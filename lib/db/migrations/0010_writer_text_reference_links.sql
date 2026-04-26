-- Migration: Track span-level reference attachments inside writer documents

create table if not exists public.writer_text_reference_links (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(user_id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  folder_id uuid not null references public.folders(id) on delete cascade,
  synthesis_doc_id uuid not null references public.documents(id) on delete cascade,
  reference_id uuid not null references public.references(id) on delete cascade,
  span_start integer not null check (span_start >= 0),
  span_end integer not null check (span_end >= span_start),
  selected_text_snapshot text not null default '',
  action_type text not null check (action_type in ('cite', 'support', 'connect', 'evaluate_grounding')),
  groundedness_score integer check (groundedness_score between 0 and 100),
  analysis_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_wtrl_doc on public.writer_text_reference_links(synthesis_doc_id);
create index if not exists idx_wtrl_reference on public.writer_text_reference_links(reference_id);
create index if not exists idx_wtrl_folder on public.writer_text_reference_links(folder_id);
create index if not exists idx_wtrl_span on public.writer_text_reference_links(synthesis_doc_id, span_start, span_end);
create index if not exists idx_wtrl_action on public.writer_text_reference_links(action_type);

drop trigger if exists trg_writer_text_reference_links_updated_at on public.writer_text_reference_links;
create trigger trg_writer_text_reference_links_updated_at
before update on public.writer_text_reference_links
for each row execute procedure public.set_updated_at();

alter table public.writer_text_reference_links enable row level security;

drop policy if exists "account_can_access_writer_text_reference_links" on public.writer_text_reference_links;
create policy "account_can_access_writer_text_reference_links" on public.writer_text_reference_links
for all
using (account_id = auth.uid())
with check (account_id = auth.uid());
