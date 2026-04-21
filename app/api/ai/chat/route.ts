import { NextRequest, NextResponse } from 'next/server';
import { isClaudeConfigured, requestClaude } from '@/lib/services/ai/claudeServer';

export async function POST(request: NextRequest) {
  try {
    const { selectedText, chatHistory = [], userMessage, docContext } = await request.json();

    if (!selectedText || !userMessage) {
      return NextResponse.json(
        { error: 'selectedText and userMessage are required' },
        { status: 400 }
      );
    }

    if (!isClaudeConfigured()) {
      return NextResponse.json(
        { error: 'Claude API key not configured. Set ANTHROPIC_API_KEY in .env.' },
        { status: 500 }
      );
    }

    const contextParts = [
      docContext?.documentTitle ? `Document title: ${docContext.documentTitle}` : null,
      docContext?.pageNumber ? `Current page: ${docContext.pageNumber}` : null,
      docContext?.totalPages ? `Total pages: ${docContext.totalPages}` : null,
    ].filter(Boolean);

    const docContextText = contextParts.length
      ? `\n\nPDF context:\n${contextParts.join('\n')}`
      : '';
    const fullDocumentText =
      typeof docContext?.fullDocumentText === 'string'
        ? docContext.fullDocumentText.trim()
        : '';
    const fullDocumentContextBlock = fullDocumentText
      ? `\n\nFull PDF text context:\n${fullDocumentText}`
      : '';

    const system = `You are a helpful AI assistant helping the user understand the following highlighted text from a PDF. Use this text as the primary context for all your responses:\n\n"${selectedText}"${docContextText}${fullDocumentContextBlock}\n\nAnswer questions clearly, stay grounded in the provided context, and say when more document context is needed. When the full PDF context is available, use it for disambiguation and better grounding while still prioritizing the selected highlight.`;

    const messages = [
      ...(Array.isArray(chatHistory)
        ? chatHistory
            .filter((msg) => msg?.role === 'user' || msg?.role === 'assistant')
            .map((msg) => ({ role: msg.role, content: String(msg.content || '') }))
        : []),
      { role: 'user', content: String(userMessage) },
    ];

    const response = await requestClaude({
      system,
      messages,
      maxTokens: 1000,
      temperature: 0.7,
    });

    return NextResponse.json({ response });
  } catch (error: any) {
    console.error('Error in AI chat:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to get AI response' },
      { status: 500 }
    );
  }
}
