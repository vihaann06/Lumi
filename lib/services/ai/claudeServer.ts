type ClaudeMessage = { role: 'user' | 'assistant'; content: string };

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || '';
const FALLBACK_MODELS = [
  process.env.CLAUDE_MODEL,
  'claude-sonnet-4-6',
  'claude-sonnet-4-5-20250929',
  'claude-sonnet-4-20250514',
].filter(Boolean) as string[];

export const isClaudeConfigured = () => Boolean(CLAUDE_API_KEY);

const shouldRetryWithNextModel = (errorMessage: string) => {
  const lower = (errorMessage || '').toLowerCase();
  return (
    lower.includes('model') ||
    lower.includes('not found') ||
    lower.includes('does not exist') ||
    lower.includes('invalid')
  );
};

export async function requestClaude({
  system,
  messages,
  maxTokens = 1200,
  temperature = 0.7,
}: {
  system: string;
  messages: ClaudeMessage[];
  maxTokens?: number;
  temperature?: number;
}): Promise<string> {
  if (!CLAUDE_API_KEY) {
    throw new Error('Claude API key not configured');
  }

  let lastError = 'Claude request failed';

  for (let i = 0; i < FALLBACK_MODELS.length; i++) {
    const model = FALLBACK_MODELS[i];
    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        system,
        messages,
        max_tokens: maxTokens,
        temperature,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const apiMessage = data?.error?.message || 'Claude request failed';
      lastError = apiMessage;
      if (i < FALLBACK_MODELS.length - 1 && shouldRetryWithNextModel(apiMessage)) {
        continue;
      }
      throw new Error(apiMessage);
    }

    const text = Array.isArray(data?.content)
      ? data.content
          .filter((item: any) => item?.type === 'text')
          .map((item: any) => item.text || '')
          .join('\n')
          .trim()
      : '';

    if (!text) {
      throw new Error('Unexpected Claude response format');
    }

    return text;
  }

  throw new Error(lastError);
}
