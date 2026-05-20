'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuth } from '@/lib/auth'
import { PIPELINE_BLUEPRINT } from '@/lib/utils'
import { ApiError, getLatestAudit, streamAudit, getAuditLogs } from '@/services/api'
import { useAuditStore } from '@/store/auditStore'
import type { AuditRequestPayload, AuditResponse, Repo } from '@/types'

const ACTIVE_LOGS = [
  'Scanning repository signals and runtime assumptions.',
  'Tracing executable paths across the requested module.',
  'Pressure-testing generated probes against the behavioral contract.',
  'Synthesizing remediation-ready output for engineering review.',
] as const

const TELEMETRY_LOGS: Record<string, string[]> = {
  intent: [
    'Analyzing repository configuration manifests...',
    'Locating framework dependencies and bootstrap components...',
    'Mapping route structure and API surface vectors...',
    'Deconstructing input sanitization schemas...',
    'Evaluating user authorization barriers...'
  ],
  analysis: [
    'Traversing Abstract Syntax Tree (AST) node clusters...',
    'Analyzing control flow graph pathing...',
    'Tracing untrusted data flows (taint analysis)...',
    'Auditing critical functions for input boundaries...',
    'Detecting potential memory or race-condition indicators...'
  ],
  design: [
    'Generating edge-case payload designs...',
    'Modeling HTTP parameter injection vectors...',
    'Creating adversarial boundary fuzzer payloads...',
    'Simulating payload responses against standard servers...',
    'Refining validation bypass patterns...'
  ],
  execution: [
    'Provisioning local execution environment...',
    'Spawning sandbox worker processes...',
    'Dispatching adversarial probe payloads...',
    'Measuring latency and error classification metrics...',
    'Recording server response signatures...'
  ],
  report: [
    'Consolidating probe execution matrices...',
    'Re-calculating component trust score metric...',
    'Correlating discovered gap classifications...',
    'Synthesizing remediation action plans...',
    'Writing engineering-ready report markdown...'
  ]
}

