import type { SupabaseClient } from '@supabase/supabase-js'
import { embedChunkWindows, isVoyageConfigured } from './voyageClient'

export interface RetrievedChunk {
  id: string
  docId: string
  docTitle: string | null
  chunkIndex: number
  pageStart: number | null
  pageEnd: number | null
  content: string
  similarity: number
}

export interface RetrieveOptions {
  folderId: string
  query: string
  matchCount?: number
  minSimilarity?: number
  /** Usually the document the user is already looking at. */
  excludeDocId?: string | null
}

/**
 * Folder-scoped semantic search.
 *
 * Fails soft on purpose. Retrieval is an enhancement layered onto prompts that
 * already work, and nothing is indexed until a Voyage key exists, so every
 * failure path returns [] and leaves the caller's prompt exactly as it was.
 */
export async function retrieveRelevantChunks(
  supabase: SupabaseClient,
  options: RetrieveOptions
): Promise<RetrievedChunk[]> {
  const query = options.query?.trim()
  if (!query || !options.folderId) return []
  if (!isVoyageConfigured()) return []

  try {
    // input_type 'query' applies Voyage's retrieval-side prompt, which is what
    // makes query and document vectors comparable. A single query is still one
    // one-element inner list.
    const embedded = await embedChunkWindows([[query]], 'query')
    const queryEmbedding = embedded.windows[0]?.[0]
    if (!queryEmbedding) return []

    const { data, error } = await supabase.rpc('match_document_chunks', {
      query_embedding: queryEmbedding,
      p_folder_id: options.folderId,
      match_count: options.matchCount ?? 8,
      min_similarity: options.minSimilarity ?? 0.3,
      exclude_doc_id: options.excludeDocId ?? null,
    })

    if (error) {
      console.warn('Chunk retrieval failed:', error.message)
      return []
    }

    return (data ?? []).map((row: any) => ({
      id: row.id,
      docId: row.doc_id,
      docTitle: row.doc_title ?? null,
      chunkIndex: row.chunk_index,
      pageStart: row.page_start ?? null,
      pageEnd: row.page_end ?? null,
      content: row.content,
      similarity: Number(row.similarity) || 0,
    }))
  } catch (err: any) {
    console.warn('Chunk retrieval failed:', err?.message || err)
    return []
  }
}

/**
 * Renders retrieved chunks as a prompt block.
 *
 * Passages are labelled [S1], [S2], ... to keep them distinct from the user's
 * curated [R1] references: those were chosen deliberately, these were found
 * automatically, and the model should not present them with equal authority.
 * Returns '' for an empty result so callers can concatenate unconditionally.
 */
export function formatRetrievedContext(chunks: RetrievedChunk[]): string {
  if (!chunks.length) return ''

  const body = chunks
    .map((chunk, i) => {
      const pages =
        chunk.pageStart && chunk.pageEnd
          ? chunk.pageStart === chunk.pageEnd
            ? ` p.${chunk.pageStart}`
            : ` pp.${chunk.pageStart}-${chunk.pageEnd}`
          : ''
      return `[S${i + 1}] "${chunk.docTitle || 'Untitled'}"${pages}:\n"${chunk.content}"`
    })
    .join('\n\n')

  return `\n\nRelated passages retrieved from other documents in this workspace. These were surfaced by similarity search, not chosen by the user, so treat them as leads rather than as the user's cited references. Cite them as [S1], [S2] and say so plainly when one is only tangentially relevant:\n${body}`
}

/**
 * Resolves the folder a request belongs to from the identifiers a route
 * already receives, so retrieval can be added without changing any client.
 * Reads go through the caller-scoped client, so RLS still applies.
 */
export async function resolveFolderId(
  supabase: SupabaseClient,
  hints: { docId?: string | null; referenceId?: string | null }
): Promise<string | null> {
  if (hints.docId) {
    const { data } = await supabase
      .from('documents')
      .select('folder_id')
      .eq('id', hints.docId)
      .maybeSingle()
    if (data?.folder_id) return data.folder_id
  }

  if (hints.referenceId) {
    const { data } = await supabase
      .from('references')
      .select('folder_id')
      .eq('id', hints.referenceId)
      .maybeSingle()
    if (data?.folder_id) return data.folder_id
  }

  return null
}
