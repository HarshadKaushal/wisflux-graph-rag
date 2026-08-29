# Graph RAG

Hybrid **Graph RAG** system for the Wisflux assignment: document ingestion, Neo4j knowledge graph, pgvector semantic search, hybrid retrieval, and grounded streaming chat with `[S*]` chunk citations and `[G*]` graph-fact citations.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, React 19, TypeScript |
| Backend | NestJS 11, TypeScript |
| Graph DB | Neo4j 5 |
| Vector DB | PostgreSQL 16 + pgvector |
| LLM | OpenAI (`gpt-4o-mini` + `text-embedding-3-small`) |
| Monorepo | pnpm workspaces |

## Prerequisites

- Node.js 20+
- Docker Desktop (Neo4j + Postgres) — **must be running before starting the API**
- OpenAI API key with available credits
- pnpm optional — use `npx pnpm@9` if not installed globally

> **Windows note:** If the project lives in OneDrive, prefer `npx pnpm@9 install` over npm. OneDrive can interfere with symlinks.

## Quick Start

### 1. Install

```bash
npx pnpm@9 install
```

### 2. Environment

```bash
cp .env.example .env
# Edit .env — set OPENAI_API_KEY at minimum
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

### 3. Start databases

Start Docker Desktop, then:

```bash
docker compose up -d
docker compose ps
```

### 4. Build shared types

```bash
npx pnpm@9 run build:shared
```

### 5. Run API + Web

```bash
# Terminal 1 — API (http://localhost:3001)
npx pnpm@9 run dev:api

# Terminal 2 — Web (http://localhost:3000)
npx pnpm@9 run dev:web
```

### 6. Verify

```bash
curl http://localhost:3001/api/v1/health
```

Open http://localhost:3000 — health dashboard should show postgres, neo4j, and openai as up.

## End-to-end demo

1. Open http://localhost:3000/upload
2. Upload `samples/acme-company.md`
3. Wait until status is **`completed`** (chunks + entities populated)
4. Open http://localhost:3000/chat
5. Select the document and ask:
   - *Who leads development of the GraphRAG Engine?*
   - *Who founded Acme Corporation?*
6. Confirm the answer cites `[G*]` / `[S*]`, and the side panel shows sources + graph facts

### curl / PowerShell smoke tests

```powershell
# Upload
curl.exe -F "file=@samples/acme-company.md" http://localhost:3001/api/v1/documents/upload

# Poll status (replace <docId>)
Invoke-RestMethod "http://localhost:3001/api/v1/documents/<docId>/status"

# Hybrid retrieval
$body = @{ query = "Who leads development of the GraphRAG Engine?"; documentIds = @("<docId>") } | ConvertTo-Json
Invoke-RestMethod -Method POST -Uri "http://localhost:3001/api/v1/retrieval/hybrid" -ContentType "application/json" -Body $body

# Hybrid chat
$body = @{ message = "Who leads development of the GraphRAG Engine?"; documentIds = @("<docId>") } | ConvertTo-Json
Invoke-RestMethod -Method POST -Uri "http://localhost:3001/api/v1/chat" -ContentType "application/json" -Body $body
```

## Architecture

```
Upload → Parse/Chunk → Embed (pgvector) → Extract entities (Neo4j)
Query  → Entity match → Graph traverse → Vector search → Hybrid merge → LLM stream → UI
```

Ingestion status flow: `pending → parsing → embedding → extracting → completed` (or `failed`).

## API endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/health` | Service health |
| POST | `/api/v1/documents/upload` | Upload PDF / TXT / MD |
| GET | `/api/v1/documents` | List documents |
| GET | `/api/v1/documents/:id` | Document + chunks |
| GET | `/api/v1/documents/:id/status` | Ingestion status |
| POST | `/api/v1/documents/:id/embed` | Re-embed chunks |
| POST | `/api/v1/documents/:id/extract-graph` | Re-run graph extraction |
| GET | `/api/v1/graph/entities?documentId=` | Entities for a document |
| GET | `/api/v1/graph/document/:id/subgraph` | Document subgraph |
| POST | `/api/v1/search/vector` | Semantic chunk search |
| POST | `/api/v1/search/graph` | Query → entity match → traversal |
| POST | `/api/v1/retrieval/hybrid` | Merge vector + graph context |
| POST | `/api/v1/chat` | Hybrid grounded answer |
| POST | `/api/v1/chat/stream` | SSE streaming hybrid chat |

## UI routes

| Route | Purpose |
|-------|---------|
| `/` | Home + API health |
| `/upload` | Upload + document status list |
| `/chat` | Streaming chat + sources / graph facts / entities |

## Project structure

```
├── apps/
│   ├── api/          NestJS backend
│   └── web/          Next.js frontend
├── packages/
│   └── shared/       Shared TypeScript types / DTOs
├── docs/             Implementation & process documentation
├── samples/          Test documents (acme-company.md)
├── docker-compose.yml
└── .env.example
```

## Documentation

| File | Description |
|------|-------------|
| [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md) | Milestones, decisions, trade-offs |
| [docs/FEATURES.md](docs/FEATURES.md) | Feature status tracker |
| [docs/DESIGN_PHILOSOPHY.md](docs/DESIGN_PHILOSOPHY.md) | Engineering approach |
| [docs/DOMAIN_NOTES.md](docs/DOMAIN_NOTES.md) | Entity / relationship rules |
| [docs/ai-reviews/](docs/ai-reviews/) | AI-assisted development log |

## MVP milestones

| Slice | Status | Description |
|-------|--------|-------------|
| MVP-1 | ✅ Complete | Document ingestion (upload → parse → chunk) |
| MVP-2 | ✅ Complete | Vector RAG (embeddings + streaming chat) |
| MVP-3 | ✅ Complete | Knowledge graph (Neo4j entity extraction) |
| MVP-4 | ✅ Complete | Hybrid retrieval + UI with sources / graph facts |

## Known limitations

- Graph traversal defaults to **2 hops** (UI toggle for 1 or 2); deeper multi-hop (>2) is deferred
- Relationship direction from LLM extraction can occasionally be inverted (e.g. `FOUNDED`)
- No Redis caching or re-ranking (optional enhancements)
- Graph UI shows facts, entities, path summaries (`P*`), and query expansion; not an interactive canvas
- Query expansion is on by default (`expandQuery: false` to disable)
- TypeORM `synchronize` is **off**; schema + `embedding` column are managed by `DatabaseInitService`. If vector search returns empty after a schema change, call `POST /documents/:id/embed`

## Neo4j Browser

Open http://localhost:7474 — login `neo4j` / `graphrag123`

Example Cypher:

```cypher
MATCH (e:Entity)-[r:RELATES_TO]->(t:Entity)
RETURN e, r, t LIMIT 50
```

## License

Private — assignment submission.
