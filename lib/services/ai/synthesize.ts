import type { Reference } from '@/lib/types/references'

export interface SynthesisMessage {
  role: 'user' | 'assistant'
  content: string
  groundednessScore?: number | null
}

export interface EditProposal {
  summary: string
  proposedContent: string
  referenceMentions?: ReferenceMention[]
}

export interface ReferenceContext {
  id: string
  sourceDocTitle: string | null
  pageNumber: number | null
  selectedText: string
  refLabel: string
}

export interface ReferenceMention {
  referenceId: string
  refLabel: string
  citationCount: number
  firstLine: number | null
}

export interface WriterSpanActionResult {
  content: string
  groundednessScore?: number | null
  analysisSummary?: string | null
}

export function refsToContext(refs: Reference[], indexOffset = 0): ReferenceContext[] {
  return refs.map((r, i) => ({
    id: r.id,
    sourceDocTitle: r.sourceDocTitle,
    pageNumber: r.pageNumber,
    selectedText: r.selectedText,
    refLabel: `R${r.referenceNumber || i + 1 + indexOffset}`,
  }))
}

export function extractReferenceMentions(
  content: string,
  references: ReferenceContext[]
): ReferenceMention[] {
  if (!content?.trim() || !references.length) return []

  const refByLabel = new Map(
    references.map((ref) => [ref.refLabel.toUpperCase(), ref])
  )
  const mentionByReference = new Map<string, ReferenceMention>()
  const lines = content.split('\n')
  const markerRegex = /\[(R\d+)\]/gi

  lines.forEach((line, idx) => {
    markerRegex.lastIndex = 0
    let match: RegExpExecArray | null = markerRegex.exec(line)
    while (match) {
      const refLabel = String(match[1] || '').toUpperCase()
      const mapped = refByLabel.get(refLabel)
      if (mapped) {
        const existing = mentionByReference.get(mapped.id)
        if (existing) {
          existing.citationCount += 1
          if (existing.firstLine === null || idx + 1 < existing.firstLine) {
            existing.firstLine = idx + 1
          }
        } else {
          mentionByReference.set(mapped.id, {
            referenceId: mapped.id,
            refLabel,
            citationCount: 1,
            firstLine: idx + 1,
          })
        }
      }
      match = markerRegex.exec(line)
    }
  })

  return Array.from(mentionByReference.values()).sort((a, b) => {
    const aLine = a.firstLine ?? Number.MAX_SAFE_INTEGER
    const bLine = b.firstLine ?? Number.MAX_SAFE_INTEGER
    return aLine - bLine
  })
}

export async function synthesizeChat(
  messages: SynthesisMessage[],
  references: ReferenceContext[],
  documentContent?: string
): Promise<string> {
  const res = await fetch('/api/ai/synthesize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, references, documentContent }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Synthesis request failed')
  }

  const data = await res.json()
  return data.content
}

export async function synthesizeEditProposal(
  instruction: string,
  references: ReferenceContext[],
  documentContent: string
): Promise<EditProposal> {
  const res = await fetch('/api/ai/synthesize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'edit',
      instruction,
      references,
      documentContent,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Edit request failed')
  }

  const data = await res.json()
  if (!data?.proposal?.proposedContent) {
    throw new Error('No edit proposal returned')
  }

  return data.proposal as EditProposal
}

export async function synthesizeWriterSpanAction(args: {
  actionMode: 'support' | 'connect' | 'evaluate_grounding'
  selectedText: string
  references: ReferenceContext[]
  documentContent: string
}): Promise<WriterSpanActionResult> {
  const res = await fetch('/api/ai/synthesize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Writer span action failed')
  }

  const data = await res.json()
  return {
    content: data?.content || '',
    groundednessScore:
      typeof data?.groundednessScore === 'number' ? data.groundednessScore : null,
    analysisSummary:
      typeof data?.analysisSummary === 'string' ? data.analysisSummary : null,
  }
}
