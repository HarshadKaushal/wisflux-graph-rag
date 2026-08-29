declare module 'pdf-parse' {
  interface PdfParseResult {
    numpages: number;
    text: string;
  }

  function pdf(data: Buffer, options?: Record<string, unknown>): Promise<PdfParseResult>;
  export default pdf;
}
