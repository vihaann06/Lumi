import type { Reference } from '@/lib/types/references'

export interface SynthesisMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ReferenceContext {
  id: string
  sourceDocTitle: string | null
  pageNumber: number | null
  selectedText: string
  refLabel: string
}

export function refsToContext(refs: Reference[], indexOffset = 0): ReferenceContext[] {
  return refs.map((r, i) => ({
    id: r.id,
    sourceDocTitle: r.sourceDocTitle,
    pageNumber: r.pageNumber,
    selectedText: r.selectedText,
    refLabel: `R${i + 1 + indexOffset}`,
  }))
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
