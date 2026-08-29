# AI Review — phase-7-hybrid-chat

## Commit summary

- **Message:** `feat(chat): use hybrid retrieval with [S*] and [G*] citations`
- **Phase / MVP slice:** Phase 7 / Hybrid chat
- **Files changed:** chat.service.ts, chat.module.ts, answer.prompt.ts, packages/shared

## AI tools used

- Cursor Agent (Phase 7 implementation)

## Implementation decisions (human-owned)

- ChatService now depends on RetrievalService (not VectorService directly)
- Empty retrieval: zero sources AND zero graph facts → "I don't have enough information"
- SSE metadata includes sources, graphFacts, entities, graphPaths for UI (Phase 9)
- Prompt prefers graph facts for relationship questions
- ChatResponse extended with graphFacts, entities, graphPaths

## Manual verification

```
POST /chat {
  "message": "Who leads development of the GraphRAG Engine?",
  "documentIds": ["d822bc96-..."]
}
→ answer: "Carol Diaz leads development of the GraphRAG Engine [G2]."
→ sources: 1, graphFacts: 2 (G2 = LEADS)
```

## Open questions / deferred items

- Phase 8: Next.js upload + chat UI
- Phase 9: Sources panel + graph path display
