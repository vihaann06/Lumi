-- Migration: Track which synthesis documents reference which source references

create table if not exists public.synthesis_reference_links (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(user_id) on delete cascade,
  folder_id uuid not null references public.folders(id) on delete cascade,
  synthesis_doc_id uuid not null references public.documents(id) on delete cascade,
  reference_id uuid not null references public.references(id) on delete cascade,
  citation_label text,
  citation_count integer not null default 1,
  first_line integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (synthesis_doc_id, reference_id)
);

create index if not exists idx_srl_reference on public.synthesis_reference_links(reference_id);
create index if not exists idx_srl_synthesis_doc on public.synthesis_reference_links(synthesis_doc_id);
create index if not exists idx_srl_folder on public.synthesis_reference_links(folder_id);

create trigger trg_synthesis_reference_links_updated_at
before update on public.synthesis_reference_links
for each row execute procedure public.set_updated_at();

alter table public.synthesis_reference_links enable row level security;

drop policy if exists "account_can_access_synthesis_reference_links" on public.synthesis_reference_links;
create policy "account_can_access_synthesis_reference_links" on public.synthesis_reference_links
for all
using (account_id = auth.uid())
with check (account_id = auth.uid());
