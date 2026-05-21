'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield, BookOpen, Terminal, GitBranch,
  Loader2, AlertTriangle, FileText, ChevronDown, ChevronRight, X,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { useAuditDetail } from '@/hooks/useAuditHistory'
import { cn, formatShortDate, getPriorityTone, summarizeFindings, simpleHighlightCode, formatClock } from '@/lib/utils'
import { AuditStatusBadge } from './AuditStatusBadge'
import { AuditOriginBadge } from './AuditOriginBadge'
import type { AuditHistoryRecord, Findings } from '@/types'

type Tab = 'overview' | 'findings' | 'logs' | 'report'

function FindingRow({ finding }: { finding: Findings }) {
  const [open, setOpen] = useState(false)
  const tone = getPriorityTone(finding.priority)

  return (
    <div
      className={cn(
        'border border-border rounded mb-2 overflow-hidden cursor-pointer hover:border-border/80 transition-colors',
        open && 'border-border/60'
      )}
      onClick={() => setOpen(v => !v)}
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        <button type="button" className="text-faint flex-shrink-0">
          {open
            ? <ChevronDown className="w-3.5 h-3.5" />
            : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
        <span className={cn('inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider flex-shrink-0', tone)}>
          {finding.priority}
        </span>
        <span className="font-mono text-[12px] text-accent-blue flex-1 truncate">{finding.endpoint}</span>
        <span className="text-[10px] font-mono text-faint hidden sm:block flex-shrink-0">{finding.classification}</span>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 border-t border-border space-y-2">
              <p className="text-[12px] text-muted leading-relaxed break-words">{finding.reasoning}</p>
              {finding.suggested_fix && (
                <div className="bg-accent-green/5 border border-accent-green/15 rounded px-3 py-2">
                  <p className="text-[10px] font-mono text-accent-green mb-1">▸ SUGGESTED FIX</p>
                  <p className="text-[12px] text-muted leading-relaxed break-words">{finding.suggested_fix}</p>
                </div>
              )}
              <p className="text-[10px] font-mono text-faint">{finding.probe_id} · {finding.case_id}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

interface AuditDetailPanelProps {
  record: AuditHistoryRecord
  onClose: () => void
}

export function AuditDetailPanel({ record, onClose }: AuditDetailPanelProps) {
  const [tab, setTab] = useState<Tab>('overview')
  const { audit, logs, isLoadingAudit, isLoadingLogs } = useAuditDetail(record.id)

  const findings = audit?.findings ?? record.findings ?? []
  const reportMarkdown = audit?.report_markdown ?? record.report_markdown ?? ''
  const summary = summarizeFindings(findings)

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview',  label: 'Overview',  icon: <GitBranch className="w-3 h-3" /> },
    { id: 'findings',  label: `Findings (${findings.length})`, icon: <Shield className="w-3 h-3" /> },
    { id: 'logs',      label: 'Logs',      icon: <Terminal className="w-3 h-3" /> },
    { id: 'report',    label: 'Report',    icon: <BookOpen className="w-3 h-3" /> },
  ]

  return (
    <motion.section
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      className="border border-border rounded bg-surface flex flex-col min-h-0"
    >
      {/* Header */}
      <div className="px-4 sm:px-5 py-3 border-b border-border flex items-start justify-between gap-3 flex-shrink-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <AuditStatusBadge status={record.status} />
            <AuditOriginBadge origin={record.origin} />
          </div>
          <p className="font-mono text-[13px] text-ink mt-1.5 truncate">{record.repo}</p>
          <p className="text-[10px] font-mono text-faint mt-0.5">
            #{record.id} · {record.module} · {formatShortDate(record.created_at)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 text-faint hover:text-muted transition-colors rounded hover:bg-s2 flex-shrink-0 mt-0.5"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-border px-3 flex-shrink-0 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-mono border-b-2 transition-colors whitespace-nowrap flex-shrink-0',
              tab === t.id
                ? 'border-accent-blue text-accent-blue'
                : 'border-transparent text-faint hover:text-muted'
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">

        {/* ── Overview ── */}
        {tab === 'overview' && (
          <div className="p-4 sm:p-5 space-y-4">
            {/* Metric cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: 'Probes',  value: String(record.probe_count ?? 0),  color: 'text-accent-blue' },
                { label: 'High',    value: String(summary.high),              color: summary.high > 0 ? 'text-accent-red' : 'text-muted' },
                { label: 'Medium',  value: String(summary.medium),            color: summary.medium > 0 ? 'text-accent-amber' : 'text-muted' },
                { label: 'Low',     value: String(summary.low),               color: 'text-muted' },
              ].map(m => (
                <div key={m.label} className="bg-s2 border border-border rounded p-3 text-center">
                  <p className="text-[10px] font-mono text-faint uppercase tracking-widest mb-1">{m.label}</p>
                  <p className={cn('text-xl font-semibold font-mono tabular-nums', m.color)}>{m.value}</p>
                </div>
              ))}
            </div>

            {/* Metadata */}
            <div className="bg-s2 border border-border rounded px-4 py-3 space-y-2">
              {[
                ['Audit ID',    `#${record.id}`],
                ['Repository',  record.repo],
                ['Module',      record.module],
                ['Status',      record.status],
                ['Trigger',     record.origin === 'github_push' ? 'GitHub Webhook' : 'Manual'],
                ['Timestamp',   formatShortDate(record.created_at)],
              ].map(([k, v]) => (
                <div key={k} className="flex items-start justify-between gap-4 text-[12px]">
                  <span className="text-faint font-mono flex-shrink-0">{k}</span>
                  <span className="text-muted font-mono text-right break-all">{v}</span>
                </div>
              ))}
            </div>

            {/* Partial / error states */}
            {record.status === 'error' && (
              <div className="flex items-start gap-2.5 bg-accent-red/5 border border-accent-red/20 rounded px-3 py-3">
                <AlertTriangle className="w-3.5 h-3.5 text-accent-red flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[12px] text-accent-red font-medium">Audit failed</p>
                  <p className="text-[11px] text-muted mt-0.5">The pipeline encountered an error. Check the Logs tab for details.</p>
                </div>
              </div>
            )}
            {record.status === 'running' && (
              <div className="flex items-center gap-2.5 bg-accent-blue/5 border border-accent-blue/15 rounded px-3 py-3">
                <Loader2 className="w-3.5 h-3.5 text-accent-blue animate-spin flex-shrink-0" />
                <p className="text-[12px] text-accent-blue">Audit is currently executing…</p>
              </div>
            )}
          </div>
        )}

        {/* ── Findings ── */}
        {tab === 'findings' && (
          <div className="p-4 sm:p-5">
            {isLoadingAudit ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-4 h-4 text-faint animate-spin" />
              </div>
            ) : findings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Shield className="w-7 h-7 text-faint mb-3" />
                <p className="text-[13px] text-muted">
                  {record.status === 'completed' ? 'No findings — all probes passed' : 'No findings available'}
                </p>
                <p className="text-[11px] text-faint mt-1">
                  {record.status === 'error' ? 'The audit did not complete successfully' : ''}
                </p>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  {summary.high > 0 && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-accent-red/25 text-accent-red">
                      {summary.high} HIGH
                    </span>
                  )}
                  {summary.medium > 0 && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-accent-amber/25 text-accent-amber">
                      {summary.medium} MEDIUM
                    </span>
                  )}
                  {summary.low > 0 && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-accent-green/25 text-accent-green">
                      {summary.low} LOW
                    </span>
                  )}
                </div>
                {findings.map((f, i) => (
                  <FindingRow key={f.case_id ?? i} finding={f} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Logs ── */}
        {tab === 'logs' && (
          <div className="p-4 sm:p-5">
            {isLoadingLogs ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-4 h-4 text-faint animate-spin" />
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Terminal className="w-7 h-7 text-faint mb-3" />
                <p className="text-[13px] text-muted">No logs recorded</p>
                <p className="text-[11px] text-faint mt-1">Logs are only persisted when Supabase is configured</p>
              </div>
            ) : (
              <div className="bg-[#050a12] border border-border rounded overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 bg-s2 border-b border-border">
                  <div className="flex gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
                  </div>
                  <span className="text-[10px] font-mono text-faint ml-2 uppercase tracking-widest">
                    AUDIT #{record.id} · EXECUTION LOG
                  </span>
                </div>
                <div className="p-3 font-mono text-[11px] leading-[1.8] max-h-[420px] overflow-y-auto">
                  {logs.map((log) => {
                    const levelColor =
                      log.level === 'success' ? 'text-accent-green' :
                      log.level === 'error'   ? 'text-accent-red' :
                      log.level === 'warning' ? 'text-accent-amber' :
                                                'text-accent-blue'
                    const prefix =
                      log.level === 'success' ? '✓' :
                      log.level === 'error'   ? '✕' :
                      log.level === 'warning' ? '!' : '›'
                    return (
                      <div key={log.id} className="flex gap-2">
                        <span className="text-faint flex-shrink-0 hidden sm:block">{formatClock(log.timestamp)}</span>
                        <span className={cn('flex-shrink-0', levelColor)}>{prefix}</span>
                        <span className="text-muted flex-shrink-0">[{log.source}]</span>
                        <span className="text-ink/90 break-words flex-1">{log.message}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Report ── */}
        {tab === 'report' && (
          <div className="p-4 sm:p-5">
            {isLoadingAudit ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-4 h-4 text-faint animate-spin" />
              </div>
            ) : !reportMarkdown.trim() ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FileText className="w-7 h-7 text-faint mb-3" />
                <p className="text-[13px] text-muted">
                  {record.status === 'error' ? 'No report — audit failed' : 'Report not available'}
                </p>
                <p className="text-[11px] text-faint mt-1">
                  {record.status === 'running' ? 'Report will appear when the audit completes' : ''}
                </p>
              </div>
            ) : (
              <div className="report-prose max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    pre: ({ children }) => <>{children}</>,
                    code({ className, children, ...props }) {
                      const language = className?.replace('language-', '')
                      const value = String(children).replace(/\n$/, '')
                      if (!className) return <code {...props}>{children}</code>
                      return (
                        <span className="block overflow-hidden rounded border border-border bg-[#050a12] my-3">
                          <span className="flex items-center border-b border-border bg-s2 px-3 py-1.5">
                            <span className="font-mono text-[10px] uppercase tracking-widest text-faint">
                              {language || 'code'}
                            </span>
                          </span>
                          <pre className="m-0 overflow-x-auto p-0">
                            <code
                              {...props}
                              className="block p-3 font-mono text-[11px]"
                              dangerouslySetInnerHTML={{ __html: simpleHighlightCode(value, language) }}
                            />
                          </pre>
                        </span>
                      )
                    },
                  }}
                >
                  {reportMarkdown}
                </ReactMarkdown>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.section>
  )
}
