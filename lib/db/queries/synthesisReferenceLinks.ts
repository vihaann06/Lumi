import type { SupabaseClient } from '@supabase/supabase-js'

export type SynthesisReferenceMention = {
  referenceId: string
  refLabel: string
  citationCount: number
  firstLine: number | null
}

export type SynthesisUsageEntry = {
  synthesisDocId: string
  synthesisTitle: string | null
  citationCount: number
  refLabel: string | null
  firstLine: number | null
}

export type SynthesisUsageMap = Record<
  string,
  {
    count: number
    syntheses: SynthesisUsageEntry[]
  }
>

export async function listSynthesisReferenceMentionsForDocument(
  supabase: SupabaseClient,
  synthesisDocId: string
): Promise<SynthesisReferenceMention[]> {
  const { data, error } = await supabase
    .from('synthesis_reference_links')
    .select('reference_id, citation_label, citation_count, first_line')
    .eq('synthesis_doc_id', synthesisDocId)

  if (error) {
    console.error('Failed to load synthesis reference links', error)
    return []
  }

  return (data ?? [])
    .map((row: any) => ({
      referenceId: row.reference_id,
      refLabel: row.citation_label || 'R?',
      citationCount: Number(row.citation_count || 0) || 1,
      firstLine: typeof row.first_line === 'number' ? row.first_line : null,
    }))
    .sort((a, b) => {
      const aLine = a.firstLine ?? Number.MAX_SAFE_INTEGER
      const bLine = b.firstLine ?? Number.MAX_SAFE_INTEGER
      return aLine - bLine
    })
}

export async function syncSynthesisReferenceMentions(
  supabase: SupabaseClient,
  {
    accountId,
    folderId,
    synthesisDocId,
    mentions,
  }: {
    accountId: string
    folderId: string
    synthesisDocId: string
    mentions: SynthesisReferenceMention[]
  }
): Promise<boolean> {
  const normalized = mentions.filter((m) => Boolean(m.referenceId))

  if (!normalized.length) {
    const { error: deleteAllError } = await supabase
      .from('synthesis_reference_links')
      .delete()
      .eq('synthesis_doc_id', synthesisDocId)
    if (deleteAllError) {
      console.error('Failed clearing synthesis reference links', deleteAllError)
      return false
    }
    return true
  }

  const { data: existingRows, error: existingError } = await supabase
    .from('synthesis_reference_links')
    .select('reference_id')
    .eq('synthesis_doc_id', synthesisDocId)
  if (existingError) {
    console.error('Failed loading existing synthesis links', existingError)
    return false
  }

  const existingIds = new Set((existingRows ?? []).map((row: any) => String(row.reference_id)))
  const incomingIds = new Set(normalized.map((m) => m.referenceId))
  const staleIds = Array.from(existingIds).filter((id) => !incomingIds.has(id))

  if (staleIds.length > 0) {
    const { error: deleteStaleError } = await supabase
      .from('synthesis_reference_links')
      .delete()
      .eq('synthesis_doc_id', synthesisDocId)
      .in('reference_id', staleIds)
    if (deleteStaleError) {
      console.error('Failed deleting stale synthesis reference links', deleteStaleError)
      return false
    }
  }

  const upsertRows = normalized.map((mention) => ({
    account_id: accountId,
    folder_id: folderId,
    synthesis_doc_id: synthesisDocId,
    reference_id: mention.referenceId,
    citation_label: mention.refLabel,
    citation_count: mention.citationCount,
    first_line: mention.firstLine,
  }))

  const { error: upsertError } = await supabase
    .from('synthesis_reference_links')
    .upsert(upsertRows, { onConflict: 'synthesis_doc_id,reference_id' })
  if (upsertError) {
    console.error('Failed upserting synthesis reference links', upsertError)
    return false
  }

  return true
}

export async function listSynthesisUsageForReferenceIds(
  supabase: SupabaseClient,
  referenceIds: string[]
): Promise<SynthesisUsageMap> {
  const uniqueReferenceIds = Array.from(new Set(referenceIds.filter(Boolean)))
  if (!uniqueReferenceIds.length) return {}

  const { data: links, error } = await supabase
    .from('synthesis_reference_links')
    .select('reference_id, synthesis_doc_id, citation_count, citation_label, first_line')
    .in('reference_id', uniqueReferenceIds)

  if (error) {
    console.error('Failed loading synthesis usage for references', error)
    return {}
  }

  const docIds = Array.from(
    new Set((links ?? []).map((row: any) => String(row.synthesis_doc_id)).filter(Boolean))
  )

  let titleByDocId = new Map<string, string | null>()
  if (docIds.length) {
    const { data: docs, error: docsError } = await supabase
      .from('documents')
      .select('id, title')
      .in('id', docIds)
    if (docsError) {
      console.error('Failed loading synthesis document titles', docsError)
    } else {
      titleByDocId = new Map((docs ?? []).map((doc: any) => [doc.id, doc.title ?? null]))
    }
  }

  const usage: SynthesisUsageMap = {}
  ;(links ?? []).forEach((row: any) => {
    const referenceId = String(row.reference_id)
    if (!usage[referenceId]) {
      usage[referenceId] = { count: 0, syntheses: [] }
    }
    usage[referenceId].syntheses.push({
      synthesisDocId: String(row.synthesis_doc_id),
      synthesisTitle: titleByDocId.get(String(row.synthesis_doc_id)) ?? null,
      citationCount: Number(row.citation_count || 0) || 1,
      refLabel: row.citation_label ?? null,
      firstLine: typeof row.first_line === 'number' ? row.first_line : null,
    })
  })

  Object.keys(usage).forEach((referenceId) => {
    usage[referenceId].syntheses.sort((a, b) => {
      if (b.citationCount !== a.citationCount) return b.citationCount - a.citationCount
      const aLine = a.firstLine ?? Number.MAX_SAFE_INTEGER
      const bLine = b.firstLine ?? Number.MAX_SAFE_INTEGER
      return aLine - bLine
    })
    usage[referenceId].count = usage[referenceId].syntheses.length
  })

  return usage
}
