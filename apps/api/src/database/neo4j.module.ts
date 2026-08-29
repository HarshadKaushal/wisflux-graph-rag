import { Global, Inject, Injectable, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import neo4j, { Driver, Session } from 'neo4j-driver';
import type { Neo4jConfig } from '../config/configuration';

export const NEO4J_DRIVER = 'NEO4J_DRIVER';

@Injectable()
export class Neo4jService implements OnModuleInit {
  constructor(@Inject(NEO4J_DRIVER) private readonly driver: Driver) {}

  async onModuleInit() {
    await this.run(`
      CREATE CONSTRAINT document_id IF NOT EXISTS
      FOR (d:Document) REQUIRE d.id IS UNIQUE
    `);
    await this.run(`
      CREATE CONSTRAINT chunk_id IF NOT EXISTS
      FOR (c:Chunk) REQUIRE c.id IS UNIQUE
    `);
    await this.run(`
      CREATE CONSTRAINT entity_id IF NOT EXISTS
      FOR (e:Entity) REQUIRE e.id IS UNIQUE
    `);
    await this.run(`
      CREATE INDEX entity_normalized_name IF NOT EXISTS
      FOR (e:Entity) ON (e.normalizedName)
    `);
  }

  session(): Session {
    return this.driver.session();
  }

  async run<T extends Record<string, unknown> = Record<string, unknown>>(
    cypher: string,
    params: Record<string, unknown> = {},
  ): Promise<T[]> {
    const session = this.session();
    try {
      const result = await session.run(cypher, params);
      return result.records.map((record) => record.toObject() as T);
    } finally {
      await session.close();
    }
  }

  async verifyConnectivity(): Promise<void> {
    await this.driver.verifyConnectivity();
  }
}

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: NEO4J_DRIVER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Driver => {
        const neo4jConfig = config.get<Neo4jConfig>('neo4j')!;
        return neo4j.driver(
          neo4jConfig.uri,
          neo4j.auth.basic(neo4jConfig.user, neo4jConfig.password),
        );
      },
    },
    Neo4jService,
  ],
  exports: [NEO4J_DRIVER, Neo4jService],
})
export class Neo4jModule implements OnModuleDestroy {
  constructor(@Inject(NEO4J_DRIVER) private readonly driver: Driver) {}

  async onModuleDestroy() {
    await this.driver.close();
  }
}
