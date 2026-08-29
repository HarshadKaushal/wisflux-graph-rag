import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { OpenAiConfig } from '../config/configuration';
import {
  ALLOWED_ENTITY_TYPES,
  ALLOWED_RELATIONSHIP_TYPES,
  buildEntityExtractionUserPrompt,
  ENTITY_EXTRACTION_SYSTEM_PROMPT,
} from './prompts/entity-extraction.prompt';
import {
  buildQueryEntityExtractionUserPrompt,
  QUERY_ENTITY_EXTRACTION_SYSTEM_PROMPT,
} from './prompts/query-entity-extraction.prompt';
import {
  buildQueryExpansionUserPrompt,
  QUERY_EXPANSION_SYSTEM_PROMPT,
} from './prompts/query-expansion.prompt';

export interface ExtractedEntity {
  name: string;
  type: string;
}

export interface ExtractedRelationship {
  source: string;
  target: string;
  type: string;
  evidence?: string;
  confidence?: number;
}

export interface ExtractionResult {
  entities: ExtractedEntity[];
  relationships: ExtractedRelationship[];
}

export interface QueryExpansionResult {
  original: string;
  rewritten: string;
  alternatives: string[];
}

@Injectable()
export class ExtractionService {
  private readonly logger = new Logger(ExtractionService.name);
  private readonly client: OpenAI;
  private readonly chatModel: string;

  constructor(private readonly config: ConfigService) {
    const openai = this.config.get<OpenAiConfig>('openai')!;
    this.client = new OpenAI({ apiKey: openai.apiKey });
    this.chatModel = openai.chatModel;
  }

  async extractFromChunk(
    content: string,
    sectionHeading?: string,
  ): Promise<ExtractionResult> {
    const response = await this.client.chat.completions.create({
      model: this.chatModel,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: ENTITY_EXTRACTION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: buildEntityExtractionUserPrompt(content, sectionHeading),
        },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? '{}';

    try {
      return this.validateExtraction(JSON.parse(raw));
    } catch (error) {
      this.logger.warn(`Invalid extraction JSON, retrying once: ${raw}`);
      return this.retryExtraction(content, sectionHeading);
    }
  }

  private async retryExtraction(
    content: string,
    sectionHeading?: string,
  ): Promise<ExtractionResult> {
    const response = await this.client.chat.completions.create({
      model: this.chatModel,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            ENTITY_EXTRACTION_SYSTEM_PROMPT +
            '\nReturn ONLY minified valid JSON. No markdown.',
        },
        {
          role: 'user',
          content: buildEntityExtractionUserPrompt(content, sectionHeading),
        },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? '{}';
    return this.validateExtraction(JSON.parse(raw));
  }

  private validateExtraction(parsed: unknown): ExtractionResult {
    if (!parsed || typeof parsed !== 'object') {
      return { entities: [], relationships: [] };
    }

    const data = parsed as {
      entities?: ExtractedEntity[];
      relationships?: ExtractedRelationship[];
    };

    const entities = (data.entities ?? [])
      .filter((e) => e?.name?.trim())
      .map((e) => ({
        name: e.name.trim(),
        type: ALLOWED_ENTITY_TYPES.includes(
          e.type as (typeof ALLOWED_ENTITY_TYPES)[number],
        )
          ? e.type
          : 'Concept',
      }));

    const entityNames = new Set(entities.map((e) => e.name.toLowerCase()));

    const relationships = (data.relationships ?? [])
      .filter(
        (r) =>
          r?.source?.trim() &&
          r?.target?.trim() &&
          entityNames.has(r.source.trim().toLowerCase()) &&
          entityNames.has(r.target.trim().toLowerCase()),
      )
      .map((r) => ({
        source: r.source.trim(),
        target: r.target.trim(),
        type: ALLOWED_RELATIONSHIP_TYPES.includes(
          r.type as (typeof ALLOWED_RELATIONSHIP_TYPES)[number],
        )
          ? r.type
          : 'OTHER',
        evidence: r.evidence?.trim(),
        confidence:
          typeof r.confidence === 'number'
            ? Math.min(1, Math.max(0, r.confidence))
            : 0.8,
      }));

    return { entities, relationships };
  }

  async extractFromQuery(query: string): Promise<ExtractionResult> {
    const response = await this.client.chat.completions.create({
      model: this.chatModel,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: QUERY_ENTITY_EXTRACTION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: buildQueryEntityExtractionUserPrompt(query),
        },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? '{}';

    try {
      const parsed = JSON.parse(raw) as { entities?: ExtractedEntity[] };
      return this.validateExtraction({ entities: parsed.entities ?? [], relationships: [] });
    } catch {
      this.logger.warn(`Invalid query extraction JSON: ${raw}`);
      return { entities: [], relationships: [] };
    }
  }

  async expandQuery(query: string): Promise<QueryExpansionResult> {
    const original = query.trim();
    if (!original) {
      return { original: '', rewritten: '', alternatives: [] };
    }

    try {
      const response = await this.client.chat.completions.create({
        model: this.chatModel,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: QUERY_EXPANSION_SYSTEM_PROMPT },
          {
            role: 'user',
            content: buildQueryExpansionUserPrompt(original),
          },
        ],
      });

      const raw = response.choices[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(raw) as {
        rewritten?: string;
        alternatives?: unknown;
      };

      const rewritten =
        typeof parsed.rewritten === 'string' && parsed.rewritten.trim()
          ? parsed.rewritten.trim()
          : original;

      const alternatives = Array.isArray(parsed.alternatives)
        ? parsed.alternatives
            .filter((a): a is string => typeof a === 'string' && a.trim().length > 0)
            .map((a) => a.trim())
            .filter((a) => a.toLowerCase() !== original.toLowerCase())
            .filter((a) => a.toLowerCase() !== rewritten.toLowerCase())
            .slice(0, 3)
        : [];

      this.logger.debug(
        `Query expansion: "${original}" → "${rewritten}" (+${alternatives.length} alts)`,
      );

      return { original, rewritten, alternatives };
    } catch (error) {
      this.logger.warn(
        `Query expansion failed, using original: ${error instanceof Error ? error.message : error}`,
      );
      return { original, rewritten: original, alternatives: [] };
    }
  }
}
