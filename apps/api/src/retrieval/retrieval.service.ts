import { Injectable, Logger } from '@nestjs/common';
import type {
  EntityRecord,
  GraphFactCitation,
  GraphPath,
  HybridRetrievalResponse,
  QueryExpansion,
  SourceCitation,
  VectorSearchResult,
} from '@graph-rag/shared';
import { ExtractionService } from '../extraction/extraction.service';
import { GraphSearchService } from '../graph/graph-search.service';
import { VectorService } from '../vector/vector.service';

@Injectable()
export class RetrievalService {
  private readonly logger = new Logger(RetrievalService.name);

  constructor(
    private readonly vectorService: VectorService,
    private readonly graphSearch: GraphSearchService,
    private readonly extraction: ExtractionService,
  ) {}

  async hybrid(
    query: string,
    options: {
      documentIds?: string[];
      topK?: number;
      hops?: number;
      minConfidence?: number;
      expandQuery?: boolean;
    } = {},
  ): Promise<HybridRetrievalResponse> {
    const topK = options.topK ?? 5;
    const hops = options.hops ?? 2;
    const minConfidence = options.minConfidence ?? 0.5;
    const shouldExpand = options.expandQuery !== false;

    let expansion: QueryExpansion | undefined;
    let retrievalQuery = query.trim();

    if (shouldExpand && retrievalQuery) {
      const expanded = await this.extraction.expandQuery(retrievalQuery);
      expansion = expanded;
      retrievalQuery = expanded.rewritten || retrievalQuery;
    }

    // Graph matching benefits from rewritten + alternate keywords in one string
    const graphQuery = expansion
      ? [expansion.rewritten, ...expansion.alternatives].filter(Boolean).join(' ')
      : retrievalQuery;

    const vectorQueries = [
      retrievalQuery,
      ...(expansion &&
      expansion.original.toLowerCase() !== retrievalQuery.toLowerCase()
        ? [expansion.original]
        : []),
    ];

    const [vectorBatches, graphResults] = await Promise.all([
      Promise.all(
        vectorQueries.map((q) =>
          this.vectorService.search(q, topK, options.documentIds),
        ),
      ),
      this.graphSearch.search(
        graphQuery,
        options.documentIds,
        hops,
        minConfidence,
      ),
    ]);

    const vectorResults = this.mergeVectorResults(vectorBatches, topK);

    const sources: SourceCitation[] = vectorResults.map((r, i) => ({
      id: `S${i + 1}`,
      chunkId: r.chunkId,
      documentId: r.documentId,
      filename: r.filename,
      content: r.content,
      pageNumber: r.pageNumber,
      sectionHeading: r.sectionHeading,
      score: r.score,
    }));

    const seenRels = new Set<string>();
    const graphFacts: GraphFactCitation[] = [];

    for (const rel of graphResults.relationships) {
      const key = `${rel.sourceEntityId}|${rel.type}|${rel.targetEntityId}|${rel.documentId}`;
      if (seenRels.has(key)) continue;
      seenRels.add(key);

      graphFacts.push({
        id: `G${graphFacts.length + 1}`,
        type: rel.type,
        sourceEntityName: rel.sourceEntityName,
        targetEntityName: rel.targetEntityName,
        evidence: rel.evidence,
        confidence: rel.confidence,
        documentId: rel.documentId,
        chunkId: rel.chunkId,
      });
    }

    const graphPaths: GraphPath[] = graphResults.graphPaths.map((path) => ({
      ...path,
    }));

    const entities: EntityRecord[] = graphResults.entities;
    const context = this.buildHybridContext(sources, graphFacts, graphPaths);

    this.logger.debug(
      `Hybrid: ${sources.length} chunks, ${graphFacts.length} graph facts, ${graphPaths.length} paths (hops=${hops})${expansion ? ` expanded="${expansion.rewritten}"` : ''}`,
    );

    return { sources, graphFacts, graphPaths, entities, context, expansion };
  }

  private mergeVectorResults(
    batches: VectorSearchResult[][],
    topK: number,
  ): VectorSearchResult[] {
    const byChunk = new Map<string, VectorSearchResult>();
    for (const batch of batches) {
      for (const row of batch) {
        const existing = byChunk.get(row.chunkId);
        if (!existing || row.score > existing.score) {
          byChunk.set(row.chunkId, row);
        }
      }
    }
    return [...byChunk.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  buildHybridContext(
    sources: SourceCitation[],
    graphFacts: GraphFactCitation[],
    graphPaths: GraphPath[] = [],
  ): string {
    const parts: string[] = [];

    if (graphPaths.length > 0) {
      const pathLines = graphPaths
        .slice(0, 20)
        .map((p) => `[${p.id}] (${p.hops}-hop) ${p.summary}`)
        .join('\n');
      parts.push(`### Graph Paths\n${pathLines}`);
    }

    if (graphFacts.length > 0) {
      const factLines = graphFacts
        .map((f) => {
          const evidence = f.evidence ? ` — "${f.evidence}"` : '';
          return `[${f.id}] ${f.sourceEntityName} -[${f.type}]-> ${f.targetEntityName}${evidence}`;
        })
        .join('\n');
      parts.push(`### Graph Facts\n${factLines}`);
    }

    if (sources.length > 0) {
      const blocks = sources
        .map(
          (s) =>
            `[${s.id}]${s.filename ? ` (from ${s.filename})` : ''}\n${s.content}`,
        )
        .join('\n\n');
      parts.push(`### Document Excerpts\n${blocks}`);
    }

    return parts.join('\n\n');
  }
}
