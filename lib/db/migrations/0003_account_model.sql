-- Migration: Pivot from workspace/membership model to per-user accounts
-- Assumptions:
-- - Existing data is minimal; workspace -> account backfill uses workspaces.owner_user_id
-- - Tables from 0001 exist: workspaces, workspace_members, folders, documents, document_assets, annotations,
--   threads, thread_messages, share_links, enums, and helper functions/triggers

-- 1) Drop old bootstrap trigger/function (workspace-based)
drop trigger if exists trg_bootstrap_workspace on auth.users;
drop function if exists public.handle_new_user_bootstrap();

-- 2) Drop old RLS policies that reference workspaces/memberships
drop policy if exists "read_workspace_scoped" on public.workspaces;
drop policy if exists "read_members_scoped" on public.workspace_members;
drop policy if exists "workspace_members_can_read" on public.folders;
drop policy if exists "workspace_members_can_write" on public.folders;
drop policy if exists "documents_access" on public.documents;
drop policy if exists "assets_access" on public.document_assets;
drop policy if exists "annotations_access" on public.annotations;
drop policy if exists "threads_access" on public.threads;
drop policy if exists "thread_messages_access" on public.thread_messages;
drop policy if exists "share_links_access" on public.share_links;

-- Drop any legacy auto-generated policies that still reference workspace_id
drop policy if exists folders_select on public.folders;
drop policy if exists folders_insert on public.folders;
drop policy if exists folders_update on public.folders;
drop policy if exists folders_delete on public.folders;

drop policy if exists documents_select on public.documents;
drop policy if exists documents_insert on public.documents;
drop policy if exists documents_update on public.documents;
drop policy if exists documents_delete on public.documents;

drop policy if exists document_assets_select on public.document_assets;
drop policy if exists document_assets_insert on public.document_assets;
drop policy if exists document_assets_update on public.document_assets;
drop policy if exists document_assets_delete on public.document_assets;
drop policy if exists assets_select on public.document_assets;
drop policy if exists assets_insert on public.document_assets;
drop policy if exists assets_update on public.document_assets;
drop policy if exists assets_delete on public.document_assets;

drop policy if exists annotations_select on public.annotations;
drop policy if exists annotations_insert on public.annotations;
drop policy if exists annotations_update on public.annotations;
drop policy if exists annotations_delete on public.annotations;

drop policy if exists threads_select on public.threads;
drop policy if exists threads_insert on public.threads;
drop policy if exists threads_update on public.threads;
drop policy if exists threads_delete on public.threads;

drop policy if exists thread_messages_select on public.thread_messages;
drop policy if exists thread_messages_insert on public.thread_messages;
drop policy if exists thread_messages_update on public.thread_messages;
drop policy if exists thread_messages_delete on public.thread_messages;

drop policy if exists share_links_select on public.share_links;
drop policy if exists share_links_insert on public.share_links;
drop policy if exists share_links_update on public.share_links;
drop policy if exists share_links_delete on public.share_links;

-- 3) Create accounts table (1:1 with auth.users)
create table if not exists public.accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  first_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at trigger
drop trigger if exists trg_accounts_updated_at on public.accounts;
create trigger trg_accounts_updated_at
before update on public.accounts
for each row execute function public.set_updated_at();

-- Seed accounts for existing workspace owners (idempotent)
insert into public.accounts (user_id)
select distinct owner_user_id from public.workspaces
on conflict (user_id) do nothing;

-- 4) Add account_id columns, backfill from workspaces, enforce NOT NULL + FK (keep workspace_id for legacy)

-- Add new columns to existing accounts if missing
alter table public.accounts add column if not exists username text unique;
alter table public.accounts add column if not exists first_name text;

-- folders
alter table public.folders add column if not exists account_id uuid;
update public.folders f
set account_id = w.owner_user_id
from public.workspaces w
where f.workspace_id = w.id
  and f.account_id is null;
alter table public.folders alter column account_id set not null;
alter table public.folders
  add constraint folders_account_fk
  foreign key (account_id) references public.accounts(user_id) on delete cascade;

-- documents
alter table public.documents add column if not exists account_id uuid;
update public.documents d
set account_id = w.owner_user_id
from public.workspaces w
where d.workspace_id = w.id
  and d.account_id is null;
alter table public.documents alter column account_id set not null;
alter table public.documents
  add constraint documents_account_fk
  foreign key (account_id) references public.accounts(user_id) on delete cascade;

