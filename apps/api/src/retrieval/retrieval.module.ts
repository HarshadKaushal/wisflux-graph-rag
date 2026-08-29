import { Module } from '@nestjs/common';
import { ExtractionModule } from '../extraction/extraction.module';
import { GraphModule } from '../graph/graph.module';
import { VectorModule } from '../vector/vector.module';
import { RetrievalController } from './retrieval.controller';
import { RetrievalService } from './retrieval.service';

@Module({
  imports: [VectorModule, GraphModule, ExtractionModule],
  controllers: [RetrievalController],
  providers: [RetrievalService],
  exports: [RetrievalService],
})
export class RetrievalModule {}
