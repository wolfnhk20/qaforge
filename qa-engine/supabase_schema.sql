create table if not exists public.audits (
    id bigint generated always as identity primary key,
    repo text not null,
    module text not null,
    status text not null,
    probe_count integer not null default 0,
    findings jsonb not null default '[]'::jsonb,
    report_markdown text not null,
    created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.logs (
    id bigint generated always as identity primary key,
    audit_id bigint references public.audits(id) on delete set null,
    level text not null default 'info',
    message text not null,
    payload jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default timezone('utc', now())
);

create index if not exists audits_created_at_idx on public.audits (created_at desc);
create index if not exists logs_audit_id_idx on public.logs (audit_id);
create index if not exists logs_created_at_idx on public.logs (created_at desc);

-- Webhook triggers metadata
create table if not exists public.webhooks (
    repo text primary key,
    webhook_id bigint not null,
    webhook_secret text not null,
    enabled boolean not null default true,
    created_at timestamptz not null default timezone('utc', now()),
    last_push_received timestamptz,
    last_auto_audit timestamptz
);

-- Legacy columns (optional; runtime targets live in repository_configs)
alter table public.webhooks add column if not exists staging_url text;

-- Per-repository runtime configuration for autonomous webhook audits
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

-- Track execution origin (manual or webhook github_push)
alter table public.audits add column if not exists origin text not null default 'manual';

-- Optional backfill from legacy webhooks.staging_url:
-- insert into public.repository_configs (repo_name, branch, staging_url, webhook_enabled, created_by)
-- select repo, 'main', staging_url, enabled, null
-- from public.webhooks
-- where staging_url is not null
-- on conflict (repo_name) do update
--   set staging_url = excluded.staging_url,
--       webhook_enabled = excluded.webhook_enabled,
--       updated_at = timezone('utc', now());

