import { Module } from '@nestjs/common';
import { EmbeddingsModule } from '../embeddings/embeddings.module';
import { VectorSearchController } from './vector-search.controller';
import { VectorService } from './vector.service';

@Module({
  imports: [EmbeddingsModule],
  controllers: [VectorSearchController],
  providers: [VectorService],
  exports: [VectorService],
})
export class VectorModule {}
