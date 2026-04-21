import type { SupabaseClient } from '@supabase/supabase-js'

let hasWarnedMissingDocumentContentsTable = false

function isMissingDocumentContentsTableError(error: any): boolean {
  if (!error) return false
  const code = String(error.code || '')
  const status = Number(error.status || 0)
  const message = String(error.message || '').toLowerCase()
  return (
    status === 404 ||
    code === '42P01' ||
    code === 'PGRST205' ||
    message.includes('document_contents') ||
    (message.includes('relation') && message.includes('does not exist'))
  )
}

function warnMissingDocumentContentsTableOnce() {
  if (hasWarnedMissingDocumentContentsTable) return
  hasWarnedMissingDocumentContentsTable = true
  console.warn(
    'document_contents table is not available yet. Run migration 0008_document_contents_table.sql to enable writer DB persistence.'
  )
}

export async function getDocumentContent(
  supabase: SupabaseClient,
  docId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('document_contents')
    .select('content')
    .eq('doc_id', docId)
    .maybeSingle()

  if (error) {
    if (isMissingDocumentContentsTableError(error)) {
      warnMissingDocumentContentsTableOnce()
      return null
    }
    console.error('Failed loading document content row', error)
    return null
  }

  return typeof data?.content === 'string' ? data.content : null
}

export async function upsertDocumentContent(
  supabase: SupabaseClient,
  input: {
    docId: string
    workspaceId: string
    accountId: string
    content: string
  }
): Promise<{ ok: boolean; rlsDenied: boolean }> {
  const { error } = await supabase
    .from('document_contents')
    .upsert(
      {
        doc_id: input.docId,
        workspace_id: input.workspaceId,
        account_id: input.accountId,
        content: input.content,
      },
      { onConflict: 'doc_id' }
    )

  if (error) {
    const message = String(error.message || '').toLowerCase()
    const code = String(error.code || '')
    const rlsDenied =
      message.includes('row-level security') ||
      message.includes('violates row-level security policy') ||
      code === '42501'
    if (isMissingDocumentContentsTableError(error)) {
      warnMissingDocumentContentsTableOnce()
      return { ok: false, rlsDenied: false }
    }
    console.error('Failed upserting document content row', error)
    return { ok: false, rlsDenied }
  }

  return { ok: true, rlsDenied: false }
}
