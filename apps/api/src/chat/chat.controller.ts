import { Body, Controller, Post, Res } from '@nestjs/common';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import type { Response } from 'express';
import type { ChatRequest, ChatResponse } from '@graph-rag/shared';
import { ChatService } from './chat.service';

class ChatDto implements ChatRequest {
  @IsString()
  message!: string;

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
  @IsBoolean()
  expandQuery?: boolean;

  @IsOptional()
  @IsBoolean()
  rerank?: boolean;
}

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  async chat(@Body() body: ChatDto): Promise<ChatResponse> {
    return this.chatService.chat(
      body.message,
      body.documentIds,
      body.hops,
      body.expandQuery,
      body.rerank,
    );
  }

  @Post('stream')
  async streamChat(
    @Body() body: ChatDto,
    @Res() res: Response,
  ): Promise<void> {
    await this.chatService.streamChat(
      body.message,
      res,
      body.documentIds,
      body.hops,
      body.expandQuery,
      body.rerank,
    );
  }
}
