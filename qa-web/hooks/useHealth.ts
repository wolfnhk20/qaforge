'use client'

import { useQuery } from '@tanstack/react-query'

import { getHealth } from '@/services/api'
import type { HealthStatus } from '@/types'

export function useHealth() {
  return useQuery<HealthStatus>({
    queryKey: ['health'],
    queryFn: async () => {
      const startedAt = performance.now()
      const response = await getHealth()
      const latencyMs = Math.round(performance.now() - startedAt)

      return {
        status: response.status === 'ok' ? 'ok' : 'degraded',
        checkedAt: new Date().toISOString(),
        latencyMs,
        message:
          response.status === 'ok'
            ? 'FastAPI control plane reachable.'
            : 'Backend responded with a degraded health signal.',
      }
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
    retry: 1,
  })
}
