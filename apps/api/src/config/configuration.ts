import { registerAs } from '@nestjs/config';

export interface AppConfig {
  port: number;
  apiPrefix: string;
  nodeEnv: string;
  uploadDir: string;
  maxUploadSizeMb: number;
}

export interface PostgresConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export interface Neo4jConfig {
  uri: string;
  user: string;
  password: string;
}

export interface OpenAiConfig {
  apiKey: string;
  embeddingModel: string;
  chatModel: string;
}

export const appConfig = registerAs(
  'app',
  (): AppConfig => ({
    port: parseInt(process.env.API_PORT ?? '3001', 10),
    apiPrefix: process.env.API_PREFIX ?? 'api/v1',
    nodeEnv: process.env.NODE_ENV ?? 'development',
    uploadDir: process.env.UPLOAD_DIR ?? './uploads',
    maxUploadSizeMb: parseInt(process.env.MAX_UPLOAD_SIZE_MB ?? '20', 10),
  }),
);

export const postgresConfig = registerAs(
  'postgres',
  (): PostgresConfig => ({
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
    user: process.env.POSTGRES_USER ?? 'graphrag',
    password: process.env.POSTGRES_PASSWORD ?? 'graphrag',
    database: process.env.POSTGRES_DB ?? 'graphrag',
  }),
);

export const neo4jConfig = registerAs(
  'neo4j',
  (): Neo4jConfig => ({
    uri: process.env.NEO4J_URI ?? 'bolt://localhost:7687',
    user: process.env.NEO4J_USER ?? 'neo4j',
    password: process.env.NEO4J_PASSWORD ?? 'graphrag123',
  }),
);

export const openAiConfig = registerAs(
  'openai',
  (): OpenAiConfig => ({
    apiKey: process.env.OPENAI_API_KEY ?? '',
    embeddingModel:
      process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small',
    chatModel: process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o-mini',
  }),
);
