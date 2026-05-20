'use client'

import { useAuth } from '@/lib/auth'

export default function SettingsPage() {
  const { session, signInWithGitHub, signOut } = useAuth()
  const isConnected = Boolean(session?.provider_token)

  const items = [
    {
      title: 'GitHub OAuth',
      desc: isConnected
        ? `Connected to GitHub as ${session?.user?.user_name || session?.user?.email || 'operator'}. Ready to load your repositories.`
        : 'Connect your GitHub account to load repositories dynamically and enable webhook triggers on push.',
      status: isConnected ? 'connected' : 'not connected',
      action: isConnected ? 'Disconnect' : 'Connect',
      accent: isConnected ? 'green' : 'blue',
      onClick: isConnected ? () => void signOut() : () => void signInWithGitHub(),
    },
    {
      title: 'Webhook Triggers',
      desc: 'Auto-trigger audits on git push events. Requires GitHub OAuth to be configured first.',
      status: 'coming soon',
      action: null,
      accent: 'amber',
      onClick: null,
    },
    {
      title: 'Staging Environment',
      desc: 'Configure the staging base URL for runtime probe execution against your deployed API.',
      status: 'configured via .env',
      action: 'Edit',
      accent: 'green',
      onClick: null,
    },
    {
      title: 'Team Workspace',
      desc: 'Shared audit history, role-based access, and collaborative finding review.',
      status: 'coming soon',
      action: null,
      accent: 'amber',
      onClick: null,
    },
  ]

  return (
    <div className="p-5 lg:p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-[18px] font-semibold text-ink">Settings</h1>
        <p className="text-[12px] text-faint mt-1">Integration configuration and access management</p>
      </div>

      <div className="grid gap-4">
        {items.map(item => (
          <div key={item.title} className="border border-border rounded bg-surface px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-[13px] font-medium text-ink">{item.title}</h3>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                    item.accent === 'blue'  ? 'border-accent-blue/25 text-accent-blue' :
                    item.accent === 'green' ? 'border-accent-green/25 text-accent-green' :
                                              'border-accent-amber/25 text-accent-amber'
                  }`}>
                    {item.status}
                  </span>
                </div>
                <p className="text-[12px] text-faint leading-relaxed">{item.desc}</p>
              </div>
              {item.action && (
                <button
                  type="button"
                  onClick={item.onClick || undefined}
                  className="flex-shrink-0 h-7 px-3 rounded border border-border text-[12px] text-muted hover:text-ink hover:bg-s2 transition-colors"
                >
                  {item.action}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
