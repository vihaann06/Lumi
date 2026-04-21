import type { SupabaseClient } from '@supabase/supabase-js'
import type { Reference } from '@/lib/types/references'

function rowToReference(row: any): Reference {
  return {
    id: row.id,
    referenceNumber: Number(row.reference_number || 0),
    accountId: row.account_id,
    folderId: row.folder_id,
    sourceDocId: row.source_doc_id,
    sourceDocTitle: row.source_doc_title,
    pageNumber: row.page_number,
    chunkId: row.chunk_id,
    selectedText: row.selected_text,
    anchorJson: row.anchor_json ?? {},
    createdAt: row.created_at,
    deletedAt: row.deleted_at ?? null,
  }
}

/** List all references attached to a specific file */
export async function listFileReferences(
  supabase: SupabaseClient,
  fileId: string
): Promise<Reference[]> {
  // Step 1: get reference IDs for this file
  const { data: joins, error: joinError } = await supabase
    .from('file_references')
    .select('reference_id')
    .eq('file_id', fileId)

  if (joinError || !joins?.length) {
    if (joinError) console.error('Failed to list file references', joinError)
    return []
  }

  const refIds = joins.map((j: any) => j.reference_id)

  // Step 2: fetch full reference rows
  const { data: refs, error: refError } = await supabase
    .from('references')
    .select('*')
    .in('id', refIds)
    .order('reference_number', { ascending: true })

  if (refError) {
    console.error('Failed to fetch references', refError)
    return []
  }

  return (refs ?? []).map(rowToReference)
}

/** Attach a reference to a file (idempotent — ignores duplicates) */
export async function attachReferenceToFile(
  supabase: SupabaseClient,
  accountId: string,
  fileId: string,
  referenceId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('file_references')
    .upsert(
      { account_id: accountId, file_id: fileId, reference_id: referenceId },
      { onConflict: 'file_id,reference_id' }
    )

  if (error) {
    console.error('Failed to attach reference to file', error)
    return false
  }
  return true
}

/** Detach a reference from a file */
export async function detachReferenceFromFile(
  supabase: SupabaseClient,
  fileId: string,
  referenceId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('file_references')
    .delete()
    .eq('file_id', fileId)
    .eq('reference_id', referenceId)

  if (error) {
    console.error('Failed to detach reference from file', error)
    return false
  }
  return true
}
