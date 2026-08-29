export type DocumentStatus =
  | 'pending'
  | 'parsing'
  | 'parsed'
  | 'extracting'
  | 'embedding'
  | 'completed'
  | 'failed';

export interface DocumentRecord {
  id: string;
  filename: string;
  mimeType: string;
  filePath: string;
  status: DocumentStatus;
  errorMessage?: string;
  pageCount?: number;
  chunkCount?: number;
  entityCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChunkRecord {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  pageNumber?: number;
  sectionHeading?: string;
  metadata?: Record<string, unknown>;
}

export interface EntityRecord {
  id: string;
  name: string;
  type: string;
  normalizedName: string;
  documentIds: string[];
  chunkIds: string[];
}

export interface RelationshipRecord {
  id: string;
  type: string;
  sourceEntityId: string;
  targetEntityId: string;
  sourceEntityName: string;
  targetEntityName: string;
  documentId: string;
  chunkId: string;
  evidence?: string;
  confidence?: number;
}

export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  services: {
    postgres: ServiceStatus;
    neo4j: ServiceStatus;
    openai: ServiceStatus;
  };
}

export interface ServiceStatus {
  status: 'up' | 'down' | 'not_configured';
  message?: string;
}

export interface DocumentListResponse {
  documents: DocumentRecord[];
}

export interface DocumentStatusResponse {
  id: string;
  status: DocumentStatus;
  errorMessage?: string;
  chunkCount?: number;
  entityCount?: number;
  updatedAt: string;
}

export interface UploadDocumentResponse {
  documentId: string;
  filename: string;
  status: DocumentStatus;
}

export interface DocumentDetailResponse extends DocumentRecord {
  chunks?: ChunkRecord[];
}

export const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
] as const;

export const SUPPORTED_EXTENSIONS = ['.pdf', '.txt', '.md'] as const;

export interface VectorSearchRequest {
  query: string;
  topK?: number;
  documentIds?: string[];
}

export interface VectorSearchResult {
  chunkId: string;
  content: string;
  score: number;
  documentId: string;
  chunkIndex: number;
  pageNumber?: number;
  sectionHeading?: string;
  filename?: string;
}

export interface VectorSearchResponse {
  results: VectorSearchResult[];
}

export interface SourceCitation {
  id: string;
  chunkId: string;
  documentId: string;
  filename?: string;
  content: string;
  pageNumber?: number;
  sectionHeading?: string;
  score?: number;
}

export interface ChatRequest {
  message: string;
  documentIds?: string[];
  hops?: number;
  /** When true (default), rewrite the query with an LLM before retrieval */
  expandQuery?: boolean;
  /** When true (default), LLM re-ranks chunks + graph facts after retrieval */
  rerank?: boolean;
}

export interface QueryExpansion {
  original: string;
  rewritten: string;
  alternatives: string[];
}

export interface RerankMeta {
  applied: boolean;
  /** Short labels in pre-rerank order */
  sourcesBefore: string[];
  /** Short labels in post-rerank order (final [S*] order) */
  sourcesAfter: string[];
  factsBefore: string[];
  factsAfter: string[];
}

export interface ChatResponse {
  answer: string;
  sources: SourceCitation[];
  graphFacts: GraphFactCitation[];
  entities: EntityRecord[];
  graphPaths: GraphPath[];
  expansion?: QueryExpansion;
  rerank?: RerankMeta;
}

export interface GraphSearchRequest {
  query: string;
  documentIds?: string[];
  hops?: number;
  minConfidence?: number;
}

export interface GraphPath {
  id: string;
  startEntityId: string;
  startEntityName: string;
  hops: number;
  entityIds: string[];
  relationships: RelationshipRecord[];
  /** Human-readable multi-hop chain, e.g. A -[LEADS]-> B -[WORKS_AT]-> C */
  summary: string;
}

export interface GraphSearchResponse {
  queryEntities: EntityRecord[];
  entities: EntityRecord[];
  relationships: RelationshipRecord[];
  graphPaths: GraphPath[];
}

export interface GraphFactCitation {
  id: string;
  type: string;
  sourceEntityName: string;
  targetEntityName: string;
  evidence?: string;
  confidence?: number;
  documentId: string;
  chunkId: string;
}

export interface HybridRetrievalRequest {
  query: string;
  documentIds?: string[];
  topK?: number;
  hops?: number;
  minConfidence?: number;
  expandQuery?: boolean;
  rerank?: boolean;
}

export interface HybridRetrievalResponse {
  sources: SourceCitation[];
  graphFacts: GraphFactCitation[];
  graphPaths: GraphPath[];
  entities: EntityRecord[];
  context: string;
  expansion?: QueryExpansion;
  rerank?: RerankMeta;
}
