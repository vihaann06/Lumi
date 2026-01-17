# Lumi Project Structure

This document outlines the codebase structure for Lumi, an AI-powered reading and writing assistant.

## Overview

Lumi is built with **Next.js 14** (App Router) and follows a modular architecture designed for step-by-step feature development.

## Directory Structure

```
lumi/
├── app/                          # Next.js App Router
│   ├── api/                      # API routes
│   │   └── ai/                   # AI service endpoints
│   │       ├── explain/          # POST /api/ai/explain
│   │       ├── summary/          # POST /api/ai/summary
│   │       └── chat/             # POST /api/ai/chat
│   ├── (reader)/                 # Route group for reader pages
│   │   └── reader/              # PDF reader page
│   ├── components/               # React components
│   │   ├── reader/              # PDF reader components
│   │   │   ├── ExplanationPanel.jsx
│   │   │   ├── HighlightOverlay.jsx
│   │   │   ├── PageHighlights.jsx
│   │   │   ├── PDFViewer.jsx
│   │   │   └── SelectionMenu.jsx
│   │   ├── ReaderScreen.jsx
│   │   └── UploadScreen.jsx
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Home page (upload)
│
├── hooks/                        # React hooks (shared)
│   ├── useAIActions.js
│   ├── useHighlights.js
│   └── usePDFViewer.js
│
├── lib/                          # Shared library code
│   ├── types/                    # TypeScript type definitions
│   │   └── index.ts              # All domain types
│   ├── utils/                    # Utility functions
│   │   ├── highlightUtils.ts
│   │   ├── pdfUtils.ts
│   │   └── index.ts
│   └── services/                 # Service layer
│       ├── ai/                   # AI services
│       │   └── openaiService.ts  # OpenAI integration
│       ├── document/             # Document processing (future)
│       └── vector/               # Vector services (future)
│
├── server/                       # Server-side code
│   ├── api/                      # API route handlers (future)
│   ├── services/                 # Server services
│   │   ├── ai/                   # AI orchestration (future)
│   │   ├── document/             # Document processing (future)
│   │   ├── vector/               # Vector operations (future)
│   │   └── ingestion/           # Ingestion pipeline (future)
│   └── jobs/                     # Background jobs (future)
│
├── lib/db/                       # Database layer
│   ├── models/                   # Database models (future)
│   └── migrations/              # Database migrations (future)
│
├── src/                          # Legacy Vite code (to be removed)
│   └── index.css                 # Global styles (used by Next.js)
│
├── next.config.js                # Next.js configuration
├── tsconfig.json                 # TypeScript configuration
├── tailwind.config.js            # Tailwind CSS configuration
├── postcss.config.js             # PostCSS configuration
└── package.json                  # Dependencies
```

## Key Directories Explained

### `/app`
Next.js App Router directory. Contains:
- **Pages**: Route definitions using file-based routing
- **API Routes**: Backend endpoints in `/app/api`
- **Components**: React components (client components marked with `'use client'`)
- **Layouts**: Shared layouts

### `/lib`
Shared code used across the application:
- **types/**: TypeScript type definitions for domain models
- **utils/**: Utility functions (highlight calculations, PDF handling)
- **services/**: Service layer for AI, document processing, etc.

### `/server`
Server-side code (future):
- **services/**: Business logic and orchestration
- **jobs/**: Background job processors
- **api/**: Additional API route handlers if needed

### `/lib/db`
Database layer (future):
- **models/**: Database schema definitions
- **migrations/**: Database migration files

## Current Features

### ✅ Implemented
- PDF upload and viewing
- Text selection and highlighting
- AI explanations (with chat)
- AI summaries
- Modern, minimalistic UI

### 🚧 In Progress
- Next.js migration (structure complete, components need testing)

### 📋 Planned (per README.md)
- Folder-scoped AI agents
- Vector index and RAG
- Document ingestion pipeline
- Writing editor with AI assistance
- Citation system
- Multi-file support
- Workspace and folder management

## Development Workflow

1. **Current State**: PDF reading feature is functional
2. **Next Steps**: 
   - Test Next.js migration
   - Set up database (PostgreSQL + pgvector)
   - Implement folder/workspace structure
   - Build document ingestion pipeline
   - Add vector indexing

## File Naming Conventions

- **Components**: PascalCase (e.g., `ReaderScreen.jsx`)
- **Hooks**: camelCase with `use` prefix (e.g., `usePDFViewer.js`)
- **Utilities**: camelCase (e.g., `highlightUtils.ts`)
- **Types**: camelCase (e.g., `index.ts` in types folder)
- **API Routes**: lowercase with route.ts (e.g., `explain/route.ts`)

## Import Paths

Use path aliases defined in `tsconfig.json`:
- `@/lib/*` - Shared library code
- `@/app/*` - App directory
- `@/server/*` - Server code

Example:
```typescript
import { Document, Highlight } from '@/lib/types'
import { truncateTextForDisplay } from '@/lib/utils'
```

## Notes

- The codebase is transitioning from Vite to Next.js
- Legacy code in `/src` will be removed once migration is complete
- All new features should follow the Next.js App Router patterns
- TypeScript types are defined in `/lib/types` for shared use

