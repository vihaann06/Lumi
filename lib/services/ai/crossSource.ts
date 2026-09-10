/**
 * Cross-source synthesis client (server-routed).
 * Sends a highlighted passage + reference + action verb to the AI backend.
 */

import { postAI } from './apiClient';

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
  const data = await postAI('/api/ai/cross-source', args);

  return {
    response: data.response || '',
    actionLabel: data.actionLabel || CROSS_SOURCE_ACTION_LABELS[args.action] || '',
    referenceLabel: data.referenceLabel || (args.reference.referenceNumber ? `R${args.reference.referenceNumber}` : 'reference'),
  };
}
