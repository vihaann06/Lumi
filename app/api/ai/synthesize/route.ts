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
      actionMode,
      selectedText,
      instruction,
      messages,
      references,
      documentContent,
    }: {
      mode?: 'ask' | 'edit'
      actionMode?: 'support' | 'connect' | 'evaluate_grounding'
      selectedText?: string
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

    if (actionMode) {
      if (!selectedText?.trim()) {
        return NextResponse.json(
          { error: 'selectedText is required for writer span actions' },
          { status: 400 }
        )
      }

      const actionPromptMap: Record<
        'support' | 'connect' | 'evaluate_grounding',
        string
      > = {
        support:
          'Revise the selected passage so it is better supported by the provided references while preserving the original claim.',
        connect:
          'Explain and integrate how the selected passage relates to the provided references. Optionally suggest a revised passage.',
        evaluate_grounding:
          'Evaluate how well the selected passage is grounded in the provided references. Return structured JSON.',
      }

      if (actionMode === 'evaluate_grounding') {
        const evalPrompt = `You are assisting with grounded writing. Given a user-written passage and one or more source references:

- Base your response ONLY on the provided passage and references.
- Do not introduce unsupported claims.
- Be explicit about how the reference supports (or fails to support) the passage.

Evaluate grounding using this rubric (0-100):
- 0-20: Little to no support; mostly unsupported or contradicted.
- 21-40: Weak support; only vague or partial overlap.
- 41-60: Moderate support; core idea is related but evidence is incomplete.
- 61-80: Good support; most key claims are backed with minor gaps.
- 81-100: Strong support; direct, specific, and sufficient evidence.

Scoring rules:
- Use the full range; do NOT default to very low scores.
- Scores below 10 should be rare and only when support is essentially absent.
- If there is meaningful textual overlap, the score should generally be at least 30+.
- If support is mixed, choose a middle band and explain what is missing.

Return ONLY valid JSON with this exact shape:
{
  "groundednessScore": 0,
  "analysisSummary": "short explanation",
  "content": "markdown bullet list with concise reasoning and optional improvements"
}

Selected text:
"""
${selectedText}
"""`
        const evaluation = await requestClaude({
          system: `${systemPrompt}${docContext}`,
          messages: [{ role: 'user', content: evalPrompt }],
          maxTokens: 1200,
          temperature: 0.2,
        })
        const parsed = parseJsonObject(evaluation) || {}
        const scoreRaw = Number(parsed.groundednessScore)
        const groundednessScore = Number.isFinite(scoreRaw)
          ? Math.max(0, Math.min(100, Math.round(scoreRaw)))
          : null
        const analysisSummary =
          typeof parsed.analysisSummary === 'string' ? parsed.analysisSummary : null
        const content =
          typeof parsed.content === 'string' && parsed.content.trim()
            ? parsed.content
            : evaluation
        return NextResponse.json({ content, groundednessScore, analysisSummary })
      }

      const prompt = `${actionPromptMap[actionMode]}\n\nYou are assisting with grounded writing. Given a user-written passage and source references:\n- Always base your response ONLY on provided text and references.\n- Do not introduce unsupported claims.\n- Be explicit about how references relate to the passage.\n\nSelected text:\n\"\"\"\n${selectedText}\n\"\"\"`

      const content = await requestClaude({
        system: `${systemPrompt}${docContext}`,
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 1500,
        temperature: 0.5,
      })

      return NextResponse.json({ content })
    }

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
- When grounding a claim in a provided reference, cite inline with bracket labels like [R1], [R2], etc.
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
        .filter(
          (m): m is { role: 'user' | 'assistant'; content: string } =>
            m?.role === 'user' || m?.role === 'assistant'
        )
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
