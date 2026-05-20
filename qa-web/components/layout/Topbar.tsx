'use client'

import { LogOut, Menu, ShieldCheck } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'

import { useAuth } from '@/lib/auth'
import { formatShortDate } from '@/lib/utils'
import { useAuditStore } from '@/store/auditStore'

const pageLabels: Record<string, string> = {
  '/dashboard': 'Audit command center',
  '/audits': 'Audit execution',
  '/findings': 'Findings explorer',
  '/reports': 'Report intelligence',
  '/settings': 'Platform settings',
}

export default function Topbar({
  onMenuClick,
}: {
  onMenuClick: () => void
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { session, signOut } = useAuth()
  const repoDraft = useAuditStore((state) => state.repoDraft)
  const lastCompletedAt = useAuditStore((state) => state.lastCompletedAt)

  return (
    <header className="sticky top-0 z-20 border-b border-white/8 bg-bg/85 backdrop-blur">
      <div className="flex items-center gap-3 px-4 py-4 lg:px-6">
        <button
          type="button"
          onClick={onMenuClick}
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.03] text-slate-100 transition hover:bg-white/[0.06] lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-[0.28em] text-faint">Control plane</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="truncate text-lg font-semibold text-white">
              {pageLabels[pathname] || 'QAForge'}
            </h2>
            <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-xs text-muted">
              {repoDraft.fullName}
            </span>
            {lastCompletedAt ? (
              <span className="text-xs text-faint">
                Last completed {formatShortDate(lastCompletedAt)}
              </span>
            ) : null}
          </div>
        </div>

        <div className="hidden items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 lg:flex">
          <ShieldCheck className="h-4 w-4 text-emerald-300" />
          <div className="text-right">
            <p className="text-sm font-medium text-white">
              {session?.user?.full_name || session?.user?.email || 'Protected session'}
            </p>
            <p className="text-xs text-muted">Supabase-authenticated operator</p>
          </div>
        </div>

        <button
          type="button"
          onClick={async () => {
            await signOut()
            router.replace('/login')
          }}
          className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.03] px-4 text-sm text-slate-100 transition hover:bg-white/[0.06]"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  )
}
