import Link from 'next/link'
import { Activity, ArrowRight, Cpu, GitBranch, Shield, Terminal, Zap } from 'lucide-react'

const PIPELINE_STAGES = [
  { id: '01', name: 'Intent Extractor',   desc: 'Reconstructs expected behavior from repository signals' },
  { id: '02', name: 'Code Analyst',        desc: 'Maps handlers, routes, and implementation surfaces' },
  { id: '03', name: 'Probe Designer',      desc: 'Generates adversarial cases from contract and code' },
  { id: '04', name: 'Probe Executor',      desc: 'Executes runtime pressure, collects behavioral gaps' },
  { id: '05', name: 'Report Synthesizer',  desc: 'Turns artifacts into decision-ready engineering narrative' },
]

const SAMPLE_LOGS = [
  { t: '10:24:01', level: 'info',    src: 'Intent Extractor',  msg: 'Scanning repository signals and runtime assumptions' },
  { t: '10:24:04', level: 'info',    src: 'Code Analyst',       msg: 'Traced 14 route surfaces in module scope' },
  { t: '10:24:08', level: 'info',    src: 'Probe Designer',     msg: 'Generated 8 adversarial cases from contract diff' },
  { t: '10:24:13', level: 'success', src: 'Probe Executor',     msg: 'Execution complete — 3 gaps detected' },
  { t: '10:24:17', level: 'success', src: 'Report Synthesizer', msg: 'Narrative finalized and persisted to Supabase' },
]

const SAMPLE_FINDINGS = [
  { priority: 'HIGH',   endpoint: '/payment',   classification: 'MISSING_VALIDATION' },
  { priority: 'MEDIUM', endpoint: '/auth/token', classification: 'RATE_LIMIT_BYPASS' },
  { priority: 'LOW',    endpoint: '/users',      classification: 'EXCESS_DATA_EXPOSURE' },
]

function LogLevel({ level }: { level: string }) {
  const colors: Record<string, string> = {
    success: 'text-accent-green',
    warning: 'text-accent-amber',
    error:   'text-accent-red',
    info:    'text-accent-blue',
  }
  const prefix: Record<string, string> = { success: '✓', warning: '!', error: '✕', info: '›' }
  return <span className={colors[level] ?? 'text-muted'}>{prefix[level] ?? '›'}</span>
}

