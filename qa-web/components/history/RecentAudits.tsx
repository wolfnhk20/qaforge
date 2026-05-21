'use client'

import Link from 'next/link'
import { History, ChevronRight, RefreshCw } from 'lucide-react'
import { cn, formatRelativeTime, summarizeFindings } from '@/lib/utils'
import { useAuditHistory } from '@/hooks/useAuditHistory'
import { AuditStatusBadge } from '@/components/history/AuditStatusBadge'

export function RecentAudits() {
  const { audits, isLoading, isFetching, refetch } = useAuditHistory()
  const recent = audits.slice(0, 5)

  return (
    <section className="border border-border rounded bg-surface">
      <div className="px-4 sm:px-5 py-3 border-b border-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <History className="w-3.5 h-3.5 text-faint" />
          <h2 className="font-medium text-[13px] text-ink">Recent Runs</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refetch}
            className="text-faint hover:text-muted transition-colors p-1 rounded hover:bg-s2"
          >
            <RefreshCw className={cn('w-3 h-3', isFetching && 'animate-spin')} />
          </button>
          <Link
            href="/audits"
            className="text-[11px] font-mono text-accent-blue hover:underline"
          >
            View all →
          </Link>
        </div>
      </div>

      {isLoading && (
        <div className="px-4 py-6 text-center">
          <p className="text-[11px] font-mono text-faint">Loading history…</p>
        </div>
      )}

      {!isLoading && recent.length === 0 && (
        <div className="px-4 py-6 text-center">
          <p className="text-[12px] text-faint">No audit history yet.</p>
        </div>
      )}

      {!isLoading && recent.length > 0 && (
        <div>
          {recent.map((audit, i) => {
            const summary = summarizeFindings(audit.findings ?? [])
            const hasHigh = summary.high > 0

            return (
              <Link
                key={audit.id}
                href="/audits"
                className={cn(
                  'flex items-center gap-3 px-4 sm:px-5 py-2.5 hover:bg-s2 transition-colors group',
                  i < recent.length - 1 && 'border-b border-border/50'
                )}
              >
                {/* Status dot */}
                <div className={cn(
                  'w-1.5 h-1.5 rounded-full flex-shrink-0',
                  audit.status === 'completed' ? 'bg-accent-green' :
                  audit.status === 'running'   ? 'bg-accent-blue animate-pulse' :
                                                 'bg-accent-red'
                )} />

                {/* Repo + ID */}
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-[12px] text-ink truncate">{audit.repo}</p>
                  <p className="text-[10px] font-mono text-faint mt-0.5">
                    #{audit.id}
                    {hasHigh && (
                      <span className="ml-1.5 text-accent-red">· {summary.high} high</span>
                    )}
                  </p>
                </div>

                {/* Status + time */}
                <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                  <AuditStatusBadge status={audit.status} className="text-[9px] px-1.5 py-0.5" />
                  <span className="text-[10px] font-mono text-faint">
                    {formatRelativeTime(audit.created_at)}
                  </span>
                </div>

                <ChevronRight className="w-3 h-3 text-faint group-hover:text-muted transition-colors flex-shrink-0" />
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}
