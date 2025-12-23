# Document Services

This directory contains document processing and management services.

## Future Services

- `ingestionService.ts` - Document upload and processing pipeline
- `extractionService.ts` - Text extraction from various file types
- `ocrService.ts` - OCR for scanned documents
- `chunkingService.ts` - Document chunking strategies
- `metadataService.ts` - Document metadata extraction

## Processing Pipeline

1. File upload
2. Text extraction (layout-aware for PDFs)
3. OCR (if needed)
4. Chunking (section/page-aware with overlap)
5. Metadata attachment
6. Embedding generation
7. Vector index storage

