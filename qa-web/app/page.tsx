import Link from 'next/link'

const highlights = [
  'Contract-aware pipeline orchestration',
  'Probe-driven findings explorer',
  'Persisted markdown intelligence',
]

const sampleLogs = [
  '[10:24:02] Intent Extractor: mapped expected behavior from repository signals',
  '[10:24:05] Code Analyst: traced 14 route surfaces in module scope',
  '[10:24:09] Probe Designer: generated 8 adversarial cases',
  '[10:24:12] Report Synthesizer: published remediation narrative',
]

export default function RootPage() {
  return (
    <main className="min-h-screen bg-bg text-ink">
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(78,161,255,0.2),transparent_40%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent)]" />
        <div className="absolute inset-0 bg-panel-grid bg-[size:54px_54px] opacity-[0.06]" />
        <div className="relative mx-auto flex max-w-7xl flex-col gap-16 px-6 py-10 lg:px-10 lg:py-14">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.34em] text-sky-200/80">
                QAForge
              </p>
              <p className="mt-2 text-sm text-muted">
                AI operating system for software quality infrastructure
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:border-sky-400/40 hover:bg-white/5"
              >
                Sign in
              </Link>
              <Link
                href="/dashboard"
                className="rounded-full bg-sky-400 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-sky-300"
              >
                Open product
              </Link>
            </div>
          </div>

          <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div className="max-w-3xl">
              <div className="inline-flex rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs uppercase tracking-[0.28em] text-sky-200">
                Contract-aware audit operations
              </div>
              <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                Turn backend intelligence into an operational frontend for software assurance.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
                QAForge launches audits, visualizes execution stages, surfaces findings as they emerge,
                and promotes the final report into a decision-ready engineering surface.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/dashboard"
                  className="rounded-full bg-white px-5 py-3 text-sm font-medium text-slate-950 transition hover:bg-slate-100"
                >
                  Launch dashboard
                </Link>
                <Link
                  href="/login"
                  className="rounded-full border border-white/10 px-5 py-3 text-sm text-slate-200 transition hover:bg-white/5"
                >
                  Connect GitHub
                </Link>
              </div>
              <div className="mt-10 grid gap-3 sm:grid-cols-3">
                {highlights.map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-sm text-slate-200 shadow-panel backdrop-blur"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-slate-950/70 p-5 shadow-panel backdrop-blur">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">Live execution surface</p>
                  <p className="text-xs text-faint">
                    Observe the backend pipeline with trustworthy operational detail.
                  </p>
                </div>
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-emerald-200">
                  System online
                </span>
              </div>
              <div className="grid gap-4">
                <div className="rounded-2xl border border-white/8 bg-slate-900/80 p-4">
                  <div className="mb-4 flex items-center justify-between text-xs uppercase tracking-[0.28em] text-faint">
                    <span>Pipeline</span>
                    <span>5 agents</span>
                  </div>
                  <div className="space-y-3">
                    {['Intent', 'Analysis', 'Design', 'Execution', 'Report'].map(
                      (stage, index) => (
                        <div
                          key={stage}
                          className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-white">{stage}</p>
                              <p className="text-xs text-muted">
                                {index < 4 ? 'Artifacts promoted to next stage' : 'Narrative finalized'}
                              </p>
                            </div>
                            <div className="h-2.5 w-2.5 rounded-full bg-sky-400 shadow-[0_0_18px_rgba(78,161,255,0.75)]" />
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/8 bg-slate-900/80 p-4">
                  <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.28em] text-faint">
                    <span>Terminal trace</span>
                    <span>Operational</span>
                  </div>
                  <div className="space-y-2 font-mono text-xs text-slate-300">
                    {sampleLogs.map((log) => (
                      <div key={log} className="rounded-lg bg-black/30 px-3 py-2">
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
