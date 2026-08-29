import { Injectable, Logger } from '@nestjs/common';
import type {
  EntityRecord,
  GraphPath,
  GraphSearchResponse,
  RelationshipRecord,
} from '@graph-rag/shared';
import { ExtractionService } from '../extraction/extraction.service';
import { GraphService } from './graph.service';

@Injectable()
export class GraphSearchService {
  private readonly logger = new Logger(GraphSearchService.name);

  constructor(
    private readonly extraction: ExtractionService,
    private readonly graph: GraphService,
  ) {}

  async search(
    query: string,
    documentIds?: string[],
    hops = 2,
    minConfidence = 0.5,
  ): Promise<GraphSearchResponse> {
    const maxHops = Math.min(Math.max(hops, 1), 2);
    const extraction = await this.extraction.extractFromQuery(query);
    const normalizedNames = extraction.entities.map((e) =>
      this.graph.normalizeName(e.name),
    );

    this.logger.debug(
      `Query entities: ${extraction.entities.map((e) => e.name).join(', ') || '(none)'} (hops=${maxHops})`,
    );

    let matched = await this.graph.findEntitiesByNames(
      normalizedNames,
      documentIds,
    );

    if (matched.length === 0) {
      matched = await this.graph.findEntitiesInQueryText(query, documentIds);
    }

    // Resume / first-person questions ("my internship", "where did I study")
    // often omit the person's name — seed from Person entities in scoped docs.
    if (
      documentIds &&
      documentIds.length > 0 &&
      this.isFirstPersonQuery(query)
    ) {
      const persons = await this.graph.findPersonEntitiesByDocuments(
        documentIds,
      );
      const byId = new Map(matched.map((m) => [m.id, m]));
      for (const p of persons) {
        byId.set(p.id, p);
      }
      matched = [...byId.values()];
      this.logger.debug(
        `First-person seed: added ${persons.length} Person entit(y/ies)`,
      );
    }

    if (matched.length === 0) {
      return {
        queryEntities: [],
        entities: [],
        relationships: [],
        graphPaths: [],
      };
    }

    const matchedIds = matched.map((e) => e.id);
    const subgraph = await this.graph.traverseFromEntities(
      matchedIds,
      maxHops,
      documentIds,
      minConfidence,
    );

    const queryEntities: EntityRecord[] = matched.map((e) => ({
      id: e.id,
      name: e.name,
      type: e.type,
      normalizedName: e.normalizedName,
      documentIds: documentIds ?? [],
      chunkIds: [],
    }));

    const entities: EntityRecord[] = subgraph.nodes.map((n) => ({
      id: n.id,
      name: n.name,
      type: n.type,
      normalizedName: n.normalizedName,
      documentIds: documentIds ?? [],
      chunkIds: [],
    }));

    const relationships: RelationshipRecord[] = subgraph.edges.map((e) => ({
      id: e.id,
      type: e.type,
      sourceEntityId: e.sourceEntityId,
      targetEntityId: e.targetEntityId,
      sourceEntityName: e.sourceEntityName,
      targetEntityName: e.targetEntityName,
      documentId: e.documentId,
      chunkId: e.chunkId,
      evidence: e.evidence,
      confidence: e.confidence,
    }));

    const graphPaths = this.buildGraphPaths(matched, relationships, maxHops);

    return { queryEntities, entities, relationships, graphPaths };
  }

  /**
   * Build per-start-entity paths using BFS up to `hops`.
   * Emits one summary path per discovered chain (1-hop and 2-hop).
   */
  private buildGraphPaths(
    matched: { id: string; name: string }[],
    relationships: RelationshipRecord[],
    hops: number,
  ): GraphPath[] {
    const nameById = new Map<string, string>();
    for (const start of matched) {
      nameById.set(start.id, start.name);
    }
    for (const rel of relationships) {
      nameById.set(rel.sourceEntityId, rel.sourceEntityName);
      nameById.set(rel.targetEntityId, rel.targetEntityName);
    }

    const adjacency = new Map<
      string,
      Array<{ neighborId: string; rel: RelationshipRecord }>
    >();

    for (const rel of relationships) {
      const add = (fromId: string, toId: string, r: RelationshipRecord) => {
        const list = adjacency.get(fromId) ?? [];
        list.push({ neighborId: toId, rel: r });
        adjacency.set(fromId, list);
      };
      add(rel.sourceEntityId, rel.targetEntityId, rel);
      add(rel.targetEntityId, rel.sourceEntityId, rel);
    }

    const paths: GraphPath[] = [];
    let pathIndex = 1;
    const seenSummaries = new Set<string>();
    const MAX_PATHS = 40;

    for (const start of matched) {
      if (paths.length >= MAX_PATHS) break;
      type QueueItem = {
        nodeId: string;
        depth: number;
        chainRels: RelationshipRecord[];
        chainIds: string[];
      };

      const queue: QueueItem[] = [
        {
          nodeId: start.id,
          depth: 0,
          chainRels: [],
          chainIds: [start.id],
        },
      ];
      const visitedEdgeKeys = new Set<string>();

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (current.depth >= hops) continue;

        const neighbors = adjacency.get(current.nodeId) ?? [];
        for (const { neighborId, rel } of neighbors) {
          const edgeKey = `${current.nodeId}|${rel.id}|${neighborId}`;
          if (visitedEdgeKeys.has(edgeKey)) continue;
          if (
            current.chainRels.length > 0 &&
            current.chainRels[current.chainRels.length - 1].id === rel.id
          ) {
            continue;
          }
          if (current.chainIds.includes(neighborId)) continue;
          visitedEdgeKeys.add(edgeKey);

          const nextRels = [...current.chainRels, rel];
          const nextIds = [...current.chainIds, neighborId];
          const nextNames = nextIds.map(
            (id) => nameById.get(id) ?? id.slice(0, 8),
          );
          const summary = this.formatPathSummary(nextNames, nextIds, nextRels);
          if (!seenSummaries.has(summary)) {
            seenSummaries.add(summary);
            paths.push({
              id: `P${pathIndex++}`,
              startEntityId: start.id,
              startEntityName: start.name,
              hops: nextRels.length,
              entityIds: nextIds,
              relationships: nextRels,
              summary,
            });
            if (paths.length >= MAX_PATHS) break;
          }

          queue.push({
            nodeId: neighborId,
            depth: current.depth + 1,
            chainRels: nextRels,
            chainIds: nextIds,
          });
        }
        if (paths.length >= MAX_PATHS) break;
      }
    }

    return paths;
  }

  private formatPathSummary(
    names: string[],
    ids: string[],
    rels: RelationshipRecord[],
  ): string {
    let summary = names[0] ?? '';
    for (let i = 0; i < rels.length; i++) {
      const fromId = ids[i];
      const toId = ids[i + 1];
      const rel = rels[i];
      const toName = names[i + 1] ?? '?';
      if (rel.sourceEntityId === fromId && rel.targetEntityId === toId) {
        summary += ` -[${rel.type}]-> ${toName}`;
      } else if (rel.targetEntityId === fromId && rel.sourceEntityId === toId) {
        summary += ` <-[${rel.type}]- ${toName}`;
      } else {
        summary += ` -[${rel.type}]- ${toName}`;
      }
    }
    return summary;
  }

  private isFirstPersonQuery(query: string): boolean {
    return /\b(i|me|my|myself|mine)\b/i.test(query);
  }
}
