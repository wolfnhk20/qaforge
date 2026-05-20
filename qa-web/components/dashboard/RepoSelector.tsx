'use client'

import { useState } from 'react'
import { GitBranch, GitFork, Search } from 'lucide-react'

import { useAudit } from '@/hooks/useAudit'
import { cn } from '@/lib/utils'

// Placeholder repos — replaced by GitHub OAuth dynamic fetch in Phase 3
const MOCK_REPOS = [
  { fullName: 'openai/openai-python', branch: 'main', stars: '21k', lang: 'Python' },
  { fullName: 'vercel/next.js',        branch: 'canary', stars: '124k', lang: 'TypeScript' },
  { fullName: 'supabase/supabase',     branch: 'master', stars: '74k', lang: 'TypeScript' },
  { fullName: 'langchain-ai/langchain', branch: 'master', stars: '93k', lang: 'Python' },
]

export default function RepoSelector() {
  const { repoDraft } = useAudit()
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)

  const filtered = MOCK_REPOS.filter(r =>
    r.fullName.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <section className="border border-border rounded bg-surface">
      <div className="px-5 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitFork className="w-3.5 h-3.5 text-faint" />
          <h2 className="font-medium text-[13px] text-ink">Repository</h2>
        </div>
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="text-[11px] text-accent-blue hover:text-ink transition-colors font-mono"
        >
          {open ? 'collapse' : 'browse'}
        </button>
      </div>

      {/* Current selection */}
      <div className="px-5 py-3 flex items-center gap-3 border-b border-border">
        <div className="w-7 h-7 rounded bg-s3 border border-border flex items-center justify-center flex-shrink-0">
          <GitBranch className="w-3.5 h-3.5 text-muted" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-ink truncate">{repoDraft.fullName}</p>
          <p className="text-[11px] font-mono text-faint mt-0.5">{repoDraft.branch} · {repoDraft.module} · {repoDraft.scope}</p>
        </div>
        <div className="flex-shrink-0 w-2 h-2 rounded-full bg-accent-green" />
      </div>

      {/* Expandable browser */}
      {open && (
        <div className="border-b border-border">
          <div className="px-4 py-2.5 border-b border-border">
            <div className="flex items-center gap-2 bg-s2 rounded border border-border px-2.5 py-1.5">
              <Search className="w-3 h-3 text-faint flex-shrink-0" />
              <input
                type="text"
                placeholder="Filter repositories…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-transparent text-[12px] text-ink placeholder:text-faint outline-none w-full"
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.map(repo => (
              <button
                key={repo.fullName}
                type="button"
                className={cn(
                  'w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-s2 transition-colors border-b border-border/30',
                  repoDraft.fullName === repo.fullName && 'bg-accent-blue/5'
                )}
              >
                <div>
                  <p className="text-[12px] text-ink font-mono">{repo.fullName}</p>
                  <p className="text-[11px] text-faint mt-0.5">{repo.branch} · {repo.lang}</p>
                </div>
                <span className="text-[11px] text-faint font-mono">★ {repo.stars}</span>
              </button>
            ))}
          </div>
          <div className="px-4 py-2.5">
            <p className="text-[11px] text-faint font-mono">
              Connect GitHub OAuth in Settings → to load your real repositories
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
