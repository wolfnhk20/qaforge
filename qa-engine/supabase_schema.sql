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
