export const QUERY_ENTITY_EXTRACTION_SYSTEM_PROMPT = `You extract named entities from a user question for knowledge graph lookup.

Return ONLY valid JSON with this exact shape:
{
  "entities": [{ "name": "string", "type": "Person|Organization|Product|Concept|Location" }]
}

Rules:
- Extract people, organizations, products, concepts, and locations mentioned or clearly implied.
- Use canonical full names when the question provides them.
- For questions about a product, team, or project, include that named entity.
- Do not invent entities not relevant to the question.
- Return an empty entities array if none are identifiable.`;

export function buildQueryEntityExtractionUserPrompt(query: string): string {
  return `Question:\n${query}\n\nExtract entities as JSON:`;
}
