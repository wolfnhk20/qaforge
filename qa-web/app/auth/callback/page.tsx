'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useAuth } from '@/lib/auth'

export default function AuthCallbackPage() {
  const router = useRouter()
  const { completeOAuth } = useAuth()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    const finalize = async () => {
      try {
        await completeOAuth()
        router.replace('/dashboard')
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : 'Unable to complete sign-in.',
        )
      }
    }

    void finalize()
  }, [completeOAuth, router])

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-6 text-ink">
      <div className="w-full max-w-lg rounded-[28px] border border-white/10 bg-slate-950/80 p-8 text-center shadow-panel">
        <p className="text-xs uppercase tracking-[0.34em] text-sky-200/70">
          Finalizing access
        </p>
        <h1 className="mt-5 text-3xl font-semibold text-white">
          Completing your GitHub session
        </h1>
        <p className="mt-4 text-sm leading-7 text-muted">
          QAForge is exchanging the Supabase PKCE code and restoring your operator session.
        </p>
        {errorMessage ? (
          <div className="mt-6 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-5 py-4 text-left text-sm text-rose-200">
            {errorMessage}
          </div>
        ) : (
          <div className="mt-6 flex items-center justify-center gap-3 text-sm text-sky-100">
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-sky-400 shadow-[0_0_18px_rgba(78,161,255,0.65)]" />
            <span>Authorizing product surface…</span>
          </div>
        )}
      </div>
    </main>
  )
}
