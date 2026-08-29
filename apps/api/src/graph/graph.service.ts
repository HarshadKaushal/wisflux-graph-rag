import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type {
  ExtractedEntity,
  ExtractedRelationship,
} from '../extraction/extraction.service';
import { Neo4jService } from '../database/neo4j.module';

export interface GraphEntityNode {
  id: string;
  name: string;
  type: string;
  normalizedName: string;
}

export interface GraphRelationshipEdge {
  id: string;
  type: string;
  sourceEntityId: string;
  targetEntityId: string;
  sourceEntityName: string;
  targetEntityName: string;
  documentId: string;
  chunkId: string;
  evidence?: string;
  confidence?: number;
}

export interface GraphSubgraph {
  nodes: GraphEntityNode[];
  edges: GraphRelationshipEdge[];
}

@Injectable()
export class GraphService {
  private readonly logger = new Logger(GraphService.name);

  constructor(private readonly neo4j: Neo4jService) {}

  normalizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .replace(/\s+/g, ' ');
  }

  async clearDocumentGraph(documentId: string): Promise<void> {
    await this.neo4j.run(
      `
      MATCH (d:Document {id: $documentId})-[:HAS_CHUNK]->(c:Chunk)
      DETACH DELETE c
      `,
      { documentId },
    );
    await this.neo4j.run(
      `
      MATCH ()-[r:RELATES_TO {documentId: $documentId}]->()
      DELETE r
      `,
      { documentId },
    );
    await this.neo4j.run(
      `
      MATCH (d:Document {id: $documentId})
      DETACH DELETE d
      `,
      { documentId },
    );
  }

  async upsertDocument(documentId: string, filename: string): Promise<void> {
    await this.neo4j.run(
      `
      MERGE (d:Document {id: $documentId})
      SET d.filename = $filename, d.updatedAt = datetime()
      `,
      { documentId, filename },
    );
  }

  async upsertChunk(
    chunkId: string,
    documentId: string,
    chunkIndex: number,
    preview: string,
    pageNumber?: number,
  ): Promise<void> {
    await this.neo4j.run(
      `
      MATCH (d:Document {id: $documentId})
      MERGE (c:Chunk {id: $chunkId})
      SET c.documentId = $documentId,
          c.chunkIndex = $chunkIndex,
          c.preview = $preview,
          c.pageNumber = $pageNumber
      MERGE (d)-[:HAS_CHUNK]->(c)
      `,
      { chunkId, documentId, chunkIndex, preview, pageNumber: pageNumber ?? null },
    );
  }

  async upsertEntityMention(
    entity: ExtractedEntity,
    chunkId: string,
    documentId: string,
  ): Promise<string> {
    const normalizedName = this.normalizeName(entity.name);
    const entityId = randomUUID();

    const records = await this.neo4j.run<{ entityId: string }>(
      `
      MERGE (e:Entity {normalizedName: $normalizedName})
      ON CREATE SET
        e.id = $entityId,
        e.name = $name,
        e.type = $type,
        e.createdAt = datetime()
      ON MATCH SET
        e.name = CASE WHEN size($name) > size(e.name) THEN $name ELSE e.name END
      WITH e
      MATCH (c:Chunk {id: $chunkId})
      MERGE (c)-[:MENTIONS]->(e)
      RETURN e.id AS entityId
      `,
      {
        normalizedName,
        entityId,
        name: entity.name,
        type: entity.type,
        chunkId,
      },
    );

    const row = records[0];
    return (row?.entityId as string) ?? entityId;
  }

  async upsertRelationship(
    relationship: ExtractedRelationship,
    chunkId: string,
    documentId: string,
    entityIdMap: Map<string, string>,
  ): Promise<void> {
    const sourceNorm = this.normalizeName(relationship.source);
    const targetNorm = this.normalizeName(relationship.target);
    const relId = randomUUID();

    const sourceId = entityIdMap.get(sourceNorm);
    const targetId = entityIdMap.get(targetNorm);
    if (!sourceId || !targetId) return;

    await this.neo4j.run(
      `
      MATCH (source:Entity {id: $sourceId})
      MATCH (target:Entity {id: $targetId})
      MERGE (source)-[r:RELATES_TO {
        documentId: $documentId,
        chunkId: $chunkId,
        type: $type,
        sourceName: $sourceName,
        targetName: $targetName
      }]->(target)
      ON CREATE SET
        r.id = $relId,
        r.evidence = $evidence,
        r.confidence = $confidence,
        r.createdAt = datetime()
      ON MATCH SET
        r.evidence = coalesce($evidence, r.evidence),
        r.confidence = coalesce($confidence, r.confidence)
      `,
      {
        sourceId,
        targetId,
        documentId,
        chunkId,
        type: relationship.type,
        sourceName: relationship.source,
        targetName: relationship.target,
        relId,
        evidence: relationship.evidence ?? null,
        confidence: relationship.confidence ?? 0.8,
      },
    );
  }

  async getEntitiesByDocument(documentId: string): Promise<GraphEntityNode[]> {
    const records = await this.neo4j.run<{
      id: string;
      name: string;
      type: string;
      normalizedName: string;
    }>(
      `
      MATCH (d:Document {id: $documentId})-[:HAS_CHUNK]->(:Chunk)-[:MENTIONS]->(e:Entity)
      RETURN DISTINCT e.id AS id, e.name AS name, e.type AS type, e.normalizedName AS normalizedName
      ORDER BY e.name
      `,
      { documentId },
    );

    return records.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      normalizedName: r.normalizedName,
    }));
  }

  async findPersonEntitiesByDocuments(
    documentIds: string[],
  ): Promise<GraphEntityNode[]> {
    if (documentIds.length === 0) return [];

    const records = await this.neo4j.run<{
      id: string;
      name: string;
      type: string;
      normalizedName: string;
    }>(
      `
      MATCH (d:Document)-[:HAS_CHUNK]->(:Chunk)-[:MENTIONS]->(e:Entity)
      WHERE d.id IN $documentIds AND e.type = 'Person'
      RETURN DISTINCT e.id AS id, e.name AS name, e.type AS type, e.normalizedName AS normalizedName
      ORDER BY e.name
      `,
      { documentIds },
    );

    return records.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      normalizedName: r.normalizedName,
    }));
  }

  async getDocumentSubgraph(documentId: string): Promise<GraphSubgraph> {
    const nodes = await this.getEntitiesByDocument(documentId);

    const edgeRecords = await this.neo4j.run<{
      id: string;
      type: string;
      sourceEntityId: string;
      targetEntityId: string;
      sourceEntityName: string;
      targetEntityName: string;
      chunkId: string;
      evidence: string | null;
      confidence: number | null;
    }>(
      `
      MATCH (d:Document {id: $documentId})-[:HAS_CHUNK]->(:Chunk)-[:MENTIONS]->(source:Entity)
      MATCH (source)-[r:RELATES_TO {documentId: $documentId}]->(target:Entity)
      RETURN
        r.id AS id,
        r.type AS type,
        source.id AS sourceEntityId,
        target.id AS targetEntityId,
        coalesce(r.sourceName, source.name) AS sourceEntityName,
        coalesce(r.targetName, target.name) AS targetEntityName,
        r.chunkId AS chunkId,
        r.evidence AS evidence,
        r.confidence AS confidence
      `,
      { documentId },
    );

    const edges: GraphRelationshipEdge[] = edgeRecords.map((r) => ({
      id: r.id,
      type: r.type,
      sourceEntityId: r.sourceEntityId,
      targetEntityId: r.targetEntityId,
      sourceEntityName: r.sourceEntityName,
      targetEntityName: r.targetEntityName,
      documentId,
      chunkId: r.chunkId,
      evidence: r.evidence ?? undefined,
      confidence: r.confidence ?? undefined,
    }));

    return { nodes, edges };
  }

  async countEntitiesForDocument(documentId: string): Promise<number> {
    const records = await this.neo4j.run<{ count: number }>(
      `
      MATCH (d:Document {id: $documentId})-[:HAS_CHUNK]->(:Chunk)-[:MENTIONS]->(e:Entity)
      RETURN count(DISTINCT e) AS count
      `,
      { documentId },
    );
    return Number(records[0]?.count ?? 0);
  }

  async findEntitiesByNames(
    normalizedNames: string[],
    documentIds?: string[],
  ): Promise<GraphEntityNode[]> {
    if (normalizedNames.length === 0) return [];

    const hasDocFilter = documentIds && documentIds.length > 0;

    const records = await this.neo4j.run<{
      id: string;
      name: string;
      type: string;
      normalizedName: string;
    }>(
      hasDocFilter
        ? `
      MATCH (d:Document)-[:HAS_CHUNK]->(:Chunk)-[:MENTIONS]->(e:Entity)
      WHERE d.id IN $documentIds
        AND (
          e.normalizedName IN $normalizedNames
          OR any(n IN $normalizedNames WHERE e.normalizedName CONTAINS n OR n CONTAINS e.normalizedName)
        )
      RETURN DISTINCT e.id AS id, e.name AS name, e.type AS type, e.normalizedName AS normalizedName
      ORDER BY e.name
      `
        : `
      MATCH (e:Entity)
      WHERE e.normalizedName IN $normalizedNames
         OR any(n IN $normalizedNames WHERE e.normalizedName CONTAINS n OR n CONTAINS e.normalizedName)
      RETURN DISTINCT e.id AS id, e.name AS name, e.type AS type, e.normalizedName AS normalizedName
      ORDER BY e.name
      `,
      { normalizedNames, documentIds: documentIds ?? [] },
    );

    return records.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      normalizedName: r.normalizedName,
    }));
  }

  async findEntitiesInQueryText(
    query: string,
    documentIds?: string[],
  ): Promise<GraphEntityNode[]> {
    const normalizedQuery = this.normalizeName(query);
    if (!normalizedQuery) return [];

    const hasDocFilter = documentIds && documentIds.length > 0;

    const records = await this.neo4j.run<{
      id: string;
      name: string;
      type: string;
      normalizedName: string;
    }>(
      hasDocFilter
        ? `
      MATCH (d:Document)-[:HAS_CHUNK]->(:Chunk)-[:MENTIONS]->(e:Entity)
      WHERE d.id IN $documentIds
      RETURN DISTINCT e.id AS id, e.name AS name, e.type AS type, e.normalizedName AS normalizedName
      ORDER BY e.name
      `
        : `
      MATCH (e:Entity)
      RETURN DISTINCT e.id AS id, e.name AS name, e.type AS type, e.normalizedName AS normalizedName
      ORDER BY e.name
      `,
      { documentIds: documentIds ?? [] },
    );

    return records
      .filter(
        (e) =>
          normalizedQuery.includes(e.normalizedName) ||
          e.normalizedName
            .split(' ')
            .filter((w) => w.length > 3)
            .some((w) => normalizedQuery.includes(w)),
      )
      .map((r) => ({
        id: r.id,
        name: r.name,
        type: r.type,
        normalizedName: r.normalizedName,
      }));
  }

  async traverseFromEntities(
    entityIds: string[],
    hops: number,
    documentIds?: string[],
    minConfidence = 0.5,
  ): Promise<GraphSubgraph> {
    if (entityIds.length === 0) return { nodes: [], edges: [] };

    const edgeRecords = await this.neo4j.run<{
      id: string;
      type: string;
      sourceEntityId: string;
      targetEntityId: string;
      sourceEntityName: string;
      targetEntityName: string;
      documentId: string;
      chunkId: string;
      evidence: string | null;
      confidence: number | null;
    }>(
      `
      MATCH (start:Entity)
      WHERE start.id IN $entityIds
      MATCH (a:Entity)-[rel:RELATES_TO]-(b:Entity)
      WHERE (a.id = start.id OR b.id = start.id)
        AND coalesce(rel.confidence, 1.0) >= $minConfidence
        AND (size($documentIds) = 0 OR rel.documentId IN $documentIds)
      WITH DISTINCT rel, startNode(rel) AS source, endNode(rel) AS target
      RETURN
        rel.id AS id,
        rel.type AS type,
        source.id AS sourceEntityId,
        target.id AS targetEntityId,
        coalesce(rel.sourceName, source.name) AS sourceEntityName,
        coalesce(rel.targetName, target.name) AS targetEntityName,
        rel.documentId AS documentId,
        rel.chunkId AS chunkId,
        rel.evidence AS evidence,
        rel.confidence AS confidence
      `,
      {
        entityIds,
        documentIds: documentIds ?? [],
        minConfidence,
      },
    );

    let allEdges = edgeRecords;

    if (hops >= 2) {
      const neighborIds = new Set<string>();
      for (const r of edgeRecords) {
        if (entityIds.includes(r.sourceEntityId)) neighborIds.add(r.targetEntityId);
        if (entityIds.includes(r.targetEntityId)) neighborIds.add(r.sourceEntityId);
      }

      const secondHopIds = [...neighborIds].filter((id) => !entityIds.includes(id));
      if (secondHopIds.length > 0) {
        const secondHopRecords = await this.neo4j.run<typeof edgeRecords[0]>(
          `
          MATCH (start:Entity)
          WHERE start.id IN $secondHopIds
          MATCH (a:Entity)-[rel:RELATES_TO]-(b:Entity)
          WHERE (a.id = start.id OR b.id = start.id)
            AND coalesce(rel.confidence, 1.0) >= $minConfidence
            AND (size($documentIds) = 0 OR rel.documentId IN $documentIds)
          WITH DISTINCT rel, startNode(rel) AS source, endNode(rel) AS target
          RETURN
            rel.id AS id,
            rel.type AS type,
            source.id AS sourceEntityId,
            target.id AS targetEntityId,
            coalesce(rel.sourceName, source.name) AS sourceEntityName,
            coalesce(rel.targetName, target.name) AS targetEntityName,
            rel.documentId AS documentId,
            rel.chunkId AS chunkId,
            rel.evidence AS evidence,
            rel.confidence AS confidence
          `,
          {
            secondHopIds,
            documentIds: documentIds ?? [],
            minConfidence,
          },
        );
        allEdges = [...edgeRecords, ...secondHopRecords];
      }
    }

    const edgeMap = new Map<string, GraphRelationshipEdge>();
    for (const r of allEdges) {
      if (!edgeMap.has(r.id)) {
        edgeMap.set(r.id, {
          id: r.id,
          type: r.type,
          sourceEntityId: r.sourceEntityId,
          targetEntityId: r.targetEntityId,
          sourceEntityName: r.sourceEntityName,
          targetEntityName: r.targetEntityName,
          documentId: r.documentId,
          chunkId: r.chunkId,
          evidence: r.evidence ?? undefined,
          confidence: r.confidence ?? undefined,
        });
      }
    }

    const edges = [...edgeMap.values()];

    const nodeIds = new Set<string>(entityIds);
    for (const e of edges) {
      nodeIds.add(e.sourceEntityId);
      nodeIds.add(e.targetEntityId);
    }

    const nodeRecords = await this.neo4j.run<{
      id: string;
      name: string;
      type: string;
      normalizedName: string;
    }>(
      `
      MATCH (e:Entity)
      WHERE e.id IN $nodeIds
      RETURN e.id AS id, e.name AS name, e.type AS type, e.normalizedName AS normalizedName
      `,
      { nodeIds: [...nodeIds] },
    );

    const nodes = nodeRecords.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      normalizedName: r.normalizedName,
    }));

    return { nodes, edges };
  }
}
