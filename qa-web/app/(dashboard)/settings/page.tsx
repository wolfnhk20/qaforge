import Link from 'next/link'

export default function SettingsPage() {
  const apiBase =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    '/api/backend'

  return (
    <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <section className="rounded-[28px] border border-white/8 bg-slate-950/70 p-6 shadow-panel">
        <p className="text-xs uppercase tracking-[0.28em] text-faint">Integrations</p>
        <h1 className="mt-3 text-2xl font-semibold text-white">
          Frontend environment posture
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">
          QAForge keeps secrets in the backend and uses public environment variables only for
          the browser-safe integration points required to reach the API and initialize Supabase
          Auth.
        </p>

        <div className="mt-8 space-y-4">
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
            <p className="text-sm font-medium text-white">Backend API base</p>
            <p className="mt-2 font-mono text-xs text-sky-100">{apiBase}</p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
            <p className="text-sm font-medium text-white">Supabase public config</p>
            <p className="mt-2 text-sm text-muted">
              `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are expected for
              GitHub OAuth.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-white/8 bg-white/[0.03] p-6 shadow-panel">
        <p className="text-xs uppercase tracking-[0.28em] text-faint">Roadmap stubs</p>
        <div className="mt-4 space-y-3 text-sm text-muted">
          <div className="rounded-2xl border border-white/8 bg-slate-950/60 px-4 py-4">
            GitHub repo installation workflows
          </div>
          <div className="rounded-2xl border border-white/8 bg-slate-950/60 px-4 py-4">
            Team workspaces and webhook-triggered audits
          </div>
          <div className="rounded-2xl border border-white/8 bg-slate-950/60 px-4 py-4">
            Historical runs, diffing, and policy guardrails
          </div>
        </div>

        <Link
          href="/login"
          className="mt-8 inline-flex rounded-full border border-white/10 px-4 py-2 text-sm text-slate-100 transition hover:bg-white/[0.04]"
        >
          Re-open authentication
        </Link>
      </section>
    </div>
  )
}