function PriorityBadge({ p }: { p: string }) {
  const colors: Record<string, string> = {
    HIGH:   'border-accent-red/25 text-accent-red',
    MEDIUM: 'border-accent-amber/25 text-accent-amber',
    LOW:    'border-accent-green/25 text-accent-green',
  }
  return (
    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${colors[p] ?? 'border-border text-faint'}`}>
      {p}
    </span>
  )
}

export default function RootPage() {
  return (
    <main className="min-h-screen bg-bg text-ink">

      {/* ── Nav ── */}
      <nav className="border-b border-border bg-surface/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-5 h-12 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-accent-blue/15 border border-accent-blue/30 flex items-center justify-center">
              <Cpu className="w-3.5 h-3.5 text-accent-blue" />
            </div>
            <span className="font-mono text-[11px] tracking-widest text-accent-blue uppercase">QAForge</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login"
              className="text-[12px] text-faint hover:text-muted transition-colors">
              Sign in
            </Link>
            <Link href="/dashboard"
              className="h-7 px-3 flex items-center gap-1.5 rounded bg-accent-blue/90 text-[12px] font-medium text-bg hover:bg-accent-blue transition-colors">
              <span>Open Dashboard</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="max-w-6xl mx-auto px-5 py-16 lg:py-24">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div>
            <div className="inline-flex items-center gap-2 mb-6 px-3 py-1 rounded border border-accent-blue/20 bg-accent-blue/5">
              <div className="w-1.5 h-1.5 rounded-full bg-accent-green" />
              <span className="text-[11px] font-mono text-muted uppercase tracking-widest">Contract-aware · Runtime-validated</span>
            </div>
            <h1 className="text-[36px] sm:text-[44px] font-semibold leading-[1.1] text-ink mb-4 tracking-tight">
              AI operating system for autonomous software quality
            </h1>
            <p className="text-[15px] text-faint leading-relaxed mb-8 max-w-xl">
              QAForge runs a 5-agent LangGraph pipeline against your codebase — extracting intent,
              analyzing surfaces, designing probes, executing runtime validation, and synthesizing
              a decision-ready engineering report.
            </p>
            <div className="flex flex-wrap gap-3 mb-10">
              <Link href="/dashboard"
                className="h-9 px-5 flex items-center gap-2 rounded bg-ink text-bg text-[13px] font-medium hover:bg-ink/90 transition-colors">
                Launch Dashboard
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link href="/login"
                className="h-9 px-5 flex items-center gap-2 rounded border border-border text-[13px] text-muted hover:text-ink hover:bg-s2 transition-colors">
                Connect GitHub
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: Zap,      label: 'Autonomous audits',   val: '5-agent pipeline' },
                { icon: Shield,   label: 'Runtime probes',      val: 'Contract-aware' },
                { icon: Activity, label: 'Live execution',      val: 'Streaming UX' },
              ].map(({ icon: Icon, label, val }) => (
                <div key={label} className="border border-border rounded bg-s2 p-3">
                  <Icon className="w-4 h-4 text-faint mb-2" />
                  <p className="text-[12px] font-medium text-ink">{label}</p>
                  <p className="text-[11px] text-faint font-mono mt-0.5">{val}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Hero: dashboard preview */}
          <div className="rounded border border-border bg-surface overflow-hidden shadow-panel">
            {/* Mock topbar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-s2">
              <span className="font-mono text-[11px] text-faint">qaforge / control-plane</span>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-accent-green" />
                <span className="font-mono text-[10px] text-faint">ONLINE</span>
              </div>
            </div>
            {/* Mock pipeline */}
            <div className="p-4 border-b border-border">
              <p className="text-[10px] font-mono text-faint uppercase tracking-widest mb-3">Pipeline · 5 agents</p>
              <div className="grid grid-cols-5 gap-1.5">
                {PIPELINE_STAGES.map((s, i) => (
                  <div key={s.id} className={`rounded p-2 border text-center ${
                    i < 4 ? 'border-accent-green/25 bg-accent-green/5' : 'border-accent-blue/25 bg-accent-blue/5'
                  }`}>
                    <p className="text-[9px] font-mono text-faint mb-0.5">{s.id}</p>
                    <p className="text-[10px] text-ink font-medium leading-tight">{s.name.split(' ')[0]}</p>
                    <div className="mt-1.5 h-0.5 rounded-full overflow-hidden bg-border/50">
                      <div className={`h-full rounded-full ${i < 4 ? 'bg-accent-green w-full' : 'bg-accent-blue w-3/4'}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Mock logs */}
            <div className="p-4 bg-[#050a12] font-mono text-[10px]">
              {SAMPLE_LOGS.map((log, i) => (
                <div key={i} className="flex gap-2 leading-5 mb-0.5">
                  <span className="text-faint">{log.t}</span>
                  <LogLevel level={log.level} />
                  <span className="text-faint">[{log.src}]</span>
                  <span className="text-muted truncate">{log.msg}</span>
                </div>
              ))}
              <div className="flex gap-2 text-accent-blue mt-1">
                <span className="text-faint">10:24:18</span>
                <span>›</span>
                <span>workspace ready<span className="inline-block w-1.5 h-3 bg-accent-blue ml-0.5 align-middle" /></span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pipeline section ── */}
      <section className="border-t border-border bg-surface">
        <div className="max-w-6xl mx-auto px-5 py-12">
          <div className="mb-8">
            <p className="text-[11px] font-mono text-faint uppercase tracking-widest mb-2">Architecture</p>
            <h2 className="text-[22px] font-semibold text-ink">Multi-agent execution pipeline</h2>
            <p className="text-[13px] text-faint mt-2 max-w-lg">
              Five specialized agents orchestrated by LangGraph, each producing artifacts that feed the next stage.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-5">
            {PIPELINE_STAGES.map((stage, i) => (
              <div key={stage.id} className="border border-border rounded bg-s2 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-mono text-faint">{stage.id}</span>
                  {i < 4 && <ArrowRight className="w-3 h-3 text-border" />}
                </div>
                <p className="text-[12px] font-medium text-ink leading-tight mb-1">{stage.name}</p>
                <p className="text-[11px] text-faint leading-relaxed">{stage.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Findings preview ── */}
      <section className="max-w-6xl mx-auto px-5 py-12 border-t border-border">
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <p className="text-[11px] font-mono text-faint uppercase tracking-widest mb-2">Findings Explorer</p>
            <h2 className="text-[22px] font-semibold text-ink mb-3">Actionable behavioral gaps</h2>
            <p className="text-[13px] text-faint leading-relaxed mb-6">
              Every probe result maps to an endpoint, a priority, and a suggested fix.
              Expandable rows surface full reasoning and remediation guidance.
            </p>
            <div className="border border-border rounded bg-surface overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
                <span className="text-[11px] font-mono text-faint uppercase tracking-widest">Findings · 3 detected</span>
                <div className="flex gap-1.5">
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-accent-red/25 text-accent-red">HIGH 1</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-accent-amber/25 text-accent-amber">MED 1</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-accent-green/25 text-accent-green">LOW 1</span>
                </div>
              </div>
              {SAMPLE_FINDINGS.map((f, i) => (
                <div key={i} className="px-4 py-2.5 border-b border-border/50 flex items-center gap-3 last:border-b-0 hover:bg-s2 transition-colors">
                  <PriorityBadge p={f.priority} />
                  <span className="text-[12px] font-mono text-accent-blue">{f.endpoint}</span>
                  <span className="text-[12px] text-muted">{f.classification}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Architecture diagram */}
          <div>
            <p className="text-[11px] font-mono text-faint uppercase tracking-widest mb-2">Stack</p>
            <h2 className="text-[22px] font-semibold text-ink mb-3">Full-stack AI infrastructure</h2>
            <p className="text-[13px] text-faint leading-relaxed mb-6">
              Next.js frontend consuming a FastAPI layer, backed by a LangGraph multi-agent engine,
              with Supabase for persistence and authentication.
            </p>
            <div className="border border-border rounded bg-surface overflow-hidden">
              {[
                { layer: 'qa-web',     tech: 'Next.js 15 · TypeScript',   role: 'Control plane UI',         color: 'accent-blue' },
                { layer: 'FastAPI',    tech: 'Python · Pydantic',          role: '/audit · /health',          color: 'accent-green' },
                { layer: 'LangGraph',  tech: '5-agent graph',              role: 'Orchestration engine',      color: 'accent-amber' },
                { layer: 'Supabase',   tech: 'Postgres · Auth',            role: 'Persistence · OAuth',       color: 'faint' },
              ].map((item, i, arr) => (
                <div key={item.layer}
                  className={`px-4 py-3 flex items-center gap-4 ${i < arr.length - 1 ? 'border-b border-border' : ''}`}>
                  <div className={`w-2 h-2 rounded-full bg-${item.color} flex-shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-medium text-ink">{item.layer}</span>
                      <span className="text-[11px] font-mono text-faint">{item.role}</span>
                    </div>
                    <span className="text-[11px] font-mono text-faint">{item.tech}</span>
                  </div>
                  {i < arr.length - 1 && (
                    <div className="text-border text-[16px] flex-shrink-0">↓</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="border-t border-border bg-surface">
        <div className="max-w-6xl mx-auto px-5 py-12 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-[18px] font-semibold text-ink">Ready to run your first audit?</h2>
            <p className="text-[13px] text-faint mt-1">Connect GitHub or open the dashboard with a mock session.</p>
          </div>
          <div className="flex gap-3">
            <Link href="/login"
              className="h-9 px-5 flex items-center gap-2 rounded border border-border text-[13px] text-muted hover:text-ink hover:bg-s2 transition-colors">
              <GitBranch className="w-3.5 h-3.5" />
              Connect GitHub
            </Link>
            <Link href="/dashboard"
              className="h-9 px-5 flex items-center gap-2 rounded bg-ink text-bg text-[13px] font-medium hover:bg-ink/90 transition-colors">
              Open Dashboard
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border px-5 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <span className="font-mono text-[11px] text-faint">QAForge · AI-native software quality infrastructure</span>
          <div className="flex items-center gap-2">
            <Terminal className="w-3 h-3 text-faint" />
            <span className="font-mono text-[11px] text-faint">v0.2.0</span>
          </div>
        </div>
      </footer>
    </main>
  )
}
