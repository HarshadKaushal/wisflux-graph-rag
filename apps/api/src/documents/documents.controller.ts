import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type {
  DocumentDetailResponse,
  DocumentListResponse,
  DocumentStatusResponse,
  UploadDocumentResponse,
} from '@graph-rag/shared';
import { DocumentsService } from './documents.service';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UploadDocumentResponse> {
    return this.documentsService.upload(file);
  }

  @Post(':id/embed')
  async embedDocument(@Param('id') id: string): Promise<DocumentStatusResponse> {
    return this.documentsService.embedDocument(id);
  }

  @Post(':id/extract-graph')
  async extractGraph(@Param('id') id: string): Promise<DocumentStatusResponse> {
    return this.documentsService.extractGraph(id);
  }

  @Get()
  async listDocuments(): Promise<DocumentListResponse> {
    const documents = await this.documentsService.findAll();
    return { documents };
  }

  @Get(':id/status')
  async getDocumentStatus(
    @Param('id') id: string,
  ): Promise<DocumentStatusResponse> {
    return this.documentsService.getStatus(id);
  }

  @Get(':id')
  async getDocument(@Param('id') id: string): Promise<DocumentDetailResponse> {
    const document = await this.documentsService.findDetail(id);
    if (!document) {
      throw new NotFoundException(`Document ${id} not found`);
    }
    return document;
  }
}
