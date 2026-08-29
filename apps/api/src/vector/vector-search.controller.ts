import { Body, Controller, Post } from '@nestjs/common';
import { IsArray, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import type { VectorSearchResponse } from '@graph-rag/shared';
import { VectorService } from './vector.service';

class VectorSearchDto {
  @IsString()
  query!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  topK?: number;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  documentIds?: string[];
}

@Controller('search')
export class VectorSearchController {
  constructor(private readonly vectorService: VectorService) {}

  @Post('vector')
  async search(@Body() body: VectorSearchDto): Promise<VectorSearchResponse> {
    const results = await this.vectorService.search(
      body.query,
      body.topK ?? 5,
      body.documentIds,
    );
    return { results };
  }
}
