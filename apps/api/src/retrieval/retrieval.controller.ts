import { Body, Controller, Post } from '@nestjs/common';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import type { HybridRetrievalResponse } from '@graph-rag/shared';
import { RetrievalService } from './retrieval.service';

class HybridRetrievalDto {
  @IsString()
  query!: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  documentIds?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  topK?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2)
  hops?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  minConfidence?: number;

  @IsOptional()
  @IsBoolean()
  expandQuery?: boolean;
}

@Controller('retrieval')
export class RetrievalController {
  constructor(private readonly retrievalService: RetrievalService) {}

  @Post('hybrid')
  async hybrid(
    @Body() body: HybridRetrievalDto,
  ): Promise<HybridRetrievalResponse> {
    return this.retrievalService.hybrid(body.query, {
      documentIds: body.documentIds,
      topK: body.topK,
      hops: body.hops,
      minConfidence: body.minConfidence,
      expandQuery: body.expandQuery,
    });
  }
}
