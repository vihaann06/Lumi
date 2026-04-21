import { NextRequest, NextResponse } from 'next/server'
import { isClaudeConfigured, requestClaude } from '@/lib/services/ai/claudeServer'

interface ReferenceContext {
  id: string
  sourceDocTitle: string | null
  pageNumber: number | null
  selectedText: string
  refLabel: string
}

function parseJsonObject(raw: string) {
  try {
    return JSON.parse(raw)
  } catch {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return null
    try {
      return JSON.parse(match[0])
    } catch {
      return null
    }
  }
}

function buildSystemPrompt(references: ReferenceContext[]): string {
  const refBlock = references
    .map(
      (r) =>
        `[${r.refLabel}] from "${r.sourceDocTitle || 'Untitled'}"${r.pageNumber ? ` (p.${r.pageNumber})` : ''}:\n"${r.selectedText}"`
    )
    .join('\n\n')

  return `You are a grounded synthesis writing assistant for an academic research workspace called Lumi.

The user is writing a synthesis document and has collected specific references from source PDFs. Your role is to help them integrate these references into coherent, well-grounded writing.

REFERENCES PROVIDED:
${refBlock}

GUIDELINES:
- Treat the provided references as primary evidence. Ground your writing in them.
- When using a reference, cite it naturally (e.g., "As noted in [R1]..." or "According to [R2]...").
- Help bridge, integrate, and synthesize claims across references.
- Support transitions, argument construction, and thematic connections.
- Do not fabricate claims beyond what the references support. If you infer or extend, clearly mark it.
- Match the user's writing tone and style when visible from their draft.
- Be concise and direct. Produce writing the user can directly use or adapt.`
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      mode,
      instruction,
      messages,
      references,
      documentContent,
    }: {
      mode?: 'ask' | 'edit'
      instruction?: string
      messages: { role: string; content: string }[]
      references: ReferenceContext[]
      documentContent?: string
    } = body

    if (!isClaudeConfigured()) {
      return NextResponse.json(
        { error: 'Claude API key not configured. Set ANTHROPIC_API_KEY in .env.' },
        { status: 500 }
      )
    }

    const systemPrompt = buildSystemPrompt(references || [])
    const docContext = documentContent
      ? `\n\nThe user's current document draft:\n\n${documentContent.slice(0, mode === 'edit' ? 20000 : 3000)}`
      : ''

    if (mode === 'edit') {
      if (!instruction?.trim()) {
        return NextResponse.json(
          { error: 'Edit instruction is required' },
          { status: 400 }
        )
      }

      const editPrompt = `You are in EDIT mode. Propose concrete document edits for the user.

Return ONLY valid JSON with this exact shape:
{
  "summary": "1-2 sentence summary of what changed and why",
  "proposedContent": "full revised document text"
}

Rules:
- Always return the FULL revised document as proposedContent.
- Preserve the user's style unless instruction says otherwise.
- Use references when relevant and do not invent facts.
- Keep improvements targeted to the instruction.

User instruction:
${instruction}`

      const content = await requestClaude({
        system: `${systemPrompt}${docContext}`,
        messages: [{ role: 'user', content: editPrompt }],
        maxTokens: 3500,
        temperature: 0.4,
      })

      const parsed = parseJsonObject(content)
      const proposal = {
        summary:
          typeof parsed?.summary === 'string' && parsed.summary.trim()
            ? parsed.summary.trim()
            : 'Proposed edits are ready for review.',
        proposedContent:
          typeof parsed?.proposedContent === 'string' && parsed.proposedContent.trim()
            ? parsed.proposedContent
            : '',
      }

      if (!proposal.proposedContent) {
        return NextResponse.json(
          { error: 'Failed to parse proposed edits from model output' },
          { status: 500 }
        )
      }

      return NextResponse.json({ proposal })
    }

    const content = await requestClaude({
      system: `${systemPrompt}${docContext}`,
      messages: (messages || [])
        .filter((m) => m?.role === 'user' || m?.role === 'assistant')
        .map((m) => ({ role: m.role, content: m.content })),
      maxTokens: 1500,
      temperature: 0.7,
    })

    return NextResponse.json({ content })
  } catch (err: any) {
    console.error('Synthesis API error:', err)
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
