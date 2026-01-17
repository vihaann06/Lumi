// Highlight and annotation types

export interface Highlight {
  id: string;
  documentId: string;
  pageNumber: number;
  text: string;
  rects: HighlightRect[];
  aiType?: 'explanation' | 'summary';
  aiContent?: string;
  chatHistory?: ChatMessage[];
  timestamp: number;
}

export interface HighlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

