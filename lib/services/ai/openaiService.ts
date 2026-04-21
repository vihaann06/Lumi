/**
 * AI service client (server-routed).
 */
const postJSON = async (url: string, body: Record<string, any>) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || 'AI request failed');
  }

  return data;
};

/**
 * Chat with AI about selected text with conversation history
 * @param {string} selectedText - The highlighted text context
 * @param {Array} chatHistory - Array of { role: 'user' | 'assistant', content: string }
 * @param {string} userMessage - The current user message
 * @returns {Promise<string>} - The AI's response
 */
export const chatWithAI = async (
  selectedText: string,
  chatHistory: { role: string; content: string }[],
  userMessage: string,
  docContext?: {
    documentTitle?: string;
    pageNumber?: number;
    totalPages?: number;
    fullDocumentText?: string;
    references?: Array<{
      label: string;
      sourceDocTitle: string;
      pageNumber: number | null;
      selectedText: string;
    }>;
  }
) => {
  const data = await postJSON('/api/ai/chat', {
    selectedText,
    chatHistory,
    userMessage,
    docContext,
  });

  return data.response || '';
};

