-- Run this in Supabase → SQL Editor if tables/columns already exist from an older schema.
-- Safe to re-run (uses IF NOT EXISTS).

-- OAuth tokens are NOT stored in webhooks; use dashboard OAuth session + in-memory cache on enable.

-- Repository runtime targets (required by Save runtime config / webhook audits)
create table if not exists public.repository_configs (
    repo_name text primary key,
    branch text not null default 'main',
    staging_url text not null,
    webhook_enabled boolean not null default false,
    created_by text,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists repository_configs_webhook_enabled_idx
    on public.repository_configs (webhook_enabled)
    where webhook_enabled = true;

-- Audits: execution origin
alter table public.audits add column if not exists origin text not null default 'manual';

-- Refresh PostgREST schema cache (Supabase usually picks this up within seconds)
notify pgrst, 'reload schema';
