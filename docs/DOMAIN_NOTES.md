# Domain & Business Understanding Notes

> Updated after graph extraction (Phase 3) and hybrid retrieval (Phase 6).

## Domain Assumptions

- Documents describe **organizations, people, products, and their relationships** (corporate knowledge, product docs, team wikis).
- Users ask **factual questions** that benefit from both unstructured text (policies, descriptions) and structured relationships (who works where, what depends on what).
- A single workspace may contain **multiple uploaded documents**; retrieval can be scoped by `documentId`.

## Entity Types (planned taxonomy)

| Type | Examples |
|------|----------|
| `Person` | Alice Chen, Carol Diaz |
| `Organization` | Acme Corporation, Beta Labs |
| `Product` | Orion Analytics Platform, GraphRAG Engine |
| `Concept` | machine learning pipeline, API gateway |
| `Location` | San Francisco |
| `Date/Event` | 2021 acquisition (as attribute, not always a node) |

## Relationship Types (planned taxonomy)

| Type | Pattern | Example |
|------|---------|---------|
| `FOUNDED` | Person → Organization | Alice FOUNDED Acme |
| `WORKS_AT` | Person → Organization | Carol WORKS_AT Acme |
| `LEADS` | Person → Product/Team | Carol LEADS GraphRAG Engine |
| `ACQUIRED` | Organization → Organization | Acme ACQUIRED Beta Labs |
| `OWNS` | Organization → Product | Beta Labs OWNS Orion |
| `DEPENDS_ON` | Product → Product | Orion DEPENDS_ON GraphRAG Engine |
| `LOCATED_IN` | Organization → Location | Acme LOCATED_IN San Francisco |

## Business Rules

1. **Entity merge:** Same `normalizedName` within a document scope → merge into one node; accumulate `chunkIds`.
2. **Relationship dedup:** Same `(source, type, target, documentId)` → update evidence, do not duplicate edge.
3. **Confidence threshold:** Relationships with LLM confidence < 0.5 are stored but flagged; excluded from hybrid context by default.
4. **Source attribution:** Every fact shown to the user must include `documentId`, `chunkId`, and optional `pageNumber`.
5. **Empty context rule:** If hybrid retrieval returns zero chunks and zero graph facts, the system responds "I don't have enough information" — never hallucinates.

## Decision Logic (retrieval)

1. Extract entities from user query (LLM → JSON).
2. Fuzzy-match extracted names against Neo4j `normalizedName`.
3. Graph traverse 1 hop (2 hops optional) from matched entities.
4. Vector search top-5 chunks (cosine similarity).
5. Merge, dedupe by `chunkId`, cap total context tokens.
6. Assign citation IDs `[S1..Sn]` for chunks, `[G1..Gn]` for graph facts.

## Open Questions

- Should cross-document entity linking be automatic (same person name in two docs)?
- How to handle ambiguous entity names ("Apple" the company vs fruit)?

*(Deferred beyond MVP — current scope merges entities by `normalizedName` globally in Neo4j.)*
