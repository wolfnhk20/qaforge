'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { PIPELINE_BLUEPRINT } from '@/lib/utils'
import { ApiError, getLatestAudit, startAudit } from '@/services/api'
import { useAuditStore } from '@/store/auditStore'
import type { AuditRequestPayload, AuditResponse, Repo } from '@/types'

const ACTIVE_LOGS = [
  'Scanning repository signals and runtime assumptions.',
  'Tracing executable paths across the requested module.',
  'Pressure-testing generated probes against the behavioral contract.',
  'Synthesizing remediation-ready output for engineering review.',
] as const

export function useAudit() {
  const queryClient = useQueryClient()
  const timersRef = useRef<number[]>([])

  const repoDraft = useAuditStore((state) => state.repoDraft)
  const activeAudit = useAuditStore((state) => state.activeAudit)
  const latestAudit = useAuditStore((state) => state.latestAudit)
  const findings = useAuditStore((state) => state.findings)
  const reportMarkdown = useAuditStore((state) => state.reportMarkdown)
  const reportPath = useAuditStore((state) => state.reportPath)
  const logs = useAuditStore((state) => state.logs)
  const pipelineStages = useAuditStore((state) => state.pipelineStages)
  const selectedFindingId = useAuditStore((state) => state.selectedFindingId)
  const phase = useAuditStore((state) => state.phase)
  const isLaunching = useAuditStore((state) => state.isLaunching)
  const isFetchingLatest = useAuditStore((state) => state.isFetchingLatest)
  const lastCompletedAt = useAuditStore((state) => state.lastCompletedAt)
  const errorMessage = useAuditStore((state) => state.errorMessage)
  const setFetchingLatest = useAuditStore((state) => state.setFetchingLatest)
  const hydrateLatestAudit = useAuditStore((state) => state.hydrateLatestAudit)
  const startAuditRun = useAuditStore((state) => state.startAuditRun)
  const appendLog = useAuditStore((state) => state.appendLog)
  const updateStage = useAuditStore((state) => state.updateStage)
  const completeAuditRun = useAuditStore((state) => state.completeAuditRun)
  const failAuditRun = useAuditStore((state) => state.failAuditRun)
  const setSelectedFindingId = useAuditStore((state) => state.setSelectedFindingId)

  const latestAuditQuery = useQuery<AuditResponse | null>({
    queryKey: ['latest-audit'],
    queryFn: async () => {
      try {
        return await getLatestAudit()
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return null
        }
        throw error
      }
    },
    staleTime: 20_000,
    refetchInterval: 45_000,
  })

  useEffect(() => {
    setFetchingLatest(latestAuditQuery.isFetching)
  }, [latestAuditQuery.isFetching, setFetchingLatest])

  useEffect(() => {
    if (latestAuditQuery.data) {
      hydrateLatestAudit(latestAuditQuery.data)
    }
  }, [hydrateLatestAudit, latestAuditQuery.data])

  const clearSimulation = () => {
    for (const timer of timersRef.current) {
      window.clearTimeout(timer)
    }
    timersRef.current = []
  }

  useEffect(() => clearSimulation, [])

  const startSimulation = () => {
    clearSimulation()

    let elapsed = 120

    PIPELINE_BLUEPRINT.forEach((stage, index) => {
      const startTimer = window.setTimeout(() => {
        const now = new Date().toISOString()
        updateStage(stage.id, {
          status: 'running',
          progress: 52,
          startedAt: now,
        })
        appendLog({
          level: 'info',
          source: stage.agent,
          stageId: stage.id,
          message: ACTIVE_LOGS[index] || stage.description,
          details: stage.description,
        })
      }, elapsed)

      timersRef.current.push(startTimer)
      elapsed += stage.durationMs

      const completeTimer = window.setTimeout(() => {
        updateStage(stage.id, {
          status: 'completed',
          progress: 100,
          completedAt: new Date().toISOString(),
          durationMs: stage.durationMs,
          detail:
            index === PIPELINE_BLUEPRINT.length - 1
              ? 'Final narrative assembled.'
              : 'Artifacts promoted to the next stage.',
        })
        appendLog({
          level: 'success',
          source: stage.agent,
          stageId: stage.id,
          message:
            index === PIPELINE_BLUEPRINT.length - 1
              ? 'Engineering report finalized and ready for review.'
              : `${stage.label} completed.`,
          details: `Duration: ${(stage.durationMs / 1000).toFixed(1)}s`,
        })
      }, elapsed)

      timersRef.current.push(completeTimer)
      elapsed += 220
    })
  }

  const launchMutation = useMutation({
    mutationFn: (payload: AuditRequestPayload) => startAudit(payload),
    onSuccess: (data) => {
      clearSimulation()
      completeAuditRun(data)
      appendLog({
        level: 'success',
        source: 'FastAPI',
        message: `Audit completed with ${data.findings.length} findings across ${data.probe_count} probes.`,
        details: data.audit_id
          ? `Persisted as audit #${data.audit_id} and synced into the workspace.`
          : 'Returned without a persisted audit id.',
      })
      queryClient.setQueryData(['latest-audit'], data)
    },
    onError: (error) => {
      clearSimulation()
      const message =
        error instanceof Error ? error.message : 'Audit execution failed.'
      failAuditRun(message)
      appendLog({
        level: 'error',
        source: 'FastAPI',
        message,
        details:
          error instanceof ApiError
            ? `Backend responded with status ${error.status}.`
            : 'Unexpected client-side failure while awaiting audit response.',
      })
    },
  })

  const launchAudit = async (repo: Repo) => {
    const payload: AuditRequestPayload = {
      repo: repo.fullName,
      module: repo.module,
      branch: repo.branch,
      scope: repo.scope,
      pr_number: repo.prNumber,
      base_commit: repo.baseCommit,
      head_commit: repo.headCommit,
    }

    startAuditRun(repo)
    startSimulation()

    try {
      await launchMutation.mutateAsync(payload)
    } catch {
      return
    }
  }

  const selectedFinding = useMemo(
    () => findings.find((finding) => finding.case_id === selectedFindingId) || null,
    [findings, selectedFindingId],
  )

  return {
    repoDraft,
    activeAudit,
    latestAudit,
    findings,
    reportMarkdown,
    reportPath,
    logs,
    pipelineStages,
    selectedFindingId,
    phase,
    isLaunching,
    isFetchingLatest,
    lastCompletedAt,
    errorMessage,
    setSelectedFindingId,
    selectedFinding,
    latestAuditQuery,
    launchMutation,
    launchAudit,
    refreshLatest: latestAuditQuery.refetch,
  }
}
