import { NextRequest, NextResponse } from 'next/server'
import { requireUser, createUserScopedClient } from '@/lib/auth/requireUser'
import { loadExtractedText } from '@/lib/db/queries/documentText'
import { replaceDocumentChunks, type ChunkInsert } from '@/lib/db/queries/documentChunks'
import { chunkPages, groupIntoWindows, batchWindows } from '@/lib/utils/chunking'
import {
  embedChunkWindows,
  isVoyageConfigured,
  VOYAGE_EMBEDDING_MODEL,
} from '@/lib/services/ai/voyageClient'

// Embedding a long paper is several sequential Voyage calls.
export const maxDuration = 300

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request)
    if ('response' in auth) return auth.response

    const { docId } = await request.json()
    if (!docId || typeof docId !== 'string') {
      return NextResponse.json({ error: 'docId is required' }, { status: 400 })
    }

    if (!isVoyageConfigured()) {
      return NextResponse.json(
        { error: 'Embeddings are not configured. Set VOYAGE_API_KEY.' },
        { status: 503 }
      )
    }

    // Act as the caller so RLS decides what this request may touch. A docId
    // belonging to someone else simply reads back as missing.
    const supabase = createUserScopedClient(auth.token)
    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase is not configured on the server.' },
        { status: 500 }
      )
    }

    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('id, folder_id, workspace_id, account_id')
      .eq('id', docId)
      .maybeSingle()

    if (docError || !doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const extracted = await loadExtractedText(supabase, docId)
    if (!extracted?.pages?.length) {
      return NextResponse.json(
        {
          error:
            'No extracted text for this document. It may predate text extraction, or have no text layer.',
        },
        { status: 409 }
      )
    }

    const chunks = chunkPages(extracted.pages)
    if (!chunks.length) {
      return NextResponse.json({ error: 'Document produced no chunks' }, { status: 409 })
    }

    // Windows keep each contextual group under Voyage's per-list token cap;
    // batches keep each HTTP request under its per-request caps.
    const windows = groupIntoWindows(chunks)
    const batches = batchWindows(windows)

    const embeddingByChunkIndex = new Map<number, number[]>()
    let totalTokens = 0

    for (const batch of batches) {
      const payload = batch.windows.map((w) => w.chunks.map((c) => c.content))
      const result = await embedChunkWindows(payload, 'document')
      totalTokens += result.totalTokens

      result.windows.forEach((embeddings, windowIdx) => {
        const windowChunks = batch.windows[windowIdx].chunks
        embeddings.forEach((embedding, chunkIdx) => {
          embeddingByChunkIndex.set(windowChunks[chunkIdx].chunkIndex, embedding)
        })
      })
    }

    const toInsert: ChunkInsert[] = chunks.map((chunk) => ({
      ...chunk,
      embedding: embeddingByChunkIndex.get(chunk.chunkIndex) ?? null,
      embeddingModel: VOYAGE_EMBEDDING_MODEL,
    }))

    const written = await replaceDocumentChunks(supabase, {
      docId,
      folderId: doc.folder_id,
      workspaceId: doc.workspace_id,
      accountId: doc.account_id,
      chunks: toInsert,
    })

    if (!written.ok) {
      return NextResponse.json(
        { error: written.error || 'Failed writing chunks' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      docId,
      chunks: written.inserted,
      windows: windows.length,
      requests: batches.length,
      embeddingModel: VOYAGE_EMBEDDING_MODEL,
      totalTokens,
    })
  } catch (error: any) {
    console.error('Error ingesting document:', error)
    return NextResponse.json(
      { error: error?.message || 'Ingestion failed' },
      { status: 500 }
    )
  }
}
