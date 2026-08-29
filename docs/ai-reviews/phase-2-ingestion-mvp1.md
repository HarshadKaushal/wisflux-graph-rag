# AI Review — phase-2-ingestion-mvp1

## Commit summary

- **Message:** `feat(ingestion): add document upload, parsing, and chunking pipeline`
- **Phase / MVP slice:** Phase 2 / MVP-1
- **Files changed:** ingestion/, documents/, packages/shared, apps/api/package.json

## AI tools used

- Cursor Agent (Phase 2 implementation)

## Prompts & intent

- User asked to move to next phase (Phase 2 — Document Ingestion)

## AI suggestions — accepted

- **Parser registry pattern** → extensible for PDF vs text/MD
- **Markdown section-aware chunking** → preserves sectionHeading for source attribution
- **Async fire-and-forget ingestion with status polling** → simple MVP without Redis/Bull queue
- **New `parsed` status** → clear gate between ingestion and graph/embedding phases

## AI suggestions — rejected

- **Bull/Redis job queue for ingestion** → deferred; in-process async sufficient for MVP-1

## Implementation decisions (human-owned)

- Memory storage for multer → file written to disk after document ID created
- Chunk size 3000 chars / 200 overlap → approximates ~800 tokens without tiktoken dependency
- PDF low-text detection (<50 chars) → fail fast with clear error for scanned PDFs

## Manual verification

```bash
curl -X POST http://localhost:3001/api/v1/documents/upload -F "file=@samples/acme-company.md"
# → documentId returned

GET /documents/:id/status → status: "parsed", chunkCount: 1
GET /documents/:id → chunks with sectionHeading: "Acme Corporation Overview"
```

## Open questions / deferred items

- Phase 3: entity extraction after `parsed` status
- Phase 4: embeddings on chunks
