'use client';

import Link from 'next/link';
import type { ChatEvidence } from '../lib/evidence-store';

export type EvidenceTab =
  | 'sources'
  | 'facts'
  | 'paths'
  | 'entities'
  | 'query'
  | 'rerank';

type Props = {
  evidence: ChatEvidence;
  hops: number;
  activeTab: EvidenceTab;
  onTabChange: (tab: EvidenceTab) => void;
  selectedPathId: string | null;
  onSelectPath: (id: string | null) => void;
};

export function EvidenceTabs({
  evidence,
  hops,
  activeTab,
  onTabChange,
  selectedPathId,
  onSelectPath,
}: Props) {
  const oneHop = evidence.graphPaths.filter((p) => p.hops === 1);
  const twoHop = evidence.graphPaths.filter((p) => p.hops === 2);

  const tabs: { id: EvidenceTab; label: string; count: number }[] = [
    { id: 'sources', label: 'Sources', count: evidence.sources.length },
    { id: 'facts', label: 'Facts', count: evidence.graphFacts.length },
    { id: 'paths', label: 'Paths', count: evidence.graphPaths.length },
    { id: 'entities', label: 'Entities', count: evidence.entities.length },
    {
      id: 'query',
      label: 'Query',
      count: evidence.expansion ? 1 : 0,
    },
    {
      id: 'rerank',
      label: 'Rerank',
      count: evidence.rerank?.applied ? 1 : 0,
    },
  ];

  return (
    <div className="evidence-panel panel">
      <div className="evidence-panel-header">
        <h2>Evidence</h2>
        <Link href="/graph" className="btn btn-secondary btn-tiny">
          Open graph
        </Link>
      </div>

      <div className="tab-row" role="tablist" aria-label="Evidence sections">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={activeTab === tab.id ? 'tab active' : 'tab'}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
            <span className="tab-count">{tab.count}</span>
          </button>
        ))}
      </div>

      <div className="tab-body" role="tabpanel">
        {activeTab === 'sources' &&
          (evidence.sources.length === 0 ? (
            <p className="muted">No chunk sources yet.</p>
          ) : (
            evidence.sources.map((s) => (
              <div key={s.id} className="evidence-item">
                <div className="evidence-id">{s.id}</div>
                <div className="muted">
                  {s.filename}
                  {s.score != null ? ` · score ${s.score.toFixed(3)}` : ''}
                </div>
                <pre className="evidence-body">{s.content.slice(0, 320)}</pre>
              </div>
            ))
          ))}

        {activeTab === 'facts' &&
          (evidence.graphFacts.length === 0 ? (
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
          ))}

        {activeTab === 'paths' &&
          (evidence.graphPaths.length === 0 ? (
            <p className="muted">
              No traversal paths yet. After a graph-heavy answer, open the Graph
              page for the interactive canvas.
            </p>
          ) : (
            <>
              <p className="muted path-viz-hint">
                {hops}-hop results · click a path, then open Graph to visualize
              </p>
              {oneHop.length > 0 && (
                <div className="path-group">
                  <div className="muted path-group-label">1-hop</div>
                  {oneHop.map((p) => (
                    <PathRow
                      key={p.id}
                      id={p.id}
                      summary={p.summary}
                      active={selectedPathId === p.id}
                      onClick={() =>
                        onSelectPath(selectedPathId === p.id ? null : p.id)
                      }
                    />
                  ))}
                </div>
              )}
              {twoHop.length > 0 && (
                <div className="path-group">
                  <div className="muted path-group-label">2-hop</div>
                  {twoHop.map((p) => (
                    <PathRow
                      key={p.id}
                      id={p.id}
                      summary={p.summary}
                      active={selectedPathId === p.id}
                      onClick={() =>
                        onSelectPath(selectedPathId === p.id ? null : p.id)
                      }
                    />
                  ))}
                </div>
              )}
              <Link href="/graph" className="btn btn-primary btn-block">
                Visualize paths
              </Link>
            </>
          ))}

        {activeTab === 'entities' &&
          (evidence.entities.length === 0 ? (
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
          ))}

        {activeTab === 'query' &&
          (!evidence.expansion ? (
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
          ))}

        {activeTab === 'rerank' &&
          (!evidence.rerank ? (
            <p className="muted">No re-rank yet (or disabled).</p>
          ) : (
            <div className="expansion-block">
              <p className="muted">
                {evidence.rerank.applied
                  ? 'LLM re-ordered candidates after vector/graph retrieval.'
                  : 'Re-rank skipped or unchanged (too few candidates).'}
              </p>
              {evidence.rerank.sourcesBefore.length > 0 && (
                <div className="rerank-columns">
                  <div>
                    <div className="muted path-group-label">Sources before</div>
                    <ol className="rerank-list">
                      {evidence.rerank.sourcesBefore.map((label, i) => (
                        <li key={`sb-${i}`}>{label}</li>
                      ))}
                    </ol>
                  </div>
                  <div>
                    <div className="muted path-group-label">Sources after</div>
                    <ol className="rerank-list">
                      {evidence.rerank.sourcesAfter.map((label, i) => (
                        <li key={`sa-${i}`}>{label}</li>
                      ))}
                    </ol>
                  </div>
                </div>
              )}
              {evidence.rerank.factsAfter.length > 0 && (
                <div className="rerank-columns">
                  <div>
                    <div className="muted path-group-label">Facts before</div>
                    <ol className="rerank-list">
                      {evidence.rerank.factsBefore.map((label, i) => (
                        <li key={`fb-${i}`}>{label}</li>
                      ))}
                    </ol>
                  </div>
                  <div>
                    <div className="muted path-group-label">Facts after</div>
                    <ol className="rerank-list">
                      {evidence.rerank.factsAfter.map((label, i) => (
                        <li key={`fa-${i}`}>{label}</li>
                      ))}
                    </ol>
                  </div>
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}

function PathRow({
  id,
  summary,
  active,
  onClick,
}: {
  id: string;
  summary: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={active ? 'evidence-item path-item active' : 'evidence-item path-item'}
      onClick={onClick}
    >
      <div className="evidence-id">{id}</div>
      <div className="path-summary">{summary}</div>
    </button>
  );
}
