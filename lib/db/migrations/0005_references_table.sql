-- Migration: Add folder-level references table for evidence-first provenance workflow
-- References are collected from PDF reading and used during writing synthesis.

create table public.references (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(user_id) on delete cascade,
  folder_id uuid not null references public.folders(id) on delete cascade,
  source_doc_id uuid not null references public.documents(id) on delete cascade,
  source_doc_title text,
  page_number int,
  chunk_id text,
  selected_text text not null,
  anchor_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_references_folder on public.references(folder_id, created_at);
create index idx_references_account on public.references(account_id);

-- RLS
alter table public.references enable row level security;

drop policy if exists "account_can_access_references" on public.references;
create policy "account_can_access_references" on public.references
for all
using (auth.uid() = account_id)
with check (auth.uid() = account_id);
