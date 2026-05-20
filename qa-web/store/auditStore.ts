import { create } from 'zustand'

import { createId, createPipelineStages, DEFAULT_REPO } from '@/lib/utils'
import type { AuditResponse, Findings, Logs, PipelineStage, Repo } from '@/types'

type AuditPhase = 'idle' | 'hydrating' | 'running' | 'completed' | 'error'

interface AuditStoreState {
  repoDraft: Repo
  activeAudit: AuditResponse | null
  latestAudit: AuditResponse | null
  findings: Findings[]
  reportMarkdown: string
  reportPath: string
  logs: Logs[]
  pipelineStages: PipelineStage[]
  selectedFindingId: string | null
  phase: AuditPhase
  isLaunching: boolean
  isFetchingLatest: boolean
  lastCompletedAt: string | null
  errorMessage: string | null
  setRepoDraft: (patch: Partial<Repo>) => void
  resetRuntime: () => void
  setFetchingLatest: (value: boolean) => void
  hydrateLatestAudit: (audit: AuditResponse) => void
  startAuditRun: (repoDraft: Repo) => void
  appendLog: (log: Omit<Logs, 'id' | 'timestamp'> & { timestamp?: string }) => void
  updateStage: (stageId: string, patch: Partial<PipelineStage>) => void
  completeAuditRun: (audit: AuditResponse) => void
  failAuditRun: (message: string) => void
  setSelectedFindingId: (value: string | null) => void
  appendFindings: (newFindings: Findings[]) => void
}

export const useAuditStore = create<AuditStoreState>((set) => ({
  repoDraft: DEFAULT_REPO,
  activeAudit: null,
  latestAudit: null,
  findings: [],
  reportMarkdown: '',
  reportPath: '',
  logs: [],
  pipelineStages: createPipelineStages(),
  selectedFindingId: null,
  phase: 'idle',
  isLaunching: false,
  isFetchingLatest: false,
  lastCompletedAt: null,
  errorMessage: null,
  setRepoDraft: (patch) =>
    set((state) => ({
      repoDraft: {
        ...state.repoDraft,
        ...patch,
      },
    })),
  resetRuntime: () =>
    set({
      activeAudit: null,
      findings: [],
      reportMarkdown: '',
      reportPath: '',
      logs: [],
      pipelineStages: createPipelineStages(),
      selectedFindingId: null,
      phase: 'idle',
      isLaunching: false,
      errorMessage: null,
    }),
  setFetchingLatest: (value) => set({ isFetchingLatest: value }),
  hydrateLatestAudit: (audit) =>
    set((state) => ({
      latestAudit: audit,
      activeAudit: state.phase === 'running' ? state.activeAudit : audit,
      findings: state.phase === 'running' ? state.findings : audit.findings,
      reportMarkdown:
        state.phase === 'running' ? state.reportMarkdown : audit.report_markdown,
      reportPath: state.phase === 'running' ? state.reportPath : audit.report_path,
      phase: state.phase === 'running' ? state.phase : 'completed',
      pipelineStages:
        state.phase === 'running'
          ? state.pipelineStages
          : createPipelineStages().map((stage) => ({
              ...stage,
              status: 'completed',
              progress: 100,
            })),
      logs:
        state.phase === 'running'
          ? state.logs
          : [
              {
                id: createId('log'),
                timestamp: new Date().toISOString(),
                level: 'success',
                source: 'Persistence',
                message: `Loaded latest audit snapshot for ${audit.repo || 'recent repository'}.`,
                details: audit.audit_id
                  ? `Supabase audit #${audit.audit_id} hydrated into the workspace.`
                  : 'Local artifact fallback loaded from backend outputs.',
              },
            ],
      lastCompletedAt: new Date().toISOString(),
      errorMessage: null,
    })),
  startAuditRun: (repoDraft) =>
    set({
      repoDraft,
      activeAudit: null,
      findings: [],
      reportMarkdown: '',
      reportPath: '',
      logs: [
        {
          id: createId('log'),
          timestamp: new Date().toISOString(),
          level: 'info',
          source: 'Control Plane',
          message: `Queued audit for ${repoDraft.fullName}.`,
          details: `Scope: ${repoDraft.scope} · Module: ${repoDraft.module} · Branch: ${repoDraft.branch}`,
        },
      ],
      pipelineStages: createPipelineStages(),
      selectedFindingId: null,
      phase: 'running',
      isLaunching: true,
      errorMessage: null,
    }),
  appendLog: (log) =>
    set((state) => ({
      logs: [
        ...state.logs,
        {
          id: createId('log'),
          timestamp: log.timestamp || new Date().toISOString(),
          ...log,
        },
      ],
    })),
  updateStage: (stageId, patch) =>
    set((state) => ({
      pipelineStages: state.pipelineStages.map((stage) =>
        stage.id === stageId ? { ...stage, ...patch } : stage,
      ),
    })),
  completeAuditRun: (audit) =>
    set((state) => ({
      activeAudit: audit,
      latestAudit: audit,
      findings: audit.findings,
      reportMarkdown: audit.report_markdown,
      reportPath: audit.report_path,
      pipelineStages: state.pipelineStages.map((stage) => ({
        ...stage,
        status: stage.status === 'error' ? stage.status : 'completed',
        progress: 100,
        completedAt: stage.completedAt || new Date().toISOString(),
        durationMs:
          stage.durationMs ||
          (stage.startedAt
            ? Math.max(800, Date.now() - new Date(stage.startedAt).getTime())
            : undefined),
      })),
      phase: 'completed',
      isLaunching: false,
      lastCompletedAt: new Date().toISOString(),
      errorMessage: null,
    })),
  failAuditRun: (message) =>
    set((state) => ({
      phase: 'error',
      isLaunching: false,
      errorMessage: message,
      pipelineStages: state.pipelineStages.map((stage, index) => {
        if (stage.status === 'running') {
          return {
            ...stage,
            status: 'error',
            detail: message,
          }
        }

        if (stage.status === 'pending' && index === 0) {
          return {
            ...stage,
            status: 'error',
            detail: message,
          }
        }

        return stage
      }),
    })),
  setSelectedFindingId: (value) => set({ selectedFindingId: value }),
  appendFindings: (newFindings) =>
    set((state) => {
      const existingIds = new Set(state.findings.map((f) => f.case_id))
      const filtered = newFindings.filter((f) => f.case_id && !existingIds.has(f.case_id))
      if (filtered.length === 0) return {}
      return {
        findings: [...state.findings, ...filtered],
      }
    }),
}))

