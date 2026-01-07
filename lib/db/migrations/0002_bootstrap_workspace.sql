-- Creates an automatic workspace + membership for new auth.users rows
-- Assumes public.workspaces and public.workspace_members already exist.

-- Clean up prior trigger/function to allow re-running safely
drop trigger if exists trg_bootstrap_workspace on auth.users;
drop function if exists public.handle_new_user_bootstrap();

create or replace function public.handle_new_user_bootstrap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
begin
  -- Find existing workspace for this owner (idempotent guard)
  select id into v_workspace_id
  from public.workspaces
  where owner_user_id = new.id
  limit 1;

  -- Create workspace if missing
  if v_workspace_id is null then
    insert into public.workspaces (owner_user_id, name)
    values (new.id, 'My Workspace')
    returning id into v_workspace_id;
  end if;

  -- Ensure membership as owner (idempotent via PK/unique constraint)
  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_workspace_id, new.id, 'owner')
  on conflict (workspace_id, user_id) do nothing;

  return new;
end;
$$;

create trigger trg_bootstrap_workspace
after insert on auth.users
for each row
execute function public.handle_new_user_bootstrap();

