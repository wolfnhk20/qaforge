'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Activity, FileText, Gauge, Radar, Settings2 } from 'lucide-react'

import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: Gauge },
  { href: '/audits', label: 'Audits', icon: Activity },
  { href: '/findings', label: 'Findings', icon: Radar },
  { href: '/reports', label: 'Reports', icon: FileText },
  { href: '/settings', label: 'Settings', icon: Settings2 },
]

export default function Sidebar({
  onNavigate,
}: {
  onNavigate?: () => void
}) {
  const pathname = usePathname()

  return (
    <aside className="flex h-full w-full flex-col border-r border-white/8 bg-slate-950/85 px-4 py-5 backdrop-blur">
      <div className="rounded-3xl border border-white/8 bg-white/[0.03] px-4 py-4">
        <p className="text-xs uppercase tracking-[0.34em] text-sky-200/80">QAForge</p>
        <h1 className="mt-3 text-lg font-semibold text-white">
          Quality infrastructure control plane
        </h1>
        <p className="mt-2 text-sm text-muted">
          Trigger audits, observe execution, and ship report-driven remediation.
        </p>
      </div>

      <nav className="mt-6 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'group flex items-center gap-3 rounded-2xl border px-3 py-3 text-sm transition',
                isActive
                  ? 'border-sky-400/30 bg-sky-400/10 text-white'
                  : 'border-transparent bg-transparent text-muted hover:border-white/8 hover:bg-white/[0.03] hover:text-white',
              )}
            >
              <div
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-xl transition',
                  isActive
                    ? 'bg-sky-400/20 text-sky-100'
                    : 'bg-white/[0.03] text-faint group-hover:text-slate-100',
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium">{item.label}</p>
                <p className="text-xs text-faint">
                  {item.label === 'Dashboard'
                    ? 'Launch and review'
                    : item.label === 'Audits'
                      ? 'Execution timeline'
                      : item.label === 'Findings'
                        ? 'Operational gaps'
                        : item.label === 'Reports'
                          ? 'Narrative output'
                          : 'Access and config'}
                </p>
              </div>
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto rounded-3xl border border-white/8 bg-gradient-to-br from-sky-400/10 to-white/[0.02] px-4 py-4">
        <p className="text-xs uppercase tracking-[0.28em] text-sky-100/80">
          Product posture
        </p>
        <p className="mt-3 text-sm text-slate-200">
          Premium execution UX for backend intelligence you can trust.
        </p>
      </div>
    </aside>
  )
}
