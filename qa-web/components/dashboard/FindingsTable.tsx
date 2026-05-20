'use client'

import { useMemo } from 'react'
import { ArrowUpRight, Radar } from 'lucide-react'

import { useAudit } from '@/hooks/useAudit'
import {
  buildFindingJumpHints,
  cn,
  getPriorityTone,
  summarizeFindings,
} from '@/lib/utils'

export default function FindingsTable({ compact = false }: { compact?: boolean }) {
  const { findings, selectedFindingId, setSelectedFindingId } = useAudit()
  const summary = useMemo(() => summarizeFindings(findings), [findings])
  const rows = compact ? findings.slice(0, 6) : findings

  return (
    <section className="rounded-[28px] border border-white/8 bg-white/[0.03] p-6 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-faint">Findings</p>
          <h2 className="mt-3 text-2xl font-semibold text-white">
            Behavioral gaps detected by probes
          </h2>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-rose-200">
            High {summary.high}
          </span>
          <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-amber-200">
            Medium {summary.medium}
          </span>
          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-emerald-200">
            Low {summary.low}
          </span>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="mt-6 flex min-h-[260px] flex-col items-center justify-center rounded-[24px] border border-dashed border-white/10 bg-slate-950/60 text-center">
          <Radar className="h-8 w-8 text-sky-200" />
          <p className="mt-4 text-lg font-medium text-white">No findings yet</p>
          <p className="mt-2 max-w-md text-sm leading-7 text-muted">
            Run an audit or hydrate the latest backend snapshot to populate operational findings.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-[24px] border border-white/8">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/8">
              <thead className="bg-slate-950/75 text-left text-[11px] uppercase tracking-[0.24em] text-faint">
                <tr>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Endpoint</th>
                  <th className="px-4 py-3">Classification</th>
                  <th className="px-4 py-3">Case</th>
                  <th className="px-4 py-3">Reasoning</th>
                  <th className="px-4 py-3 text-right">Jump</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6 bg-white/[0.02]">
                {rows.map((finding) => (
                  <tr
                    key={finding.case_id}
                    className={cn(
                      'cursor-pointer transition hover:bg-white/[0.04]',
                      selectedFindingId === finding.case_id && 'bg-sky-400/10',
                    )}
                    onClick={() => setSelectedFindingId(finding.case_id)}
                  >
                    <td className="px-4 py-4 align-top">
                      <span
                        className={cn(
                          'inline-flex rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.2em]',
                          getPriorityTone(finding.priority),
                        )}
                      >
                        {finding.priority}
                      </span>
                    </td>
                    <td className="px-4 py-4 align-top text-sm text-white">
                      {finding.endpoint || 'Unknown surface'}
                    </td>
                    <td className="px-4 py-4 align-top text-sm text-slate-200">
                      {finding.classification}
                    </td>
                    <td className="px-4 py-4 align-top font-mono text-xs text-sky-100">
                      {finding.case_id}
                    </td>
                    <td className="max-w-[380px] px-4 py-4 align-top text-sm leading-6 text-muted">
                      {finding.reasoning}
                    </td>
                    <td className="px-4 py-4 align-top text-right">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          window.dispatchEvent(
                            new CustomEvent('qaforge-report-jump', {
                              detail: {
                                hints: buildFindingJumpHints(finding),
                                caseId: finding.case_id,
                              },
                            }),
                          )
                        }}
                        className="inline-flex items-center gap-2 rounded-full border border-white/8 px-3 py-1 text-xs text-slate-100 transition hover:bg-white/[0.05]"
                      >
                        <span>Open</span>
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}
