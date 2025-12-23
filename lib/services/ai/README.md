# AI Services

This directory contains AI-related services for Lumi.

## Current Implementation

- `openaiService.ts` - OpenAI API integration (migrated from src/services)

## Future Services

- `ragService.ts` - Retrieval-Augmented Generation orchestration
- `citationService.ts` - Citation extraction and formatting
- `agentService.ts` - Folder-scoped agent management
- `embeddingService.ts` - Text embedding generation

## Design Principles

- All AI responses must be evidence-based
- Citations are mandatory for factual claims
- Agents are scoped to folder context
- Graceful failure when context is insufficient

