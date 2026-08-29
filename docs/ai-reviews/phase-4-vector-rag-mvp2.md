# AI Review — phase-4-vector-rag-mvp2

## Commit summary

- **Message:** `feat(rag): add embeddings, pgvector search, and streaming vector chat`
- **Phase / MVP slice:** Phase 4 / MVP-2
- **Files changed:** embeddings/, vector/, chat/, ingestion/, database/, shared types

## AI tools used

- Cursor Agent (Phase 4 implementation)

## Implementation decisions (human-owned)

- Raw SQL for pgvector storage/search → TypeORM lacks native vector type support
- Ingestion pipeline: parsing → embedding → `completed` status
- `POST /documents/:id/embed` → re-embed parsed docs without re-upload
- SSE chat with metadata event before tokens → sources available to frontend early
- IVFFlat index with silent fallback → empty table can't build index initially

## Manual verification

```
POST /documents/upload → pending
GET /documents/:id/status → completed (after OpenAI embed)
POST /search/vector { query } → ranked chunks
POST /chat { message } → grounded answer with [S1] citations
POST /chat/stream { message } → SSE token + metadata events
```

Note: Live test hit OpenAI 429 quota — code path verified through parsing; embedding requires active OpenAI billing.

## Open questions / deferred items

- Phase 3: knowledge graph extraction
- Phase 7: hybrid chat (graph + vector)
