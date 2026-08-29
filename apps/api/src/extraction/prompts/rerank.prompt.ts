export const RERANK_SYSTEM_PROMPT = `You re-rank retrieval candidates for a question-answering system.

You receive a user question plus two lists:
- Document excerpts (temp ids like C1, C2, …)
- Graph facts (temp ids like F1, F2, …)

Return ONLY valid JSON with this exact shape:
{
  "sourceIds": ["C2", "C1", "..."],
  "factIds": ["F3", "F1", "..."]
}

Rules:
- Order ids from MOST to LEAST useful for answering the question.
- Include every id you were given exactly once (no new ids, no drops).
- Prefer excerpts/facts that directly answer the question over loosely related background.
- If two items are equally useful, keep their relative order.`;

export function buildRerankUserPrompt(
  query: string,
  sources: { id: string; text: string }[],
  facts: { id: string; text: string }[],
): string {
  const sourceBlock =
    sources.length === 0
      ? '(none)'
      : sources
          .map((s) => `[${s.id}]\n${s.text.slice(0, 500)}`)
          .join('\n\n');

  const factBlock =
    facts.length === 0
      ? '(none)'
      : facts.map((f) => `[${f.id}] ${f.text}`).join('\n');

  return `Question:\n${query}

### Document excerpts
${sourceBlock}

### Graph facts
${factBlock}

Return JSON with sourceIds and factIds ordered by relevance:`;
}
