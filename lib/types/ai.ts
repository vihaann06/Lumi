// AI service types

import { Chunk } from './vector';

export interface AIRequest {
  folderId: string;
  query: string;
  context?: string; // Selected text or highlight
  highlightId?: string;
  documentId?: string;
}

export interface Citation {
  documentId: string;
  fileName: string;
  pageNumber?: number;
  section?: string;
  quote?: string;
  startOffset?: number;
  endOffset?: number;
}

export interface AIResponse {
  content: string;
  citations: Citation[];
  confidence?: number;
  retrievedChunks?: Chunk[];
}

