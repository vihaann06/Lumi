// Vector index types

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

