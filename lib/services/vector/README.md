# Vector Services

This directory contains vector database and embedding services.

## Future Services

- `vectorStore.ts` - pgvector integration for similarity search
- `embeddingService.ts` - Text embedding generation
- `retrievalService.ts` - RAG retrieval orchestration
- `indexService.ts` - Vector index management

## Storage

- Primary: pgvector (PostgreSQL extension)
- Stores: embeddings + metadata (file_id, page, offsets)
- Enables: similarity search within folder scope

