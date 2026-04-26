/**
 * Cross-source synthesis client (server-routed).
 * Sends a highlighted passage + reference + action verb to the AI backend.
 */

export type CrossSourceAction = 'connect' | 'compare' | 'contrast' | 'support';

export const CROSS_SOURCE_ACTION_LABELS: Record<CrossSourceAction, string> = {
  connect: 'Connect',
  compare: 'Compare',
  contrast: 'Contrast',
  support: 'Use as Support',
};

export interface CrossSourceHighlight {
  text: string;
  id?: string;
  sourceDocId?: string;
  sourceDocTitle?: string;
  pageNumber?: number | null;
}

export interface CrossSourceReference {
  id?: string;
  text: string;
  referenceNumber?: number | null;
  sourceDocId?: string;
  sourceDocTitle?: string;
  pageNumber?: number | null;
}

export interface CrossSourceResult {
  response: string;
  actionLabel: string;
  referenceLabel: string;
}

export async function crossSourceWithAI(args: {
  action: CrossSourceAction;
  highlight: CrossSourceHighlight;
  reference: CrossSourceReference;
  chatHistory?: { role: string; content: string }[];
}): Promise<CrossSourceResult> {
  const response = await fetch('/api/ai/cross-source', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || 'Cross-source synthesis failed');
  }

  return {
    response: data.response || '',
    actionLabel: data.actionLabel || CROSS_SOURCE_ACTION_LABELS[args.action] || '',
    referenceLabel: data.referenceLabel || (args.reference.referenceNumber ? `R${args.reference.referenceNumber}` : 'reference'),
  };
}
