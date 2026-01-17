// Document types

export type FileType =
  | 'pdf'
  | 'txt'
  | 'md'
  | 'html'
  | 'docx'
  | 'latex'
  | 'epub'
  | 'pptx';

export type DocumentStatus =
  | 'uploading'
  | 'processing'
  | 'indexing'
  | 'ready'
  | 'error';

export interface DocumentMetadata {
  pageCount?: number;
  wordCount?: number;
  language?: string;
  ocrRequired?: boolean;
  extractedText?: string;
}

export interface Document {
  id: string;
  folderId: string;
  fileName: string;
  fileType: FileType;
  fileSize: number;
  fileUrl: string;
  status: DocumentStatus;
  metadata?: DocumentMetadata;
  createdAt: Date;
  updatedAt: Date;
}

