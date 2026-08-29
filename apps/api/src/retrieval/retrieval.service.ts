import { Injectable, Logger } from '@nestjs/common';
import type {
  EntityRecord,
  GraphFactCitation,
  GraphPath,
  HybridRetrievalResponse,
  QueryExpansion,
  RerankMeta,
  SourceCitation,
  VectorSearchResult,
} from '@graph-rag/shared';
import { CacheService } from '../cache/cache.service';
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
    private readonly cache: CacheService,
  ) {}

  async hybrid(
    query: string,
    options: {
      documentIds?: string[];
      topK?: number;
      hops?: number;
      minConfidence?: number;
      expandQuery?: boolean;
      rerank?: boolean;
    } = {},
  ): Promise<HybridRetrievalResponse> {
    const topK = options.topK ?? 5;
    const hops = options.hops ?? 2;
    const minConfidence = options.minConfidence ?? 0.5;
    const shouldExpand = options.expandQuery !== false;
    const shouldRerank = options.rerank !== false;

    const cachePayload = {
      query: query.trim(),
      documentIds: [...(options.documentIds ?? [])].sort(),
      topK,
      hops,
      minConfidence,
      expandQuery: shouldExpand,
      rerank: shouldRerank,
    };
    const cacheKey = this.cache.hybridKey(cachePayload);
    const cached = await this.cache.getJson<HybridRetrievalResponse>(cacheKey);
    if (cached) {
      this.logger.debug(`Hybrid cache hit for "${query.trim().slice(0, 60)}"`);
      return {
        ...cached,
        cache: {
          redis: this.cache.isReady(),
          hybridHit: true,
        },
      };
    }

    const result = await this.hybridUncached(query, {
      documentIds: options.documentIds,
      topK,
      hops,
      minConfidence,
      expandQuery: shouldExpand,
      rerank: shouldRerank,
    });

    const toStore: HybridRetrievalResponse = {
      ...result,
      cache: undefined,
    };
    await this.cache.setJson(
      cacheKey,
      toStore,
      this.cache.getResponseTtl(),
    );

    return {
      ...result,
      cache: {
        redis: this.cache.isReady(),
        hybridHit: false,
      },
    };
  }

  private async hybridUncached(
    query: string,
    options: {
      documentIds?: string[];
      topK: number;
      hops: number;
      minConfidence: number;
      expandQuery: boolean;
      rerank: boolean;
    },
  ): Promise<HybridRetrievalResponse> {
    const { topK, hops, minConfidence } = options;
    const shouldExpand = options.expandQuery;
    const shouldRerank = options.rerank;
    // Pull a wider pool when re-ranking so the LLM can promote buried hits.
    const vectorPool = shouldRerank
      ? Math.min(Math.max(topK * 2, topK + 3), 12)
      : topK;

    let expansion: QueryExpansion | undefined;
    let retrievalQuery = query.trim();

    if (shouldExpand && retrievalQuery) {
      const expanded = await this.extraction.expandQuery(retrievalQuery);
      expansion = expanded;
      retrievalQuery = expanded.rewritten || retrievalQuery;
    }

    // Keep the original wording so first-person cues ("I/me/my") survive rewrite
    // and resume Person seeding still runs in graph search.
    const graphQuery = expansion
      ? [expansion.original, expansion.rewritten, ...expansion.alternatives]
          .filter(Boolean)
          .join(' ')
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
          this.vectorService.search(q, vectorPool, options.documentIds),
        ),
      ),
      this.graphSearch.search(
        graphQuery,
        options.documentIds,
        hops,
        minConfidence,
      ),
    ]);

    const vectorResults = this.mergeVectorResults(vectorBatches, vectorPool);

    let sources: SourceCitation[] = vectorResults.map((r, i) => ({
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
    let graphFacts: GraphFactCitation[] = [];

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

    let rerank: RerankMeta | undefined;

    if (shouldRerank && (sources.length > 1 || graphFacts.length > 1)) {
      const ranked = await this.applyRerank(
        retrievalQuery,
        sources,
        graphFacts,
        topK,
      );
      sources = ranked.sources;
      graphFacts = ranked.graphFacts;
      rerank = ranked.meta;
    } else {
      sources = sources.slice(0, topK).map((s, i) => ({ ...s, id: `S${i + 1}` }));
      graphFacts = graphFacts.map((f, i) => ({ ...f, id: `G${i + 1}` }));
      if (shouldRerank) {
        rerank = {
          applied: false,
          sourcesBefore: sources.map((s) => this.sourceLabel(s)),
          sourcesAfter: sources.map((s) => this.sourceLabel(s)),
          factsBefore: graphFacts.map((f) => this.factLabel(f)),
          factsAfter: graphFacts.map((f) => this.factLabel(f)),
        };
      }
    }

    const graphPaths: GraphPath[] = graphResults.graphPaths.map((path) => ({
      ...path,
    }));

    const entities: EntityRecord[] = graphResults.entities;
    const context = this.buildHybridContext(sources, graphFacts, graphPaths);

    this.logger.debug(
      `Hybrid: ${sources.length} chunks, ${graphFacts.length} graph facts, ${graphPaths.length} paths (hops=${hops})${expansion ? ` expanded="${expansion.rewritten}"` : ''}${rerank?.applied ? ' reranked' : ''}`,
    );

    return {
      sources,
      graphFacts,
      graphPaths,
      entities,
      context,
      expansion,
      rerank,
    };
  }

  private async applyRerank(
    query: string,
    sources: SourceCitation[],
    graphFacts: GraphFactCitation[],
    topK: number,
  ): Promise<{
    sources: SourceCitation[];
    graphFacts: GraphFactCitation[];
    meta: RerankMeta;
  }> {
    const sourceTemps = sources.map((s, i) => ({
      tempId: `C${i + 1}`,
      source: s,
      text: `${s.filename ? `(${s.filename}) ` : ''}${s.content}`,
    }));
    const factTemps = graphFacts.map((f, i) => ({
      tempId: `F${i + 1}`,
      fact: f,
      text: `${f.sourceEntityName} -[${f.type}]-> ${f.targetEntityName}${f.evidence ? ` — ${f.evidence}` : ''}`,
    }));

    const sourcesBefore = sourceTemps.map((s) => this.sourceLabel(s.source));
    const factsBefore = factTemps.map((f) => this.factLabel(f.fact));

    const order = await this.extraction.rerankCandidates(
      query,
      sourceTemps.map((s) => ({ id: s.tempId, text: s.text })),
      factTemps.map((f) => ({ id: f.tempId, text: f.text })),
    );

    const sourceByTemp = new Map(sourceTemps.map((s) => [s.tempId, s.source]));
    const factByTemp = new Map(factTemps.map((f) => [f.tempId, f.fact]));

    const orderedSources = order.sourceIds
      .map((id) => sourceByTemp.get(id))
      .filter((s): s is SourceCitation => Boolean(s))
      .slice(0, topK)
      .map((s, i) => ({ ...s, id: `S${i + 1}` }));

    const orderedFacts = order.factIds
      .map((id) => factByTemp.get(id))
      .filter((f): f is GraphFactCitation => Boolean(f))
      .map((f, i) => ({ ...f, id: `G${i + 1}` }));

    return {
      sources: orderedSources,
      graphFacts: orderedFacts,
      meta: {
        applied: true,
        sourcesBefore,
        sourcesAfter: orderedSources.map((s) => this.sourceLabel(s)),
        factsBefore,
        factsAfter: orderedFacts.map((f) => this.factLabel(f)),
      },
    };
  }

  private sourceLabel(s: SourceCitation): string {
    const body = s.content.replace(/\s+/g, ' ').trim();
    const preview = body.length > 72 ? `${body.slice(0, 70)}…` : body;
    return preview || s.chunkId.slice(0, 8);
  }

  private factLabel(f: GraphFactCitation): string {
    return `${f.sourceEntityName} -[${f.type}]-> ${f.targetEntityName}`;
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
