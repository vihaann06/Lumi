# Background Jobs

This directory contains background job processors.

## Future Jobs

- `documentIngestion.ts` - Process uploaded documents
- `ocrJob.ts` - OCR processing for scanned PDFs
- `chunkingJob.ts` - Document chunking and embedding
- `indexingJob.ts` - Vector index updates

## Queue System

- To be implemented: BullMQ (Node.js) or Celery (Python)
- Handles: File processing, OCR, chunking, embedding generation

