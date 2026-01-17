import { SupabaseClient } from '@supabase/supabase-js'

type CreateDocumentParams = {
  title: string
  folderId: string
  workspaceId: string
  accountId: string
  ownerUserId: string | null
  docType: string
  mimeType: string
  fileBucket: string
  filePath: string
  status?: string
}

export async function createDocument(
  supabase: SupabaseClient | null,
  params: CreateDocumentParams
) {
  if (!supabase) return null

  const {
    title,
    folderId,
    workspaceId,
    accountId,
    ownerUserId,
    docType,
    mimeType,
    fileBucket,
    filePath,
    status = 'ready',
  } = params

  const { data, error } = await supabase
    .from('documents')
    .insert({
      title,
      folder_id: folderId,
      workspace_id: workspaceId,
      account_id: accountId,
      owner_user_id: ownerUserId,
      doc_type: docType,
      mime_type: mimeType,
      file_bucket: fileBucket,
      file_path: filePath,
      status,
    })
    .select('id')
    .single()

  if (error || !data?.id) return null
  return data.id as string
}

