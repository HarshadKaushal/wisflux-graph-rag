'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  DocumentRecord,
  EntityRecord,
  GraphFactCitation,
  GraphPath,
  QueryExpansion,
  SourceCitation,
} from '@graph-rag/shared';
import { listDocuments, streamChat } from '../../lib/api';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type Evidence = {
  sources: SourceCitation[];
  graphFacts: GraphFactCitation[];
  entities: EntityRecord[];
  graphPaths: GraphPath[];
  expansion?: QueryExpansion;
};

const STORAGE_KEY = 'graph-rag-selected-doc';
const HOPS_KEY = 'graph-rag-hops';
const EXPAND_KEY = 'graph-rag-expand-query';

export default function ChatPage() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [hops, setHops] = useState<1 | 2>(2);
  const [expandQuery, setExpandQuery] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<Evidence>({
    sources: [],
    graphFacts: [],
    entities: [],
    graphPaths: [],
  });
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadDocs = useCallback(async () => {
    try {
      const docs = await listDocuments();
      const ready = docs.filter((d) => d.status === 'completed');
      setDocuments(ready);

      const saved =
        typeof window !== 'undefined'
          ? localStorage.getItem(STORAGE_KEY)
          : null;
      if (saved && ready.some((d) => d.id === saved)) {
        setSelectedDocId(saved);
      } else if (ready[0]) {
        setSelectedDocId(ready[0].id);
      }

      const savedHops = localStorage.getItem(HOPS_KEY);
      if (savedHops === '1' || savedHops === '2') {
        setHops(Number(savedHops) as 1 | 2);
      }

      const savedExpand = localStorage.getItem(EXPAND_KEY);
      if (savedExpand === '0') setExpandQuery(false);
      if (savedExpand === '1') setExpandQuery(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    }
  }, []);

  useEffect(() => {
    void loadDocs();
  }, [loadDocs]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function onSelectDoc(id: string) {
    setSelectedDocId(id);
    localStorage.setItem(STORAGE_KEY, id);
  }

  function onSelectHops(value: 1 | 2) {
    setHops(value);
    localStorage.setItem(HOPS_KEY, String(value));
  }

  function onToggleExpand(value: boolean) {
    setExpandQuery(value);
    localStorage.setItem(EXPAND_KEY, value ? '1' : '0');
  }

  async function onSend() {
    const text = input.trim();
    if (!text || busy) return;

    setBusy(true);
    setError(null);
    setInput('');

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
    };
    const assistantId = `a-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: assistantId, role: 'assistant', content: '' },
    ]);

    try {
      await streamChat(
        text,
        selectedDocId ? [selectedDocId] : undefined,
        {
          onMetadata: (data) => {
            setEvidence({
              sources: data.sources ?? [],
              graphFacts: data.graphFacts ?? [],
              entities: data.entities ?? [],
              graphPaths: data.graphPaths ?? [],
              expansion: data.expansion,
            });
          },
          onToken: (content) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: m.content + content }
                  : m,
              ),
            );
          },
          onError: (message) => setError(message),
        },
        hops,
        expandQuery,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chat failed');
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId && !m.content
            ? { ...m, content: 'Something went wrong.' }
            : m,
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  const oneHopPaths = evidence.graphPaths.filter((p) => p.hops === 1);
  const twoHopPaths = evidence.graphPaths.filter((p) => p.hops === 2);

  return (
    <main className="chat-layout">
      <section className="chat-main">
        <h1>Chat</h1>
        <p className="lede">
          Ask questions grounded in document chunks and graph relationships.
        </p>

        <div className="panel tight controls-row controls-row-3">
          <div className="control">
            <label className="field-label" htmlFor="doc-select">
              Scope to document
            </label>
            <select
              id="doc-select"
              value={selectedDocId}
              onChange={(e) => onSelectDoc(e.target.value)}
              disabled={documents.length === 0}
            >
              {documents.length === 0 ? (
                <option value="">No completed documents — upload first</option>
              ) : (
                documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.filename} ({d.entityCount ?? 0} entities)
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="control">
            <label className="field-label" htmlFor="hops-select">
              Graph hops
            </label>
            <select
              id="hops-select"
              value={hops}
              onChange={(e) => onSelectHops(Number(e.target.value) as 1 | 2)}
            >
              <option value={1}>1 hop (direct neighbors)</option>
              <option value={2}>2 hops (multi-hop)</option>
            </select>
          </div>

          <div className="control">
            <label className="field-label" htmlFor="expand-select">
              Query expansion
            </label>
            <select
              id="expand-select"
              value={expandQuery ? 'on' : 'off'}
              onChange={(e) => onToggleExpand(e.target.value === 'on')}
            >
              <option value="on">On (LLM rewrite)</option>
              <option value="off">Off</option>
            </select>
          </div>
        </div>

        <div className="chat-thread panel">
          {messages.length === 0 ? (
            <p className="muted">
              Try a vague question with expansion on: &quot;who started
              acme?&quot; or multi-hop: &quot;How is Carol Diaz connected to
              Beta Labs?&quot;
            </p>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={
                  m.role === 'user' ? 'bubble bubble-user' : 'bubble bubble-ai'
                }
              >
                <div className="bubble-role">
                  {m.role === 'user' ? 'You' : 'Assistant'}
                </div>
                <div className="bubble-content">
                  {m.content || (busy ? '…' : '')}
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {error && <p className="status-error">{error}</p>}

        <div className="composer">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question…"
            rows={3}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void onSend();
              }
            }}
          />
          <button
            className="btn btn-primary"
            disabled={busy || !input.trim() || !selectedDocId}
            onClick={() => void onSend()}
          >
            {busy ? 'Thinking…' : 'Send'}
          </button>
        </div>
      </section>

      <aside className="chat-side">
        <div className="panel">
          <h2>Query expansion</h2>
          {!evidence.expansion ? (
            <p className="muted">No expansion yet (or disabled).</p>
          ) : (
            <div className="expansion-block">
              <div className="muted path-group-label">Original</div>
              <p>{evidence.expansion.original}</p>
              <div className="muted path-group-label">Rewritten</div>
              <p className="path-summary">{evidence.expansion.rewritten}</p>
              {evidence.expansion.alternatives.length > 0 && (
                <>
                  <div className="muted path-group-label">Alternatives</div>
                  <ul className="entity-list">
                    {evidence.expansion.alternatives.map((alt) => (
                      <li key={alt}>{alt}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>

        <div className="panel">
          <h2>Sources</h2>
          {evidence.sources.length === 0 ? (
            <p className="muted">No chunk sources yet.</p>
          ) : (
            evidence.sources.map((s) => (
              <div key={s.id} className="evidence-item">
                <div className="evidence-id">{s.id}</div>
                <div className="muted">
                  {s.filename}
                  {s.score != null ? ` · score ${s.score.toFixed(3)}` : ''}
                </div>
                <pre className="evidence-body">{s.content.slice(0, 400)}</pre>
              </div>
            ))
          )}
        </div>

        <div className="panel">
          <h2>Graph facts</h2>
          {evidence.graphFacts.length === 0 ? (
            <p className="muted">No graph facts yet.</p>
          ) : (
            evidence.graphFacts.map((f) => (
              <div key={f.id} className="evidence-item">
                <div className="evidence-id">{f.id}</div>
                <div>
                  <strong>{f.sourceEntityName}</strong>{' '}
                  <span className="rel-type">[{f.type}]</span>{' '}
                  <strong>{f.targetEntityName}</strong>
                </div>
                {f.evidence && (
                  <p className="muted">&ldquo;{f.evidence}&rdquo;</p>
                )}
              </div>
            ))
          )}
        </div>

        <div className="panel">
          <h2>
            Graph paths ({hops} hop{hops > 1 ? 's' : ''})
          </h2>
          {evidence.graphPaths.length === 0 ? (
            <p className="muted">No traversal paths yet.</p>
          ) : (
            <>
              {oneHopPaths.length > 0 && (
                <div className="path-group">
                  <div className="muted path-group-label">1-hop</div>
                  {oneHopPaths.map((p) => (
                    <div key={p.id} className="evidence-item">
                      <div className="evidence-id">{p.id}</div>
                      <div className="path-summary">{p.summary}</div>
                    </div>
                  ))}
                </div>
              )}
              {twoHopPaths.length > 0 && (
                <div className="path-group">
                  <div className="muted path-group-label">2-hop</div>
                  {twoHopPaths.map((p) => (
                    <div key={p.id} className="evidence-item">
                      <div className="evidence-id">{p.id}</div>
                      <div className="path-summary">{p.summary}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="panel">
          <h2>Entities</h2>
          {evidence.entities.length === 0 ? (
            <p className="muted">No matched entities yet.</p>
          ) : (
            <ul className="entity-list">
              {evidence.entities.map((e) => (
                <li key={e.id}>
                  <strong>{e.name}</strong>
                  <span className="muted"> · {e.type}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </main>
  );
}
