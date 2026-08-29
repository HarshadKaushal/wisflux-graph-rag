import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChunkEntity } from '../documents/entities/chunk.entity';
import { DocumentEntity } from '../documents/entities/document.entity';
import { ExtractionModule } from '../extraction/extraction.module';
import { Neo4jModule } from '../database/neo4j.module';
import { GraphBuilderService } from './graph-builder.service';
import { GraphController } from './graph.controller';
import { GraphSearchController } from './graph-search.controller';
import { GraphSearchService } from './graph-search.service';
import { GraphService } from './graph.service';

@Module({
  imports: [
    Neo4jModule,
    ExtractionModule,
    TypeOrmModule.forFeature([DocumentEntity, ChunkEntity]),
  ],
  controllers: [GraphController, GraphSearchController],
  providers: [GraphService, GraphBuilderService, GraphSearchService],
  exports: [GraphService, GraphBuilderService, GraphSearchService],
})
export class GraphModule {}
