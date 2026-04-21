-- Migration: Store writer document text directly in Postgres

create table if not exists public.document_contents (
  doc_id uuid primary key references public.documents(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  account_id uuid not null references public.accounts(user_id) on delete cascade,
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_document_contents_workspace on public.document_contents(workspace_id);
create index if not exists idx_document_contents_account on public.document_contents(account_id);

drop trigger if exists trg_document_contents_updated_at on public.document_contents;
create trigger trg_document_contents_updated_at
before update on public.document_contents
for each row execute procedure public.set_updated_at();

alter table public.document_contents enable row level security;

drop policy if exists "account_can_access_document_contents" on public.document_contents;
create policy "account_can_access_document_contents" on public.document_contents
for all
using (account_id = auth.uid())
with check (account_id = auth.uid());
