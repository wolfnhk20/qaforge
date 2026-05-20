'use client'

import { motion } from 'framer-motion'
import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react'

import { useAudit } from '@/hooks/useAudit'
import { cn, formatClock, formatDuration } from '@/lib/utils'
import type { PipelineStageStatus } from '@/types'

const STAGE_ICONS: Record<string, string> = {
  intent:    '01',
  analysis:  '02',
  design:    '03',
  execution: '04',
  report:    '05',
}

function StageStatusIcon({ status }: { status: PipelineStageStatus }) {
  if (status === 'running')   return <Loader2 className="w-3.5 h-3.5 animate-spin text-accent-blue" />
  if (status === 'completed') return <CheckCircle2 className="w-3.5 h-3.5 text-accent-green" />
  if (status === 'error')     return <XCircle className="w-3.5 h-3.5 text-accent-red" />
  return <Circle className="w-3.5 h-3.5 text-faint" />
}

function stageBg(status: PipelineStageStatus) {
  if (status === 'running')   return 'border-accent-blue/30 bg-accent-blue/5 stage-running'
  if (status === 'completed') return 'border-accent-green/25 bg-accent-green/5'
  if (status === 'error')     return 'border-accent-red/25 bg-accent-red/5'
  return 'border-border bg-s2'
}

function stageText(status: PipelineStageStatus) {
  if (status === 'running')   return 'text-accent-blue'
  if (status === 'completed') return 'text-accent-green'
  if (status === 'error')     return 'text-accent-red'
  return 'text-faint'
}

function progressColor(status: PipelineStageStatus) {
  if (status === 'running')   return 'bg-accent-blue'
  if (status === 'completed') return 'bg-accent-green'
  if (status === 'error')     return 'bg-accent-red'
  return 'bg-border'
}

export default function PipelineView() {
  const { pipelineStages, phase } = useAudit()

  return (
    <section className="border border-border rounded bg-surface">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-4">
        <h2 className="font-medium text-[13px] text-ink">Multi-Agent Pipeline</h2>
        <div className={cn(
          'text-[11px] font-mono px-2.5 py-0.5 rounded border',
          phase === 'running'   ? 'border-accent-blue/30 text-accent-blue' :
          phase === 'completed' ? 'border-accent-green/30 text-accent-green' :
                                  'border-border text-faint'
        )}>
          {phase === 'running' ? 'EXECUTING' : phase === 'completed' ? 'SETTLED' : 'IDLE'}
        </div>
      </div>

      {/* Pipeline stages */}
      <div className="p-5">
        {/* Connector line */}
        <div className="relative">
          <div className="absolute left-0 right-0 top-[18px] h-px bg-border z-0 hidden lg:block" />
          <div className="grid gap-3 lg:grid-cols-5 relative z-10">
            {pipelineStages.map((stage, index) => (
              <motion.div
                key={stage.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.25 }}
                className={cn('rounded border p-3 transition-all duration-300', stageBg(stage.status))}
              >
                {/* Stage number + icon */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-mono text-faint">{STAGE_ICONS[stage.id] ?? `0${index+1}`}</span>
                  <StageStatusIcon status={stage.status} />
                </div>

                {/* Label */}
                <p className={cn('text-[12px] font-medium leading-tight mb-1', stage.status !== 'pending' ? 'text-ink' : 'text-muted')}>
                  {stage.label}
                </p>
                <p className="text-[11px] text-faint mb-3 leading-tight">{stage.agent}</p>

                {/* Progress bar */}
                <div className="h-0.5 w-full bg-border/60 rounded-full overflow-hidden mb-3">
                  <motion.div
                    className={cn('h-full rounded-full', progressColor(stage.status))}
                    initial={{ width: 0 }}
                    animate={{ width: `${stage.progress}%` }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                  />
                </div>

                {/* Timestamps */}
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-faint">start</span>
                    <span className={cn('text-[10px] font-mono', stageText(stage.status))}>
                      {formatClock(stage.startedAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-faint">dur</span>
                    <span className="text-[10px] font-mono text-muted">
                      {formatDuration(stage.durationMs)}
                    </span>
                  </div>
                </div>

                {stage.detail && (
                  <p className="mt-2 text-[10px] font-mono text-faint border-t border-border/50 pt-2 truncate" title={stage.detail}>
                    {stage.detail}
                  </p>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
