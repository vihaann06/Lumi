/**
 * OpenAI API service
 */

const API_KEY = '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';
const API_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * Make a request to OpenAI API
 */
const makeOpenAIRequest = async (prompt, model = 'gpt-4o-mini') => {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [{
        role: 'user',
        content: prompt
      }],
      max_tokens: 1000,
      temperature: 0.7,
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'API request failed');
  }

  const data = await response.json();
  
  if (data.choices && data.choices[0] && data.choices[0].message) {
    return data.choices[0].message.content;
  } else {
    throw new Error('Unexpected response format');
  }
};

/**
 * Get AI explanation for selected text
 */
export const getAIExplanation = async (selectedText) => {
  const prompt = `Please explain the following text in a clear and accessible way:\n\n"${selectedText}"`;
  return makeOpenAIRequest(prompt);
};

/**
 * Get AI summary for selected text
 */
export const getAISummary = async (selectedText) => {
  const prompt = `Please provide a concise summary of the following text:\n\n"${selectedText}"`;
  return makeOpenAIRequest(prompt);
};

/**
 * Get reference check for selected text
 */
export const getReferenceCheck = async (selectedText) => {
  const prompt = `Please check if the following text contains any factual claims, statistics, or references that should be verified. If so, identify what needs to be checked and suggest how to verify it:\n\n"${selectedText}"`;
  return makeOpenAIRequest(prompt);
};

/**
 * Chat with AI about selected text with conversation history
 * @param {string} selectedText - The highlighted text context
 * @param {Array} chatHistory - Array of { role: 'user' | 'assistant', content: string }
 * @param {string} userMessage - The current user message
 * @returns {Promise<string>} - The AI's response
 */
export const chatWithAI = async (selectedText, chatHistory, userMessage) => {
  // Build the conversation messages
  const messages = [
    {
      role: 'system',
      content: `You are a helpful AI assistant helping the user understand the following text. Use this text as context for all your responses:\n\n"${selectedText}"\n\nAnswer questions about this text clearly and helpfully.`
    }
  ];

  // Add conversation history (excluding the system message)
  chatHistory.forEach(msg => {
    messages.push({
      role: msg.role,
      content: msg.content
    });
  });

  // Add the current user message
  messages.push({
    role: 'user',
    content: userMessage
  });

  // Make the API request with the messages array
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: messages,
      max_tokens: 1000,
      temperature: 0.7,
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'API request failed');
  }

  const data = await response.json();
  
  if (data.choices && data.choices[0] && data.choices[0].message) {
    return data.choices[0].message.content;
  } else {
    throw new Error('Unexpected response format');
  }
};

