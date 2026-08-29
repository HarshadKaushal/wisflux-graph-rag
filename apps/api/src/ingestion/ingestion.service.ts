import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentEntity } from '../documents/entities/document.entity';
import { ChunkEntity } from '../documents/entities/chunk.entity';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { GraphBuilderService } from '../graph/graph-builder.service';
import { VectorService } from '../vector/vector.service';
import { ChunkerService } from './chunking/chunker.service';
import { ParserRegistry } from './parsers/parser.registry';

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    @InjectRepository(DocumentEntity)
    private readonly documentsRepo: Repository<DocumentEntity>,
    @InjectRepository(ChunkEntity)
    private readonly chunksRepo: Repository<ChunkEntity>,
    private readonly parserRegistry: ParserRegistry,
    private readonly chunker: ChunkerService,
    private readonly embeddings: EmbeddingsService,
    private readonly vectorService: VectorService,
    private readonly graphBuilder: GraphBuilderService,
  ) {}

  ingestDocument(documentId: string): void {
    void this.runIngestion(documentId);
  }

  async embedDocument(documentId: string): Promise<void> {
    await this.runEmbedding(documentId);
    await this.runGraphExtraction(documentId);
  }

  async extractGraph(documentId: string): Promise<void> {
    await this.runGraphExtraction(documentId);
  }

  private async runIngestion(documentId: string): Promise<void> {
    const document = await this.documentsRepo.findOne({ where: { id: documentId } });
    if (!document) return;

    try {
      await this.documentsRepo.update(documentId, {
        status: 'parsing',
        errorMessage: undefined,
      });

      const parsed = await this.parserRegistry.parse(
        document.filePath,
        document.mimeType,
        document.filename,
      );

      const drafts = this.chunker.chunkSegments(parsed.segments);

      if (drafts.length === 0) {
        throw new Error('No chunks produced from document');
      }

      await this.chunksRepo.delete({ documentId });

      const chunks = drafts.map((draft) =>
        this.chunksRepo.create({
          documentId,
          chunkIndex: draft.chunkIndex,
          content: draft.content,
          tokenCount: draft.tokenCount,
          pageNumber: draft.pageNumber,
          sectionHeading: draft.sectionHeading,
          metadata: {
            filename: document.filename,
            ...draft.metadata,
          },
        }),
      );

      await this.chunksRepo.save(chunks);

      await this.documentsRepo.update(documentId, {
        pageCount: parsed.pageCount,
        chunkCount: chunks.length,
      });

      this.logger.log(`Document ${documentId} parsed: ${chunks.length} chunks`);
      await this.runEmbedding(documentId);
      await this.runGraphExtraction(documentId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown ingestion error';

      await this.documentsRepo.update(documentId, {
        status: 'failed',
        errorMessage: message,
      });

      this.logger.error(`Document ${documentId} ingestion failed: ${message}`);
    }
  }

  private async runEmbedding(documentId: string): Promise<void> {
    try {
      await this.documentsRepo.update(documentId, { status: 'embedding' });

      const chunks = await this.chunksRepo.find({
        where: { documentId },
        order: { chunkIndex: 'ASC' },
      });

      if (chunks.length === 0) {
        throw new Error('No chunks found to embed');
      }

      const vectors = await this.embeddings.embedTexts(
        chunks.map((c) => c.content),
      );

      for (let i = 0; i < chunks.length; i++) {
        await this.vectorService.embedChunk(chunks[i].id, vectors[i]);
      }

      this.logger.log(`Document ${documentId} embedded: ${chunks.length} vectors`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown embedding error';
      const friendlyMessage = message.includes('429')
        ? 'OpenAI quota exceeded. Add billing/credits at platform.openai.com'
        : message;

      await this.documentsRepo.update(documentId, {
        status: 'failed',
        errorMessage: friendlyMessage,
      });
      throw error;
    }
  }

  private async runGraphExtraction(documentId: string): Promise<void> {
    try {
      await this.documentsRepo.update(documentId, { status: 'extracting' });
      await this.graphBuilder.buildGraphForDocument(documentId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown graph extraction error';

      await this.documentsRepo.update(documentId, {
        status: 'failed',
        errorMessage: message,
      });

      this.logger.error(`Document ${documentId} graph extraction failed: ${message}`);
      throw error;
    }
  }
}
