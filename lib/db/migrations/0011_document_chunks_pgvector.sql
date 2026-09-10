-- Migration: pgvector-backed chunk store for folder-level retrieval
--
-- Phase 2 of RAG groundwork. Creates the table that will hold embedded chunks
-- of source PDFs. Chunks are written by the ingestion pipeline (phase 3); this
-- migration only establishes the schema, index, and access rules.
--
-- Dimension note: 1024 is the Voyage default output width. pgvector's HNSW
-- index supports `vector` up to 2000 dimensions, so staying at 1024 avoids the
-- halfvec cast that larger models would require.

create extension if not exists vector;

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references public.documents(id) on delete cascade,
  folder_id uuid not null references public.folders(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  account_id uuid not null references public.accounts(user_id) on delete cascade,

  -- Position within the document
  chunk_index int not null,
  page_start int,
  page_end int,

  content text not null,
  char_count int,

  -- Null until the chunk has been embedded, so ingestion can write text first
  -- and embed in a second pass.
  embedding vector(1024),
  embedding_model text,
  embedded_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (doc_id, chunk_index)
);

create index if not exists idx_document_chunks_doc on public.document_chunks(doc_id);
create index if not exists idx_document_chunks_folder on public.document_chunks(folder_id);
create index if not exists idx_document_chunks_account on public.document_chunks(account_id);

-- Partial index over rows that still need embedding, so the ingestion worker
-- can find its backlog without scanning the whole table.
create index if not exists idx_document_chunks_pending
  on public.document_chunks(doc_id)
  where embedding is null;

-- Cosine distance: Voyage embeddings are normalized to unit length, so cosine
-- and dot product rank identically. HNSW is safe to create on an empty table
-- (unlike ivfflat, which needs data present to build its lists).
create index if not exists idx_document_chunks_embedding
  on public.document_chunks
  using hnsw (embedding vector_cosine_ops);

drop trigger if exists trg_document_chunks_updated_at on public.document_chunks;
create trigger trg_document_chunks_updated_at
before update on public.document_chunks
for each row execute procedure public.set_updated_at();

alter table public.document_chunks enable row level security;

drop policy if exists "account_can_access_document_chunks" on public.document_chunks;
create policy "account_can_access_document_chunks" on public.document_chunks
for all
using (account_id = auth.uid())
with check (account_id = auth.uid());
