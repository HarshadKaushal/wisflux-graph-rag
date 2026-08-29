import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChunkEntity } from '../documents/entities/chunk.entity';
import { DocumentEntity } from '../documents/entities/document.entity';
import { ExtractionService } from '../extraction/extraction.service';
import { GraphService } from './graph.service';

@Injectable()
export class GraphBuilderService {
  private readonly logger = new Logger(GraphBuilderService.name);

  constructor(
    @InjectRepository(DocumentEntity)
    private readonly documentsRepo: Repository<DocumentEntity>,
    @InjectRepository(ChunkEntity)
    private readonly chunksRepo: Repository<ChunkEntity>,
    private readonly extraction: ExtractionService,
    private readonly graph: GraphService,
  ) {}

  async buildGraphForDocument(documentId: string): Promise<number> {
    const document = await this.documentsRepo.findOne({ where: { id: documentId } });
    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    const chunks = await this.chunksRepo.find({
      where: { documentId },
      order: { chunkIndex: 'ASC' },
    });

    if (chunks.length === 0) {
      throw new Error('No chunks available for graph extraction');
    }

    await this.graph.clearDocumentGraph(documentId);
    await this.graph.upsertDocument(documentId, document.filename);

    for (const chunk of chunks) {
      await this.graph.upsertChunk(
        chunk.id,
        documentId,
        chunk.chunkIndex,
        chunk.content.slice(0, 200),
        chunk.pageNumber,
      );
    }

    let totalRelationships = 0;

    for (const chunk of chunks) {
      const extracted = await this.extraction.extractFromChunk(
        chunk.content,
        chunk.sectionHeading,
      );

      const entityIdMap = new Map<string, string>();

      for (const entity of extracted.entities) {
        const entityId = await this.graph.upsertEntityMention(
          entity,
          chunk.id,
          documentId,
        );
        entityIdMap.set(this.graph.normalizeName(entity.name), entityId);
      }

      for (const relationship of extracted.relationships) {
        await this.graph.upsertRelationship(
          relationship,
          chunk.id,
          documentId,
          entityIdMap,
        );
        totalRelationships++;
      }

      this.logger.log(
        `Chunk ${chunk.chunkIndex}: ${extracted.entities.length} entities, ${extracted.relationships.length} relationships`,
      );
    }

    const entityCount = await this.graph.countEntitiesForDocument(documentId);

    await this.documentsRepo.update(documentId, {
      entityCount,
      status: 'completed',
      errorMessage: undefined,
    });

    this.logger.log(
      `Graph built for ${documentId}: ${entityCount} entities, ${totalRelationships} relationships`,
    );

    return entityCount;
  }
}
