# AI Review — phase-5-graph-search

## Commit summary

- **Message:** `feat(graph): add POST /search/graph for query-driven graph traversal`
- **Phase / MVP slice:** Phase 5 / Graph retrieval
- **Files changed:** graph-search.service.ts, graph-search.controller.ts, graph.service.ts, extraction.service.ts, packages/shared

## AI tools used

- Cursor Agent (Phase 5 implementation)

## Implementation decisions (human-owned)

- Flow: LLM query entity extraction → Neo4j name match → 1-hop RELATES_TO traversal → graph paths
- Text fallback when LLM extraction misses entities (match entity names in normalized query)
- Document scope via `documentIds` filter on entity lookup and edge traversal
- `minConfidence` default 0.5 per DOMAIN_NOTES
- Graph paths labeled G1, G2… for future chat citation integration (Phase 7)
- Edge dedup by relationship id to avoid duplicates from undirected Cypher match

## Manual verification

```
POST /search/graph { "query": "Who leads development of the GraphRAG Engine?", "documentIds": ["..."] }
→ queryEntities: GraphRAG Engine
→ relationships: Carol Diaz LEADS GraphRAG Engine, Orion DEPENDS_ON GraphRAG Engine
→ graphPaths: G1 with provenance (chunkId, evidence)
```

## Open questions / deferred items

- Phase 6: hybrid retrieval (merge graph + vector)
- Phase 7: hybrid chat with [G1] graph fact citations
