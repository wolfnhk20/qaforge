'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ApiError, getAuditById, getAuditLogs, listAudits } from '@/services/api'
import type { AuditHistoryRecord, AuditResponse, Logs } from '@/types'
import { createId } from '@/lib/utils'

export function useAuditHistory() {
  const query = useQuery<AuditHistoryRecord[]>({
    queryKey: ['audit-history'],
    queryFn: async () => {
      try {
        return await listAudits(50)
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return []
        throw err
      }
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  })

  return {
    audits: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isFetching: query.isFetching,
  }
}

export function useAuditDetail(auditId: number | null) {
  const auditQuery = useQuery<AuditResponse | null>({
    queryKey: ['audit-detail', auditId],
    queryFn: async () => {
      if (!auditId) return null
      try {
        return await getAuditById(auditId)
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null
        throw err
      }
    },
    enabled: !!auditId,
    staleTime: 60_000,
  })

  const logsQuery = useQuery<Logs[]>({
    queryKey: ['audit-logs', auditId],
    queryFn: async () => {
      if (!auditId) return []
      try {
        const raw = await getAuditLogs(auditId)
        return raw.map((l: any) => ({
          id: l.id?.toString() ?? createId('log'),
          timestamp: l.created_at ?? new Date().toISOString(),
          level: (l.level ?? 'info') as Logs['level'],
          source: l.payload?.agent ?? 'Engine',
          message: l.message ?? '',
          details: l.payload ? JSON.stringify(l.payload) : undefined,
        }))
      } catch {
        return []
      }
    },
    enabled: !!auditId,
    staleTime: 60_000,
  })

  return {
    audit: auditQuery.data ?? null,
    logs: logsQuery.data ?? [],
    isLoadingAudit: auditQuery.isLoading,
    isLoadingLogs: logsQuery.isLoading,
    isError: auditQuery.isError,
  }
}
