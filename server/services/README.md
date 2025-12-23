# Server Services

This directory contains server-side service implementations.

## Services

- `ai/` - AI orchestration and RAG services
- `document/` - Document processing services
- `vector/` - Vector database services
- `ingestion/` - Document ingestion pipeline

## Design

- Services are stateless where possible
- Folder-scoped operations are enforced
- All AI operations require retrieval first
- Citations are generated automatically

