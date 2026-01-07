-- Add username and first_name to accounts
-- Safe to run after accounts table already exists

alter table public.accounts
  add column if not exists username text,
  add column if not exists first_name text;

-- Enforce uniqueness on username when present
create unique index if not exists accounts_username_key
  on public.accounts (username)
  where username is not null;

