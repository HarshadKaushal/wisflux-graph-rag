import { readFile } from 'fs/promises';
import { extname } from 'path';
import pdf from 'pdf-parse';
import type { DocumentParser, ParsedDocument, ParsedSegment } from './parser.interface';

export class PdfParser implements DocumentParser {
  supports(mimeType: string, filename: string): boolean {
    return (
      mimeType === 'application/pdf' || extname(filename).toLowerCase() === '.pdf'
    );
  }

  async parse(filePath: string): Promise<ParsedDocument> {
    const buffer = await readFile(filePath);
    const data = await pdf(buffer);
    const fullText = data.text?.trim() ?? '';

    if (fullText.length < 50) {
      throw new Error(
        'PDF contains insufficient extractable text. Scanned/image PDFs are not supported.',
      );
    }

    const pageTexts = fullText.split('\f').map((p) => p.trim()).filter(Boolean);
    const segments: ParsedSegment[] =
      pageTexts.length > 1
        ? pageTexts.map((content, index) => ({
            content,
            pageNumber: index + 1,
          }))
        : [{ content: fullText, pageNumber: 1 }];

    return {
      segments,
      pageCount: data.numpages,
      fullText,
    };
  }
}
