'use client'

import { useMemo, useState } from 'react'
import { ArrowUpRight, ChevronDown, ChevronRight, Filter, Search, Shield } from 'lucide-react'

import { useAudit } from '@/hooks/useAudit'
import { buildFindingJumpHints, cn, getPriorityTone, summarizeFindings } from '@/lib/utils'
import type { Findings } from '@/types'

function PriorityBadge({ priority }: { priority: string }) {
  const tone = getPriorityTone(priority)
  return (
    <span className={cn('inline-flex items-center rounded px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider border', tone)}>
      {priority}
    </span>
  )
}

function FindingRow({ finding, isSelected, onSelect }: {
  finding: Findings
  isSelected: boolean
  onSelect: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <tr
        onClick={onSelect}
        className={cn(
          'cursor-pointer border-b border-border/50 transition-colors',
          isSelected ? 'bg-accent-blue/5' : 'hover:bg-s2',
        )}
      >
        <td className="px-3 sm:px-4 py-2.5 w-8">
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
            className="text-faint hover:text-muted transition-colors"
          >
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        </td>
        <td className="px-3 sm:px-4 py-2.5"><PriorityBadge priority={finding.priority} /></td>
        <td className="px-3 sm:px-4 py-2.5 font-mono text-[12px] text-accent-blue whitespace-nowrap">{finding.endpoint || '—'}</td>
        {/* Hide less-critical cols on mobile */}
        <td className="px-3 sm:px-4 py-2.5 text-[12px] text-muted hidden sm:table-cell">{finding.classification}</td>
        <td className="px-3 sm:px-4 py-2.5 font-mono text-[11px] text-faint hidden md:table-cell">{finding.case_id}</td>
        <td className="px-3 sm:px-4 py-2.5 max-w-[200px] lg:max-w-[300px] text-[12px] text-faint truncate hidden lg:table-cell">{finding.reasoning}</td>
        <td className="px-3 sm:px-4 py-2.5 text-right">
          <button
            type="button"
            onClick={e => {
              e.stopPropagation()
              window.dispatchEvent(new CustomEvent('qaforge-report-jump', {
                detail: { hints: buildFindingJumpHints(finding), caseId: finding.case_id },
              }))
            }}
            className="inline-flex items-center gap-1 text-[11px] text-faint hover:text-accent-blue transition-colors"
          >
            <ArrowUpRight className="w-3 h-3" />
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-border/50 bg-s2">
          <td colSpan={7} className="px-3 sm:px-4 py-3 max-w-0">
            <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <p className="text-[11px] font-mono text-faint uppercase tracking-widest mb-1">Reasoning</p>
                <p className="text-[12px] text-muted leading-relaxed break-words">{finding.reasoning}</p>
              </div>
              <div>
                <p className="text-[11px] font-mono text-faint uppercase tracking-widest mb-1">Suggested Fix</p>
                <p className="text-[12px] text-muted leading-relaxed break-words">{finding.suggested_fix || 'No fix suggested.'}</p>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export default function FindingsTable({ compact = false }: { compact?: boolean }) {
  const { findings, selectedFindingId, setSelectedFindingId } = useAudit()
  const [search, setSearch] = useState('')
  const [filterPriority, setFilterPriority] = useState<string>('all')

  const summary = useMemo(() => summarizeFindings(findings), [findings])

  const filtered = useMemo(() => {
    let rows = compact ? findings.slice(0, 8) : findings
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(f =>
        f.endpoint?.toLowerCase().includes(q) ||
        f.classification?.toLowerCase().includes(q) ||
        f.reasoning?.toLowerCase().includes(q)
      )
    }
    if (filterPriority !== 'all') {
      rows = rows.filter(f => f.priority.toLowerCase().includes(filterPriority))
    }
    return rows
  }, [findings, compact, search, filterPriority])

  return (
    <section className="border border-border rounded bg-surface">
      {/* Header */}
      <div className="px-4 sm:px-5 py-3 border-b border-border flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-faint" />
          <h2 className="font-medium text-[13px] text-ink">Findings</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-mono px-1.5 sm:px-2 py-0.5 rounded border border-accent-red/25 text-accent-red">
            H {summary.high}
          </span>
          <span className="text-[11px] font-mono px-1.5 sm:px-2 py-0.5 rounded border border-accent-amber/25 text-accent-amber">
            M {summary.medium}
          </span>
          <span className="text-[11px] font-mono px-1.5 sm:px-2 py-0.5 rounded border border-accent-green/25 text-accent-green">
            L {summary.low}
          </span>
        </div>
      </div>

      {/* Filters */}
      {!compact && (
        <div className="px-4 sm:px-5 py-2.5 border-b border-border flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-s2 border border-border rounded px-2.5 py-1.5 flex-1 min-w-[160px]">
            <Search className="w-3 h-3 text-faint flex-shrink-0" />
            <input
              type="text"
              placeholder="Search findings…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-transparent text-[12px] text-ink placeholder:text-faint outline-none w-full"
            />
          </div>
          <div className="flex items-center gap-1">
            <Filter className="w-3 h-3 text-faint flex-shrink-0" />
            {['all','high','medium','low'].map(p => (
              <button key={p} type="button"
                onClick={() => setFilterPriority(p)}
                className={cn('px-2 sm:px-2.5 py-1 rounded text-[11px] font-mono transition-colors',
                  filterPriority === p ? 'bg-s3 border border-border text-ink' : 'text-faint hover:text-muted'
                )}>
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Table / Content Area with scrolling in compact mode */}
      <div className={cn(compact ? 'h-[255px] overflow-y-auto' : '')}>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12 text-center">
            <Shield className="w-8 h-8 text-faint mb-3" />
            <p className="text-[13px] text-muted">No findings yet</p>
            <p className="text-[12px] text-faint mt-1">Run an audit to detect behavioral gaps</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="w-8 px-3 sm:px-4 py-2.5" />
                  <th className="px-3 sm:px-4 py-2.5 text-left text-[10px] font-mono text-faint uppercase tracking-widest">Priority</th>
                  <th className="px-3 sm:px-4 py-2.5 text-left text-[10px] font-mono text-faint uppercase tracking-widest">Endpoint</th>
                  <th className="px-3 sm:px-4 py-2.5 text-left text-[10px] font-mono text-faint uppercase tracking-widest hidden sm:table-cell">Classification</th>
                  <th className="px-3 sm:px-4 py-2.5 text-left text-[10px] font-mono text-faint uppercase tracking-widest hidden md:table-cell">Case ID</th>
                  <th className="px-3 sm:px-4 py-2.5 text-left text-[10px] font-mono text-faint uppercase tracking-widest hidden lg:table-cell">Reasoning</th>
                  <th className="px-3 sm:px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(finding => (
                  <FindingRow
                    key={finding.case_id}
                    finding={finding}
                    isSelected={selectedFindingId === finding.case_id}
                    onSelect={() => setSelectedFindingId(finding.case_id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
