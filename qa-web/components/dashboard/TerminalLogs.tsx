'use client'

import { useEffect, useRef, useState } from 'react'
import { Terminal } from 'lucide-react'

import { useAudit } from '@/hooks/useAudit'
import { cn, formatClock } from '@/lib/utils'
import type { LogLevel } from '@/types'

function levelBadge(level: LogLevel) {
  switch (level) {
    case 'success': return 'text-accent-green'
    case 'warning': return 'text-accent-amber'
    case 'error':   return 'text-accent-red'
    default:        return 'text-accent-blue'
  }
}

function levelDot(level: LogLevel) {
  switch (level) {
    case 'success': return 'bg-accent-green'
    case 'warning': return 'bg-accent-amber'
    case 'error':   return 'bg-accent-red'
    default:        return 'bg-accent-blue'
  }
}

function levelPrefix(level: LogLevel) {
  switch (level) {
    case 'success': return '✓'
    case 'warning': return '!'
    case 'error':   return '✕'
    default:        return '›'
  }
}

export default function TerminalLogs() {
  const { logs, phase } = useAudit()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [mode, setMode] = useState<'grouped' | 'raw'>('grouped')

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [logs])

  // Group logs by source
  const grouped = logs.reduce<Record<string, typeof logs>>((acc, log) => {
    if (!acc[log.source]) acc[log.source] = []
    acc[log.source].push(log)
    return acc
  }, {})

  return (
    <section className="border border-border rounded bg-surface flex flex-col">
      {/* Header */}
      <div className="px-5 py-3 border-b border-border flex items-center justify-between gap-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-faint" />
          <h2 className="font-medium text-[13px] text-ink">Execution Log</h2>
          <span className="text-[11px] font-mono text-faint ml-1">· {logs.length} events</span>
        </div>
        <div className="flex items-center gap-1">
          {(['grouped', 'raw'] as const).map(m => (
            <button key={m} type="button" onClick={() => setMode(m)}
              className={cn('px-2.5 py-1 rounded text-[11px] font-mono transition-colors',
                mode === m ? 'bg-s3 text-ink border border-border' : 'text-faint hover:text-muted'
              )}>
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Terminal body */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4 font-mono text-[11px] bg-[#050a12] min-h-[320px] max-h-[400px]"
      >
        {logs.length === 0 ? (
          <div className="flex h-full items-center justify-center text-faint text-center">
            <div>
              <p className="mb-1">// awaiting audit execution</p>
              <p className="text-[10px]">Launch an audit to stream logs</p>
            </div>
          </div>
        ) : mode === 'raw' ? (
          // Raw mode
          <div className="space-y-1">
            {logs.map((log) => (
              <div key={log.id} className="log-row flex gap-2 leading-5">
                <span className="text-faint flex-shrink-0">{formatClock(log.timestamp)}</span>
                <span className={cn('flex-shrink-0 w-3', levelBadge(log.level))}>{levelPrefix(log.level)}</span>
                <span className="text-muted flex-shrink-0">[{log.source}]</span>
                <span className="text-ink/90">{log.message}</span>
                {log.details && <span className="text-faint">· {log.details}</span>}
              </div>
            ))}
            {phase === 'running' && (
              <div className="flex gap-2 leading-5 text-accent-blue">
                <span className="text-faint">{formatClock(new Date().toISOString())}</span>
                <span>›</span>
                <span>awaiting backend response<span className="cursor-blink" /></span>
              </div>
            )}
          </div>
        ) : (
          // Grouped mode
          <div className="space-y-4">
            {Object.entries(grouped).map(([source, entries]) => (
              <div key={source}>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', levelDot(entries[entries.length-1].level))} />
                  <span className="text-muted text-[11px] uppercase tracking-widest">{source}</span>
                  <div className="flex-1 h-px bg-border/40" />
                </div>
                <div className="pl-3.5 space-y-1 border-l border-border/40">
                  {entries.map(log => (
                    <div key={log.id} className="log-row">
                      <div className="flex items-start gap-2">
                        <span className="text-faint flex-shrink-0">{formatClock(log.timestamp)}</span>
                        <span className={cn(levelBadge(log.level), 'flex-shrink-0')}>{levelPrefix(log.level)}</span>
                        <span className={cn('flex-1 leading-5', log.level === 'error' ? 'text-accent-red' : log.level === 'success' ? 'text-ink/90' : 'text-muted')}>
                          {log.message}
                        </span>
                      </div>
                      {log.details && (
                        <p className="ml-[calc(6ch+8px)] text-faint text-[10px] leading-4 mt-0.5">{log.details}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {phase === 'running' && (
              <div className="flex items-center gap-2 text-accent-blue">
                <div className="w-1.5 h-1.5 rounded-full bg-accent-blue animate-ping-slow flex-shrink-0" />
                <span className="text-[11px]">backend://awaiting-response<span className="cursor-blink" /></span>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
