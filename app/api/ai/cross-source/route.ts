import { NextRequest, NextResponse } from 'next/server';
import { isClaudeConfigured, requestClaude } from '@/lib/services/ai/claudeServer';

type CrossSourceAction = 'connect' | 'compare' | 'contrast' | 'support';

const ACTION_LABELS: Record<CrossSourceAction, string> = {
  connect: 'Connect',
  compare: 'Compare',
  contrast: 'Contrast',
  support: 'Use as Support',
};

const ACTION_INSTRUCTIONS: Record<CrossSourceAction, string> = {
  connect:
    'Explain the conceptual relationship between the highlighted passage and the reference. Identify the shared idea, mechanism, or theme that links them.',
  compare:
    'Identify both similarities and differences between the highlighted passage and the reference. Be specific and grounded in the text.',
  contrast:
    'Focus on tensions, disagreements, or different framings between the highlighted passage and the reference. Make the divergence explicit.',
  support:
    'Explain how the reference could support or strengthen the highlighted claim. Note exactly which part of the reference provides support and how.',
};

const isValidAction = (value: unknown): value is CrossSourceAction =>
  value === 'connect' || value === 'compare' || value === 'contrast' || value === 'support';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      action,
      highlight,
      reference,
      chatHistory = [],
    }: {
      action?: string;
      highlight?: {
        text?: string;
        id?: string;
        sourceDocId?: string;
        sourceDocTitle?: string;
        pageNumber?: number | null;
      };
      reference?: {
        id?: string;
        text?: string;
        referenceNumber?: number | null;
        sourceDocId?: string;
        sourceDocTitle?: string;
        pageNumber?: number | null;
      };
      chatHistory?: Array<{ role: string; content: string }>;
    } = body || {};

    if (!isValidAction(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be one of: connect, compare, contrast, support.' },
        { status: 400 }
      );
    }
    if (!highlight?.text || !reference?.text) {
      return NextResponse.json(
        { error: 'Both highlight.text and reference.text are required.' },
        { status: 400 }
      );
    }
    if (!isClaudeConfigured()) {
      return NextResponse.json(
        { error: 'Claude API key not configured. Set ANTHROPIC_API_KEY in .env.' },
        { status: 500 }
      );
    }

    const actionLabel = ACTION_LABELS[action];
    const actionInstruction = ACTION_INSTRUCTIONS[action];

    const highlightLocation = [
      highlight.sourceDocTitle ? `"${highlight.sourceDocTitle}"` : 'the current document',
      highlight.pageNumber ? `p.${highlight.pageNumber}` : null,
    ]
      .filter(Boolean)
      .join(', ');
    const referenceLabel = reference.referenceNumber ? `R${reference.referenceNumber}` : 'reference';
    const referenceLocation = [
      reference.sourceDocTitle ? `"${reference.sourceDocTitle}"` : 'an external source',
      reference.pageNumber ? `p.${reference.pageNumber}` : null,
    ]
      .filter(Boolean)
      .join(', ');

    const system = `You are Lumi, an AI that helps researchers connect ideas across sources. The user has performed a cross-source synthesis operation: ${actionLabel}.

Operation guidance: ${actionInstruction}

Always:
- Ground every claim in the provided highlighted passage and the provided reference text.
- Mention both source locations when relevant (highlight: ${highlightLocation || 'unknown'}; ${referenceLabel}: ${referenceLocation || 'unknown'}).
- Do not introduce unsupported claims or invent facts not present in the texts.
- Be concise (3-6 short paragraphs or a tight bulleted list). Use Markdown.
- When citing the reference, refer to it as [${referenceLabel}].`;

    const initialUserPrompt = `Highlighted passage from ${highlightLocation || 'the current document'}:
"""
${highlight.text}
"""

Reference [${referenceLabel}] from ${referenceLocation || 'an external source'}:
"""
${reference.text}
"""

Action: ${actionLabel}.
${actionInstruction}`;

    const followUpMessages = Array.isArray(chatHistory)
      ? chatHistory
          .filter(
            (msg): msg is { role: 'user' | 'assistant'; content: string } =>
              !!msg && (msg.role === 'user' || msg.role === 'assistant') && typeof msg.content === 'string'
          )
          .map((msg) => ({ role: msg.role, content: msg.content }))
      : [];

    const messages = [{ role: 'user' as const, content: initialUserPrompt }, ...followUpMessages];

    const response = await requestClaude({
      system,
      messages,
      maxTokens: 1200,
      temperature: 0.6,
    });

    return NextResponse.json({
      response,
      actionLabel,
      referenceLabel,
    });
  } catch (error: any) {
    console.error('Error in cross-source synthesis:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to run cross-source synthesis' },
      { status: 500 }
    );
  }
}
