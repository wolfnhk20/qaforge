'use client'

import { Menu, RefreshCw, Terminal } from 'lucide-react'

import { useAudit } from '@/hooks/useAudit'
import { useHealth } from '@/hooks/useHealth'
import { cn } from '@/lib/utils'

export default function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { phase, latestAudit, latestAuditQuery } = useAudit()
  const { data: healthStatus } = useHealth()

  return (
    <header className="h-[48px] flex items-center justify-between border-b border-border bg-surface px-3 sm:px-4 gap-2 flex-shrink-0">
      {/* Left */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={onMenuClick}
          className="lg:hidden p-1.5 -ml-1 text-faint hover:text-ink transition-colors rounded hover:bg-s2 flex-shrink-0"
          aria-label="Toggle sidebar"
        >
          <Menu className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-1.5 font-mono text-[11px] min-w-0">
          <span className="text-faint hidden sm:block">qaforge</span>
          <span className="text-border hidden sm:block">/</span>
          <span className="text-muted truncate">control-plane</span>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Audit phase pill — hidden on very small screens */}
        {phase !== 'idle' && (
          <div className={cn(
            'hidden xs:flex items-center gap-1.5 rounded px-2 py-0.5 border text-[11px] font-mono',
            phase === 'running'   ? 'bg-accent-blue/8 border-accent-blue/25 text-accent-blue' :
            phase === 'completed' ? 'bg-accent-green/8 border-accent-green/25 text-accent-green' :
            phase === 'error'     ? 'bg-accent-red/8 border-accent-red/25 text-accent-red' :
                                    'bg-s2 border-border text-faint'
          )}>
            {phase === 'running' && (
              <span className="flex gap-0.5">
                {[0,1,2].map(i => (
                  <span key={i} className="w-0.5 h-2.5 rounded-full bg-accent-blue animate-[dot-blink_1.2s_ease-in-out_infinite]"
                    style={{ animationDelay: `${i * 0.2}s` }} />
                ))}
              </span>
            )}
            <span className="hidden sm:block">
              {phase === 'running'   ? 'AUDIT RUNNING' :
               phase === 'completed' ? 'COMPLETED' :
               phase === 'error'     ? 'FAILED' :
               phase.toUpperCase()}
            </span>
            {/* Compact label on mobile */}
            <span className="sm:hidden">
              {phase === 'running' ? 'RUN' : phase === 'completed' ? 'OK' : 'ERR'}
            </span>
          </div>
        )}

        {/* Repo context — md+ only */}
        {latestAudit?.repo && (
          <div className="hidden md:flex items-center gap-1.5 font-mono text-[11px] text-faint min-w-0 max-w-[160px]">
            <Terminal className="w-3 h-3 flex-shrink-0" />
            <span className="text-muted truncate">{latestAudit.repo}</span>
          </div>
        )}

        {/* Sync */}
        <button
          type="button"
          onClick={() => void latestAuditQuery.refetch()}
          className="p-1.5 text-faint hover:text-ink transition-colors rounded hover:bg-s2"
          title="Sync latest"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', latestAuditQuery.isFetching && 'animate-spin')} />
        </button>

        {/* Health dot */}
        <div className="flex items-center gap-1.5">
          <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0',
            healthStatus?.status === 'ok'
              ? 'bg-accent-green shadow-[0_0_6px_rgba(46,200,154,0.6)]'
              : 'bg-accent-red shadow-[0_0_6px_rgba(245,101,101,0.6)]'
          )} />
          <span className="text-[11px] font-mono text-faint hidden sm:block">
            {healthStatus?.status === 'ok' ? 'ok' : 'err'}
          </span>
        </div>
      </div>
    </header>
  )
}
