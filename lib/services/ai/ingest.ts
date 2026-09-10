import { postAI } from './apiClient'

export interface IngestResult {
  docId: string
  chunks: number
  windows: number
  requests: number
  embeddingModel: string
  totalTokens: number
}

export async function ingestDocument(docId: string): Promise<IngestResult> {
  return postAI<IngestResult>('/api/ingest/document', { docId })
}

/**
 * Kicks off ingestion without making the caller wait.
 *
 * Embedding a long paper is several seconds of Voyage calls; blocking an
 * upload on it would be a poor trade for a feature the user cannot see yet.
 * A failure here is logged and left for a later re-index rather than surfaced,
 * since the document itself uploaded fine.
 */
export function ingestDocumentInBackground(docId: string): void {
  void ingestDocument(docId)
    .then((result) => {
      console.info(
        `Indexed ${result.chunks} chunks for ${docId} (${result.requests} request(s), ${result.totalTokens} tokens).`
      )
    })
    .catch((err) => {
      console.warn(`Background indexing failed for ${docId}:`, err?.message || err)
    })
}
