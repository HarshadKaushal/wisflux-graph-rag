import type {
  EntityRecord,
  GraphFactCitation,
  GraphPath,
  QueryExpansion,
  RerankMeta,
  SourceCitation,
} from '@graph-rag/shared';

export type ChatEvidence = {
  sources: SourceCitation[];
  graphFacts: GraphFactCitation[];
  entities: EntityRecord[];
  graphPaths: GraphPath[];
  expansion?: QueryExpansion;
  rerank?: RerankMeta;
  query?: string;
  hops?: number;
  updatedAt: string;
};

const STORAGE_KEY = 'graph-rag-last-evidence';
export const EVIDENCE_EVENT = 'graph-rag-evidence';

export const emptyEvidence = (): ChatEvidence => ({
  sources: [],
  graphFacts: [],
  entities: [],
  graphPaths: [],
  updatedAt: new Date(0).toISOString(),
});

export function saveChatEvidence(
  evidence: Omit<ChatEvidence, 'updatedAt'> & { updatedAt?: string },
): ChatEvidence {
  const payload: ChatEvidence = {
    ...evidence,
    updatedAt: evidence.updatedAt ?? new Date().toISOString(),
  };
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    window.dispatchEvent(new Event(EVIDENCE_EVENT));
  }
  return payload;
}

export function loadChatEvidence(): ChatEvidence | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ChatEvidence;
  } catch {
    return null;
  }
}

export function subscribeChatEvidence(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const handler = () => onChange();
  window.addEventListener(EVIDENCE_EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(EVIDENCE_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}
