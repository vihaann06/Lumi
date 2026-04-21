-- Migration: Stable reference numbering + soft delete for provenance continuity

create sequence if not exists public.references_reference_number_seq;

alter table public.references
  add column if not exists reference_number bigint,
  add column if not exists deleted_at timestamptz;

alter table public.references
  alter column reference_number set default nextval('public.references_reference_number_seq');

with ordered as (
  select id
  from public.references
  where reference_number is null
  order by created_at asc, id asc
)
update public.references r
set reference_number = nextval('public.references_reference_number_seq')
from ordered o
where r.id = o.id;

alter table public.references
  alter column reference_number set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'references_reference_number_unique'
  ) then
    alter table public.references
      add constraint references_reference_number_unique unique (reference_number);
  end if;
end $$;

create index if not exists idx_references_folder_active_number
  on public.references(folder_id, deleted_at, reference_number);
