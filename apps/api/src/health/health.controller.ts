import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import type { HealthCheckResponse } from '@graph-rag/shared';
import { CacheService } from '../cache/cache.service';
import type { OpenAiConfig } from '../config/configuration';
import { Neo4jService } from '../database/neo4j.module';

@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly neo4j: Neo4jService,
    private readonly config: ConfigService,
    private readonly cache: CacheService,
  ) {}

  @Get()
  async checkHealth(): Promise<HealthCheckResponse> {
    const postgres = await this.checkPostgres();
    const neo4j = await this.checkNeo4j();
    const openai = this.checkOpenAi();
    const redis = await this.checkRedis();

    const criticalDown =
      postgres.status === 'down' || neo4j.status === 'down';

    const allRequiredUp =
      postgres.status === 'up' &&
      neo4j.status === 'up' &&
      openai.status === 'up';

    const redisOk =
      redis.status === 'up' || redis.status === 'not_configured';

    return {
      status: criticalDown
        ? 'error'
        : allRequiredUp && redisOk
          ? 'ok'
          : 'degraded',
      timestamp: new Date().toISOString(),
      services: { postgres, neo4j, openai, redis },
    };
  }

  private async checkPostgres() {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'up' as const };
    } catch (error) {
      return {
        status: 'down' as const,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async checkNeo4j() {
    try {
      await this.neo4j.verifyConnectivity();
      return { status: 'up' as const };
    } catch (error) {
      return {
        status: 'down' as const,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private checkOpenAi() {
    const openai = this.config.get<OpenAiConfig>('openai');
    const key = openai?.apiKey?.trim();
    const isPlaceholder =
      !key ||
      key === 'sk-your-key-here' ||
      key.startsWith('sk-your-key');

    if (isPlaceholder) {
      return {
        status: 'not_configured' as const,
        message: 'Set OPENAI_API_KEY in .env and restart the API',
      };
    }
    return { status: 'up' as const };
  }

  private async checkRedis() {
    if (!this.cache.isEnabled()) {
      return {
        status: 'not_configured' as const,
        message: 'REDIS_ENABLED=false',
      };
    }
    const ok = await this.cache.ping();
    if (ok) return { status: 'up' as const };
    return {
      status: 'down' as const,
      message: 'Redis unreachable — API continues without cache',
    };
  }
}
