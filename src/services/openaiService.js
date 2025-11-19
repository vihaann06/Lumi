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

