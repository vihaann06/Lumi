/**
 * Shared TypeScript types for Lumi
 * 
 * This file contains type definitions used across the application.
 * As features are added, types will be organized by domain.
 */

// ============================================================================
// Core Domain Types
// ============================================================================

export interface Workspace {
  id: string;
  name: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Folder {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  agentConfig?: AgentConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentConfig {
  folderId: string;
  retrievalScope: 'strict' | 'relaxed'; // strict = only folder docs, relaxed = can use external
  citationStyle: 'inline' | 'footnote' | 'apa' | 'mla';
  tone?: string; // e.g., "academic", "casual", "professional"
}

// ============================================================================
// Document Types
// ============================================================================

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

export type FileType = 'pdf' | 'txt' | 'md' | 'html' | 'docx' | 'latex' | 'epub' | 'pptx';

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

// ============================================================================
// Highlight & Annotation Types
// ============================================================================

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

// ============================================================================
// Vector Index Types
// ============================================================================

export interface Chunk {
  id: string;
  documentId: string;
  content: string;
  embedding?: number[];
  metadata: ChunkMetadata;
  createdAt: Date;
}

export interface ChunkMetadata {
  pageNumber?: number;
  section?: string;
  startOffset?: number;
  endOffset?: number;
  chunkIndex: number;
}

// ============================================================================
// AI Service Types
// ============================================================================

export interface AIRequest {
  folderId: string;
  query: string;
  context?: string; // Selected text or highlight
  highlightId?: string;
  documentId?: string;
}

export interface AIResponse {
  content: string;
  citations: Citation[];
  confidence?: number;
  retrievedChunks?: Chunk[];
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

// ============================================================================
// Writing Editor Types
// ============================================================================

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

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

