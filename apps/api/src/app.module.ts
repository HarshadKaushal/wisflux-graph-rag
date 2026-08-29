import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { AppConfigModule, validateEnv } from './config/config.module';
import {
  appConfig,
  neo4jConfig,
  openAiConfig,
  postgresConfig,
} from './config/configuration';
import { PostgresModule } from './database/postgres.module';
import { DatabaseModule } from './database/database.module';
import { Neo4jModule } from './database/neo4j.module';
import { GraphModule } from './graph/graph.module';
import { HealthModule } from './health/health.module';
import { DocumentsModule } from './documents/documents.module';
import { VectorModule } from './vector/vector.module';
import { ChatModule } from './chat/chat.module';
import { RetrievalModule } from './retrieval/retrieval.module';

function resolveEnvPaths(): string[] {
  const candidates = [
    resolve(__dirname, '../../..', '.env'),
    resolve(__dirname, '../..', '.env'),
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '../../.env'),
  ];
  return [...new Set(candidates.filter((p) => existsSync(p)))];
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolveEnvPaths(),
      load: [appConfig, postgresConfig, neo4jConfig, openAiConfig],
      validate: validateEnv,
    }),
    AppConfigModule,
    PostgresModule,
    DatabaseModule,
    Neo4jModule,
    GraphModule,
    HealthModule,
    DocumentsModule,
    VectorModule,
    ChatModule,
    RetrievalModule,
  ],
})
export class AppModule {}
