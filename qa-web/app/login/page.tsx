'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Cpu, Github } from 'lucide-react'

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
    <main className="min-h-screen bg-bg flex items-center justify-center px-4">
      {/* Background grid */}
      <div className="absolute inset-0 opacity-[0.025] pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(var(--text) 1px, transparent 1px), linear-gradient(90deg, var(--text) 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}
      />

      <div className="relative w-full max-w-5xl grid gap-6 lg:grid-cols-2">
        {/* Left: product context */}
        <div className="lg:pr-6 lg:border-r lg:border-border flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-7 h-7 rounded bg-accent-blue/15 border border-accent-blue/30 flex items-center justify-center">
              <Cpu className="w-4 h-4 text-accent-blue" />
            </div>
            <span className="font-mono text-[12px] tracking-widest text-accent-blue uppercase">QAForge</span>
          </div>

          <h1 className="text-[28px] font-semibold text-ink leading-tight mb-3">
            AI-native software quality infrastructure
          </h1>
          <p className="text-[13px] text-faint leading-relaxed mb-8 max-w-md">
            Autonomous code audits. Behavioral validation. Runtime probe execution.
            Connect GitHub OAuth to access the control plane.
          </p>

          <div className="space-y-2">
            {[
              'GitHub OAuth via Supabase PKCE',
              'Client session persisted and auto-refreshed',
              'Protected dashboard routes',
            ].map(item => (
              <div key={item} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-accent-green flex-shrink-0" />
                <span className="text-[12px] text-muted font-mono">{item}</span>
              </div>
            ))}
          </div>

          <div className="mt-8 pt-8 border-t border-border flex items-center gap-4">
            <Link href="/" className="text-[12px] text-faint hover:text-muted transition-colors">
              ← Landing page
            </Link>
            <button
              type="button"
              onClick={() => { signInMock(); router.replace('/dashboard') }}
              className="text-[12px] text-faint hover:text-accent-blue transition-colors"
            >
              Try dashboard (mock session)
            </button>
          </div>
        </div>

        {/* Right: sign-in */}
        <div className="lg:pl-6 flex flex-col justify-center">
          <div className="border border-border rounded bg-surface p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-[14px] font-medium text-ink">Operator access</p>
                <p className="text-[12px] text-faint mt-0.5">Sign in to unlock the dashboard</p>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-border text-faint">OAuth</span>
            </div>

            <div className="border border-border rounded p-4 mb-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded bg-s2 border border-border flex items-center justify-center">
                  <Github className="w-4 h-4 text-muted" />
                </div>
                <div>
                  <p className="text-[13px] font-medium text-ink">GitHub via Supabase</p>
                  <p className="text-[11px] text-faint font-mono">NEXT_PUBLIC_SUPABASE_URL required</p>
                </div>
              </div>

              <button
                type="button"
                onClick={async () => {
                  setErrorMessage(null)
                  try {
                    await signInWithGitHub()
                  } catch (err) {
                    setErrorMessage(err instanceof Error ? err.message : 'Unable to begin sign-in.')
                  }
                }}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 h-9 rounded bg-ink text-bg text-[13px] font-medium hover:bg-ink/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>Continue with GitHub</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {errorMessage && (
              <div className="rounded border border-accent-red/20 bg-accent-red/8 px-3 py-2.5 mb-3">
                <p className="text-[12px] text-accent-red">{errorMessage}</p>
              </div>
            )}

            <div className="text-[11px] font-mono text-faint">
              {session?.user?.email
                ? `Session: ${session.user.email}`
                : 'No active session detected'}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
