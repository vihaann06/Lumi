# Types Directory

This directory contains TypeScript type definitions shared across the application.

## Organization

- `index.ts` - Main types file with all domain types
- Future: Domain-specific type files as the codebase grows:
  - `document.types.ts`
  - `ai.types.ts`
  - `vector.types.ts`
  - `editor.types.ts`

## Usage

Import types from this directory:

```typescript
import { Document, Highlight, AIResponse } from '@/lib/types';
```

