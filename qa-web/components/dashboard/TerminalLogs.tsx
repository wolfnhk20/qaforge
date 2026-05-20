'use client'

import { useEffect, useRef } from 'react'

import { useAudit } from '@/hooks/useAudit'
import { cn, formatClock } from '@/lib/utils'

export default function TerminalLogs() {
  const { logs, phase } = useAudit()
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const element = containerRef.current
    if (!element) {
      return
    }

    element.scrollTop = element.scrollHeight
  }, [logs])

  return (
    <section className="rounded-[28px] border border-white/8 bg-slate-950/85 p-6 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-faint">Terminal trace</p>
          <h2 className="mt-3 text-2xl font-semibold text-white">
            Operational execution log
          </h2>
        </div>
        <div className="rounded-full border border-white/8 bg-white/[0.03] px-4 py-2 text-xs uppercase tracking-[0.24em] text-slate-200">
          {logs.length} events
        </div>
      </div>

      <div
        ref={containerRef}
        className="mt-6 h-[340px] overflow-y-auto rounded-[22px] border border-white/8 bg-black/35 p-4 font-mono text-xs text-slate-200"
      >
        {logs.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-sm text-faint">
            Launch an audit to start receiving simulated and reconciled execution logs.
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div
                key={log.id}
                className="rounded-2xl border border-white/6 bg-white/[0.03] px-3 py-3"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sky-200">{formatClock(log.timestamp)}</span>
                  <span
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.2em]',
                      log.level === 'success'
                        ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
                        : log.level === 'warning'
                          ? 'border-amber-500/20 bg-amber-500/10 text-amber-200'
                          : log.level === 'error'
                            ? 'border-rose-500/20 bg-rose-500/10 text-rose-200'
                            : 'border-sky-500/20 bg-sky-500/10 text-sky-200',
                    )}
                  >
                    {log.level}
                  </span>
                  <span className="text-faint">{log.source}</span>
                </div>
                <p className="mt-3 leading-6 text-slate-100">{log.message}</p>
                {log.details ? (
                  <p className="mt-2 leading-6 text-faint">{log.details}</p>
                ) : null}
              </div>
            ))}

            {phase === 'running' ? (
              <div className="text-sky-100">
                backend://awaiting-final-response<span className="cursor-blink" />
              </div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  )
}
