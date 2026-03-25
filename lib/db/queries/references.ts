import type { SupabaseClient } from '@supabase/supabase-js'
import type { Reference, ReferenceInsert } from '@/lib/types/references'

function rowToReference(row: any): Reference {
  return {
    id: row.id,
    accountId: row.account_id,
    folderId: row.folder_id,
    sourceDocId: row.source_doc_id,
    sourceDocTitle: row.source_doc_title,
    pageNumber: row.page_number,
    chunkId: row.chunk_id,
    selectedText: row.selected_text,
    anchorJson: row.anchor_json ?? {},
    createdAt: row.created_at,
  }
}

export async function listFolderReferences(
  supabase: SupabaseClient,
  folderId: string
): Promise<Reference[]> {
  const { data, error } = await supabase
    .from('references')
    .select('*')
    .eq('folder_id', folderId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Failed to list references', error)
    return []
  }
  return (data ?? []).map(rowToReference)
}

export async function createReference(
  supabase: SupabaseClient,
  accountId: string,
  input: ReferenceInsert
): Promise<Reference | null> {
  const { data, error } = await supabase
    .from('references')
    .insert({
      account_id: accountId,
      folder_id: input.folderId,
      source_doc_id: input.sourceDocId,
      source_doc_title: input.sourceDocTitle ?? null,
      page_number: input.pageNumber ?? null,
      chunk_id: input.chunkId ?? null,
      selected_text: input.selectedText,
      anchor_json: input.anchorJson ?? {},
    })
    .select('*')
    .single()

  if (error) {
    console.error('Failed to create reference', error)
    return null
  }
  return rowToReference(data)
}

export async function deleteReference(
  supabase: SupabaseClient,
  referenceId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('references')
    .delete()
    .eq('id', referenceId)

  if (error) {
    console.error('Failed to delete reference', error)
    return false
  }
  return true
}
