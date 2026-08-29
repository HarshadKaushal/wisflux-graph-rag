import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { VectorSearchResult } from '@graph-rag/shared';
import { EmbeddingsService } from '../embeddings/embeddings.service';

interface VectorRow {
  id: string;
  content: string;
  document_id: string;
  chunk_index: number;
  page_number: number | null;
  section_heading: string | null;
  filename: string;
  score: number;
}

@Injectable()
export class VectorService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly embeddings: EmbeddingsService,
  ) {}

  async embedChunk(chunkId: string, embedding: number[]): Promise<void> {
    const vector = `[${embedding.join(',')}]`;
    await this.dataSource.query(
      `UPDATE chunks SET embedding = $1::vector WHERE id = $2`,
      [vector, chunkId],
    );
  }

  async search(
    query: string,
    topK = 5,
    documentIds?: string[],
  ): Promise<VectorSearchResult[]> {
    const queryEmbedding = await this.embeddings.embedQuery(query);
    const vector = `[${queryEmbedding.join(',')}]`;

    const params: unknown[] = [vector, topK];
    let docFilter = '';

    if (documentIds && documentIds.length > 0) {
      params.push(documentIds);
      docFilter = `AND c.document_id = ANY($3::uuid[])`;
    }

    const rows: VectorRow[] = await this.dataSource.query(
      `
      SELECT
        c.id,
        c.content,
        c.document_id,
        c.chunk_index,
        c.page_number,
        c.section_heading,
        d.filename,
        1 - (c.embedding <=> $1::vector) AS score
      FROM chunks c
      JOIN documents d ON d.id = c.document_id
      WHERE c.embedding IS NOT NULL
      ${docFilter}
      ORDER BY c.embedding <=> $1::vector
      LIMIT $2
      `,
      params,
    );

    return rows.map((row) => ({
      chunkId: row.id,
      content: row.content,
      score: Number(row.score),
      documentId: row.document_id,
      chunkIndex: row.chunk_index,
      pageNumber: row.page_number ?? undefined,
      sectionHeading: row.section_heading ?? undefined,
      filename: row.filename,
    }));
  }
}
