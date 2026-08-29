import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { DocumentStatus } from '@graph-rag/shared';
import { ChunkEntity } from './chunk.entity';

@Entity('documents')
export class DocumentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  filename!: string;

  @Column({ name: 'mime_type' })
  mimeType!: string;

  @Column({ name: 'file_path' })
  filePath!: string;

  @Column({ default: 'pending' })
  status!: DocumentStatus;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ name: 'page_count', type: 'int', nullable: true })
  pageCount?: number;

  @Column({ name: 'chunk_count', type: 'int', default: 0 })
  chunkCount!: number;

  @Column({ name: 'entity_count', type: 'int', default: 0 })
  entityCount!: number;

  @OneToMany(() => ChunkEntity, (chunk) => chunk.document)
  chunks!: ChunkEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
