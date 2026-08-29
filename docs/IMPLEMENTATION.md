# Implementation Documentation

> Updated incrementally after each phase milestone.

## Approach

MVP-first, backend-before-frontend. Each vertical slice is completed and manually tested before moving to the next. AI (Cursor) assists implementation; all decisions are documented in `docs/ai-reviews/`.

## Architecture Overview

```
Upload → Parse/Chunk → [Extract Entities → Neo4j]
                     → [Embed Chunks → pgvector]
Query → Entity Extract → Graph Traverse → Hybrid Merge → LLM Stream → UI
```

## Milestones

| Phase | Date | Status | Notes |
|-------|------|--------|-------|
| 0 — Setup | 2026-08-28 | ✅ Complete | Monorepo, Docker compose, health check, docs scaffold |
| 1 — Backend foundation | 2026-08-28 | ✅ Complete | Typed config, pgvector init, Neo4j constraints, DocumentsModule skeleton |
| 2 — Ingestion (MVP-1) | 2026-08-28 | ✅ Complete | Upload PDF/TXT/MD → parse → chunk → status `parsed` |
| 3 — Knowledge graph (MVP-3) | 2026-08-28 | ✅ Complete | LLM entity extraction → Neo4j; graph API endpoints |
| 4 — Vector RAG (MVP-2) | 2026-08-28 | ✅ Complete | Embeddings + pgvector search + streaming chat (needs OpenAI credits) |
| 5 — Graph retrieval | 2026-08-28 | ✅ Complete | POST /search/graph — query entity extract + 1-hop traversal |
| 6 — Hybrid retrieval | 2026-08-29 | ✅ Complete | POST /retrieval/hybrid merges vector chunks + graph facts |
| 7 — Hybrid chat | 2026-08-29 | ✅ Complete | Chat uses hybrid context; cites [S*] and [G*] |
| 8 — UI | 2026-08-29 | ✅ Complete | Upload + streaming chat UI |
| 9 — Sources + graph viz | 2026-08-29 | ✅ Complete | Sources, graph facts, entities side panel |
| 10 — Polish | 2026-08-29 | ✅ Complete | Submission README, E2E demo steps, known limitations |

## Technical Decisions

### Monorepo: pnpm workspaces
**Why:** Shared types between NestJS and Next.js without publishing packages.

### Vector DB: pgvector (not Pinecone)
**Why:** Runs locally in Docker, no extra SaaS account, metadata + vectors in one DB.

### Entity extraction: LLM structured JSON (not spaCy)
**Why:** Better relationship extraction; assignment allows LLM; keeps stack TypeScript-only.

### Streaming: SSE (not WebSockets)
**Why:** One-way token stream is simpler; works with POST for chat body.

## Challenges & Trade-offs

### Phase 3 — Graph DI fix
`GraphBuilderService` injects `ChunkEntity` repository but `GraphModule` initially only registered `DocumentEntity`. Fixed by adding `ChunkEntity` to `TypeOrmModule.forFeature`.

### Ingestion pipeline order
Pipeline is now: `parsing → embedding → extracting → completed`. Graph extraction runs after embeddings so chunks exist in both Postgres and Neo4j.

### Phase 5 — Query entity fallback
LLM query extraction sometimes misses entities in natural-language questions. Added text-based fallback: match graph entity names contained in the normalized query string.

### Phase 6 — TypeORM wiped embeddings
`synchronize: true` dropped the pgvector `embedding` column every boot (not on the TypeORM entity). Fixed by setting `synchronize: false` and creating tables/columns in `DatabaseInitService`. Re-embed existing docs after upgrade via `POST /documents/:id/embed`.

### Phase 10 — Submission packaging
README updated with completed MVP status, API table, UI routes, PowerShell smoke tests, and known limitations. Optional enhancements (Redis, re-ranking, deep multi-hop, query expansion, interactive graph viz) remain deferred by design.

### Optional — Multi-hop (2 hops)
Default traversal is now 2 hops. Chat UI has a hops toggle. Path summaries (`[P*]`) are built via BFS and injected into hybrid LLM context so connection questions work (e.g. Carol → Acme → Beta Labs).

### Optional — Query expansion
Before hybrid retrieval, an LLM rewrites vague questions (e.g. "who started acme?" → "Who were the founders of Acme Corporation?") and supplies short alternatives. Vector search uses rewritten (+ original merge); graph search uses rewritten + alternatives for entity matching. Toggleable in chat UI.

## Future Work — Scale

- Async job queue (Bull + Redis) for ingestion
- Batch embedding with rate-limit handling
- HNSW index tuning on pgvector
- Neo4j read replicas for graph queries
- S3 for file storage

## Future Work — Accuracy

- Re-ranking retrieved chunks (cross-encoder or LLM)
- Hybrid score weighting (graph vs vector)
- Query expansion
- Entity deduplication / fuzzy matching
- Chunk size tuning per document type
