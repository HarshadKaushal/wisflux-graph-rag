# AI Review — optional-redis-caching

## Commit summary

- **Message:** `feat(cache): Redis caching for embeddings and chat responses`
- **Phase / MVP slice:** Optional enhancement — Redis caching
- **Files changed:** docker-compose, CacheModule, embeddings, retrieval, chat, health, shared types, docs

## AI tools used

- Cursor Agent

## Prompts & intent

- Implement assignment optional: “Caching embeddings and responses (Redis)”

## AI suggestions — accepted

- Fail-open if Redis is unavailable (API still works)
- Cache embeddings by model+text hash; hybrid retrieval; full chat answers (including stream replay)
- Expose redis on `/health` and cache-hit badge in Evidence UI

## AI suggestions — rejected

- Hard dependency on Redis at boot → conflicts with assignment “optional” framing
- Caching only embeddings → assignment also asks for response caching

## Implementation decisions (human-owned)

- TTLs: embeddings 7d, hybrid/chat 1h (env-configurable)
- Stream cache stores completed answer and replays as a single token event on hit
- `REDIS_ENABLED=false` disables the client entirely

## What I learned / can explain

- Repeated identical questions skip OpenAI expand/rerank/answer work when chat cache hits
- Query embeddings for vector search benefit from embedding cache even on first chat cache miss

## Manual verification

1. `docker compose up -d redis` (or full stack)
2. Restart API — logs should show `Redis connected`
3. `GET /api/v1/health` → `services.redis.status = up`
4. Ask the same chat question twice — second shows **cache hit** badge and returns faster

## Open questions / deferred items

- Cache invalidation on document re-ingest (TTL-based for now)
