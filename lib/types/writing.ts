// Writing/editor types

import { Citation } from './ai';

export interface DocumentDraft {
  id: string;
  folderId: string;
  title: string;
  content: string; // Rich text or markdown
  format: 'markdown' | 'html' | 'plain';
  citations: Citation[];
  createdAt: Date;
  updatedAt: Date;
}

