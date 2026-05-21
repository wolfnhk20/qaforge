import type {
  AuditHistoryRecord,
  AuditRequestPayload,
  AuditResponse,
  BackendHealthResponse,
  WebhookConfig,
} from '@/types'


const DEFAULT_API_BASE = '/api/backend'

export class ApiError extends Error {
  status: number
  payload: unknown

  constructor(message: string, status: number, payload: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }
}

function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_BASE
}

async function parseErrorPayload(response: Response) {
  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    return response.json()
  }

  return response.text()
}

function getErrorMessage(payload: unknown, fallback: string) {
  if (!payload) {
    return fallback
  }

  if (typeof payload === 'string') {
    return payload
  }

  if (typeof payload === 'object' && payload !== null) {
    const record = payload as Record<string, unknown>
    const detail = record.detail

    if (typeof detail === 'string') {
      return detail
    }

    if (detail && typeof detail === 'object') {
      const nested = detail as Record<string, unknown>
      if (typeof nested.message === 'string') {
        return nested.message
      }
    }

    if (typeof record.message === 'string') {
      return record.message
    }
  }

  return fallback
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    const payload = await parseErrorPayload(response)
    throw new ApiError(
      getErrorMessage(payload, `Request failed with status ${response.status}.`),
      response.status,
      payload,
    )
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

export function getHealth() {
  return request<BackendHealthResponse>('/health')
}

export function startAudit(payload: AuditRequestPayload) {
  return request<AuditResponse>('/audit', {
    method: 'POST',
    body: JSON.stringify(payload),
  }).then((response) => ({
    ...response,
    audit_id: response.audit_id ?? null,
  }))
}

export async function streamAudit(
  payload: AuditRequestPayload,
  onEvent: (event: { type: string; data: any }) => void
): Promise<void> {
  const url = `${getApiBaseUrl()}/audit/stream`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const contentType = response.headers.get('content-type') || ''
    let message = `Request failed with status ${response.status}.`
    try {
      if (contentType.includes('application/json')) {
        const err = await response.json()
        message = err.detail?.message || err.detail || message
      } else {
        const text = await response.text()
        message = text || message
      }
    } catch {}
    throw new Error(message)
  }

  if (!response.body) {
    throw new Error('Response body is not readable.')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data: ')) continue

        const jsonStr = trimmed.slice(6)
        try {
          const event = JSON.parse(jsonStr)
          onEvent(event)
        } catch (err) {
          console.error('Failed to parse SSE line:', trimmed, err)
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

export function getLatestAudit() {
  return request<AuditResponse>('/audit/latest').then((response) => ({
    ...response,
    audit_id: response.audit_id ?? null,
  }))
}

export function getWebhookConfig(owner: string, repo: string) {
  return request<WebhookConfig>(`/repos/${owner}/${repo}/webhook`)
}

export function saveRepositoryConfig(
  owner: string,
  repo: string,
  options: {
    stagingUrl: string
    branch?: string
    createdBy?: string
  }
) {
  return request<{
    status: string
    repo: string
    staging_url: string
    branch: string
    webhook_enabled: boolean
  }>(`/repos/${owner}/${repo}/config`, {
    method: 'PUT',
    body: JSON.stringify({
      staging_url: options.stagingUrl,
      branch: options.branch,
      created_by: options.createdBy,
    }),
  })
}

export function toggleWebhook(
  owner: string,
  repo: string,
  githubToken: string,
  action: 'enable' | 'disable',
  options?: {
    stagingUrl?: string
    branch?: string
    createdBy?: string
  }
) {
  return request<{ status: string; message: string; webhook_id?: number }>(
    `/repos/${owner}/${repo}/webhook`,
    {
      method: 'POST',
      body: JSON.stringify({
        github_token: githubToken,
        action,
        staging_url: options?.stagingUrl,
        branch: options?.branch,
        created_by: options?.createdBy,
      }),
    }
  )
}

export function listAudits(limit = 50) {
  return request<AuditHistoryRecord[]>(`/audits?limit=${limit}`)
}

export function getAuditById(auditId: number) {
  return request<AuditResponse>(`/audit/${auditId}`).then((r) => ({
    ...r,
    audit_id: r.audit_id ?? null,
  }))
}

export function getAuditLogs(auditId: number) {
  return request<any[]>(`/audit/${auditId}/logs`)
}

