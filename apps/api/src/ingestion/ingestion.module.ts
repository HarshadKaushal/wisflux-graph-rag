import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentEntity } from '../documents/entities/document.entity';
import { ChunkEntity } from '../documents/entities/chunk.entity';
import { CacheModule } from '../cache/cache.module';
import { EmbeddingsModule } from '../embeddings/embeddings.module';
import { GraphModule } from '../graph/graph.module';
import { VectorModule } from '../vector/vector.module';
import { ChunkerService } from './chunking/chunker.service';
import { IngestionService } from './ingestion.service';
import { ParserRegistry } from './parsers/parser.registry';

@Module({
  imports: [
    TypeOrmModule.forFeature([DocumentEntity, ChunkEntity]),
    CacheModule,
    EmbeddingsModule,
    VectorModule,
    GraphModule,
  ],
  providers: [ParserRegistry, ChunkerService, IngestionService],
  exports: [IngestionService],
})
export class IngestionModule {}
