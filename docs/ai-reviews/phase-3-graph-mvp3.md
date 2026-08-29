# AI Review — phase-3-graph-mvp3

## Commit summary

- **Message:** `feat(graph): add LLM entity extraction and Neo4j knowledge graph`
- **Phase / MVP slice:** Phase 3 / MVP-3
- **Files changed:** extraction/, graph/, ingestion/, documents/, neo4j.module.ts

## AI tools used

- Cursor Agent (Phase 3 implementation + DI fix)

## Implementation decisions (human-owned)

- LLM structured JSON extraction per chunk → consistent entity/relationship schema
- Neo4j nodes: Document, Chunk, Entity; edges: RELATES_TO with provenance (documentId, chunkId, evidence, confidence)
- Entity dedup by normalizedName within document → avoids duplicate nodes
- Ingestion extended: `embedding → extracting → completed`
- `POST /documents/:id/extract-graph` → manual re-extract without re-upload
- Fixed GraphModule DI: added `ChunkEntity` to TypeOrmModule.forFeature

## Manual verification

```
POST /documents/upload (acme-company.md) → pending
GET /documents/:id/status → extracting → completed (entityCount: 8)
GET /graph/entities?documentId=... → 8 entities (Person, Organization, Product, Location)
GET /graph/document/:id/subgraph → 8 nodes, 9 edges (LEADS, WORKS_AT, DEPENDS_ON, ACQUIRED, etc.)
```

Sample extracted relationships:
- Carol Diaz → LEADS → GraphRAG Engine
- Orion Analytics Platform → DEPENDS_ON → GraphRAG Engine
- Acme Corporation → ACQUIRED → Beta Labs

## Open questions / deferred items

- Phase 5: graph traversal search API
- Phase 6: hybrid retrieval (graph + vector merge)
- Phase 7: hybrid chat with graph facts + chunk citations
