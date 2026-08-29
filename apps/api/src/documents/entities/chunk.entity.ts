import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DocumentEntity } from './document.entity';

@Entity('chunks')
export class ChunkEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'document_id' })
  documentId!: string;

  @ManyToOne(() => DocumentEntity, (document) => document.chunks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'document_id' })
  document!: DocumentEntity;

  @Column({ name: 'chunk_index', type: 'int' })
  chunkIndex!: number;

  @Column({ type: 'text' })
  content!: string;

  @Column({ name: 'token_count', type: 'int', default: 0 })
  tokenCount!: number;

  @Column({ name: 'page_number', type: 'int', nullable: true })
  pageNumber?: number;

  @Column({ name: 'section_heading', nullable: true })
  sectionHeading?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
