export const connectorAuthModes = [
  'none',
  'api_key',
  'bearer_token',
  'oauth',
  'cookie_jar',
  'browser_session',
  'username_password',
] as const

export type ConnectorAuthMode = (typeof connectorAuthModes)[number]

export const connectorRunModes = ['manual', 'scheduled', 'catch_up'] as const

export type ConnectorRunMode = (typeof connectorRunModes)[number]

export const connectorRunStatuses = [
  'queued',
  'running',
  'completed',
  'partial_success',
  'failed',
  'cancelled',
  'skipped',
] as const

export type ConnectorRunStatus = (typeof connectorRunStatuses)[number]

export const connectorStatusSeverities = ['healthy', 'warning', 'blocked'] as const

export type ConnectorStatusSeverity = (typeof connectorStatusSeverities)[number]

export const connectorStatusStates = [
  'auth_required',
  'blocked',
  'cancelled',
  'failed',
  'healthy',
  'never_run',
  'no_jobs',
  'partial_success',
  'queued',
  'running',
  'skipped',
] as const

export type ConnectorStatusState = (typeof connectorStatusStates)[number]

export const connectorActionRequiredKinds = [
  'auth',
  'captcha',
  'configuration',
  'manual_review',
  'rate_limit',
] as const

export type ConnectorActionRequiredKind = (typeof connectorActionRequiredKinds)[number]

export interface ConnectorAuthSummary {
  id: string
  mode: ConnectorAuthMode
  label: string | null
  configured: boolean
}

export interface ConnectorAuthReferenceInput {
  id: string
  mode: ConnectorAuthMode
  label?: string | null
  secretKey?: string
  sessionKey?: string
}

export interface ConnectorActionRequired {
  id: string
  kind: ConnectorActionRequiredKind
  label: string
  message: string
  severity: ConnectorStatusSeverity
}

export interface ConnectorStatusAction {
  id: 'configure' | 'reconnect' | 'review' | 'skip' | 'wait'
  label: string
}

export interface ConnectorWarning {
  code: string
  label: string | null
  message: string
  severity: ConnectorStatusSeverity
}

export interface ConnectorCoverageWindow {
  start: string | null
  end: string | null
}

export interface ConnectorInstanceSummary {
  id: string
  connectorId: string
  connectorVersion: string
  displayName: string
  enabled: boolean
  auth: ConnectorAuthSummary[]
  config: unknown
  filters: unknown
  createdAt: string
  updatedAt: string
}

export interface ConnectorStatusSummary {
  id: string
  connectorId: string
  connectorVersion: string | null
  displayName: string
  enabled: boolean
  auth: ConnectorAuthSummary[]
  actionRequired: ConnectorActionRequired[]
  actions: ConnectorStatusAction[]
  lastRunAt: string | null
  latestRunId: string | null
  observationCount: number
  severity: ConnectorStatusSeverity
  status: ConnectorStatusState
  statusLabel: string
  summary: string
  warningCount: number
  warnings: ConnectorWarning[]
}

export interface ConnectorRunSummary {
  id: string
  connectorInstanceId: string
  mode: ConnectorRunMode | string
  status: ConnectorRunStatus | string
  coverage: ConnectorCoverageWindow
  filterSignature: string
  observationCount: number
  warningCount: number
  stats: unknown
  warnings: ConnectorWarning[]
  retryHints: unknown
  startedAt: string
  completedAt: string | null
}

export interface ConnectorCheckpoint {
  connectorInstanceId: string
  filterSignature: string
  checkpoint: unknown
  schemaVersion: string
  coverage: ConnectorCoverageWindow
}

export interface ConnectorObservationLinks {
  source: string | null
  intermediary: string | null
  official: string | null
}

export interface ConnectorObservationResolution {
  status: string
  method: string | null
  reason: string | null
}

export interface ConnectorObservationEvidence {
  type: string
  capturedAt: string
  sourceUrl: string | null
}

export interface ConnectorObservation {
  id: string
  connectorInstanceId: string
  connectorRunId: string
  connectorId: string
  connectorVersion: string
  sourceRecordKey: string
  observedAt: string
  companyName: string
  roleTitle: string
  locationRaw: string | null
  descriptionText: string | null
  pay: unknown
  links: ConnectorObservationLinks
  resolution: ConnectorObservationResolution
  dedupeKeys: string[]
  sourceMetadata: unknown
  evidence: ConnectorObservationEvidence[]
  sourcingFindingId: string | null
  createdAt: string
  updatedAt: string
}

export interface ConnectorInstancesListResult {
  items: ConnectorInstanceSummary[]
}

export interface CreateConnectorInstanceInput {
  id: string
  connectorId: string
  connectorVersion: string
  displayName: string
  enabled: boolean
  auth?: ConnectorAuthReferenceInput[]
  config?: Record<string, unknown>
  filters?: Record<string, unknown>
}

export interface UpdateConnectorInstanceInput {
  connectorInstanceId: string
  connectorVersion?: string
  displayName?: string
  enabled?: boolean
  auth?: ConnectorAuthReferenceInput[]
  config?: Record<string, unknown>
  filters?: Record<string, unknown>
}

export interface ConnectorRunsListInput {
  connectorInstanceId: string
  status?: ConnectorRunStatus | string
  mode?: ConnectorRunMode | string
  limit?: number
  offset?: number
}

export interface ConnectorRunsListResult {
  items: ConnectorRunSummary[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

export interface TriggerConnectorRunInput {
  connectorInstanceId: string
  mode?: ConnectorRunMode
  coverageStartedAt?: string | null
  coverageEndedAt?: string | null
  filterSignature?: string | null
  filters?: unknown
  reason?: string | null
  dryRun?: boolean
}

export interface ConnectorCheckpointsListInput {
  connectorInstanceId: string
  filterSignature?: string
}

export interface ConnectorCheckpointsListResult {
  items: ConnectorCheckpoint[]
}

export interface ConnectorObservationsListInput {
  connectorInstanceId: string
  connectorRunId?: string
  limit?: number
  offset?: number
}

export interface ConnectorObservationsListResult {
  items: ConnectorObservation[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}
