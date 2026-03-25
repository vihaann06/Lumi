-- Migration: Add file_references join table for file-scoped reference attachment (Option 2)
-- A reference can be attached to multiple files; a file can have multiple references.

create table public.file_references (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(user_id) on delete cascade,
  file_id uuid not null references public.documents(id) on delete cascade,
  reference_id uuid not null references public.references(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (file_id, reference_id)
);

create index idx_file_references_file on public.file_references(file_id);
create index idx_file_references_reference on public.file_references(reference_id);

-- RLS
alter table public.file_references enable row level security;

create policy "account_can_access_file_references" on public.file_references
for all
using (auth.uid() = account_id)
with check (auth.uid() = account_id);
