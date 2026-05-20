'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

import { useAuth } from '@/lib/auth'

import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { isAuthenticated, isLoading } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Close sidebar on route change
  useEffect(() => { setSidebarOpen(false) }, [pathname])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setSidebarOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // Prevent body scroll only when mobile sidebar is open
  useEffect(() => {
    if (sidebarOpen) {
      document.documentElement.style.overflow = 'hidden'
    } else {
      document.documentElement.style.overflow = ''
    }
    return () => { document.documentElement.style.overflow = '' }
  }, [sidebarOpen])

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`)
    }
  }, [isAuthenticated, isLoading, pathname, router])

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-6">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-1.5 h-5 rounded-full bg-accent-blue"
                style={{ animation: `dot-blink 1.1s ease-in-out ${i * 0.18}s infinite` }}
              />
            ))}
          </div>
          <p className="font-mono text-[11px] tracking-widest text-faint uppercase">Verifying session</p>
        </div>
      </div>
    )
  }

  return (
    /*
     * Root: full viewport height, flex row.
     * Sidebar is sticky. Main column stretches and scrolls its content.
     */
    <div className="flex h-screen bg-bg text-ink overflow-hidden">

      {/* ── Desktop sidebar ── */}
      <div className="hidden lg:flex flex-col w-[240px] flex-shrink-0 h-screen overflow-y-auto">
        <Sidebar />
      </div>

      {/* ── Mobile sidebar overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-bg/80 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        >
          <div
            className="h-full w-[240px] max-w-[80vw] overflow-y-auto shadow-panel"
            onClick={e => e.stopPropagation()}
          >
            <Sidebar onNavigate={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* ── Main area ── */}
      <div className="flex flex-col flex-1 min-w-0 h-screen">
        {/* Topbar — fixed height, never scrolls */}
        <Topbar onMenuClick={() => setSidebarOpen(v => !v)} />

        {/* Page content — this is the ONLY scroll container */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  )
}
