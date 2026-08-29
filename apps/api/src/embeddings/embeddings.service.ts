import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { OpenAiConfig } from '../config/configuration';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(
    private readonly config: ConfigService,
    private readonly cache: CacheService,
  ) {
    const openai = this.config.get<OpenAiConfig>('openai')!;
    this.client = new OpenAI({ apiKey: openai.apiKey });
    this.model = openai.embeddingModel;
  }

  async embedTexts(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const results: Array<number[] | null> = new Array(texts.length).fill(null);
    const missIndexes: number[] = [];
    let hits = 0;

    for (let i = 0; i < texts.length; i++) {
      const cached = await this.cache.getEmbedding(this.model, texts[i]);
      if (cached) {
        results[i] = cached;
        hits += 1;
      } else {
        missIndexes.push(i);
      }
    }

    if (missIndexes.length > 0) {
      const batchSize = 20;
      for (let i = 0; i < missIndexes.length; i += batchSize) {
        const slice = missIndexes.slice(i, i + batchSize);
        const batch = slice.map((idx) => texts[idx]);
        const response = await this.client.embeddings.create({
          model: this.model,
          input: batch,
        });

        const sorted = response.data.sort((a, b) => a.index - b.index);
        for (let j = 0; j < sorted.length; j++) {
          const textIndex = slice[j];
          const embedding = sorted[j].embedding;
          results[textIndex] = embedding;
          await this.cache.setEmbedding(this.model, texts[textIndex], embedding);
        }
      }
    }

    this.logger.log(
      `Embedded ${texts.length} text(s) with ${this.model} (cache hits=${hits}, misses=${missIndexes.length})`,
    );

    return results.map((r, i) => {
      if (!r) {
        throw new Error(`Missing embedding for text index ${i}`);
      }
      return r;
    });
  }

  async embedQuery(query: string): Promise<number[]> {
    const [embedding] = await this.embedTexts([query]);
    return embedding;
  }
}
