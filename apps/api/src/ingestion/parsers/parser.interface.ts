export interface ParsedSegment {
  content: string;
  pageNumber?: number;
  sectionHeading?: string;
}

export interface ParsedDocument {
  segments: ParsedSegment[];
  pageCount?: number;
  fullText: string;
}

export interface DocumentParser {
  supports(mimeType: string, filename: string): boolean;
  parse(filePath: string): Promise<ParsedDocument>;
}
