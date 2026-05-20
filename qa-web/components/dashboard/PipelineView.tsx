'use client'

import { useEffect, useState } from 'react'
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
  if (status === 'running') {
    return (
      <div className="relative flex items-center justify-center">
        <span className="absolute w-4 h-4 rounded-full bg-accent-blue/20 animate-ping" />
        <Loader2 className="w-3.5 h-3.5 animate-spin text-accent-blue relative z-10" />
      </div>
    )
  }
  if (status === 'completed') return <CheckCircle2 className="w-3.5 h-3.5 text-accent-green drop-shadow-[0_0_4px_rgba(46,200,154,0.4)]" />
  if (status === 'error')     return <XCircle className="w-3.5 h-3.5 text-accent-red drop-shadow-[0_0_4px_rgba(245,101,101,0.4)]" />
  return <Circle className="w-3.5 h-3.5 text-faint" />
}

function stageBg(status: PipelineStageStatus) {
  if (status === 'running')   return 'border-accent-blue/40 bg-[#0F1C33] shadow-[0_0_20px_rgba(78,161,255,0.12)] stage-running'
  if (status === 'completed') return 'border-accent-green/30 bg-[#0E211F] shadow-[0_0_15px_rgba(46,200,154,0.03)]'
  if (status === 'error')     return 'border-accent-red/35 bg-[#1F121C] shadow-[0_0_15px_rgba(245,101,101,0.04)]'
  return 'border-border/50 bg-surface/40 opacity-50 hover:opacity-85 hover:border-border transition-all duration-300'
}

function stageText(status: PipelineStageStatus) {
  if (status === 'running')   return 'text-accent-blue font-medium'
  if (status === 'completed') return 'text-accent-green'
  if (status === 'error')     return 'text-accent-red'
  return 'text-faint'
}

function progressColor(status: PipelineStageStatus) {
  if (status === 'running')   return 'animate-bar-shimmer'
  if (status === 'completed') return 'bg-accent-green shadow-[0_0_8px_rgba(46,200,154,0.5)]'
  if (status === 'error')     return 'bg-accent-red shadow-[0_0_8px_rgba(245,101,101,0.5)]'
  return 'bg-border'
}

export default function PipelineView() {
  const { pipelineStages, phase } = useAudit()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <section className="border border-border rounded bg-surface">
      {/* Header */}
      <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-border flex items-center justify-between gap-3">
        <h2 className="font-medium text-[13px] text-ink">Multi-Agent Pipeline</h2>
        <div className={cn(
          'text-[11px] font-mono px-2.5 py-0.5 rounded border flex-shrink-0',
          phase === 'running'   ? 'border-accent-blue/30 text-accent-blue' :
          phase === 'completed' ? 'border-accent-green/30 text-accent-green' :
                                  'border-border text-faint'
        )}>
          {phase === 'running' ? 'EXECUTING' : phase === 'completed' ? 'SETTLED' : 'IDLE'}
        </div>
      </div>

      {/* Pipeline stages */}
      <div className="p-4 sm:p-5">
        <div className="relative">
          {/* Horizontal connector line background — only on lg 5-col layout */}
          <div className="absolute left-[10%] right-[10%] top-[24px] h-[2px] bg-border/20 z-0 hidden lg:block" />

          {/* Dynamic horizontal connector segments — only on lg 5-col layout */}
          {Array.from({ length: 4 }).map((_, i) => {
            const leftStage = pipelineStages[i]
            const isCompleted = leftStage?.status === 'completed'
            const isRunning = leftStage?.status === 'running'

            return (
              <div
                key={i}
                className="absolute top-[24px] h-[2px] z-0 hidden lg:block transition-all duration-500 overflow-hidden"
                style={{
                  left: `${i * 20 + 10}%`,
                  width: '20%',
                }}
              >
                <div
                  className={cn(
                    "h-full w-full transition-all duration-500",
                    isCompleted ? "bg-accent-green" :
                    isRunning ? "bg-gradient-to-r from-accent-blue via-accent-blue/30 to-border/40 animate-flow-line" :
                    "bg-transparent"
                  )}
                />
              </div>
            )
          })}

          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 relative z-10">
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

                {/* Progress bar and percentage */}
                <div className="flex items-center justify-between mb-1.5 text-[10px] font-mono">
                  <span className="text-faint">progress</span>
                  <span className={cn(stageText(stage.status))}>{stage.progress}%</span>
                </div>
                <div className="h-1.5 w-full bg-border/40 rounded-full overflow-hidden mb-3">
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
                      {mounted ? formatClock(stage.startedAt) : '--:--:--'}
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
