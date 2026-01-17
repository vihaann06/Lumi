import { SupabaseClient } from '@supabase/supabase-js'

export async function getFolderMeta(supabase: SupabaseClient | null, folderId: string | null) {
  if (!supabase || !folderId) return null
  const { data, error } = await supabase
    .from('folders')
    .select('name, account_id, workspace_id')
    .eq('id', folderId)
    .maybeSingle()

  if (error || !data) return null
  return data
}

export async function listFolderDocuments(
  supabase: SupabaseClient | null,
  folderId: string | null
) {
  if (!supabase || !folderId) return []
  const { data, error } = await supabase
    .from('documents')
    .select('id, title, doc_type, updated_at, document_assets ( kind, bucket, path )')
    .eq('folder_id', folderId)
    .order('updated_at', { ascending: false })
  if (error || !data) return []
  return data
}

