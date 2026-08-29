import type {
  ChatResponse,
  DocumentListResponse,
  DocumentRecord,
  DocumentStatusResponse,
  HealthCheckResponse,
  UploadDocumentResponse,
} from '@graph-rag/shared';

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function fetchHealth(): Promise<HealthCheckResponse | null> {
  try {
    const res = await fetch(`${API_URL}/health`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function listDocuments(): Promise<DocumentRecord[]> {
  const data = await parseJson<DocumentListResponse>(
    await fetch(`${API_URL}/documents`, { cache: 'no-store' }),
  );
  return data.documents;
}

export async function getDocumentStatus(
  id: string,
): Promise<DocumentStatusResponse> {
  return parseJson(
    await fetch(`${API_URL}/documents/${id}/status`, { cache: 'no-store' }),
  );
}

export async function uploadDocument(
  file: File,
): Promise<UploadDocumentResponse> {
  const form = new FormData();
  form.append('file', file);
  return parseJson(
    await fetch(`${API_URL}/documents/upload`, {
      method: 'POST',
      body: form,
    }),
  );
}

export async function chat(
  message: string,
  documentIds?: string[],
  hops = 2,
  expandQuery = true,
  rerank = true,
): Promise<ChatResponse> {
  return parseJson(
    await fetch(`${API_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        documentIds,
        hops,
        expandQuery,
        rerank,
      }),
    }),
  );
}

export type StreamHandlers = {
  onMetadata?: (data: {
    sources: ChatResponse['sources'];
    graphFacts: ChatResponse['graphFacts'];
    entities: ChatResponse['entities'];
    graphPaths: ChatResponse['graphPaths'];
    hops?: number;
    expansion?: ChatResponse['expansion'];
    rerank?: ChatResponse['rerank'];
    cache?: ChatResponse['cache'];
  }) => void;
  onToken?: (content: string) => void;
  onDone?: () => void;
  onError?: (message: string) => void;
};

export async function streamChat(
  message: string,
  documentIds: string[] | undefined,
  handlers: StreamHandlers,
  hops = 2,
  expandQuery = true,
  rerank = true,
): Promise<void> {
  const res = await fetch(`${API_URL}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      documentIds,
      hops,
      expandQuery,
      rerank,
    }),
  });

  if (!res.ok || !res.body) {
    throw new Error(`Stream failed (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';

    for (const part of parts) {
      const lines = part.split('\n');
      let event = 'message';
      let data = '';
      for (const line of lines) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (!data) continue;

      try {
        const parsed = JSON.parse(data) as Record<string, unknown>;
        if (event === 'metadata') {
          handlers.onMetadata?.(parsed as never);
        } else if (event === 'token') {
          handlers.onToken?.(String(parsed.content ?? ''));
        } else if (event === 'done') {
          handlers.onDone?.();
        } else if (event === 'error') {
          handlers.onError?.(String(parsed.message ?? 'Chat failed'));
        }
      } catch {
        // ignore malformed SSE chunks
      }
    }
  }
}
