'use client'

import { createElement, useEffect, useMemo, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { FileText } from 'lucide-react'

import { useAudit } from '@/hooks/useAudit'
import {
  extractMarkdownHeadings,
  simpleHighlightCode,
  slugify,
} from '@/lib/utils'

function createHeading(level: 'h1' | 'h2' | 'h3') {
  return function HeadingRenderer({
    children,
  }: {
    children?: React.ReactNode
  }) {
    const text = Array.isArray(children)
      ? children.map((child) => (typeof child === 'string' ? child : '')).join('')
      : typeof children === 'string'
        ? children
        : ''
    const id = slugify(text || `${level}-section`)

    return createElement(
      level,
      {
        id,
        className: 'scroll-mt-28',
      },
      children,
    )
  }
}

export default function ReportViewer({
  compact = false,
  fullHeight = false,
}: {
  compact?: boolean
  fullHeight?: boolean
}) {
  const { reportMarkdown, selectedFinding, latestAudit } = useAudit()
  const containerRef = useRef<HTMLDivElement | null>(null)

  const headings = useMemo(
    () => extractMarkdownHeadings(reportMarkdown),
    [reportMarkdown],
  )

  useEffect(() => {
    const handleJump = (event: Event) => {
      const detail = (event as CustomEvent<{ hints?: string[] }>).detail
      const hints = detail?.hints || []
      const container = containerRef.current

      if (!container) {
        return
      }

      const elements = Array.from(container.querySelectorAll<HTMLElement>('h1, h2, h3'))
      const target = elements.find((element) =>
        hints.some((hint) => element.textContent?.toLowerCase().includes(hint)),
      )

      target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    window.addEventListener('qaforge-report-jump', handleJump)
    return () => window.removeEventListener('qaforge-report-jump', handleJump)
  }, [])

  if (!reportMarkdown.trim()) {
    return (
      <section className="flex min-h-[420px] items-center justify-center rounded-[28px] border border-dashed border-white/10 bg-slate-950/70 p-6 text-center shadow-panel">
        <div>
          <FileText className="mx-auto h-8 w-8 text-sky-200" />
          <h2 className="mt-4 text-xl font-semibold text-white">No report loaded</h2>
          <p className="mt-2 max-w-md text-sm leading-7 text-muted">
            Trigger an audit or sync the latest backend snapshot to render the markdown report.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-[28px] border border-white/8 bg-slate-950/75 p-6 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-faint">Report intelligence</p>
          <h2 className="mt-3 text-2xl font-semibold text-white">
            Markdown audit narrative
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-muted">
            Canonical engineering output returned from the backend. Use the table of contents
            or findings jump links to move through the report quickly.
          </p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-muted">
          {latestAudit?.repo || 'No repository context'}
        </div>
      </div>

      {selectedFinding ? (
        <div className="mt-6 rounded-3xl border border-sky-500/20 bg-sky-500/10 p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-sky-100/80">
            Selected finding
          </p>
          <p className="mt-2 text-sm font-medium text-white">
            {selectedFinding.classification} · {selectedFinding.endpoint}
          </p>
          <p className="mt-2 text-sm leading-7 text-sky-50/85">{selectedFinding.reasoning}</p>
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-[250px_minmax(0,1fr)]">
        <aside className={compact ? 'xl:order-2' : ''}>
          <div className="sticky top-24 rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-faint">Contents</p>
            <div className="mt-4 space-y-2">
              {headings.map((heading) => (
                <button
                  key={heading.id}
                  type="button"
                  onClick={() =>
                    document
                      .getElementById(heading.id)
                      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }
                  className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/[0.05]"
                  style={{ paddingLeft: `${heading.level * 0.6}rem` }}
                >
                  {heading.title}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div
          ref={containerRef}
          className={fullHeight ? 'max-h-[calc(100vh-220px)] overflow-y-auto pr-2' : 'pr-2'}
        >
          <div className="report-prose rounded-[24px] border border-white/8 bg-white/[0.02] p-6">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: createHeading('h1'),
                h2: createHeading('h2'),
                h3: createHeading('h3'),
                pre: ({ children }) => <>{children}</>,
                a: ({ href, children }) => (
                  <a
                    href={href}
                    className="text-sky-200 underline decoration-sky-400/40 underline-offset-4"
                    target={href?.startsWith('http') ? '_blank' : undefined}
                    rel={href?.startsWith('http') ? 'noreferrer' : undefined}
                  >
                    {children}
                  </a>
                ),
                code({ className, children, ...props }) {
                  const language = className?.replace('language-', '')
                  const value = String(children).replace(/\n$/, '')

                  if (!className) {
                    return <code {...props}>{children}</code>
                  }

                  return (
                    <span className="block overflow-hidden rounded-xl border border-white/8 bg-[#06101d]">
                      <span className="flex items-center justify-between border-b border-white/8 bg-white/[0.03] px-3 py-2 font-mono text-[11px] uppercase tracking-[0.24em] text-faint">
                        <span>{language || 'code'}</span>
                        <span>snippet</span>
                      </span>
                      <pre className="m-0 overflow-x-auto p-0">
                        <code
                          {...props}
                          className="block p-4"
                          dangerouslySetInnerHTML={{
                            __html: simpleHighlightCode(value, language),
                          }}
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
