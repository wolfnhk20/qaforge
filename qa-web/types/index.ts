export interface AuditHistoryRecord {
  id: number
  repo: string
  module: string
  status: 'completed' | 'running' | 'error'
  probe_count: number
  findings: Findings[]
  origin: 'manual' | 'github_push'
  created_at: string
  report_markdown?: string
}

export interface AuditScope = 'full_module' | 'pr' | 'commit_range'

export type PipelineStageStatus =
  | 'idle'
  | 'pending'
  | 'running'
  | 'completed'
  | 'error'

export type LogLevel = 'info' | 'success' | 'warning' | 'error'

export interface Findings {
  probe_id: string
  endpoint: string
  priority: string
  classification: string
  reasoning: string
  suggested_fix: string
  case_id: string
}

export type Finding = Findings

export interface AuditResponse {
  audit_id: number | null
  status: string
  repo: string
  probe_count: number
  findings: Findings[]
  report_markdown: string
  report_path: string
  origin?: 'manual' | 'github_push'
}

export interface WebhookConfig {
  enabled: boolean
  webhook_id?: number
  staging_url?: string
  branch?: string
  created_at?: string
  updated_at?: string
  last_push_received?: string
  last_auto_audit?: string
}


export interface Repo {
  fullName: string
  module: string
  branch: string
  scope: AuditScope
  prNumber?: number
  baseCommit?: string
  headCommit?: string
  baseUrl?: string
}

export interface AuditRequestPayload {
  repo: string
  module: string
  branch: string
  scope: AuditScope
  pr_number?: number
  base_commit?: string
  head_commit?: string
  base_url?: string
  github_token?: string
}

export interface PipelineStage {
  id: string
  label: string
  agent: string
  description: string
  status: PipelineStageStatus
  progress: number
  startedAt?: string
  completedAt?: string
  durationMs?: number
  detail?: string
}

export interface Logs {
  id: string
  timestamp: string
  level: LogLevel
  source: string
  message: string
  stageId?: string
  details?: string
}

export type LogEntry = Logs
export type LogEntries = Logs[]

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'offline'
  checkedAt: string
  latencyMs?: number
  message?: string
}

export interface BackendHealthResponse {
  status: string
}

export interface MarkdownHeading {
  id: string
  level: number
  title: string
}

export interface AuthUser {
  id: string
  email?: string
  full_name?: string
  user_name?: string
  avatar_url?: string
}

export interface AuthSession {
  access_token: string
  refresh_token: string
  expires_at: number
  token_type?: string
  user: AuthUser | null
  provider_token?: string
  provider_refresh_token?: string
}