export function useAudit() {
  const queryClient = useQueryClient()
  const telemetryIntervalRef = useRef<number | null>(null)
  const { session } = useAuth()


  const repoDraft = useAuditStore((state) => state.repoDraft)
  const setRepoDraft = useAuditStore((state) => state.setRepoDraft)
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
  const appendFindings = useAuditStore((state) => state.appendFindings)


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
    staleTime: 1000,
    refetchInterval: 3000, // Poll every 3 seconds to sync backend state immediately
  })

  useEffect(() => {
    setFetchingLatest(latestAuditQuery.isFetching)
  }, [latestAuditQuery.isFetching, setFetchingLatest])

  const clearTelemetryInterval = () => {
    if (telemetryIntervalRef.current !== null) {
      window.clearInterval(telemetryIntervalRef.current)
      telemetryIntervalRef.current = null
    }
  }

  useEffect(() => {
    return () => clearTelemetryInterval()
  }, [])

  const isStreamingSSE = useRef(false)

  const stageOrder = useMemo(() => ['intent', 'analysis', 'design', 'execution', 'report'], [])

  const mapLogToStage = useMemo(() => (agent: string, message: string) => {
    const cleanAgent = (agent || '').trim()
    const cleanMsg = (message || '').trim()

    if (cleanMsg.includes('Starting Agent 1') || cleanAgent === 'Intent Extractor') {
      return { stageId: 'intent', status: cleanMsg.includes('done') || cleanMsg.includes('ready') ? 'completed' : 'running' }
    }
    if (cleanMsg.includes('Starting Agent 2') || cleanAgent === 'Code Analyst') {
      return { stageId: 'analysis', status: cleanMsg.includes('done') || cleanMsg.includes('ready') ? 'completed' : 'running' }
    }
    if (cleanMsg.includes('Starting Agent 3') || cleanAgent === 'Probe Designer') {
      return { stageId: 'design', status: cleanMsg.includes('done') || cleanMsg.includes('plan complete') ? 'completed' : 'running' }
    }
    if (cleanMsg.includes('Executing probe') || cleanAgent === 'Probe Executor' || cleanAgent.startsWith('P') || cleanMsg.includes('Running probes') || cleanMsg.includes('All probes complete')) {
      return { stageId: 'execution', status: cleanMsg.includes('All probes complete') || cleanMsg.includes('Done.') ? 'completed' : 'running' }
    }
    if (cleanMsg.includes('Starting Agent 5') || cleanAgent === 'Report Synthesizer') {
      return { stageId: 'report', status: cleanMsg.includes('done') || cleanMsg.includes('report.md written') ? 'completed' : 'running' }
    }
    return null
  }, [])

  const initialAuditIdRef = useRef<number | null | undefined>(undefined)

  // Sync initialAuditIdRef with currently running or loaded audit
  useEffect(() => {
    const currentId = activeAudit?.audit_id || latestAudit?.audit_id
    if (currentId && initialAuditIdRef.current !== currentId) {
      initialAuditIdRef.current = currentId
    }
  }, [activeAudit?.audit_id, latestAudit?.audit_id])

  // Automatically detect and transition when a background/webhook audit runs
  useEffect(() => {
    const data = latestAuditQuery.data
    if (!data) return

    // Capture the latest audit ID on first load to keep dashboard in clean idle state
    if (initialAuditIdRef.current === undefined) {
      initialAuditIdRef.current = data.audit_id
      return
    }

    // A new audit started/finished on the backend
    if (data.audit_id && data.audit_id !== initialAuditIdRef.current) {
      initialAuditIdRef.current = data.audit_id
      if (data.status === 'running') {
        useAuditStore.setState({
          repoDraft: {
            fullName: data.repo,
            module: '.',
            branch: 'main',
            scope: 'commit_range',
          },
          activeAudit: data,
          phase: 'running',
          isLaunching: true,
          findings: data.findings || [],
          reportMarkdown: '',
          reportPath: '',
        })
      } else if (data.status === 'completed' || data.status === 'error') {
        hydrateLatestAudit(data)
      }
    }
  }, [latestAuditQuery.data, hydrateLatestAudit])

  // Polling loop for background/webhook-triggered audits
  useEffect(() => {
    if (phase !== 'running' || isStreamingSSE.current || !activeAudit?.audit_id) return

    let active = true
    const auditId = activeAudit.audit_id

    const poll = async () => {
      try {
        const fetchedLogs = await getAuditLogs(auditId)
        if (!active) return

        const mappedLogs = fetchedLogs.map((log: any) => ({
          id: log.id?.toString() || log.created_at || Math.random().toString(),
          timestamp: log.created_at || new Date().toISOString(),
          level: log.level as any,
          source: log.payload?.agent || 'Engine',
          message: log.message,
        }))

        useAuditStore.setState({ logs: mappedLogs })

        const now = new Date().toISOString()
        fetchedLogs.forEach((log: any) => {
          const stageInfo = mapLogToStage(log.payload?.agent || '', log.message)
          if (stageInfo) {
            const { stageId, status } = stageInfo
            if (status === 'running') {
              updateStage(stageId, {
                status: 'running',
                progress: 75,
                startedAt: log.created_at || now,
              })
              const currentIndex = stageOrder.indexOf(stageId)
              for (let i = 0; i < currentIndex; i++) {
                const prevId = stageOrder[i]
                updateStage(prevId, {
                  status: 'completed',
                  progress: 100,
                  completedAt: log.created_at || now,
                })
              }
            } else if (status === 'completed') {
              updateStage(stageId, {
                status: 'completed',
                progress: 100,
                completedAt: log.created_at || now,
              })
            }
          }
        })

        const latest = await getLatestAudit()
        if (!active) return

        if (latest && latest.audit_id === auditId) {
          if (latest.findings && latest.findings.length > 0) {
            useAuditStore.setState({ findings: latest.findings })
          }

          if (latest.status === 'completed') {
            completeAuditRun(latest)
            appendLog({
              level: 'success',
              source: 'Control Plane',
              message: `Auto Audit completed successfully. ${latest.findings.length} findings surfaced.`,
              details: `Supabase audit record #${latest.audit_id} finalized.`,
            })
            queryClient.setQueryData(['latest-audit'], latest)
          } else if (latest.status === 'error') {
            failAuditRun('Auto Audit run failed.')
            appendLog({
              level: 'error',
              source: 'Engine',
              message: 'Auto Audit run failed.',
              details: 'Details available in repository execution logs.',
            })
            queryClient.setQueryData(['latest-audit'], latest)
          }
        }
      } catch (err) {
        console.error('Polling error in useAudit:', err)
      }
    }

    void poll()
    const interval = window.setInterval(() => {
      void poll()
    }, 2500)

    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [phase, activeAudit?.audit_id, stageOrder, mapLogToStage, completeAuditRun, failAuditRun, appendLog, queryClient, updateStage])

  const launchAudit = async (repo: Repo) => {
    isStreamingSSE.current = true
    const repoPattern = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/
    if (!repo.fullName || !repoPattern.test(repo.fullName.trim())) {
      failAuditRun('Invalid repository. Repository must be in "owner/repo" format.')
      appendLog({
        level: 'error',
        source: 'Validation',
        message: 'Invalid repository format.',
        details: 'Expected format: owner/repo',
      })
      isStreamingSSE.current = false
      return
    }

    if (repo.scope === 'pr') {
      if (!repo.prNumber || Number.isNaN(repo.prNumber) || repo.prNumber <= 0) {
        failAuditRun('Pull Request number is required and must be positive when scope is "Pull request".')
        appendLog({
          level: 'error',
          source: 'Validation',
          message: 'Missing or invalid PR number.',
          details: 'Scope set to "pr" but no valid PR number was provided.',
        })
        isStreamingSSE.current = false
        return
      }
    }

    if (repo.scope === 'commit_range') {
      if (!repo.baseCommit?.trim() || !repo.headCommit?.trim()) {
        failAuditRun('Base and head commit SHAs are required when scope is "Commit range".')
        appendLog({
          level: 'error',
          source: 'Validation',
          message: 'Missing commit range parameters.',
          details: 'Scope set to "commit_range" but base_commit or head_commit is empty.',
        })
        isStreamingSSE.current = false
        return
      }
    }

    const stagingUrl = repo.baseUrl?.trim()
    if (!stagingUrl) {
      failAuditRun('Staging base URL is required for runtime probe execution.')
      appendLog({
        level: 'error',
        source: 'Validation',
        message: 'Missing staging base URL.',
        details: 'Enter the deployed API base URL in the audit launcher before running.',
      })
      isStreamingSSE.current = false
      return
    }

    try {
      const parsed = new URL(stagingUrl.includes('://') ? stagingUrl : `https://${stagingUrl}`)
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('invalid protocol')
      }
      if (!parsed.hostname) {
        throw new Error('missing hostname')
      }
    } catch {
      failAuditRun('Staging base URL is invalid. Use http(s)://host[:port] format.')
      appendLog({
        level: 'error',
        source: 'Validation',
        message: 'Invalid staging base URL.',
        details: `Could not parse: ${stagingUrl}`,
      })
      isStreamingSSE.current = false
      return
    }

    const payload: AuditRequestPayload = {
      repo: repo.fullName.trim(),
      module: repo.module,
      branch: repo.branch,
      scope: repo.scope,
      pr_number: repo.prNumber,
      base_commit: repo.baseCommit?.trim(),
      head_commit: repo.headCommit?.trim(),
      base_url: stagingUrl,
      github_token: session?.provider_token,
    }

    startAuditRun(repo)

    clearTelemetryInterval()
    let lastMsgIndex = -1
    telemetryIntervalRef.current = window.setInterval(() => {
      const activeStage = useAuditStore.getState().pipelineStages.find((s) => s.status === 'running')
      if (!activeStage) return

      const nextProgress = Math.min(95, activeStage.progress + Math.floor(Math.random() * 4) + 2)
      updateStage(activeStage.id, { progress: nextProgress })

      const pool = TELEMETRY_LOGS[activeStage.id] || []
      if (pool.length > 0) {
        let idx = Math.floor(Math.random() * pool.length)
        if (idx === lastMsgIndex) {
          idx = (idx + 1) % pool.length
        }
        lastMsgIndex = idx
        appendLog({
          level: 'info',
          source: activeStage.agent,
          message: pool[idx],
        })
      }
    }, 1800)

    try {
      await streamAudit(payload, (event) => {
        if (event.type === 'log') {
          const logData = event.data
          const isError = logData.message.toLowerCase().includes('error')
          const isSuccess =
            logData.message.toLowerCase().includes('done') ||
            logData.message.toLowerCase().includes('complete') ||
            logData.message.toLowerCase().includes('final answer')

          appendLog({
            level: isError ? 'error' : isSuccess ? 'success' : 'info',
            source: logData.agent || 'Engine',
            message: logData.message,
            timestamp: logData.timestamp ? new Date().toISOString() : undefined,
          })

          const stageInfo = mapLogToStage(logData.agent, logData.message)
          if (stageInfo) {
            const { stageId, status } = stageInfo
            const now = new Date().toISOString()
            if (status === 'running') {
              updateStage(stageId, {
                status: 'running',
                progress: 50,
                startedAt: now,
              })
              const currentIndex = stageOrder.indexOf(stageId)
              for (let i = 0; i < currentIndex; i++) {
                const prevId = stageOrder[i]
                updateStage(prevId, {
                  status: 'completed',
                  progress: 100,
                  completedAt: now,
                })
              }
            } else if (status === 'completed') {
              updateStage(stageId, {
                status: 'completed',
                progress: 100,
                completedAt: now,
              })
            }
          }
        } else if (event.type === 'findings') {
          appendFindings(event.data)
        } else if (event.type === 'complete') {
          clearTelemetryInterval()
          const auditResponse = event.data
          completeAuditRun(auditResponse)
          appendLog({
            level: 'success',
            source: 'Control Plane',
            message: `Audit completed successfully. ${auditResponse.findings.length} findings surfaced.`,
            details: auditResponse.audit_id
              ? `Supabase audit record #${auditResponse.audit_id} generated.`
              : 'Local audit artifacts saved.',
          })
          queryClient.setQueryData(['latest-audit'], auditResponse)
        } else if (event.type === 'error') {
          clearTelemetryInterval()
          const errData = event.data
          const errMsg = errData.message || 'Audit execution failed.'
          failAuditRun(errMsg)
          appendLog({
            level: 'error',
            source: 'Engine',
            message: errMsg,
            details: errData.errors?.join('; ') || '',
          })
        }
      })
    } catch (error: any) {
      clearTelemetryInterval()
      const errMsg = error.message || 'Unexpected streaming error occurred.'
      failAuditRun(errMsg)
      appendLog({
        level: 'error',
        source: 'Control Plane',
        message: errMsg,
      })
    } finally {
      isStreamingSSE.current = false
    }
  }

  const selectedFinding = useMemo(
    () => findings.find((finding) => finding.case_id === selectedFindingId) || null,
    [findings, selectedFindingId],
  )

  return {
    repoDraft,
    setRepoDraft,
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
    launchAudit,
    refreshLatest: latestAuditQuery.refetch,
  }
}

