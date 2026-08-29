import { Injectable, Module, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PostgresModule } from './postgres.module';

@Injectable()
export class DatabaseInitService implements OnModuleInit {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async onModuleInit() {
    await this.dataSource.query('CREATE EXTENSION IF NOT EXISTS vector');
    await this.dataSource.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        filename varchar NOT NULL,
        mime_type varchar NOT NULL,
        file_path varchar NOT NULL,
        status varchar NOT NULL DEFAULT 'pending',
        error_message text,
        page_count int,
        chunk_count int NOT NULL DEFAULT 0,
        entity_count int NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS chunks (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        chunk_index int NOT NULL,
        content text NOT NULL,
        token_count int NOT NULL DEFAULT 0,
        page_number int,
        section_heading varchar,
        metadata jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await this.dataSource.query(`
      ALTER TABLE chunks
      ADD COLUMN IF NOT EXISTS embedding vector(1536)
    `);

    await this.dataSource
      .query(
        `
      CREATE INDEX IF NOT EXISTS chunks_embedding_idx
      ON chunks USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100)
    `,
      )
      .catch(() => {
        // IVFFlat index requires rows; fall back to no index for empty table
      });
  }
}

@Module({
  imports: [PostgresModule],
  providers: [DatabaseInitService],
})
export class DatabaseModule {}
