import { Injectable } from '@nestjs/common';
import { PdfParser } from './pdf.parser';
import { TextParser } from './text.parser';
import type { DocumentParser, ParsedDocument } from './parser.interface';

@Injectable()
export class ParserRegistry {
  private readonly parsers: DocumentParser[];

  constructor() {
    this.parsers = [new PdfParser(), new TextParser()];
  }

  parse(filePath: string, mimeType: string, filename: string): Promise<ParsedDocument> {
    const parser = this.parsers.find((p) => p.supports(mimeType, filename));
    if (!parser) {
      throw new Error(
        `Unsupported file type: ${mimeType}. Supported: PDF, TXT, Markdown.`,
      );
    }
    return parser.parse(filePath);
  }
}
