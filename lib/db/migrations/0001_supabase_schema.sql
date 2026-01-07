-- Supabase schema for Lumi
-- Enable required extensions
create extension if not exists pgcrypto;
create extension if not exists citext;

-- Helper functions
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_workspace_member(
  p_workspace_id uuid,
  p_user_id uuid
) returns boolean language sql stable as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = p_user_id
  );
$$;

-- Workspaces
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'My Workspace',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_workspaces_updated_at
before update on public.workspaces
for each row execute function public.set_updated_at();

create type public.workspace_role as enum ('owner','admin','member','viewer');

create table public.workspace_members (
  workspace_id uuid references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role public.workspace_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- Folders
create table public.folders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_folders_updated_at
before update on public.folders
for each row execute function public.set_updated_at();

-- Documents
create type public.document_type as enum ('pdf','txt','md','docx','html','other');
create type public.document_status as enum ('uploaded','processing','ready','failed','deleted');

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  folder_id uuid not null references public.folders(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  doc_type public.document_type not null default 'pdf',
  mime_type text,
  file_bucket text not null default 'documents',
  file_path text not null,
  status public.document_status not null default 'uploaded',
  error text,
  page_count int,
  hash_sha256 text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (file_bucket, file_path)
);

create trigger trg_documents_updated_at
before update on public.documents
for each row execute function public.set_updated_at();

-- Document assets
create type public.asset_kind as enum (
  'extracted_text_json',
  'chunks_json',
  'thumbnail_png',
  'metadata_json'
);

create table public.document_assets (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references public.documents(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  kind public.asset_kind not null,
  bucket text not null default 'documents',
  path text not null,
  created_at timestamptz not null default now(),
  unique (doc_id, kind)
);

-- Annotations
create table public.annotations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  folder_id uuid not null references public.folders(id) on delete cascade,
  doc_id uuid not null references public.documents(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  page int,
  quote text,
  anchor_json jsonb not null default '{}'::jsonb,
  has_thread boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_annotations_updated_at
before update on public.annotations
for each row execute function public.set_updated_at();

-- Threads
create type public.thread_kind as enum ('highlight_chat','doc_chat','folder_chat');

create table public.threads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  folder_id uuid references public.folders(id) on delete cascade,
  doc_id uuid references public.documents(id) on delete cascade,
  annotation_id uuid references public.annotations(id) on delete cascade,
  kind public.thread_kind not null default 'highlight_chat',
  title text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (annotation_id)
);

create trigger trg_threads_updated_at
before update on public.threads
for each row execute function public.set_updated_at();

-- Thread messages
create type public.message_role as enum ('user','assistant','system','tool');

create table public.thread_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  role public.message_role not null,
  content text not null,
  content_json jsonb not null default '{}'::jsonb,
  citations_json jsonb not null default '[]'::jsonb,
  model text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_thread_messages_thread_created
on public.thread_messages(thread_id, created_at);

-- Share links
create type public.share_permission as enum ('view','comment','edit');

create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  folder_id uuid references public.folders(id) on delete cascade,
  doc_id uuid references public.documents(id) on delete cascade,
  token text not null unique,
  permission public.share_permission not null default 'view',
  created_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- Row level security
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.folders enable row level security;
alter table public.documents enable row level security;
alter table public.document_assets enable row level security;
alter table public.annotations enable row level security;
alter table public.threads enable row level security;
alter table public.thread_messages enable row level security;
alter table public.share_links enable row level security;

-- Policies
create policy "read_workspace_scoped"
on public.workspaces for select
using (auth.uid() = owner_user_id);

create policy "read_members_scoped"
on public.workspace_members for select
using (public.is_workspace_member(workspace_id, auth.uid()));

create policy "workspace_members_can_read"
on public.folders for select
using (public.is_workspace_member(workspace_id, auth.uid()));

create policy "workspace_members_can_write"
on public.folders for all
using (public.is_workspace_member(workspace_id, auth.uid()))
with check (public.is_workspace_member(workspace_id, auth.uid()));

create policy "documents_access"
on public.documents for all
using (public.is_workspace_member(workspace_id, auth.uid()))
with check (public.is_workspace_member(workspace_id, auth.uid()));

create policy "assets_access"
on public.document_assets for all
using (public.is_workspace_member(workspace_id, auth.uid()))
with check (public.is_workspace_member(workspace_id, auth.uid()));

create policy "annotations_access"
on public.annotations for all
using (public.is_workspace_member(workspace_id, auth.uid()))
with check (public.is_workspace_member(workspace_id, auth.uid()));

create policy "threads_access"
on public.threads for all
using (public.is_workspace_member(workspace_id, auth.uid()))
with check (public.is_workspace_member(workspace_id, auth.uid()));

create policy "thread_messages_access"
on public.thread_messages for all
using (public.is_workspace_member(workspace_id, auth.uid()))
with check (public.is_workspace_member(workspace_id, auth.uid()));

create policy "share_links_access"
on public.share_links for all
using (public.is_workspace_member(workspace_id, auth.uid()))
with check (public.is_workspace_member(workspace_id, auth.uid()));

