# Feature Status

> Honest tracker updated after each MVP slice completes or stalls.

## Legend

- ✅ Completed — works end-to-end, manually verified
- 🔄 In progress — actively being built
- ⏳ Pending — not started
- ⚠️ Partial — started but not fully working

---

## MVP Slices

| Feature | Status | Notes |
|---------|--------|-------|
| **MVP-1: Document Ingestion** | ✅ Completed | Upload → parse → chunk; full pipeline to `completed` |
| **MVP-2: Semantic RAG** | ✅ Completed | Embeddings + vector search + chat (needs OpenAI credits) |
| **MVP-3: Knowledge Graph** | ✅ Completed | LLM extraction → Neo4j with provenance |
| **MVP-4: Full Graph RAG** | ✅ Completed | Hybrid retrieval + chat UI with [S*]/[G*] sources |

---

## Infrastructure

| Feature | Status | Notes |
|---------|--------|-------|
| Monorepo scaffold | ✅ Completed | pnpm workspaces, apps/api, apps/web, packages/shared |
| Docker (Neo4j + Postgres/pgvector) | ✅ Completed | docker-compose.yml |
| Typed config + env validation | ✅ Completed | Phase 1 — registerAs namespaces |
| pgvector extension init | ✅ Completed | Phase 1 — on API boot |
| Neo4j constraints/indexes | ✅ Completed | Phase 1 — Entity, Document, Chunk |
| Health check API | ✅ Completed | GET /api/v1/health |
| Documents module skeleton | ✅ Completed | Phase 1 — GET /documents, GET /documents/:id |
| Next.js shell + health display | ✅ Completed | Homepage shows API health |

---

## API Endpoints

| Endpoint | Status | Notes |
|----------|--------|-------|
| `GET /health` | ✅ Completed | All services up |
| `GET /documents` | ✅ Completed | Phase 1 — returns empty list until upload |
| `GET /documents/:id` | ✅ Completed | Phase 1 — 404 if not found |
| `POST /documents/upload` | ✅ Completed | Phase 2 — PDF, TXT, MD |
| `GET /documents/:id/status` | ✅ Completed | Phase 2 — poll ingestion progress |
| `GET /documents/:id` | ✅ Completed | Phase 2 — includes chunks |
| `POST /search/vector` | ✅ Completed | Phase 4 |
| `POST /chat` | ✅ Completed | Phase 7 — hybrid (vector + graph) |
| `POST /chat/stream` | ✅ Completed | Phase 7 — SSE with graphFacts metadata |
| `POST /documents/:id/embed` | ✅ Completed | Phase 4 — re-embed retry |
| `GET /graph/entities?documentId=` | ✅ Completed | Phase 3 — list entities for a document |
| `GET /graph/document/:id/subgraph` | ✅ Completed | Phase 3 — nodes + edges with provenance |
| `POST /documents/:id/extract-graph` | ✅ Completed | Phase 3 — manual re-extract trigger |
| `POST /search/graph` | ✅ Completed | Phase 5 — query entity extract + graph traversal |
| `POST /retrieval/hybrid` | ✅ Completed | Phase 6 — merge vector chunks + graph facts |

---

## UI

| Feature | Status | Notes |
|---------|--------|-------|
| Health dashboard | ✅ Completed | Phase 0 — shows API connectivity |
| File upload page | ✅ Completed | Phase 8 — upload + status polling |
| Chat interface | ✅ Completed | Phase 8 — SSE streaming chat; viewport shell + tabs |
| Sources panel | ✅ Completed | Phase 9 — chunk citations [S*] |
| Graph path display | ✅ Completed | Phase 9 — graph facts [G*] + entities |
| Interactive path canvas | ✅ Completed | Optional — `/graph` page + chat Paths tab |

---

## Optional (deferred)

| Feature | Status |
|---------|--------|
| Redis caching | ✅ Completed | Embeddings + hybrid + chat response cache; fail-open if Redis down |
| Re-ranking | ✅ Completed | LLM reorders chunks + graph facts after hybrid retrieval |
| Multi-hop traversal (2 hops) | ✅ Completed | Default hops=2; UI toggle; path summaries [P*] |
| Query expansion | ✅ Completed | LLM rewrite + alternatives before hybrid retrieval |
| Interactive graph visualization | ✅ Completed | SVG path canvas on chat; click path highlight, drag nodes, edge evidence |
