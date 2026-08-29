# AI Review — optional-query-expansion

## Commit summary

- **Message:** `feat(retrieval): add LLM query expansion before hybrid search`
- **Phase / MVP slice:** Optional enhancement — query expansion
- **Files changed:** extraction prompts/service, retrieval service/module/controller, chat, shared types, web chat UI

## AI tools used

- Cursor Agent

## Implementation decisions (human-owned)

- Expand with structured JSON: `rewritten` + up to 3 `alternatives`
- Vector: search rewritten (and original if different), merge by chunkId max score
- Graph: search `rewritten + alternatives` string for better entity name hits
- Default `expandQuery: true`; API + UI can disable
- Fail open: if expansion LLM fails, use original query
- Side panel shows original / rewritten / alternatives for transparency

## Manual verification

```
POST /retrieval/hybrid { "query": "who started acme?", "expandQuery": true, ... }
→ expansion.rewritten: "Who were the founders of Acme Corporation?"
→ alternatives: "Acme Corporation founders", "who founded Acme", ...

POST /chat { "message": "who started acme?", ... }
→ "Acme Corporation was founded in 2018 by Bob Kumar and Alice Chen [G6], [G7]."
```
