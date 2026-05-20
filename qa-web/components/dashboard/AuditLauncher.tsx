'use client'

import { useMemo } from 'react'
import { Loader2, Play, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react'

import { useAudit } from '@/hooks/useAudit'
import { cn, summarizeFindings } from '@/lib/utils'

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
      <p className="text-xs uppercase tracking-[0.24em] text-faint">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-xs text-muted">{hint}</p>
    </div>
  )
}

export default function AuditLauncher() {
  const {
    repoDraft,
    findings,
    activeAudit,
    latestAudit,
    phase,
    isLaunching,
    errorMessage,
    launchAudit,
    refreshLatest,
    latestAuditQuery,
  } = useAudit()

  const findingSummary = useMemo(() => summarizeFindings(findings), [findings])
  const displayedAudit = activeAudit || latestAudit

  return (
    <section className="rounded-[28px] border border-white/8 bg-white/[0.03] p-6 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-faint">Execution control</p>
          <h2 className="mt-3 text-2xl font-semibold text-white">
            Run a new QAForge audit
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-7 text-muted">
            Trigger the backend pipeline and keep the frontend alive with progressive stage and
            log updates while FastAPI completes the inline run.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void refreshLatest()}
            className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.03] px-4 text-sm text-slate-100 transition hover:bg-white/[0.06]"
          >
            <RefreshCw
              className={cn('h-4 w-4', latestAuditQuery.isFetching && 'animate-spin')}
            />
            <span>Sync latest</span>
          </button>
          <button
            type="button"
            onClick={() => void launchAudit(repoDraft)}
            disabled={isLaunching}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-sky-400 px-4 text-sm font-medium text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLaunching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            <span>{isLaunching ? 'Audit in progress' : 'Launch audit'}</span>
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Status"
          value={
            phase === 'running'
              ? 'Running'
              : phase === 'completed'
                ? 'Completed'
                : phase === 'error'
                  ? 'Failed'
                  : 'Ready'
          }
          hint="Operational state of the current frontend session."
        />
        <MetricCard
          label="Probe count"
          value={String(displayedAudit?.probe_count || 0)}
          hint="Returned from the backend audit payload."
        />
        <MetricCard
          label="High priority"
          value={String(findingSummary.high)}
          hint="High or critical remediation candidates."
        />
        <MetricCard
          label="Audit id"
          value={displayedAudit?.audit_id ? `#${displayedAudit.audit_id}` : 'Pending'}
          hint="Persisted Supabase record when available."
        />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-white/8 bg-slate-950/70 p-4">
          <div className="flex items-center gap-3">
            <Sparkles className="h-4 w-4 text-sky-200" />
            <div>
              <p className="text-sm font-medium text-white">Current target</p>
              <p className="text-sm text-muted">
                {repoDraft.fullName} · {repoDraft.module} · {repoDraft.scope}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/8 bg-slate-950/70 p-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-4 w-4 text-emerald-300" />
            <div>
              <p className="text-sm font-medium text-white">Persistence posture</p>
              <p className="text-sm text-muted">
                {displayedAudit?.audit_id
                  ? 'Latest run persisted to Supabase.'
                  : 'Waiting for persisted audit metadata from backend.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {errorMessage ? (
        <div className="mt-6 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-4 text-sm text-rose-200">
          {errorMessage}
        </div>
      ) : null}
    </section>
  )
}
