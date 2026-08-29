import { createHash } from 'crypto';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { RedisConfig } from '../config/configuration';

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private client: Redis | null = null;
  private ready = false;
  private readonly enabled: boolean;
  private readonly embeddingTtl: number;
  private readonly responseTtl: number;

  constructor(private readonly config: ConfigService) {
    const redis = this.config.get<RedisConfig>('redis')!;
    this.enabled = redis.enabled;
    this.embeddingTtl = redis.embeddingTtlSeconds;
    this.responseTtl = redis.responseTtlSeconds;
  }

  async onModuleInit() {
    if (!this.enabled) {
      this.logger.warn('Redis cache disabled (REDIS_ENABLED=false)');
      return;
    }

    const redis = this.config.get<RedisConfig>('redis')!;
    try {
      this.client = new Redis({
        host: redis.host,
        port: redis.port,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        lazyConnect: true,
      });

      this.client.on('error', (err) => {
        this.ready = false;
        this.logger.warn(`Redis error: ${err.message}`);
      });

      await this.client.connect();
      const pong = await this.client.ping();
      this.ready = pong === 'PONG';
      this.logger.log(
        this.ready
          ? `Redis connected at ${redis.host}:${redis.port}`
          : 'Redis ping failed',
      );
    } catch (error) {
      this.ready = false;
      this.logger.warn(
        `Redis unavailable — continuing without cache: ${error instanceof Error ? error.message : error}`,
      );
      if (this.client) {
        this.client.disconnect();
        this.client = null;
      }
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit().catch(() => undefined);
      this.client = null;
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  isReady(): boolean {
    return this.ready && this.client != null;
  }

  async ping(): Promise<boolean> {
    if (!this.client) return false;
    try {
      return (await this.client.ping()) === 'PONG';
    } catch {
      this.ready = false;
      return false;
    }
  }

  hashKey(parts: unknown): string {
    return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
  }

  async getJson<T>(key: string): Promise<T | null> {
    if (!this.isReady() || !this.client) return null;
    try {
      const raw = await this.client.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!this.isReady() || !this.client) return;
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (error) {
      this.logger.warn(
        `Redis set failed: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  embeddingKey(model: string, text: string): string {
    return `embed:${model}:${this.hashKey(text)}`;
  }

  async getEmbedding(
    model: string,
    text: string,
  ): Promise<number[] | null> {
    return this.getJson<number[]>(this.embeddingKey(model, text));
  }

  async setEmbedding(
    model: string,
    text: string,
    embedding: number[],
  ): Promise<void> {
    await this.setJson(
      this.embeddingKey(model, text),
      embedding,
      this.embeddingTtl,
    );
  }

  hybridKey(payload: unknown): string {
    return `hybrid:${this.hashKey(payload)}`;
  }

  chatKey(payload: unknown): string {
    return `chat:${this.hashKey(payload)}`;
  }

  getResponseTtl(): number {
    return this.responseTtl;
  }
}
