# Feature Test Path

End-to-end checklist for every implemented capability. Mark each step **PASS** / **FAIL**.

Base URLs:
- API: `http://localhost:3001/api/v1`
- Web: `http://localhost:3000`
- Neo4j Browser: `http://localhost:7474` (neo4j / graphrag123)

---

## 0. Prerequisites

| # | Check | Pass? |
|---|--------|-------|
| 0.1 | `docker compose ps` → postgres, neo4j, redis **healthy** | |
| 0.2 | `pnpm dev:api` running | |
| 0.3 | `pnpm dev:web` running | |
| 0.4 | `.env` has a real `OPENAI_API_KEY` | |

---

## 1. Health & infra

| # | Test | How | Expect |
|---|------|-----|--------|
| 1.1 | API health | `GET /health` or Home page | `status: ok`; postgres, neo4j, openai, **redis** all `up` |
| 1.2 | Web shell | Open `/` | Health panel loads; Upload / Chat / Graph links work |

---

## 2. MVP-1 — Document ingestion

| # | Test | How | Expect |
|---|------|-----|--------|
| 2.1 | Upload | UI `/upload` **or** `curl.exe -F "file=@samples/acme-company.md" http://localhost:3001/api/v1/documents/upload` | Returns `documentId`, status starts `pending` |
| 2.2 | Poll status | `GET /documents/:id/status` until done | Final status **`completed`** with `chunkCount` + `entityCount` > 0 |
| 2.3 | Document detail | `GET /documents/:id` | Chunks present |

*(If already completed from earlier, reuse that doc — skip re-upload.)*

---

## 3. MVP-2 — Vector RAG

| # | Test | How | Expect |
|---|------|-----|--------|
| 3.1 | Vector search | `POST /search/vector` body `{ "query": "GraphRAG Engine", "documentIds": ["<id>"], "topK": 3 }` | Results with scores + chunk text |
| 3.2 | Chat cites chunks | Chat UI: *Who leads the GraphRAG Engine?* | Answer mentions Carol; citations `[S*]` and/or `[G*]` |

---

## 4. MVP-3 — Knowledge graph

| # | Test | How | Expect |
|---|------|-----|--------|
| 4.1 | List entities | `GET /graph/entities?documentId=<id>` | People/orgs/products (≈8 for acme) |
| 4.2 | Document subgraph | `GET /graph/document/<id>/subgraph` | Nodes + edges with provenance |
| 4.3 | Neo4j Browser (optional) | `MATCH (e:Entity)-[r:RELATES_TO]->(t) RETURN e,r,t LIMIT 25` | Graph visible |

---

## 5. MVP-4 — Hybrid retrieval + chat

| # | Test | How | Expect |
|---|------|-----|--------|
| 5.1 | Hybrid API | `POST /retrieval/hybrid` `{ "query": "Who founded Acme?", "documentIds": ["<id>"] }` | `sources`, `graphFacts`, `graphPaths`, `context` |
| 5.2 | Streaming chat | UI `/chat` ask a factual question | Tokens stream; Evidence tabs populate |
| 5.3 | Empty / out-of-scope | Ask something unrelated to the doc | “don’t have enough information” (or clearly ungrounded refusal) |

---

## 6. Optional — Multi-hop

| # | Test | How | Expect |
|---|------|-----|--------|
| 6.1 | 2-hop connection | Hops = **2**; ask *How is Carol Diaz connected to Beta Labs?* | Answer: Carol → Acme → Beta; Evidence **Paths** shows 2-hop `[P*]` |

---

## 7. Optional — Query expansion

| # | Test | How | Expect |
|---|------|-----|--------|
| 7.1 | Vague query | Expansion **On**; ask *who started acme?* | Evidence **Query** tab: rewritten + alternatives; answer names founders |

---

## 8. Optional — Path visualization

| # | Test | How | Expect |
|---|------|-----|--------|
| 8.1 | Paths tab | After a graph question, Evidence → **Paths** | Path list + link to visualize |
| 8.2 | Graph page | Open `/graph` | SVG canvas with nodes/edges; click path to highlight; drag nodes |

---

## 9. Optional — Re-ranking

| # | Test | How | Expect |
|---|------|-----|--------|
| 9.1 | Off baseline | Re-ranking **Off**; *Where is Acme Corporation located?* | Answer SF; useful fact often **not** `[G1]` (e.g. `[G5]`) |
| 9.2 | On | Re-ranking **On**; same question | Evidence **Rerank**: `LOCATED_IN` moves toward top; answer cites **`[G1]`** |

---

## 10. Optional — Redis caching

| # | Test | How | Expect |
|---|------|-----|--------|
| 10.1 | Redis up | Health `redis: up` | Already covered in 1.1 |
| 10.2 | Cache miss → hit | Ask the **same** chat question twice (same doc/hops/flags) | 2nd response faster; Evidence shows **cache hit** badge |
| 10.3 | Fail-open (optional) | Stop Redis briefly, ask a question | API still answers (no crash) |

---

## Suggested demo order (fast)

1. Health (redis up)  
2. Upload / confirm completed doc  
3. Chat: *who started acme?* (expansion)  
4. Chat: *How is Carol Diaz connected to Beta Labs?* (multi-hop + graph page)  
5. Chat: location Off then On (re-rank)  
6. Repeat last question (cache hit)  

---

## Sign-off

| Area | Result |
|------|--------|
| Infra / health | |
| Ingestion | |
| Vector + hybrid chat | |
| Multi-hop | |
| Query expansion | |
| Path viz | |
| Re-ranking | |
| Redis cache | |

**Overall:** ☐ PASS — ready to push
