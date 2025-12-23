# Lumi — Context-Aware AI Reading & Writing Assistant

## Overview

**Lumi** is an AI-powered reading and writing assistant built around **folder-scoped AI agents**.

Each folder represents a **bounded knowledge context** (documents, PDFs, drafts, notes) and is paired with an AI agent whose outputs are strictly grounded in that folder’s contents.

Lumi’s core promise:

> AI assistance that is contextual, traceable, and embedded directly into reading and writing workflows.

Lumi prioritizes **trust, provenance, and usability** over raw generative fluency.

---

## Core Concepts

### 1. Folder-Scoped Agents
- Each folder owns:
  - Uploaded documents
  - A vector index built only from those documents
  - An AI agent configured with that folder’s retrieval scope
- Agents **must not** use information outside the folder unless explicitly instructed
- When evidence is insufficient, the agent should say so

### 2. Retrieval-Augmented Generation (RAG) Is Mandatory
All AI responses follow this pipeline:
1. Retrieve relevant chunks from the folder index
2. Generate responses strictly from retrieved evidence
3. Attach citations (file + page/section/offset)
4. Avoid hallucination at all costs

---

## Primary User Workflows

### A. Reading with AI (PDF-Centric)

**Capabilities**
- Upload PDFs (native or scanned)
- Render PDFs in-browser
- Highlight text inline
- Invoke AI actions:
  - Summarize
  - Explain
  - Ask questions
  - Cite or insert into writing

**Requirements**
- Highlight metadata must include:
  - file_id
  - page number
  - bounding box or character offsets
- AI responses must:
  - Quote relevant passages
  - Cite exact locations
  - Preserve original meaning

---

### B. Writing with AI (Cursor-Like Editor)

**Capabilities**
- Rich-text writing surface
- Inline AI assistance:
  - Autocomplete
  - Rewrite
  - Expand
  - Feedback / comments
- Insert cited excerpts from folder documents

**Requirements**
- AI must:
  - Use folder documents as primary context
  - Match document tone/style
  - Provide citations for factual claims

---

## Supported File Types

### Reading & Citation
- PDF (native + OCR)
- TXT
- Markdown
- HTML

### Writing Context
- DOCX
- Markdown
- TXT

Planned:
- LaTeX
- EPUB
- PPTX (text extraction)

---

## High-Level Architecture

### Core Data Model
- Workspace
  - Folders
    - Files
    - Vector index
    - Agent configuration
    - Notes / Docs

---

## Tech Stack (In-Depth)

### Frontend

**Framework**
- **Next.js (React + TypeScript)**
  - Server Components where appropriate
  - App Router

**Rich Text Editor**
- **Tiptap (ProseMirror-based)**
  - Inline AI suggestions
  - Selection-based transformations
  - Comments / feedback hooks
  - Slash commands

**PDF Rendering**
- **PDF.js**
  - Page-accurate rendering
  - Text selection + highlighting
  - Annotation overlays

**State & Realtime (Optional)**
- WebSockets or WebRTC for collaboration
- yjs (if collaborative editing is introduced)

---

### Backend

**API Layer**
- Node.js (TypeScript) or Python (FastAPI)
- REST + streaming endpoints for AI responses

**Background Jobs**
- Queue system (BullMQ / Celery)
- Used for:
  - File ingestion
  - OCR
  - Chunking
  - Embedding generation

---

### Storage

**File Storage**
- S3-compatible object storage
- Signed URLs for access control

**Primary Database**
- PostgreSQL
  - Users, workspaces, folders
  - File metadata
  - Highlights & annotations
  - Documents & editor state

**Vector Storage**
- **pgvector (Postgres extension)**
  - Stores embeddings + metadata
  - Enables similarity search
  - Keeps infra simple for v1

---

### Document Ingestion Pipeline

1. File upload
2. Text extraction
   - Layout-aware parsing for PDFs
3. OCR (for scanned PDFs)
4. Chunking strategy:
   - Section-aware
   - Page-aware
   - Overlap to preserve context
5. Metadata attachment:
   - file_id
   - page / section
   - offsets
6. Embedding generation
7. Storage in vector index

---

### AI Layer

**LLM Orchestration**
- Lightweight custom orchestration layer
- Optional scaffolding via LangChain or LlamaIndex

**Key Rules**
- Retrieval happens before generation
- Prompting enforces:
  - Evidence-first responses
  - Citation formatting
  - Graceful failure when context is missing

**Prompt Structure**
- System: agent rules + constraints
- Context: retrieved chunks
- User: request
- Output: answer + citations

---

### OCR & Parsing Services

- OCR engine for scanned PDFs
- Layout-aware extraction is critical
- Tables, headers, footnotes must be handled carefully

(Exact vendor selection is abstracted behind an ingestion service.)

---

### Security & Privacy

- Folder-level access control
- Per-workspace isolation
- Signed file URLs
- No training on user data
- Explicit deletion guarantees

---

## Design Principles

### Trust > Fluency
- Incorrect answers are worse than incomplete ones
- Citations are mandatory for claims

### Scoped Intelligence
- Folder boundaries are strict
- No global knowledge bleed

### Reading ↔ Writing Loop
- Reading insights must flow into writing
- Writing must remain traceable to sources

### Minimal Cognitive Overhead
- Inline actions
- No modal-heavy UX
- AI behaves like a co-pilot, not a chatbot

---

## Non-Goals (v1)

- Open web browsing
- Global chatbot memory
- Creative fiction generation
- Model training on user data

---

## Intended Users (Initial Focus)

- Students & researchers
- Consultants & analysts
- Knowledge workers dealing with dense documents

---

## Product Positioning

**Lumi is not**
- A generic chatbot
- “Chat with PDFs”
- A grammar checker

**Lumi is**
- A citation-first AI reading & writing system
- A bridge between comprehension and authorship
- A trustworthy document co-pilot

---

## Guiding Implementation Question

> Does this feature help users understand documents more deeply and write responsibly from them?

If not, it does not belong in Lumi.
