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

    const explanation = await requestClaude({
      system: 'You are a clear, patient assistant who explains text accurately and simply.',
      messages: [
        {
          role: 'user',
          content: `Please explain the following text in a clear and accessible way:\n\n"${text}"`,
        },
      ],
      maxTokens: 1000,
      temperature: 0.6,
    });

    return NextResponse.json({ explanation });
  } catch (error: any) {
    console.error('Error getting AI explanation:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to get explanation' },
      { status: 500 }
    );
  }
}
