'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DocumentRecord } from '@graph-rag/shared';
import {
  EvidenceTabs,
  type EvidenceTab,
} from '../../components/EvidenceTabs';
import {
  emptyEvidence,
  saveChatEvidence,
  type ChatEvidence,
} from '../../lib/evidence-store';
import { listDocuments, streamChat } from '../../lib/api';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

const STORAGE_KEY = 'graph-rag-selected-doc';
const HOPS_KEY = 'graph-rag-hops';
const EXPAND_KEY = 'graph-rag-expand-query';
const RERANK_KEY = 'graph-rag-rerank';

export default function ChatPage() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [hops, setHops] = useState<1 | 2>(2);
  const [expandQuery, setExpandQuery] = useState(true);
  const [rerank, setRerank] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<ChatEvidence>(emptyEvidence);
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<EvidenceTab>('sources');
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

      const savedRerank = localStorage.getItem(RERANK_KEY);
      if (savedRerank === '0') setRerank(false);
      if (savedRerank === '1') setRerank(true);
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

  function onToggleRerank(value: boolean) {
    setRerank(value);
    localStorage.setItem(RERANK_KEY, value ? '1' : '0');
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
            const next = saveChatEvidence({
              sources: data.sources ?? [],
              graphFacts: data.graphFacts ?? [],
              entities: data.entities ?? [],
              graphPaths: data.graphPaths ?? [],
              expansion: data.expansion,
              rerank: data.rerank,
              query: text,
              hops,
            });
            setEvidence(next);
            setSelectedPathId(null);
            if (data.rerank?.applied) setActiveTab('rerank');
            else if ((data.graphPaths?.length ?? 0) > 0) setActiveTab('paths');
            else if ((data.sources?.length ?? 0) > 0) setActiveTab('sources');
            else if ((data.graphFacts?.length ?? 0) > 0) setActiveTab('facts');
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
        rerank,
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

  return (
    <main className="workspace chat-workspace">
      <section className="chat-main">
        <header className="workspace-header">
          <div>
            <h1>Chat</h1>
            <p className="lede tight">
              Grounded answers with citations — evidence stays in the side panel.
            </p>
          </div>
        </header>

        <div className="panel tight controls-row controls-row-4">
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

          <div className="control">
            <label className="field-label" htmlFor="rerank-select">
              Re-ranking
            </label>
            <select
              id="rerank-select"
              value={rerank ? 'on' : 'off'}
              onChange={(e) => onToggleRerank(e.target.value === 'on')}
            >
              <option value="on">On (LLM reorder)</option>
              <option value="off">Off</option>
            </select>
          </div>
        </div>

        <div className="chat-thread panel">
          {messages.length === 0 ? (
            <p className="muted">
              Try &quot;who started acme?&quot; or &quot;How is Carol Diaz
              connected to Beta Labs?&quot;
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
            rows={2}
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
        <EvidenceTabs
          evidence={evidence}
          hops={hops}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          selectedPathId={selectedPathId}
          onSelectPath={setSelectedPathId}
        />
      </aside>
    </main>
  );
}
