'use client'

import { motion } from 'framer-motion'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'

import { useAudit } from '@/hooks/useAudit'
import { formatClock, formatDuration, getStageTone } from '@/lib/utils'

export default function PipelineView() {
  const { pipelineStages, phase } = useAudit()

  return (
    <section className="rounded-[28px] border border-white/8 bg-slate-950/75 p-6 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-faint">Pipeline</p>
          <h2 className="mt-3 text-2xl font-semibold text-white">
            Multi-agent execution pipeline
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-muted">
            The frontend stages animate regardless of backend streaming support, then reconcile
            against the final FastAPI response when the run completes.
          </p>
        </div>
        <div className="rounded-full border border-white/8 bg-white/[0.03] px-4 py-2 text-xs uppercase tracking-[0.24em] text-slate-200">
          {phase === 'running'
            ? 'Execution live'
            : phase === 'completed'
              ? 'Execution settled'
              : 'Awaiting run'}
        </div>
      </div>

      <div className="mt-8 grid gap-4 xl:grid-cols-5">
        {pipelineStages.map((stage, index) => (
          <motion.article
            key={stage.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06 }}
            className={`rounded-3xl border p-4 ${getStageTone(stage.status)}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] opacity-70">
                  {stage.agent}
                </p>
                <h3 className="mt-2 text-base font-semibold">{stage.label}</h3>
              </div>
              {stage.status === 'running' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : stage.status === 'completed' ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : stage.status === 'error' ? (
                <XCircle className="h-4 w-4" />
              ) : (
                <div className="mt-1 h-2.5 w-2.5 rounded-full bg-white/25" />
              )}
            </div>

            <p className="mt-4 text-sm leading-6 opacity-80">{stage.description}</p>

            <div className="mt-5 h-2 overflow-hidden rounded-full bg-black/25">
              <motion.div
                className="h-full rounded-full bg-current"
                initial={{ width: 0 }}
                animate={{ width: `${stage.progress}%` }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
              />
            </div>

            <div className="mt-4 space-y-1 text-xs opacity-75">
              <p>Started: {formatClock(stage.startedAt)}</p>
              <p>Completed: {formatClock(stage.completedAt)}</p>
              <p>Duration: {formatDuration(stage.durationMs)}</p>
            </div>

            {stage.detail ? (
              <div className="mt-4 rounded-2xl border border-white/8 bg-black/15 px-3 py-3 text-xs leading-6 opacity-90">
                {stage.detail}
              </div>
            ) : null}
          </motion.article>
        ))}
      </div>
    </section>
  )
}
