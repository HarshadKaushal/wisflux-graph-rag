import { Body, Controller, Post } from '@nestjs/common';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import type { GraphSearchResponse } from '@graph-rag/shared';
import { GraphSearchService } from './graph-search.service';

class GraphSearchDto {
  @IsString()
  query!: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  documentIds?: string[];

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
}

@Controller('search')
export class GraphSearchController {
  constructor(private readonly graphSearchService: GraphSearchService) {}

  @Post('graph')
  async search(@Body() body: GraphSearchDto): Promise<GraphSearchResponse> {
    return this.graphSearchService.search(
      body.query,
      body.documentIds,
      body.hops ?? 2,
      body.minConfidence ?? 0.5,
    );
  }
}
