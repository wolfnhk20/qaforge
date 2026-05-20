import type {
  AuditRequestPayload,
  AuditResponse,
  BackendHealthResponse,
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
  return process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_API_BASE
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

export function getLatestAudit() {
  return request<AuditResponse>('/audit/latest').then((response) => ({
    ...response,
    audit_id: response.audit_id ?? null,
  }))
}
