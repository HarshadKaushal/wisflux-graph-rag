import Link from 'next/link';
import { fetchHealth } from '../lib/api';

function StatusBadge({ status }: { status: string }) {
  const kind =
    status === 'up'
      ? 'up'
      : status === 'not_configured'
        ? 'not-configured'
        : 'down';
  return <span className={`badge badge-${kind}`}>{status}</span>;
}

export default async function HomePage() {
  const health = await fetchHealth();
  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

  return (
    <main>
      <h1>Graph RAG</h1>
      <p className="lede">
        Upload documents, extract a knowledge graph, and ask grounded questions
        with chunk citations and graph facts.
      </p>

      <div className="home-actions">
        <Link href="/upload" className="btn btn-primary">
          Upload documents
        </Link>
        <Link href="/chat" className="btn btn-secondary">
          Open chat
        </Link>
        <Link href="/graph" className="btn btn-secondary">
          Graph paths
        </Link>
      </div>

      <div className="panel">
        <h2>API Health</h2>
        {!health ? (
          <p className="status-error">
            Cannot reach API at {apiUrl}. Start Docker and run{' '}
            <code>pnpm dev:api</code>.
          </p>
        ) : (
          <>
            <p className={`status-${health.status}`}>
              Overall: <strong>{health.status}</strong>
            </p>
            <div className="services">
              {Object.entries(health.services).map(([name, svc]) => (
                <div key={name} className="service-row">
                  <span>{name}</span>
                  <StatusBadge status={svc.status} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
