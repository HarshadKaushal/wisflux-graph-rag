# AI Review — phase-0-setup

## Commit summary

- **Message:** `chore: initialize monorepo, docker infra, and docs scaffold`
- **Phase / MVP slice:** Phase 0 / pre-MVP foundation
- **Files changed:** package.json, pnpm-workspace.yaml, docker-compose.yml, apps/api/*, apps/web/*, packages/shared/*, docs/*, README.md, samples/acme-company.md

## AI tools used

- Cursor Agent (plan execution, file scaffolding, troubleshooting install issues)

## Prompts & intent

- User approved plan and said "lets begin"
- Goal: Phase 0 — monorepo skeleton, Docker infra, NestJS health check, Next.js shell, full docs scaffold

## AI suggestions — accepted

- **pnpm workspaces** for monorepo → accepted; plan specified pnpm; works via `npx pnpm@9` on Windows without global install
- **TypeORM for Postgres** → accepted; fast NestJS integration, entity sync in dev
- **Global Neo4jModule with driver token** → accepted; clean injection across future graph services
- **Health check returning per-service status** → accepted; useful for demo and debugging before full pipeline exists
- **Next.js homepage as health dashboard** → accepted; proves frontend/backend wiring early

## AI suggestions — rejected

- **Switch permanently to npm workspaces** → rejected after pnpm install succeeded; pnpm lockfile already created; reverted npm experiment to avoid dual package-manager confusion
- **Skip docs in Phase 0** → rejected; assignment-giver requires documentation from the start

## Implementation decisions (human-owned)

- **Monorepo layout:** `apps/api`, `apps/web`, `packages/shared` → matches plan; shared types prevent DTO drift
- **Postgres + pgvector image:** `pgvector/pgvector:pg16` → extension pre-installed, no manual CREATE EXTENSION step
- **Neo4j 5 with default auth** → simple local dev; credentials in .env.example
- **Document/Chunk entities in Phase 0** → tables created on first API boot (TypeORM sync); ready for Phase 2 ingestion
- **CORS limited to localhost:3000** → sufficient for local Next.js dev

## What I learned / can explain

- Root `ConfigModule` loads `.env` from repo root via `envFilePath: ['.env', '../../.env']`
- `HealthController` pings Postgres (`SELECT 1`), Neo4j (`RETURN 1`), and checks OpenAI key presence
- `Neo4jModule` is `@Global()` and closes driver on shutdown via `OnModuleDestroy`
- OneDrive + pnpm symlinks can cause slow installs and bin warnings on Windows — use `npx pnpm@9`

## Manual verification

```bash
npx pnpm@9 install          # ✅ Done in ~37s (repair after failed npm attempt)
npx pnpm@9 run build:shared # ✅ tsc compiles shared types
npx pnpm@9 --filter @graph-rag/api build  # ✅ nest build succeeds
npx pnpm@9 run dev:api      # ✅ Nest boots; retries Postgres until Docker started
docker compose up -d        # ⚠️ Requires Docker Desktop running
curl localhost:3001/api/v1/health  # Pending — needs Docker
```

## Open questions / deferred items

- Docker Desktop was not running during Phase 0 — user must start it before health check goes green
- Consider adding `.npmrc` with `node-linker=hoisted` if OneDrive symlink issues persist
- Phase 1: verify both DB connections green, then proceed to MVP-1 ingestion
