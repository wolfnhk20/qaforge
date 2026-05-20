'use client'

import { createElement, useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { BookOpen, Check, Copy, FileText } from 'lucide-react'

import { useAudit } from '@/hooks/useAudit'
import { cn } from '@/lib/utils'
import { extractMarkdownHeadings, simpleHighlightCode, slugify } from '@/lib/utils'

function createHeading(level: 'h1' | 'h2' | 'h3') {
  return function HeadingRenderer({ children }: { children?: React.ReactNode }) {
    const text = Array.isArray(children)
      ? children.map(c => (typeof c === 'string' ? c : '')).join('')
      : typeof children === 'string' ? children : ''
    const id = slugify(text || `${level}-section`)
    return createElement(level, { id, className: 'scroll-mt-6' }, children)
  }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="p-1.5 text-faint hover:text-muted transition-colors rounded"
      title="Copy"
    >
      {copied
        ? <Check className="w-3 h-3 text-accent-green" />
        : <Copy className="w-3 h-3" />}
    </button>
  )
}

export default function ReportViewer({ compact = false }: {
  compact?: boolean
  /** @deprecated — no longer used; report grows naturally in page flow */
  fullHeight?: boolean
}) {
  const { reportMarkdown, selectedFinding, latestAudit } = useAudit()
  const contentRef = useRef<HTMLDivElement | null>(null)
  const [activeHeading, setActiveHeading] = useState<string>('')
  const [tocOpen, setTocOpen] = useState(false)

  const headings = useMemo(() => extractMarkdownHeadings(reportMarkdown), [reportMarkdown])

  // Jump-to-section from findings table
  useEffect(() => {
    const handleJump = (event: Event) => {
      const detail = (event as CustomEvent<{ hints?: string[] }>).detail
      const hints = detail?.hints || []
      const container = contentRef.current
      if (!container) return
      const elements = Array.from(container.querySelectorAll<HTMLElement>('h1, h2, h3'))
      const target = elements.find(el =>
        hints.some(hint => el.textContent?.toLowerCase().includes(hint))
      )
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    window.addEventListener('qaforge-report-jump', handleJump)
    return () => window.removeEventListener('qaforge-report-jump', handleJump)
  }, [])

  // Active heading tracker
  useEffect(() => {
    const container = contentRef.current
    if (!container || headings.length === 0) return
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) setActiveHeading(entry.target.id)
        })
      },
      { rootMargin: '-10% 0px -80% 0px' }
    )
    headings.forEach(h => {
      const el = document.getElementById(h.id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [headings])

  if (!reportMarkdown.trim()) {
    return (
      <section className="border border-dashed border-border rounded flex items-center justify-center py-16 sm:py-20 text-center">
        <div>
          <FileText className="w-8 h-8 text-faint mx-auto mb-3" />
          <p className="text-[13px] text-muted">No report loaded</p>
          <p className="text-[12px] text-faint mt-1">Trigger an audit to render the markdown report</p>
        </div>
      </section>
    )
  }

  return (
    <section className="border border-border rounded bg-surface">
      {/* ── Header ── */}
      <div className="px-4 sm:px-5 py-3 border-b border-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <BookOpen className="w-3.5 h-3.5 text-faint flex-shrink-0" />
          <h2 className="font-medium text-[13px] text-ink">Audit Report</h2>
          {latestAudit?.repo && (
            <span className="text-[11px] font-mono text-faint hidden sm:block truncate max-w-[180px] ml-1">
              · {latestAudit.repo}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* TOC toggle — visible below xl */}
          {headings.length > 0 && (
            <button
              type="button"
              onClick={() => setTocOpen(v => !v)}
              className={cn(
                'xl:hidden text-[11px] font-mono transition-colors px-2 py-1 rounded border hover:bg-s2',
                tocOpen
                  ? 'border-accent-blue/40 text-accent-blue bg-accent-blue/8'
                  : 'border-border text-faint hover:text-muted'
              )}
            >
              TOC
            </button>
          )}
          <CopyButton text={reportMarkdown} />
        </div>
      </div>

      {/* ── Mobile/tablet TOC drawer ── */}
      {tocOpen && headings.length > 0 && (
        <div className="xl:hidden border-b border-border bg-s2 px-4 py-3">
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {headings.map(h => (
              <button
                key={h.id}
                type="button"
                onClick={() => {
                  document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  setTocOpen(false)
                }}
                className={cn(
                  'text-[11px] transition-colors leading-tight',
                  h.level > 1 && 'pl-3',
                  activeHeading === h.id ? 'text-accent-blue' : 'text-faint hover:text-muted'
                )}
              >
                {h.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Selected finding callout ── */}
      {selectedFinding && (
        <div className="mx-4 sm:mx-5 mt-4 rounded border border-accent-blue/20 bg-accent-blue/5 px-3 sm:px-4 py-3">
          <p className="text-[11px] font-mono text-faint uppercase tracking-widest mb-1">Selected Finding</p>
          <p className="text-[12px] font-medium text-ink">
            {selectedFinding.classification} · {selectedFinding.endpoint}
          </p>
          <p className="text-[12px] text-muted mt-1 leading-relaxed">{selectedFinding.reasoning}</p>
        </div>
      )}

      {/* ── Body: sticky TOC (xl+) + markdown content ── */}
      <div className="flex min-w-0">

        {/* Sticky TOC sidebar — xl+ only */}
        {headings.length > 0 && (
          <aside className="hidden xl:flex flex-col w-[190px] flex-shrink-0 border-r border-border">
            <div className="sticky top-0 p-4 overflow-y-auto max-h-[80vh]">
              <p className="text-[10px] font-mono text-faint uppercase tracking-widest mb-3">Contents</p>
              <nav className="space-y-0.5">
                {headings.map(h => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() =>
                      document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }
                    className={cn(
                      'block w-full text-left py-1 rounded text-[11px] transition-colors leading-snug',
                      activeHeading === h.id
                        ? 'text-accent-blue bg-accent-blue/8 px-2'
                        : 'text-faint hover:text-muted px-2',
                    )}
                    style={{ paddingLeft: `${(h.level - 1) * 10 + 8}px` }}
                  >
                    {h.title}
                  </button>
                ))}
              </nav>
            </div>
          </aside>
        )}

        {/* Markdown content */}
        <div
          ref={contentRef}
          className="flex-1 min-w-0 p-4 sm:p-6 overflow-x-hidden"
        >
          <div className="report-prose max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: createHeading('h1'),
                h2: createHeading('h2'),
                h3: createHeading('h3'),
                // Prevent double <pre> nesting
                pre: ({ children }) => <>{children}</>,
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target={href?.startsWith('http') ? '_blank' : undefined}
                    rel={href?.startsWith('http') ? 'noreferrer' : undefined}
                  >
                    {children}
                  </a>
                ),
                code({ className, children, ...props }) {
                  const language = className?.replace('language-', '')
                  const value = String(children).replace(/\n$/, '')
                  if (!className) return <code {...props}>{children}</code>
                  return (
                    <span className="block overflow-hidden rounded border border-border bg-[#050a12] my-3">
                      <span className="flex items-center justify-between border-b border-border bg-s2 px-3 py-1.5">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-faint">
                          {language || 'code'}
                        </span>
                        <CopyButton text={value} />
                      </span>
                      <pre className="m-0 overflow-x-auto p-0">
                        <code
                          {...props}
                          className="block p-3 sm:p-4 font-mono text-[11px]"
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
        </div>
      </div>
    </section>
  )
}
