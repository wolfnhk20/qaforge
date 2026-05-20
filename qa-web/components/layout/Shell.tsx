'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

import { useAuth } from '@/lib/auth'

import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { isAuthenticated, isLoading } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`)
    }
  }, [isAuthenticated, isLoading, pathname, router])

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg px-6 text-ink">
        <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-slate-950/80 p-8 text-center shadow-panel">
          <p className="text-xs uppercase tracking-[0.34em] text-sky-200/70">
            Preparing workspace
          </p>
          <h1 className="mt-5 text-2xl font-semibold text-white">
            Verifying operator session
          </h1>
          <p className="mt-4 text-sm leading-7 text-muted">
            Loading the protected QAForge surface and restoring the most recent audit context.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-bg text-ink">
      <div className="hidden w-[310px] shrink-0 lg:block">
        <Sidebar />
      </div>

      {sidebarOpen ? (
        <div
          className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <div
            className="h-full w-[300px] max-w-[85vw]"
            onClick={(event) => event.stopPropagation()}
          >
            <Sidebar onNavigate={() => setSidebarOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="min-w-0 flex-1">
        <Topbar onMenuClick={() => setSidebarOpen((current) => !current)} />
        <main className="min-h-[calc(100vh-73px)] overflow-x-hidden px-4 py-5 lg:px-6">
          {children}
        </main>
      </div>
    </div>
  )
}
