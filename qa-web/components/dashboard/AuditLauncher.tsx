'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, Loader2, Play, RefreshCw, ShieldCheck, Zap } from 'lucide-react'

import { useAudit } from '@/hooks/useAudit'
import { cn, summarizeFindings } from '@/lib/utils'

function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-s2 border border-border rounded p-3">
      <p className="text-[11px] font-mono text-faint uppercase tracking-widest mb-1.5">{label}</p>
      <p className={cn('text-xl font-semibold font-mono tabular-nums', accent ? 'text-accent-red' : 'text-ink')}>
        {value}
      </p>
    </div>
  )
}

const SCOPE_OPTIONS = [
  { value: 'full_module', label: 'Full module', desc: 'Entire codebase' },
  { value: 'pr',          label: 'Pull request', desc: 'PR diff only' },
  { value: 'commit_range',label: 'Commit range', desc: 'Base → head' },
] as const

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
    latestAuditQuery,
  } = useAudit()

  const [scopeOpen, setScopeOpen] = useState(false)
  const findingSummary = useMemo(() => summarizeFindings(findings), [findings])
  const displayedAudit = activeAudit || latestAudit

  const phaseColor = phase === 'running'   ? 'text-accent-blue' :
                     phase === 'completed' ? 'text-accent-green' :
                     phase === 'error'     ? 'text-accent-red'   : 'text-faint'

  const phaseLabel = phase === 'running'   ? 'Running' :
                     phase === 'completed' ? 'Completed' :
                     phase === 'error'     ? 'Failed' : 'Ready'

  return (
    <section className="border border-border rounded bg-surface">
      {/* Header row */}
      <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-accent-blue flex-shrink-0" />
          <h2 className="font-medium text-[13px] text-ink">Execution Control</h2>
          <span className={cn('text-[11px] font-mono ml-1', phaseColor)}>· {phaseLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void latestAuditQuery.refetch()}
            className="h-7 px-3 flex items-center gap-1.5 rounded border border-border text-[12px] text-muted hover:text-ink hover:bg-s2 transition-colors"
          >
            <RefreshCw className={cn('w-3 h-3', latestAuditQuery.isFetching && 'animate-spin')} />
            <span>Sync</span>
          </button>
          <button
            type="button"
            onClick={() => void launchAudit(repoDraft)}
            disabled={isLaunching}
            className="h-7 px-4 flex items-center gap-1.5 rounded bg-accent-blue/90 text-[12px] font-medium text-bg hover:bg-accent-blue transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLaunching ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Play className="w-3 h-3" />
            )}
            <span>{isLaunching ? 'Running…' : 'Run Audit'}</span>
          </button>
        </div>
      </div>

      {/* Config row */}
      <div className="px-5 py-3 border-b border-border flex flex-wrap items-center gap-3">
        {/* Target */}
        <div className="flex items-center gap-2 flex-1 min-w-[180px]">
          <span className="text-[11px] font-mono text-faint uppercase tracking-widest flex-shrink-0">Repo</span>
          <code className="text-[12px] font-mono text-muted bg-s2 border border-border rounded px-2 py-0.5">
            {repoDraft.fullName}
          </code>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-faint uppercase tracking-widest">Module</span>
          <code className="text-[12px] font-mono text-muted bg-s2 border border-border rounded px-2 py-0.5">
            {repoDraft.module}
          </code>
        </div>
        {/* Scope dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setScopeOpen(v => !v)}
            className="flex items-center gap-1.5 h-6 px-2.5 rounded border border-border bg-s2 text-[12px] text-muted hover:text-ink transition-colors"
          >
            <span>{SCOPE_OPTIONS.find(s => s.value === repoDraft.scope)?.label || repoDraft.scope}</span>
            <ChevronDown className={cn('w-3 h-3 transition-transform', scopeOpen && 'rotate-180')} />
          </button>
          {scopeOpen && (
            <div className="absolute top-full left-0 mt-1 w-44 bg-s2 border border-border rounded shadow-panel z-20">
              {SCOPE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { setScopeOpen(false) }}
                  className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-s3 transition-colors"
                >
                  <span className="text-[12px] text-ink">{opt.label}</span>
                  <span className="text-[11px] text-faint">{opt.desc}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-faint uppercase tracking-widest">Branch</span>
          <code className="text-[12px] font-mono text-muted bg-s2 border border-border rounded px-2 py-0.5">
            {repoDraft.branch}
          </code>
        </div>
      </div>

      {/* Metrics */}
      <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Metric label="Status"     value={phaseLabel} />
        <Metric label="Probes"     value={String(displayedAudit?.probe_count ?? 0)} />
        <Metric label="High"       value={String(findingSummary.high)} accent={findingSummary.high > 0} />
        <Metric label="Audit ID"   value={displayedAudit?.audit_id ? `#${displayedAudit.audit_id}` : '—'} />
      </div>

      {/* Persistence posture */}
      <div className="px-5 pb-4">
        <div className="flex items-center gap-2 bg-s2 border border-border rounded px-3 py-2">
          <ShieldCheck className="w-3.5 h-3.5 text-accent-green flex-shrink-0" />
          <span className="text-[12px] text-muted">
            {displayedAudit?.audit_id
              ? `Audit #${displayedAudit.audit_id} persisted to Supabase.`
              : 'Awaiting persisted audit metadata from backend.'}
          </span>
        </div>
      </div>

      {/* Error banner */}
      {errorMessage && (
        <div className="mx-5 mb-4 rounded border border-accent-red/20 bg-accent-red/8 px-3 py-2.5">
          <p className="text-[12px] text-accent-red font-mono">{errorMessage}</p>
        </div>
      )}
    </section>
  )
}
