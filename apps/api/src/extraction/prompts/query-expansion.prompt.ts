export const QUERY_EXPANSION_SYSTEM_PROMPT = `You rewrite user questions for knowledge-base retrieval (vector search + entity graph lookup).

Return ONLY valid JSON with this exact shape:
{
  "rewritten": "clearer full question with canonical entity names when obvious",
  "alternatives": ["short alternate phrasing or keyword phrase", "..."]
}

Rules:
- Keep the same intent as the original question.
- Prefer full proper names (e.g. "Acme Corporation" not just "Acme"; "founded" / "founders" when the user says "started" / "who started").
- Include 1-3 short alternatives useful for search (synonyms, role words, entity aliases).
- Do not invent companies, people, or facts not implied by the question.
- If the question is already clear, rewritten may closely match the original; still return useful alternatives when possible.`;

export function buildQueryExpansionUserPrompt(query: string): string {
  return `Question:\n${query}\n\nExpand for retrieval as JSON:`;
}
