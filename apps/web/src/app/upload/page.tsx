'use client';

import { useCallback, useEffect, useState } from 'react';
import type { DocumentRecord } from '@graph-rag/shared';
import {
  getDocumentStatus,
  listDocuments,
  uploadDocument,
} from '../../lib/api';

function statusClass(status: string): string {
  if (status === 'completed') return 'badge-up';
  if (status === 'failed') return 'badge-down';
  return 'badge-not-configured';
}

export default function UploadPage() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const refresh = useCallback(async () => {
    try {
      const docs = await listDocuments();
      setDocuments(docs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const watchIds = documents
      .filter((d) =>
        ['pending', 'parsing', 'embedding', 'extracting'].includes(d.status),
      )
      .map((d) => d.id);

    if (watchIds.length === 0) return;

    const timer = setInterval(() => {
      void (async () => {
        for (const id of watchIds) {
          try {
            const status = await getDocumentStatus(id);
            setDocuments((prev) =>
              prev.map((d) =>
                d.id === id
                  ? {
                      ...d,
                      status: status.status,
                      errorMessage: status.errorMessage,
                      chunkCount: status.chunkCount,
                      entityCount: status.entityCount,
                      updatedAt: status.updatedAt,
                    }
                  : d,
              ),
            );
          } catch {
            // ignore transient poll errors
          }
        }
      })();
    }, 2500);

    return () => clearInterval(timer);
  }, [documents]);

  async function onUpload() {
    if (!selectedFile) return;
    setUploading(true);
    setError(null);
    try {
      const result = await uploadDocument(selectedFile);
      setSelectedFile(null);
      await refresh();
      // Ensure the new doc appears even before list refresh settles
      setDocuments((prev) => {
        if (prev.some((d) => d.id === result.documentId)) return prev;
        return [
          {
            id: result.documentId,
            filename: result.filename,
            mimeType: selectedFile.type || 'application/octet-stream',
            filePath: '',
            status: result.status,
            chunkCount: 0,
            entityCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          ...prev,
        ];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <main>
      <h1>Upload</h1>
      <p className="lede">
        Upload PDF, TXT, or Markdown. The pipeline parses, embeds, and extracts
        a knowledge graph automatically.
      </p>

      <div className="panel">
        <h2>New document</h2>
        <div className="upload-row">
          <input
            type="file"
            accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
            onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
          />
          <button
            className="btn btn-primary"
            disabled={!selectedFile || uploading}
            onClick={() => void onUpload()}
          >
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
        {selectedFile && (
          <p className="muted">Selected: {selectedFile.name}</p>
        )}
        {error && <p className="status-error">{error}</p>}
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2>Documents</h2>
          <button className="btn btn-secondary" onClick={() => void refresh()}>
            Refresh
          </button>
        </div>

        {documents.length === 0 ? (
          <p className="muted">No documents yet.</p>
        ) : (
          <div className="doc-table">
            {documents.map((doc) => (
              <div key={doc.id} className="doc-row">
                <div>
                  <strong>{doc.filename}</strong>
                  <div className="muted mono">{doc.id}</div>
                </div>
                <div className="doc-meta">
                  <span className={`badge ${statusClass(doc.status)}`}>
                    {doc.status}
                  </span>
                  <span className="muted">
                    {doc.chunkCount ?? 0} chunks · {doc.entityCount ?? 0}{' '}
                    entities
                  </span>
                </div>
                {doc.errorMessage && (
                  <p className="status-error">{doc.errorMessage}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
