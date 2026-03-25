export interface Reference {
  id: string;
  accountId: string;
  folderId: string;
  sourceDocId: string;
  sourceDocTitle: string | null;
  pageNumber: number | null;
  chunkId: string | null;
  selectedText: string;
  anchorJson: Record<string, unknown>;
  createdAt: string;
}

export interface ReferenceInsert {
  folderId: string;
  sourceDocId: string;
  sourceDocTitle?: string;
  pageNumber?: number;
  chunkId?: string;
  selectedText: string;
  anchorJson?: Record<string, unknown>;
}
