'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Github } from 'lucide-react'

import { useAuth } from '@/lib/auth'

export default function LoginPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading, signInWithGitHub, signInMock, session } = useAuth()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/dashboard')
    }
  }, [isAuthenticated, isLoading, router])

  return (
    <main className="min-h-screen bg-bg px-6 py-10 text-ink lg:px-10">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-8 shadow-panel">
          <p className="text-xs uppercase tracking-[0.34em] text-sky-200/70">
            Authentication
          </p>
          <h1 className="mt-5 text-4xl font-semibold text-white">
            Connect GitHub through Supabase Auth.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-muted">
            Use GitHub OAuth to protect the dashboard, persist sessions, and keep the frontend
            aligned with the product surface that will eventually gate repository-triggered audits.
          </p>

          <div className="mt-8 rounded-2xl border border-white/10 bg-slate-950/70 p-5">
            <p className="text-sm font-medium text-white">Session model</p>
            <div className="mt-4 space-y-3 text-sm text-muted">
              <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
                GitHub OAuth redirect via Supabase PKCE
              </div>
              <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
                Client session persisted locally and refreshed on boot
              </div>
              <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
                Protected dashboard routes with logout support
              </div>
            </div>
          </div>

          <div className="mt-8 flex items-center gap-4 text-sm text-faint">
            <Link href="/" className="transition hover:text-white">
              Back to landing page
            </Link>
            <button
              type="button"
              onClick={() => {
                signInMock()
                router.replace('/dashboard')
              }}
              className="transition hover:text-white"
            >
              Try dashboard anyway
            </button>
          </div>
        </section>

        <section className="rounded-[28px] border border-white/10 bg-slate-950/80 p-8 shadow-panel">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">Operator access</p>
              <p className="mt-1 text-sm text-muted">
                Sign in to unlock protected product routes.
              </p>
            </div>
            <div className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-faint">
              OAuth
            </div>
          </div>

          <div className="mt-10 rounded-2xl border border-white/8 bg-white/[0.03] p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-400/15 text-sky-200">
                <Github className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">GitHub via Supabase</p>
                <p className="text-sm text-muted">
                  Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={async () => {
                setErrorMessage(null)
                try {
                  await signInWithGitHub()
                } catch (error) {
                  setErrorMessage(
                    error instanceof Error ? error.message : 'Unable to begin GitHub sign-in.',
                  )
                }
              }}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={isLoading}
            >
              <span>Continue with GitHub</span>
              <ArrowRight className="h-4 w-4" />
            </button>

            {errorMessage ? (
              <p className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {errorMessage}
              </p>
            ) : null}

            <div className="mt-6 rounded-xl border border-white/8 bg-black/20 px-4 py-3 text-sm text-muted">
              {session?.user?.email ? (
                <span>Signed in as {session.user.email}</span>
              ) : (
                <span>No active session detected in this browser.</span>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