-- document_assets
alter table public.document_assets add column if not exists account_id uuid;
update public.document_assets da
set account_id = w.owner_user_id
from public.workspaces w
where da.workspace_id = w.id
  and da.account_id is null;
alter table public.document_assets alter column account_id set not null;
alter table public.document_assets
  add constraint document_assets_account_fk
  foreign key (account_id) references public.accounts(user_id) on delete cascade;

-- annotations
alter table public.annotations add column if not exists account_id uuid;
update public.annotations a
set account_id = w.owner_user_id
from public.workspaces w
where a.workspace_id = w.id
  and a.account_id is null;
alter table public.annotations alter column account_id set not null;
alter table public.annotations
  add constraint annotations_account_fk
  foreign key (account_id) references public.accounts(user_id) on delete cascade;

-- threads
alter table public.threads add column if not exists account_id uuid;
update public.threads t
set account_id = w.owner_user_id
from public.workspaces w
where t.workspace_id = w.id
  and t.account_id is null;
alter table public.threads alter column account_id set not null;
alter table public.threads
  add constraint threads_account_fk
  foreign key (account_id) references public.accounts(user_id) on delete cascade;

-- thread_messages
alter table public.thread_messages add column if not exists account_id uuid;
update public.thread_messages tm
set account_id = w.owner_user_id
from public.workspaces w
where tm.workspace_id = w.id
  and tm.account_id is null;
alter table public.thread_messages alter column account_id set not null;
alter table public.thread_messages
  add constraint thread_messages_account_fk
  foreign key (account_id) references public.accounts(user_id) on delete cascade;

-- share_links
alter table public.share_links add column if not exists account_id uuid;
update public.share_links sl
set account_id = w.owner_user_id
from public.workspaces w
where sl.workspace_id = w.id
  and sl.account_id is null;
alter table public.share_links alter column account_id set not null;
alter table public.share_links
  add constraint share_links_account_fk
  foreign key (account_id) references public.accounts(user_id) on delete cascade;

-- 5) Retain legacy workspace structures (ignored by new flow); remove helper if desired
-- (Keeping tables/columns to avoid dependency errors)
-- drop function if exists public.is_workspace_member();
-- drop type if exists public.workspace_role;

-- 6) RLS: enable and scope to account_id/user_id
alter table public.accounts enable row level security;
alter table public.folders enable row level security;
alter table public.documents enable row level security;
alter table public.document_assets enable row level security;
alter table public.annotations enable row level security;
alter table public.threads enable row level security;
alter table public.thread_messages enable row level security;
alter table public.share_links enable row level security;

-- accounts
drop policy if exists "accounts_self_access" on public.accounts;
create policy "accounts_self_access" on public.accounts
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- folders
drop policy if exists "account_can_access_folders" on public.folders;
create policy "account_can_access_folders" on public.folders
for all
using (auth.uid() = account_id)
with check (auth.uid() = account_id);

-- documents
drop policy if exists "account_can_access_documents" on public.documents;
create policy "account_can_access_documents" on public.documents
for all
using (auth.uid() = account_id)
with check (auth.uid() = account_id);

-- document_assets
drop policy if exists "account_can_access_document_assets" on public.document_assets;
create policy "account_can_access_document_assets" on public.document_assets
for all
using (auth.uid() = account_id)
with check (auth.uid() = account_id);

-- annotations
drop policy if exists "account_can_access_annotations" on public.annotations;
create policy "account_can_access_annotations" on public.annotations
for all
using (auth.uid() = account_id)
with check (auth.uid() = account_id);

-- threads
drop policy if exists "account_can_access_threads" on public.threads;
create policy "account_can_access_threads" on public.threads
for all
using (auth.uid() = account_id)
with check (auth.uid() = account_id);

-- thread_messages
drop policy if exists "account_can_access_thread_messages" on public.thread_messages;
create policy "account_can_access_thread_messages" on public.thread_messages
for all
using (auth.uid() = account_id)
with check (auth.uid() = account_id);

-- share_links
drop policy if exists "account_can_access_share_links" on public.share_links;
create policy "account_can_access_share_links" on public.share_links
for all
using (auth.uid() = account_id)
with check (auth.uid() = account_id);

-- 7) Bootstrap trigger for accounts on new auth.users
drop trigger if exists trg_bootstrap_account on auth.users;
drop function if exists public.handle_new_user_account();

create or replace function public.handle_new_user_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.accounts (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger trg_bootstrap_account
after insert on auth.users
for each row
execute function public.handle_new_user_account();

