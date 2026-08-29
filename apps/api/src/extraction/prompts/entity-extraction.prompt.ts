export const ENTITY_EXTRACTION_SYSTEM_PROMPT = `You extract entities and relationships from text for a knowledge graph.

Return ONLY valid JSON with this exact shape:
{
  "entities": [{ "name": "string", "type": "Person|Organization|Product|Concept|Location" }],
  "relationships": [{
    "source": "entity name",
    "target": "entity name",
    "type": "FOUNDED|WORKS_AT|LEADS|ACQUIRED|OWNS|DEPENDS_ON|LOCATED_IN|PART_OF|KNOWS|OTHER",
    "evidence": "short quote from text",
    "confidence": 0.0-1.0
  }]
}

Rules:
- Extract only entities explicitly mentioned in the text.
- Use canonical full names when available.
- Every relationship must reference entity names from the entities array.
- Include evidence as a short direct quote.
- If no relationships exist, return an empty relationships array.
- Do not invent facts not present in the text.`;

export function buildEntityExtractionUserPrompt(
  chunkText: string,
  sectionHeading?: string,
): string {
  const heading = sectionHeading ? `Section: ${sectionHeading}\n\n` : '';
  return `${heading}Text:\n${chunkText}\n\nExtract entities and relationships as JSON:`;
}

export const ALLOWED_ENTITY_TYPES = [
  'Person',
  'Organization',
  'Product',
  'Concept',
  'Location',
] as const;

export const ALLOWED_RELATIONSHIP_TYPES = [
  'FOUNDED',
  'WORKS_AT',
  'LEADS',
  'ACQUIRED',
  'OWNS',
  'DEPENDS_ON',
  'LOCATED_IN',
  'PART_OF',
  'KNOWS',
  'OTHER',
] as const;
