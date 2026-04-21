export interface Reference {
  id: string;
  referenceNumber: number;
  accountId: string;
  folderId: string;
  sourceDocId: string;
  sourceDocTitle: string | null;
  pageNumber: number | null;
  chunkId: string | null;
  selectedText: string;
  anchorJson: Record<string, unknown>;
  createdAt: string;
  deletedAt: string | null;
}

export interface FileReference {
  id: string;
  accountId: string;
  fileId: string;
  referenceId: string;
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
