import { NextRequest, NextResponse } from 'next/server';
import { isClaudeConfigured, requestClaude } from '@/lib/services/ai/claudeServer';
import { requireUser } from '@/lib/auth/requireUser';

// Claude calls routinely exceed Vercel's short default function timeout.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if ('response' in auth) return auth.response;

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

    const result = await requestClaude({
      system:
        'You are a careful research assistant. Identify factual claims that need verification and suggest practical ways to verify them.',
      messages: [
        {
          role: 'user',
          content:
            `Please check if the following text contains any factual claims, statistics, or references that should be verified. ` +
            `If so, identify what needs to be checked and suggest how to verify it:\n\n"${text}"`,
        },
      ],
      maxTokens: 1000,
      temperature: 0.4,
    });

    return NextResponse.json({ result });
  } catch (error: any) {
    console.error('Error getting reference check:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to run reference check' },
      { status: 500 }
    );
  }
}
