'use client'

import { RefreshCw, History, ChevronRight, AlertTriangle, Clock } from 'lucide-react'
import { cn, formatRelativeTime, formatShortDate, summarizeFindings } from '@/lib/utils'
import type { AuditHistoryRecord } from '@/types'
import { AuditStatusBadge } from './AuditStatusBadge'
import { AuditOriginBadge } from './AuditOriginBadge'

interface AuditHistoryTableProps {
  audits: AuditHistoryRecord[]
  selectedId: number | null
  onSelect: (id: number) => void
  isLoading: boolean
  isError: boolean
  isFetching: boolean
  onRefresh: () => void
}

export function AuditHistoryTable({
  audits,
  selectedId,
  onSelect,
  isLoading,
  isError,
  isFetching,
  onRefresh,
}: AuditHistoryTableProps) {
  return (
    <section className="border border-border rounded bg-surface flex flex-col">
      {/* Header */}
      <div className="px-4 sm:px-5 py-3 border-b border-border flex items-center justify-between gap-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <History className="w-3.5 h-3.5 text-faint" />
          <h2 className="font-medium text-[13px] text-ink">Execution History</h2>
          {!isLoading && (
            <span className="text-[11px] font-mono text-faint">
              · {audits.length} {audits.length === 1 ? 'run' : 'runs'}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="flex items-center gap-1.5 text-[11px] text-faint hover:text-muted transition-colors px-2 py-1 rounded hover:bg-s2"
        >
          <RefreshCw className={cn('w-3 h-3', isFetching && 'animate-spin')} />
          <span className="hidden sm:block">Refresh</span>
        </button>
      </div>

      {/* States */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <RefreshCw className="w-5 h-5 text-faint animate-spin mb-3" />
          <p className="text-[12px] text-faint font-mono">Loading audit history…</p>
        </div>
      )}

      {isError && !isLoading && (
        <div className="flex flex-col items-center justify-center py-20 text-center px-6">
          <AlertTriangle className="w-6 h-6 text-accent-red mb-3" />
          <p className="text-[13px] text-muted">Failed to load history</p>
          <p className="text-[11px] text-faint mt-1 font-mono">Backend may be offline or Supabase is not configured</p>
          <button
            type="button"
            onClick={onRefresh}
            className="mt-4 text-[11px] text-accent-blue hover:underline font-mono"
          >
            Try again
          </button>
        </div>
      )}

      {!isLoading && !isError && audits.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center px-6">
          <Clock className="w-8 h-8 text-faint mb-3" />
          <p className="text-[13px] text-muted">No audit history yet</p>
          <p className="text-[11px] text-faint mt-1 max-w-[260px] leading-relaxed">
            Run your first audit from the dashboard or enable Auto Audits via GitHub webhook in Settings.
          </p>
        </div>
      )}

      {!isLoading && !isError && audits.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 sm:px-5 py-2.5 text-left text-[10px] font-mono text-faint uppercase tracking-widest">Repository</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-mono text-faint uppercase tracking-widest">Trigger</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-mono text-faint uppercase tracking-widest">Status</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-mono text-faint uppercase tracking-widest hidden sm:table-cell">Findings</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-mono text-faint uppercase tracking-widest hidden md:table-cell">Probes</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-mono text-faint uppercase tracking-widest">When</th>
                <th className="px-3 py-2.5 w-8" />
              </tr>
            </thead>
            <tbody>
              {audits.map((audit) => {
                const isSelected = selectedId === audit.id
                const summary = summarizeFindings(audit.findings ?? [])
                const hasFindings = summary.high + summary.medium + summary.low > 0

                return (
                  <tr
                    key={audit.id}
                    onClick={() => onSelect(audit.id)}
                    className={cn(
                      'border-b border-border/50 cursor-pointer transition-colors group',
                      isSelected
                        ? 'bg-accent-blue/5 border-accent-blue/15'
                        : 'hover:bg-s2'
                    )}
                  >
                    {/* Repo */}
                    <td className="px-4 sm:px-5 py-3">
                      <div className="flex flex-col min-w-0">
                        <span className={cn(
                          'font-mono text-[12px] truncate max-w-[200px]',
                          isSelected ? 'text-accent-blue' : 'text-ink'
                        )}>
                          {audit.repo}
                        </span>
                        <span className="text-[10px] text-faint font-mono mt-0.5">
                          #{audit.id} · {audit.module}
                        </span>
                      </div>
                    </td>

                    {/* Trigger */}
                    <td className="px-3 py-3">
                      <AuditOriginBadge origin={audit.origin} />
                    </td>

                    {/* Status */}
                    <td className="px-3 py-3">
                      <AuditStatusBadge status={audit.status} />
                    </td>

                    {/* Findings */}
                    <td className="px-3 py-3 hidden sm:table-cell">
                      {hasFindings ? (
                        <div className="flex items-center gap-1.5">
                          {summary.high > 0 && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-accent-red/25 text-accent-red bg-accent-red/8">
                              H{summary.high}
                            </span>
                          )}
                          {summary.medium > 0 && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-accent-amber/25 text-accent-amber bg-accent-amber/8">
                              M{summary.medium}
                            </span>
                          )}
                          {summary.low > 0 && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-accent-green/25 text-accent-green bg-accent-green/8">
                              L{summary.low}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] font-mono text-faint">
                          {audit.status === 'completed' ? '✓ clean' : '—'}
                        </span>
                      )}
                    </td>

                    {/* Probes */}
                    <td className="px-3 py-3 hidden md:table-cell">
                      <span className="text-[12px] font-mono text-muted">{audit.probe_count ?? 0}</span>
                    </td>

                    {/* Timestamp */}
                    <td className="px-3 py-3">
                      <div className="flex flex-col">
                        <span className="text-[11px] font-mono text-muted" title={formatShortDate(audit.created_at)}>
                          {formatRelativeTime(audit.created_at)}
                        </span>
                        <span className="text-[10px] font-mono text-faint mt-0.5 hidden lg:block">
                          {formatShortDate(audit.created_at)}
                        </span>
                      </div>
                    </td>

                    {/* Chevron */}
                    <td className="px-3 py-3 text-right">
                      <ChevronRight className={cn(
                        'w-3.5 h-3.5 transition-colors',
                        isSelected ? 'text-accent-blue' : 'text-faint group-hover:text-muted'
                      )} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
