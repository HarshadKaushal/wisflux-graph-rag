# AI Review — optional-reranking

## Commit summary

- **Message:** `feat(retrieval): LLM re-rank chunks and graph facts after hybrid search`
- **Phase / MVP slice:** Optional enhancement — re-ranking
- **Files changed:** rerank.prompt.ts, extraction.service, retrieval.service, chat, shared types, web chat UI

## AI tools used

- Cursor Agent

## Prompts & intent

- Implement assignment optional: “Re-ranking retrieved nodes using LLM or cross-encoder”

## AI suggestions — accepted

- LLM re-rank (not cross-encoder) → no new model dependency; matches existing OpenAI stack
- Wider vector candidate pool when re-ranking, then cut to topK
- Return before/after labels in metadata for explainability UI

## AI suggestions — rejected

- Cross-encoder package → extra infra/latency for assignment deadline
- Re-ranking graph paths separately → facts/chunks reorder is enough; paths stay traversal order

## Implementation decisions (human-owned)

- Default `rerank: true` on chat/hybrid; toggleable in UI
- Fail-open: if LLM re-rank fails, keep vector/graph order
- Temp ids `C*` / `F*` in the re-rank prompt; final citations still `[S*]` / `[G*]`

## What I learned / can explain

- Vector similarity ≠ answer relevance; second-pass ranking improves context quality
- Flow: expand → retrieve pool → LLM order → rebuild context → answer

## Manual verification

1. Chat with Re-ranking On
2. Ask a focused question (e.g. who leads GraphRAG Engine)
3. Open Evidence → Rerank tab; confirm before/after lists
4. Sources / Facts tabs show final (post-rerank) `[S*]` / `[G*]` order

## Open questions / deferred items

- Redis caching still pending (last assignment optional)
