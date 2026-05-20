'use client'

import { CheckCircle2, Clock3, Github, ShieldAlert } from 'lucide-react'

import { useHealth } from '@/hooks/useHealth'
import { cn, getHealthTone } from '@/lib/utils'
import { useAuditStore } from '@/store/auditStore'

export default function RepoSelector() {
  const { repoDraft, setRepoDraft } = useAuditStore()
  const healthQuery = useHealth()
  const health = healthQuery.data

  return (
    <section className="rounded-[28px] border border-white/8 bg-slate-950/70 p-6 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-faint">Audit target</p>
          <h2 className="mt-3 text-2xl font-semibold text-white">
            Connect the next repository run
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-7 text-muted">
            The frontend stays presentation-only. Repository analysis, persistence, and agent
            orchestration remain owned by FastAPI and LangGraph.
          </p>
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
          <div className="flex items-center gap-3">
            {healthQuery.isLoading ? (
              <Clock3 className="h-4 w-4 text-amber-200" />
            ) : health?.status === 'ok' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-300" />
            ) : (
              <ShieldAlert className="h-4 w-4 text-rose-300" />
            )}
            <div>
              <p className={cn('text-sm font-medium', getHealthTone(health?.status || 'offline'))}>
                {health?.status === 'ok'
                  ? 'Backend healthy'
                  : healthQuery.isLoading
                    ? 'Checking backend'
                    : 'Backend unavailable'}
              </p>
              <p className="text-xs text-faint">
                {health?.latencyMs ? `${health.latencyMs}ms` : 'No latency yet'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.24em] text-faint">
            Repository
          </span>
          <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
            <Github className="h-4 w-4 text-sky-200" />
            <input
              value={repoDraft.fullName}
              onChange={(event) => setRepoDraft({ fullName: event.target.value })}
              placeholder="owner/repo"
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-faint"
            />
          </div>
        </label>

        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.24em] text-faint">Module</span>
          <input
            value={repoDraft.module}
            onChange={(event) => setRepoDraft({ module: event.target.value })}
            placeholder="."
            className="w-full rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none placeholder:text-faint"
          />
        </label>

        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.24em] text-faint">Branch</span>
          <input
            value={repoDraft.branch}
            onChange={(event) => setRepoDraft({ branch: event.target.value })}
            placeholder="main"
            className="w-full rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none placeholder:text-faint"
          />
        </label>

        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.24em] text-faint">Scope</span>
          <select
            value={repoDraft.scope}
            onChange={(event) =>
              setRepoDraft({
                scope: event.target.value as typeof repoDraft.scope,
              })
            }
            className="w-full rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none"
          >
            <option value="full_module">Full module</option>
            <option value="pr">Pull request</option>
            <option value="commit_range">Commit range</option>
          </select>
        </label>
      </div>

      {repoDraft.scope === 'pr' ? (
        <div className="mt-4">
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.24em] text-faint">PR number</span>
            <input
              type="number"
              min={1}
              value={repoDraft.prNumber ?? ''}
              onChange={(event) =>
                setRepoDraft({
                  prNumber: event.target.value ? Number(event.target.value) : undefined,
                })
              }
              className="w-full rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none placeholder:text-faint"
            />
          </label>
        </div>
      ) : null}

      {repoDraft.scope === 'commit_range' ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.24em] text-faint">Base commit</span>
            <input
              value={repoDraft.baseCommit ?? ''}
              onChange={(event) => setRepoDraft({ baseCommit: event.target.value || undefined })}
              className="w-full rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none placeholder:text-faint"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.24em] text-faint">Head commit</span>
            <input
              value={repoDraft.headCommit ?? ''}
              onChange={(event) => setRepoDraft({ headCommit: event.target.value || undefined })}
              className="w-full rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none placeholder:text-faint"
            />
          </label>
        </div>
      ) : null}
    </section>
  )
}
