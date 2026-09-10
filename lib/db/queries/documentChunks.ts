import type { SupabaseClient } from '@supabase/supabase-js'
import type { TextChunk } from '@/lib/utils/chunking'

export interface ChunkInsert extends TextChunk {
  embedding: number[] | null
  embeddingModel: string | null
}

/**
 * Replaces a document's chunks.
 *
 * Ingestion is idempotent by design: re-running it for a document wipes the
 * previous chunks first, so a re-index cannot leave a mix of old and new rows
 * behind (the unique constraint on (doc_id, chunk_index) would otherwise make
 * a shorter re-chunk silently retain the tail of the old one).
 */
export async function replaceDocumentChunks(
  supabase: SupabaseClient,
  input: {
    docId: string
    folderId: string
    workspaceId: string
    accountId: string
    chunks: ChunkInsert[]
  }
): Promise<{ ok: boolean; inserted: number; error?: string }> {
  const { error: deleteError } = await supabase
    .from('document_chunks')
    .delete()
    .eq('doc_id', input.docId)

  if (deleteError) {
    return { ok: false, inserted: 0, error: deleteError.message }
  }

  if (!input.chunks.length) {
    return { ok: true, inserted: 0 }
  }

  const rows = input.chunks.map((chunk) => ({
    doc_id: input.docId,
    folder_id: input.folderId,
    workspace_id: input.workspaceId,
    account_id: input.accountId,
    chunk_index: chunk.chunkIndex,
    page_start: chunk.pageStart,
    page_end: chunk.pageEnd,
    content: chunk.content,
    char_count: chunk.charCount,
    embedding: chunk.embedding,
    embedding_model: chunk.embedding ? chunk.embeddingModel : null,
    embedded_at: chunk.embedding ? new Date().toISOString() : null,
  }))

  // Chunked inserts: a long paper can produce hundreds of 1024-float vectors,
  // which is a large enough request body to be worth splitting.
  const BATCH_SIZE = 100
  let inserted = 0

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const slice = rows.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from('document_chunks').insert(slice)
    if (error) {
      return { ok: false, inserted, error: error.message }
    }
    inserted += slice.length
  }

  return { ok: true, inserted }
}

export async function countDocumentChunks(
  supabase: SupabaseClient,
  docId: string
): Promise<{ total: number; embedded: number }> {
  const { count: total } = await supabase
    .from('document_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('doc_id', docId)

  const { count: embedded } = await supabase
    .from('document_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('doc_id', docId)
    .not('embedding', 'is', null)

  return { total: total ?? 0, embedded: embedded ?? 0 }
}
