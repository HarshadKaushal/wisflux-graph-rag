import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { Repository } from 'typeorm';
import type {
  ChunkRecord,
  DocumentDetailResponse,
  DocumentRecord,
  DocumentStatusResponse,
  UploadDocumentResponse,
} from '@graph-rag/shared';
import { SUPPORTED_EXTENSIONS } from '@graph-rag/shared';
import type { AppConfig } from '../config/configuration';
import { IngestionService } from '../ingestion/ingestion.service';
import { ChunkEntity } from './entities/chunk.entity';
import { DocumentEntity } from './entities/document.entity';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(DocumentEntity)
    private readonly documentsRepo: Repository<DocumentEntity>,
    @InjectRepository(ChunkEntity)
    private readonly chunksRepo: Repository<ChunkEntity>,
    private readonly ingestionService: IngestionService,
    private readonly config: ConfigService,
  ) {}

  async upload(file: Express.Multer.File): Promise<UploadDocumentResponse> {
    this.validateFile(file);

    const document = this.documentsRepo.create({
      filename: file.originalname,
      mimeType: file.mimetype,
      filePath: '',
      status: 'pending',
    });
    await this.documentsRepo.save(document);

    const appConfig = this.config.get<AppConfig>('app')!;
    const docDir = join(appConfig.uploadDir, document.id);
    await mkdir(docDir, { recursive: true });

    const savedPath = join(docDir, file.originalname);
    await writeFile(savedPath, file.buffer);

    document.filePath = savedPath;
    await this.documentsRepo.save(document);

    this.ingestionService.ingestDocument(document.id);

    return {
      documentId: document.id,
      filename: document.filename,
      status: 'pending',
    };
  }

  async findAll(): Promise<DocumentRecord[]> {
    const docs = await this.documentsRepo.find({
      order: { createdAt: 'DESC' },
    });
    return docs.map((doc) => this.toRecord(doc));
  }

  async findById(id: string): Promise<DocumentRecord | null> {
    const doc = await this.documentsRepo.findOne({ where: { id } });
    return doc ? this.toRecord(doc) : null;
  }

  async findDetail(id: string): Promise<DocumentDetailResponse | null> {
    const doc = await this.documentsRepo.findOne({ where: { id } });
    if (!doc) return null;

    const chunks = await this.chunksRepo.find({
      where: { documentId: id },
      order: { chunkIndex: 'ASC' },
    });

    return {
      ...this.toRecord(doc),
      chunks: chunks.map((chunk) => this.toChunkRecord(chunk)),
    };
  }

  async getStatus(id: string): Promise<DocumentStatusResponse> {
    const doc = await this.documentsRepo.findOne({ where: { id } });
    if (!doc) {
      throw new NotFoundException(`Document ${id} not found`);
    }

    return {
      id: doc.id,
      status: doc.status,
      errorMessage: doc.errorMessage,
      chunkCount: doc.chunkCount,
      entityCount: doc.entityCount,
      updatedAt: doc.updatedAt.toISOString(),
    };
  }

  async embedDocument(id: string): Promise<DocumentStatusResponse> {
    const doc = await this.documentsRepo.findOne({ where: { id } });
    if (!doc) {
      throw new NotFoundException(`Document ${id} not found`);
    }

    void this.ingestionService.embedDocument(id);
    return this.getStatus(id);
  }

  async extractGraph(id: string): Promise<DocumentStatusResponse> {
    const doc = await this.documentsRepo.findOne({ where: { id } });
    if (!doc) {
      throw new NotFoundException(`Document ${id} not found`);
    }

    void this.ingestionService.extractGraph(id);
    return this.getStatus(id);
  }

  private validateFile(file: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const ext = extname(file.originalname).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.includes(ext as (typeof SUPPORTED_EXTENSIONS)[number])) {
      throw new BadRequestException(
        `Unsupported file extension "${ext}". Supported: ${SUPPORTED_EXTENSIONS.join(', ')}`,
      );
    }

    const appConfig = this.config.get<AppConfig>('app')!;
    const maxBytes = appConfig.maxUploadSizeMb * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new BadRequestException(
        `File exceeds maximum size of ${appConfig.maxUploadSizeMb}MB`,
      );
    }
  }

  private toRecord(doc: DocumentEntity): DocumentRecord {
    return {
      id: doc.id,
      filename: doc.filename,
      mimeType: doc.mimeType,
      filePath: doc.filePath,
      status: doc.status,
      errorMessage: doc.errorMessage,
      pageCount: doc.pageCount,
      chunkCount: doc.chunkCount,
      entityCount: doc.entityCount,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }

  private toChunkRecord(chunk: ChunkEntity): ChunkRecord {
    return {
      id: chunk.id,
      documentId: chunk.documentId,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      tokenCount: chunk.tokenCount,
      pageNumber: chunk.pageNumber,
      sectionHeading: chunk.sectionHeading,
      metadata: chunk.metadata,
    };
  }
}
