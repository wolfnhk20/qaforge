import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

import type {
  Findings,
  MarkdownHeading,
  PipelineStage,
  PipelineStageStatus,
  Repo,
} from '@/types'

export const APP_NAME = 'QAForge'

export const DEFAULT_REPO: Repo = {
  fullName: '',
  module: '.',
  branch: 'main',
  scope: 'full_module',
}

export const PIPELINE_BLUEPRINT = [
  {
    id: 'intent',
    label: 'Intent Extraction',
    agent: 'Intent Extractor',
    description: 'Reconstructing expected behavior from repository signals.',
    durationMs: 1800,
  },
  {
    id: 'analysis',
    label: 'Code Analysis',
    agent: 'Code Analyst',
    description: 'Mapping handlers, routes, and implementation surfaces.',
    durationMs: 2100,
  },
  {
    id: 'design',
    label: 'Probe Design',
    agent: 'Probe Designer',
    description: 'Generating adversarial cases from contract and code.',
    durationMs: 1700,
  },
  {
    id: 'execution',
    label: 'Probe Execution',
    agent: 'Probe Executor',
    description: 'Executing runtime pressure and collecting behavioral gaps.',
    durationMs: 2600,
  },
  {
    id: 'report',
    label: 'Report Synthesis',
    agent: 'Report Synthesizer',
    description: 'Turning artifacts into a decision-ready engineering narrative.',
    durationMs: 1400,
  },
] as const

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function createPipelineStages(): PipelineStage[] {
  return PIPELINE_BLUEPRINT.map((stage) => ({
    id: stage.id,
    label: stage.label,
    agent: stage.agent,
    description: stage.description,
    status: 'pending',
    progress: 0,
  }))
}

export function formatClock(value?: string) {
  if (!value) {
    return '--:--:--'
  }

  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value))
}

export function formatShortDate(value?: string) {
  if (!value) {
    return 'No timestamp'
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function formatDuration(durationMs?: number) {
  if (!durationMs || Number.isNaN(durationMs)) {
    return '--'
  }

  if (durationMs < 1000) {
    return `${durationMs}ms`
  }

  return `${(durationMs / 1000).toFixed(durationMs >= 10000 ? 0 : 1)}s`
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
}

export function extractMarkdownHeadings(markdown: string): MarkdownHeading[] {
  const lines = markdown.split('\n')
  const headings: MarkdownHeading[] = []

  for (const line of lines) {
    const match = /^(#{1,3})\s+(.+)$/.exec(line.trim())
    if (!match) {
      continue
    }

    headings.push({
      id: slugify(match[2]),
      level: match[1].length,
      title: match[2].trim(),
    })
  }

  return headings
}

export function getPriorityTone(priority: string) {
  const normalized = priority.toLowerCase()

  if (normalized.includes('high') || normalized.includes('critical')) {
    return 'text-rose-300 border-rose-500/30 bg-rose-500/10'
  }

  if (normalized.includes('medium') || normalized.includes('amber')) {
    return 'text-amber-200 border-amber-500/30 bg-amber-500/10'
  }

  if (normalized.includes('low') || normalized.includes('info')) {
    return 'text-emerald-200 border-emerald-500/30 bg-emerald-500/10'
  }

  return 'text-slate-300 border-slate-500/30 bg-slate-500/10'
}

export function getStageTone(status: PipelineStageStatus) {
  switch (status) {
    case 'completed':
      return 'border-emerald-500/30 bg-emerald-500/8 text-emerald-100'
    case 'running':
      return 'border-sky-500/30 bg-sky-500/8 text-sky-100'
    case 'error':
      return 'border-rose-500/30 bg-rose-500/8 text-rose-100'
    case 'pending':
      return 'border-slate-700 bg-slate-900/70 text-slate-300'
    default:
      return 'border-slate-800 bg-slate-950/70 text-slate-400'
  }
}

export function getHealthTone(status: string) {
  if (status === 'ok') {
    return 'text-emerald-300'
  }

  if (status === 'degraded') {
    return 'text-amber-200'
  }

  return 'text-rose-300'
}

export function summarizeFindings(findings: Findings[]) {
  return findings.reduce(
    (summary, finding) => {
      const priority = finding.priority.toLowerCase()

      if (priority.includes('high') || priority.includes('critical')) {
        summary.high += 1
      } else if (priority.includes('medium')) {
        summary.medium += 1
      } else {
        summary.low += 1
      }

      return summary
    },
    { high: 0, medium: 0, low: 0 },
  )
}

export function buildFindingJumpHints(finding: Findings) {
  const hints = ['executive summary', 'next steps', 'functional gaps']

  if (finding.classification) {
    hints.unshift(finding.classification.replace(/_/g, ' ').toLowerCase())
  }

  if (finding.classification.toLowerCase().includes('validation')) {
    hints.unshift('missing validations')
  }

  if (finding.endpoint) {
    hints.unshift(finding.endpoint.toLowerCase())
  }

  return hints
}

export function formatRelativeTime(value?: string): string {
  if (!value) return '—'
  const diff = Date.now() - new Date(value).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(value))
}

export function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

export function simpleHighlightCode(value: string, language?: string) {
  let html = escapeHtml(value)
  const lang = (language || '').toLowerCase()

  const replacements: Array<[RegExp, string]> = [
    [
      /\b(const|let|var|function|return|if|else|await|async|class|from|import|export|new|try|catch|throw|for|while|interface|type)\b/g,
      '<span class="token token-keyword">$1</span>',
    ],
    [/\b(true|false|null|undefined)\b/g, '<span class="token token-atom">$1</span>'],
    [/(\".*?\"|'.*?'|`.*?`)/g, '<span class="token token-string">$1</span>'],
    [/\b(\d+)\b/g, '<span class="token token-number">$1</span>'],
  ]

  if (lang === 'json') {
    replacements.unshift([
      /(".*?")(?=\s*:)/g,
      '<span class="token token-property">$1</span>',
    ])
  }

  for (const [pattern, replacement] of replacements) {
    html = html.replace(pattern, replacement)
  }

  return html
}
