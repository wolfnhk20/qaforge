'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, GitBranch, GitFork, Loader2, RefreshCw, Search } from 'lucide-react'

import { useAuth } from '@/lib/auth'
import { useAudit } from '@/hooks/useAudit'
import { cn } from '@/lib/utils'
import { getWebhookConfig, toggleWebhook } from '@/services/api'
import type { WebhookConfig } from '@/types'

interface GithubRepo {
  id: number
  name: string
  full_name: string
  private: boolean
  description: string | null
  updated_at: string
  default_branch: string
}

export default function RepoSelector() {
  const { session, signInWithGitHub } = useAuth()
  const { repoDraft, setRepoDraft } = useAudit()
  
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [repos, setRepos] = useState<GithubRepo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const [webhookConfig, setWebhookConfig] = useState<WebhookConfig | null>(null)
  const [fetchingWebhook, setFetchingWebhook] = useState(false)
  const [togglingWebhook, setTogglingWebhook] = useState(false)
  const [webhookError, setWebhookError] = useState<string | null>(null)

  const providerToken = session?.provider_token

  useEffect(() => {
    if (!repoDraft.fullName) {
      setWebhookConfig(null)
      return
    }

    const loadWebhookConfig = async () => {
      setFetchingWebhook(true)
      setWebhookError(null)
      try {
        const [owner, name] = repoDraft.fullName.split('/')
        if (owner && name) {
          const config = await getWebhookConfig(owner, name)
          setWebhookConfig(config)
        }
      } catch (err: any) {
        console.error('Failed to load webhook config:', err)
        setWebhookConfig({ enabled: false })
      } finally {
        setFetchingWebhook(false)
      }
    }

    void loadWebhookConfig()
  }, [repoDraft.fullName])

  const handleToggleWebhook = async () => {
    if (!repoDraft.fullName || !providerToken) return
    const [owner, name] = repoDraft.fullName.split('/')
    if (!owner || !name) return

    setTogglingWebhook(true)
    setWebhookError(null)
    const currentEnabled = webhookConfig?.enabled || false
    const action = currentEnabled ? 'disable' : 'enable'

    try {
      await toggleWebhook(owner, name, providerToken, action)
      const updated = await getWebhookConfig(owner, name)
      setWebhookConfig(updated)
    } catch (err: any) {
      setWebhookError(err.message || `Failed to ${action} webhook.`)
    } finally {
      setTogglingWebhook(false)
    }
  }


  const fetchRepos = async () => {
    if (!providerToken) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100', {
        headers: {
          Authorization: `Bearer ${providerToken}`,
          Accept: 'application/vnd.github+json',
        },
      })

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}))
        throw new Error(errBody.message || `GitHub API returned ${response.status}`)
      }

      const data = (await response.json()) as GithubRepo[]
      setRepos(data)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch repositories.')
    } finally {
      setLoading(false)
    }
  }

  // Fetch repositories when component is expanded and we have a token
  useEffect(() => {
    if (open && providerToken && repos.length === 0) {
      void fetchRepos()
    }
  }, [open, providerToken])

  const filtered = repos.filter(r =>
    r.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (r.description && r.description.toLowerCase().includes(search.toLowerCase()))
  )

  const formatUpdatedAt = (dateStr: string) => {
    if (!mounted) return '--'
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    } catch {
      return dateStr
    }
  }

  return (
    <section className="border border-border rounded bg-surface">
      <div className="px-4 sm:px-5 py-3 border-b border-border flex items-center justify-between">
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
      <div className="px-4 sm:px-5 py-3 flex items-center gap-3 border-b border-border">
        <div className="w-7 h-7 rounded bg-s3 border border-border flex items-center justify-center flex-shrink-0">
          <GitBranch className="w-3.5 h-3.5 text-muted" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-ink truncate">{repoDraft.fullName || 'No repository selected'}</p>
          <p className="text-[11px] font-mono text-faint mt-0.5 truncate">
            {repoDraft.branch} · {repoDraft.module} · {repoDraft.scope}
            {repoDraft.scope === 'pr' && repoDraft.prNumber && ` · PR #${repoDraft.prNumber}`}
            {repoDraft.scope === 'commit_range' && repoDraft.baseCommit && repoDraft.headCommit && ` · ${repoDraft.baseCommit.slice(0, 7)}...${repoDraft.headCommit.slice(0, 7)}`}
          </p>
        </div>
        <div className={cn(
          'flex-shrink-0 w-2 h-2 rounded-full transition-colors',
          repoDraft.fullName ? 'bg-accent-green shadow-[0_0_6px_rgba(46,200,154,0.4)]' : 'bg-border'
        )} />
      </div>

      {/* Auto Audits configuration panel */}
      {repoDraft.fullName && (
        <div className="px-4 sm:px-5 py-3 border-b border-border bg-s2/20 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-faint uppercase tracking-wider">Auto Audits</span>
              {fetchingWebhook ? (
                <Loader2 className="w-3 h-3 text-faint animate-spin" />
              ) : webhookConfig?.enabled ? (
                <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded border border-accent-green/25 text-accent-green bg-accent-green/5 font-mono uppercase tracking-wider">
                  <span className="w-1 h-1 rounded-full bg-accent-green animate-ping" />
                  Active
                </span>
              ) : (
                <span className="text-[9px] px-1.5 py-0.5 rounded border border-border text-faint bg-s2/50 font-mono uppercase tracking-wider">
                  Inactive
                </span>
              )}
            </div>

            {providerToken ? (
              <button
                type="button"
                disabled={togglingWebhook || fetchingWebhook}
                onClick={handleToggleWebhook}
                className={cn(
                  "px-3 py-1 rounded text-[11px] font-medium font-mono transition-all flex items-center gap-1.5 border",
                  webhookConfig?.enabled
                    ? "border-accent-red/25 text-accent-red hover:bg-accent-red/5 bg-accent-red/5"
                    : "border-accent-blue/25 text-accent-blue hover:bg-accent-blue/5 bg-accent-blue/5"
                )}
              >
                {togglingWebhook && <Loader2 className="w-3 h-3 animate-spin" />}
                {webhookConfig?.enabled ? 'Disable Auto Audits' : 'Enable Auto Audits'}
              </button>
            ) : (
              <span className="text-[10px] text-faint italic">Connect GitHub in Browse to toggle</span>
            )}
          </div>

          {webhookError && (
            <p className="text-[11px] font-mono text-accent-red leading-normal bg-accent-red/5 border border-accent-red/10 rounded px-2.5 py-1.5">
              {webhookError}
            </p>
          )}

          {webhookConfig?.enabled && (
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-muted bg-s2/40 border border-border/30 rounded p-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] text-faint uppercase tracking-wider">Last Push Received</span>
                <span className="text-ink">
                  {webhookConfig.last_push_received && mounted
                    ? new Date(webhookConfig.last_push_received).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                    : 'Never'}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] text-faint uppercase tracking-wider">Last Auto Audit</span>
                <span className="text-ink">
                  {webhookConfig.last_auto_audit && mounted
                    ? new Date(webhookConfig.last_auto_audit).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                    : 'Never'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Expandable browser */}
      {open && (
        <div className="border-b border-border">
          {providerToken ? (
            <>
              {/* Search bar and refresh action */}
              <div className="px-3 sm:px-4 py-2.5 border-b border-border flex items-center gap-2">
                <div className="flex items-center gap-2 bg-s2 rounded border border-border px-2.5 py-1.5 flex-1">
                  <Search className="w-3 h-3 text-faint flex-shrink-0" />
                  <input
                    type="text"
                    placeholder="Filter repositories…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="bg-transparent text-[12px] text-ink placeholder:text-faint outline-none w-full"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void fetchRepos()}
                  disabled={loading}
                  className="h-8 w-8 flex items-center justify-center rounded border border-border bg-s2 text-muted hover:text-ink hover:bg-s3 transition-colors disabled:opacity-50"
                  title="Refresh repository list"
                >
                  <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
                </button>
              </div>

              <div className="px-3 sm:px-4 py-2 border-b border-border bg-s2/40 flex items-center gap-2">
                <span className="text-[10px] font-mono text-faint uppercase tracking-wider flex-shrink-0">Manual:</span>
                <input
                  type="text"
                  placeholder="owner/repo (e.g. fastapi/fastapi)"
                  id="manual-repo-input-auth"
                  className="flex-1 bg-transparent text-[12px] text-ink placeholder:text-faint outline-none border border-border rounded px-2.5 py-1 focus:border-accent-blue/50"
                />
                <button
                  type="button"
                  onClick={() => {
                    const val = (document.getElementById('manual-repo-input-auth') as HTMLInputElement)?.value?.trim()
                    if (val) {
                      setRepoDraft({
                        fullName: val,
                        branch: 'main',
                        module: '.',
                        scope: 'full_module',
                      })
                      setOpen(false)
                    }
                  }}
                  className="h-7 px-2.5 rounded border border-border bg-s2 text-[11px] font-medium text-muted hover:text-ink hover:bg-s3 transition-colors"
                >
                  Select
                </button>
              </div>

              {/* States: loading, error, empty, list */}
              {loading && repos.length === 0 ? (
                <div className="px-4 py-8 text-center text-faint font-mono text-[12px] flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-accent-blue" />
                  <span>Loading repositories…</span>
                </div>
              ) : error ? (
                <div className="px-4 py-6 text-center border-b border-border/30">
                  <AlertCircle className="w-5 h-5 text-accent-red mx-auto mb-2" />
                  <p className="text-[12px] text-accent-red font-mono mb-3">{error}</p>
                  <button
                    type="button"
                    onClick={() => void fetchRepos()}
                    className="px-3 py-1.5 text-[11px] rounded border border-border text-muted hover:text-ink hover:bg-s2 transition-colors font-mono"
                  >
                    Retry Fetch
                  </button>
                </div>
              ) : filtered.length === 0 ? (
                <div className="px-4 py-8 text-center text-faint font-mono text-[12px]">
                  {repos.length === 0 ? 'No repositories found in your GitHub account.' : `No repositories match "${search}"`}
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto divide-y divide-border/20">
                  {filtered.map(repo => (
                    <button
                      key={repo.id}
                      type="button"
                      onClick={() => {
                        setRepoDraft({
                          fullName: repo.full_name,
                          branch: repo.default_branch,
                          module: '.',
                          scope: 'full_module',
                        })
                      }}
                      className={cn(
                        'w-full px-3 sm:px-4 py-2.5 flex flex-col text-left hover:bg-s2 transition-colors',
                        repoDraft.fullName === repo.full_name && 'bg-accent-blue/5'
                      )}
                    >
                      <div className="flex items-center justify-between w-full gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="text-[12px] text-ink font-mono font-medium truncate">{repo.full_name}</p>
                          <span className={cn(
                            'text-[9px] px-1.5 py-0.2 rounded border font-mono flex-shrink-0 uppercase tracking-wider',
                            repo.private
                              ? 'border-accent-amber/25 text-accent-amber bg-accent-amber/5'
                              : 'border-accent-green/25 text-accent-green bg-accent-green/5'
                          )}>
                            {repo.private ? 'private' : 'public'}
                          </span>
                        </div>
                        <span className="text-[10px] text-faint font-mono flex-shrink-0">
                          {repo.default_branch}
                        </span>
                      </div>
                      {repo.description && (
                        <p className="text-[11px] text-muted mt-1 line-clamp-1 break-all">{repo.description}</p>
                      )}
                      <p className="text-[10px] text-faint mt-1 font-mono">
                        Updated {formatUpdatedAt(repo.updated_at)}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="px-4 py-6 text-center">
              <p className="text-[12px] text-muted mb-3 leading-relaxed">
                Connect GitHub OAuth in Settings to dynamically fetch your repositories.
              </p>
              <button
                type="button"
                onClick={() => void signInWithGitHub()}
                className="h-7 px-3.5 rounded bg-accent-blue/90 text-[11px] font-medium text-bg hover:bg-accent-blue transition-colors"
              >
                Connect GitHub
              </button>

              <div className="mt-6 pt-4 border-t border-border/40">
                <p className="text-[11px] font-mono text-faint uppercase tracking-widest mb-2">Or enter a public repository manually</p>
                <div className="flex items-center gap-2 max-w-sm mx-auto">
                  <input
                    type="text"
                    placeholder="owner/repo (e.g. fastapi/fastapi)"
                    className="flex-1 bg-s2 text-[12px] text-ink placeholder:text-faint outline-none border border-border rounded px-3 py-1.5 focus:border-accent-blue/50"
                    id="manual-repo-input"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const val = (document.getElementById('manual-repo-input') as HTMLInputElement)?.value?.trim()
                      if (val) {
                        setRepoDraft({
                          fullName: val,
                          branch: 'main',
                          module: '.',
                          scope: 'full_module',
                        })
                        setOpen(false)
                      }
                    }}
                    className="h-8 px-3 rounded border border-border bg-s2 text-[11px] font-medium text-muted hover:text-ink hover:bg-s3 transition-colors"
                  >
                    Select
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
