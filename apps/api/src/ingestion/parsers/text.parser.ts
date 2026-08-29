import { readFile } from 'fs/promises';
import { extname } from 'path';
import type { DocumentParser, ParsedDocument, ParsedSegment } from './parser.interface';

export class TextParser implements DocumentParser {
  supports(mimeType: string, filename: string): boolean {
    const ext = extname(filename).toLowerCase();
    return (
      mimeType === 'text/plain' ||
      mimeType === 'text/markdown' ||
      ext === '.txt' ||
      ext === '.md'
    );
  }

  async parse(filePath: string): Promise<ParsedDocument> {
    const fullText = (await readFile(filePath, 'utf-8')).trim();

    if (!fullText) {
      throw new Error('File is empty');
    }

    const isMarkdown = extname(filePath).toLowerCase() === '.md';
    const segments = isMarkdown
      ? this.splitMarkdownSections(fullText)
      : [{ content: fullText }];

    return { segments, fullText };
  }

  private splitMarkdownSections(text: string): ParsedSegment[] {
    const lines = text.split('\n');
    const segments: ParsedSegment[] = [];
    let currentHeading: string | undefined;
    let buffer: string[] = [];

    const flush = () => {
      const content = buffer.join('\n').trim();
      if (content) {
        segments.push({ content, sectionHeading: currentHeading });
      }
      buffer = [];
    };

    for (const line of lines) {
      const headingMatch = line.match(/^#{1,6}\s+(.+)/);
      if (headingMatch) {
        flush();
        currentHeading = headingMatch[1].trim();
        buffer.push(line);
      } else {
        buffer.push(line);
      }
    }

    flush();
    return segments.length > 0 ? segments : [{ content: text }];
  }
}
