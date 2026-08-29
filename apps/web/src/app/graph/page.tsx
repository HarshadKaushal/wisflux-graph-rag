'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { PathGraphViz } from '../../components/PathGraphViz';
import {
  emptyEvidence,
  loadChatEvidence,
  subscribeChatEvidence,
  type ChatEvidence,
} from '../../lib/evidence-store';

export default function GraphPage() {
  const [evidence, setEvidence] = useState<ChatEvidence>(emptyEvidence);
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const refresh = () => {
      setEvidence(loadChatEvidence() ?? emptyEvidence());
    };
    refresh();
    return subscribeChatEvidence(refresh);
  }, []);

  const oneHop = useMemo(
    () => evidence.graphPaths.filter((p) => p.hops === 1),
    [evidence.graphPaths],
  );
  const twoHop = useMemo(
    () => evidence.graphPaths.filter((p) => p.hops === 2),
    [evidence.graphPaths],
  );

  const hasPaths = evidence.graphPaths.length > 0;

  return (
    <main className="workspace graph-workspace">
      <header className="workspace-header">
        <div>
          <h1>Graph paths</h1>
          <p className="lede tight">
            Interactive view of the last chat retrieval
            {evidence.query ? (
              <>
                {' '}
                for <em>&ldquo;{evidence.query}&rdquo;</em>
              </>
            ) : null}
            .
          </p>
        </div>
        <div className="header-actions">
          <Link href="/chat" className="btn btn-secondary">
            Back to chat
          </Link>
        </div>
      </header>

      {!mounted ? (
        <div className="panel">
          <p className="muted">Loading…</p>
        </div>
      ) : !hasPaths ? (
        <div className="panel empty-state">
          <h2>No paths yet</h2>
          <p className="muted">
            Ask a relationship question in chat (e.g. Carol ↔ Beta Labs). Paths
            from that answer appear here automatically.
          </p>
          <Link href="/chat" className="btn btn-primary">
            Go to chat
          </Link>
        </div>
      ) : (
        <div className="graph-grid">
          <section className="panel graph-canvas-panel">
            <div className="panel-header">
              <h2>
                Canvas
                {evidence.hops != null ? ` · ${evidence.hops} hop` : ''}
                {evidence.hops != null && evidence.hops > 1 ? 's' : ''}
              </h2>
              <span className="muted">
                {evidence.graphPaths.length} paths · {evidence.entities.length}{' '}
                entities
              </span>
            </div>
            <PathGraphViz
              paths={evidence.graphPaths}
              entities={evidence.entities}
              selectedPathId={selectedPathId}
              onSelectPath={setSelectedPathId}
              width={900}
              height={520}
            />
          </section>

          <aside className="panel graph-path-list">
            <h2>Path list</h2>
            <p className="muted path-viz-hint">
              Select a path to highlight it on the canvas.
            </p>
            {oneHop.length > 0 && (
              <div className="path-group">
                <div className="muted path-group-label">1-hop</div>
                {oneHop.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={
                      selectedPathId === p.id
                        ? 'evidence-item path-item active'
                        : 'evidence-item path-item'
                    }
                    onClick={() =>
                      setSelectedPathId((cur) => (cur === p.id ? null : p.id))
                    }
                  >
                    <div className="evidence-id">{p.id}</div>
                    <div className="path-summary">{p.summary}</div>
                  </button>
                ))}
              </div>
            )}
            {twoHop.length > 0 && (
              <div className="path-group">
                <div className="muted path-group-label">2-hop</div>
                {twoHop.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={
                      selectedPathId === p.id
                        ? 'evidence-item path-item active'
                        : 'evidence-item path-item'
                    }
                    onClick={() =>
                      setSelectedPathId((cur) => (cur === p.id ? null : p.id))
                    }
                  >
                    <div className="evidence-id">{p.id}</div>
                    <div className="path-summary">{p.summary}</div>
                  </button>
                ))}
              </div>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}
