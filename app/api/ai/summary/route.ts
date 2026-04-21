import { NextRequest, NextResponse } from 'next/server';
import { isClaudeConfigured, requestClaude } from '@/lib/services/ai/claudeServer';

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();
    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    if (!isClaudeConfigured()) {
      return NextResponse.json(
        { error: 'Claude API key not configured. Set ANTHROPIC_API_KEY in .env.' },
        { status: 500 }
      );
    }

    const summary = await requestClaude({
      system: 'You produce concise summaries that preserve the key ideas and important caveats.',
      messages: [
        {
          role: 'user',
          content: `Please provide a concise summary of the following text:\n\n"${text}"`,
        },
      ],
      maxTokens: 900,
      temperature: 0.5,
    });

    return NextResponse.json({ summary });
  } catch (error: any) {
    console.error('Error getting AI summary:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to get summary' },
      { status: 500 }
    );
  }
}
