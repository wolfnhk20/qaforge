'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Activity, BookOpen, Cpu, Gauge, GitBranch, Settings2, Shield } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useHealth } from '@/hooks/useHealth'

const navItems = [
  { href: '/dashboard', label: 'Dashboard',  sub: 'Launch & monitor',  icon: Gauge },
  { href: '/audits',    label: 'Audits',      sub: 'Execution history',  icon: Activity },
  { href: '/findings',  label: 'Findings',    sub: 'Behavioral gaps',    icon: Shield },
  { href: '/reports',   label: 'Reports',     sub: 'Narrative output',   icon: BookOpen },
  { href: '/settings',  label: 'Settings',    sub: 'Config & access',    icon: Settings2 },
]

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { healthStatus } = useHealth()

  return (
    <aside className="flex h-full w-full flex-col bg-surface border-r border-border">
      {/* Logo / Brand */}
      <div className="px-5 py-5 border-b border-border">
        <div className="flex items-center gap-2.5 mb-0.5">
          <div className="w-6 h-6 rounded bg-accent-blue/15 border border-accent-blue/30 flex items-center justify-center flex-shrink-0">
            <Cpu className="w-3.5 h-3.5 text-accent-blue" />
          </div>
          <span className="text-[11px] font-mono font-medium tracking-[0.18em] text-accent-blue uppercase">QAForge</span>
        </div>
        <p className="text-[11px] text-faint mt-1 pl-8 font-mono">v0.2.0 · engine</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'group flex items-center gap-3 rounded px-3 py-2.5 text-sm transition-all duration-150',
                isActive
                  ? 'bg-accent-blue/10 border border-accent-blue/20 text-ink'
                  : 'border border-transparent text-muted hover:bg-s2 hover:border-border hover:text-ink',
              )}
            >
              <Icon className={cn('w-4 h-4 flex-shrink-0 transition-colors',
                isActive ? 'text-accent-blue' : 'text-faint group-hover:text-muted'
              )} />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-[13px] leading-tight">{item.label}</p>
                <p className="text-[11px] text-faint mt-0.5">{item.sub}</p>
              </div>
              {isActive && (
                <div className="w-1 h-1 rounded-full bg-accent-blue flex-shrink-0" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Engine status */}
      <div className="px-3 py-4 border-t border-border">
        <div className="rounded bg-s2 border border-border px-3 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono text-faint uppercase tracking-widest">Engine</span>
            <div className="flex items-center gap-1.5">
              <div className={cn('w-1.5 h-1.5 rounded-full',
                healthStatus?.status === 'ok' ? 'bg-accent-green' : 'bg-accent-red'
              )} />
              <span className={cn('text-[11px] font-mono',
                healthStatus?.status === 'ok' ? 'text-accent-green' : 'text-accent-red'
              )}>
                {healthStatus?.status === 'ok' ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>
          </div>
          <div className="space-y-1">
            {[
              ['FastAPI', 'ready'],
              ['LangGraph', '5 agents'],
              ['Supabase', 'active'],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between">
                <span className="text-[11px] text-faint font-mono">{k}</span>
                <span className="text-[11px] text-muted font-mono">{v}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 px-1">
          <GitBranch className="w-3 h-3 text-faint" />
          <span className="text-[11px] text-faint font-mono">main · GitHub OAuth ready</span>
        </div>
      </div>
    </aside>
  )
}
