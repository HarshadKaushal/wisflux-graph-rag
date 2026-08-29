# AI Review — optional interactive path viz

## Commit summary

- **Message:** `feat(web): interactive SVG graph path visualization`
- **Phase / MVP slice:** Optional — interactive graph visualization
- **Files changed:** `PathGraphViz.tsx`, chat page, `globals.css`, FEATURES/IMPLEMENTATION/README

## AI tools used

- Cursor Agent

## Prompts & intent

- Implement interactive graph path visualization for retrieved multi-hop paths in chat UI

## AI suggestions — accepted

- Pure SVG + React (no Cytoscape/D3/force-graph) → matches design philosophy of minimal dependencies
- Reuse SSE `graphPaths` / `entities` metadata → UI stays a thin consumer
- Layer layout from path start entities + drag repositioning for interactivity

## AI suggestions — rejected

- Full document subgraph page with Neo4j fetch → deferred; path viz answers the multi-hop demo need first
- Heavy graph libraries → unnecessary for ≤40 path / small neighborhood graphs

## Implementation decisions (human-owned)

- Highlight is driven by selecting a `[P*]` path row (or clicking an edge that belongs to a path)
- Edge evidence comes from relationship records already on the path
- Entity type colors match DOMAIN_NOTES taxonomy

## What I learned / can explain

- Chat metadata already carries enough structure (`entityIds`, `relationships`, `summary`) to render a path graph without a new API
- Layer BFS distance from start entities gives a readable left-to-right layout for 1–2 hop chains

## Manual verification

1. Open `/chat`, ask: `How is Carol Diaz connected to Beta Labs?`
2. Side panel shows SVG with Carol → Acme → Beta Labs
3. Click `[P*]` row → path highlights; drag a node; click an edge → evidence panel

## Open questions / deferred items

- Full-document subgraph explorer (`GET /graph/document/:id/subgraph`) still optional
- Pan/zoom canvas deferred
