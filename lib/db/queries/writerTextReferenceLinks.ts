import type { SupabaseClient } from '@supabase/supabase-js'

let hasWarnedMissingWriterLinksTable = false

function isMissingWriterLinksTableError(error: any): boolean {
  if (!error) return false
  const code = String(error.code || '')
  const status = Number(error.status || 0)
  const message = String(error.message || '').toLowerCase()
  return (
    status === 404 ||
    code === '42P01' ||
    code === 'PGRST205' ||
    message.includes('writer_text_reference_links') ||
    (message.includes('relation') && message.includes('does not exist'))
  )
}

function warnMissingWriterLinksTableOnce() {
  if (hasWarnedMissingWriterLinksTable) return
  hasWarnedMissingWriterLinksTable = true
  console.warn(
    'writer_text_reference_links table is not available yet. Run migration 0010_writer_text_reference_links.sql to enable writer span provenance links.'
  )
}

export type WriterReferenceActionType = 'cite' | 'support' | 'connect' | 'evaluate_grounding'

export type WriterTextReferenceLink = {
  id: string
  synthesisDocId: string
  referenceId: string
  spanStart: number
  spanEnd: number
  selectedTextSnapshot: string
  actionType: WriterReferenceActionType
  groundednessScore: number | null
  analysisSummary: string | null
  createdAt: string
}

export type WriterTextReferenceLinkInsert = {
  accountId: string
  workspaceId: string
  folderId: string
  synthesisDocId: string
  referenceId: string
  spanStart: number
  spanEnd: number
  selectedTextSnapshot: string
  actionType: WriterReferenceActionType
  groundednessScore?: number | null
  analysisSummary?: string | null
}

function rowToWriterTextReferenceLink(row: any): WriterTextReferenceLink {
  return {
    id: row.id,
    synthesisDocId: row.synthesis_doc_id,
    referenceId: row.reference_id,
    spanStart: row.span_start,
    spanEnd: row.span_end,
    selectedTextSnapshot: row.selected_text_snapshot || '',
    actionType: row.action_type,
    groundednessScore:
      typeof row.groundedness_score === 'number' ? row.groundedness_score : null,
    analysisSummary: row.analysis_summary || null,
    createdAt: row.created_at,
  }
}

export async function createWriterTextReferenceLink(
  supabase: SupabaseClient,
  input: WriterTextReferenceLinkInsert
): Promise<WriterTextReferenceLink | null> {
  const { data, error } = await supabase
    .from('writer_text_reference_links')
    .insert({
      account_id: input.accountId,
      workspace_id: input.workspaceId,
      folder_id: input.folderId,
      synthesis_doc_id: input.synthesisDocId,
      reference_id: input.referenceId,
      span_start: input.spanStart,
      span_end: input.spanEnd,
      selected_text_snapshot: input.selectedTextSnapshot,
      action_type: input.actionType,
      groundedness_score: input.groundednessScore ?? null,
      analysis_summary: input.analysisSummary ?? null,
    })
    .select('*')
    .single()

  if (error) {
    if (isMissingWriterLinksTableError(error)) {
      warnMissingWriterLinksTableOnce()
      return null
    }
    console.error('Failed creating writer text-reference link', error)
    return null
  }

  return rowToWriterTextReferenceLink(data)
}

export async function listWriterTextReferenceLinksForDocument(
  supabase: SupabaseClient,
  synthesisDocId: string
): Promise<WriterTextReferenceLink[]> {
  const { data, error } = await supabase
    .from('writer_text_reference_links')
    .select('*')
    .eq('synthesis_doc_id', synthesisDocId)
    .order('created_at', { ascending: true })

  if (error) {
    if (isMissingWriterLinksTableError(error)) {
      warnMissingWriterLinksTableOnce()
      return []
    }
    console.error('Failed loading writer text-reference links', error)
    return []
  }

  return (data ?? []).map(rowToWriterTextReferenceLink)
}

export async function listWriterTextReferenceLinksForReferenceIds(
  supabase: SupabaseClient,
  referenceIds: string[]
): Promise<WriterTextReferenceLink[]> {
  const uniqueReferenceIds = Array.from(new Set(referenceIds.filter(Boolean)))
  if (!uniqueReferenceIds.length) return []

  const { data, error } = await supabase
    .from('writer_text_reference_links')
    .select('*')
    .in('reference_id', uniqueReferenceIds)
    .order('created_at', { ascending: false })

  if (error) {
    if (isMissingWriterLinksTableError(error)) {
      warnMissingWriterLinksTableOnce()
      return []
    }
    console.error('Failed loading writer text-reference links by reference', error)
    return []
  }

  return (data ?? []).map(rowToWriterTextReferenceLink)
}
