import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsOptional, IsUUID } from 'class-validator';
import { Repository } from 'typeorm';
import type { EntityRecord, RelationshipRecord } from '@graph-rag/shared';
import { DocumentEntity } from '../documents/entities/document.entity';
import { GraphService } from './graph.service';

class GraphEntitiesQuery {
  @IsOptional()
  @IsUUID()
  documentId?: string;
}

@Controller('graph')
export class GraphController {
  constructor(
    private readonly graphService: GraphService,
    @InjectRepository(DocumentEntity)
    private readonly documentsRepo: Repository<DocumentEntity>,
  ) {}

  @Get('entities')
  async listEntities(@Query() query: GraphEntitiesQuery) {
    if (!query.documentId) {
      return { entities: [] as EntityRecord[] };
    }

    const nodes = await this.graphService.getEntitiesByDocument(
      query.documentId,
    );

    const entities: EntityRecord[] = nodes.map((n) => ({
      id: n.id,
      name: n.name,
      type: n.type,
      normalizedName: n.normalizedName,
      documentIds: [query.documentId!],
      chunkIds: [],
    }));

    return { entities };
  }

  @Get('document/:id/subgraph')
  async getSubgraph(@Param('id') id: string) {
    const doc = await this.documentsRepo.findOne({ where: { id } });
    if (!doc) {
      throw new NotFoundException(`Document ${id} not found`);
    }

    const subgraph = await this.graphService.getDocumentSubgraph(id);

    const relationships: RelationshipRecord[] = subgraph.edges.map((e) => ({
      id: e.id,
      type: e.type,
      sourceEntityId: e.sourceEntityId,
      targetEntityId: e.targetEntityId,
      sourceEntityName: e.sourceEntityName,
      targetEntityName: e.targetEntityName,
      documentId: e.documentId,
      chunkId: e.chunkId,
      evidence: e.evidence,
      confidence: e.confidence,
    }));

    return {
      documentId: id,
      filename: doc.filename,
      nodes: subgraph.nodes,
      edges: subgraph.edges,
      relationships,
    };
  }
}
