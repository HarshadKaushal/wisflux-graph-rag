import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import OpenAI from 'openai';
import type { ChatResponse } from '@graph-rag/shared';
import type { OpenAiConfig } from '../config/configuration';
import { RetrievalService } from '../retrieval/retrieval.service';
import {
  ANSWER_SYSTEM_PROMPT,
  buildAnswerUserPrompt,
} from './prompts/answer.prompt';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly client: OpenAI;
  private readonly chatModel: string;

  constructor(
    private readonly config: ConfigService,
    private readonly retrieval: RetrievalService,
  ) {
    const openai = this.config.get<OpenAiConfig>('openai')!;
    this.client = new OpenAI({ apiKey: openai.apiKey });
    this.chatModel = openai.chatModel;
  }

  async streamChat(
    message: string,
    res: Response,
    documentIds?: string[],
    hops = 2,
    expandQuery = true,
  ): Promise<void> {
    this.initSse(res);

    try {
      const hybrid = await this.retrieval.hybrid(message, {
        documentIds,
        hops,
        expandQuery,
      });

      this.writeEvent(res, 'metadata', {
        sources: hybrid.sources,
        graphFacts: hybrid.graphFacts,
        entities: hybrid.entities,
        graphPaths: hybrid.graphPaths,
        hops,
        expansion: hybrid.expansion,
      });

      if (hybrid.sources.length === 0 && hybrid.graphFacts.length === 0) {
        this.writeEvent(res, 'token', {
          content: "I don't have enough information to answer that question.",
        });
        this.writeEvent(res, 'done', {});
        res.end();
        return;
      }

      const userPrompt = buildAnswerUserPrompt(message, hybrid.context);

      const stream = await this.client.chat.completions.create({
        model: this.chatModel,
        temperature: 0.2,
        stream: true,
        messages: [
          { role: 'system', content: ANSWER_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          this.writeEvent(res, 'token', { content });
        }
      }

      this.writeEvent(res, 'done', {});
      res.end();
    } catch (error) {
      this.logger.error('Chat stream failed', error);
      this.writeEvent(res, 'error', {
        message: error instanceof Error ? error.message : 'Chat failed',
      });
      res.end();
    }
  }

  async chat(
    message: string,
    documentIds?: string[],
    hops = 2,
    expandQuery = true,
  ): Promise<ChatResponse> {
    const hybrid = await this.retrieval.hybrid(message, {
      documentIds,
      hops,
      expandQuery,
    });

    if (hybrid.sources.length === 0 && hybrid.graphFacts.length === 0) {
      return {
        answer: "I don't have enough information to answer that question.",
        sources: [],
        graphFacts: [],
        entities: [],
        graphPaths: [],
        expansion: hybrid.expansion,
      };
    }

    const userPrompt = buildAnswerUserPrompt(message, hybrid.context);

    const response = await this.client.chat.completions.create({
      model: this.chatModel,
      temperature: 0.2,
      messages: [
        { role: 'system', content: ANSWER_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    });

    return {
      answer: response.choices[0]?.message?.content ?? '',
      sources: hybrid.sources,
      graphFacts: hybrid.graphFacts,
      entities: hybrid.entities,
      graphPaths: hybrid.graphPaths,
      expansion: hybrid.expansion,
    };
  }

  private initSse(res: Response): void {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
  }

  private writeEvent(res: Response, event: string, data: unknown): void {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}
