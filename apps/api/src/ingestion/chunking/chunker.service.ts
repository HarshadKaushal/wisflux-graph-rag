import { Injectable } from '@nestjs/common';
import type { ParsedSegment } from '../parsers/parser.interface';

export interface ChunkDraft {
  content: string;
  chunkIndex: number;
  tokenCount: number;
  pageNumber?: number;
  sectionHeading?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class ChunkerService {
  private readonly chunkSize = 3000;
  private readonly chunkOverlap = 200;

  chunkSegments(segments: ParsedSegment[]): ChunkDraft[] {
    const drafts: ChunkDraft[] = [];
    let index = 0;

    for (const segment of segments) {
      const pieces = this.splitText(segment.content);
      for (const piece of pieces) {
        drafts.push({
          content: piece,
          chunkIndex: index++,
          tokenCount: this.estimateTokens(piece),
          pageNumber: segment.pageNumber,
          sectionHeading: segment.sectionHeading,
        });
      }
    }

    return drafts;
  }

  private splitText(text: string): string[] {
    const normalized = text.replace(/\r\n/g, '\n').trim();
    if (normalized.length <= this.chunkSize) {
      return [normalized];
    }

    const chunks: string[] = [];
    let start = 0;

    while (start < normalized.length) {
      let end = Math.min(start + this.chunkSize, normalized.length);

      if (end < normalized.length) {
        const breakAt = normalized.lastIndexOf('\n\n', end);
        if (breakAt > start + this.chunkSize * 0.5) {
          end = breakAt;
        }
      }

      chunks.push(normalized.slice(start, end).trim());
      if (end >= normalized.length) break;
      start = Math.max(end - this.chunkOverlap, start + 1);
    }

    return chunks.filter(Boolean);
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
