import { z } from 'zod'
import {
  canonicalDateOnlySchema,
  type CanonicalDateOnly,
} from './canonical-date.js'
import { retryAdviceSchema, type RetryAdvice } from './retry.js'

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
  earliestBackfillDate: CanonicalDateOnly
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
  retryHints: RetryAdvice | null
  startedAt: string
  completedAt: string | null
}

const connectorWarningSchema = z
  .object({
    code: z.string(),
    label: z.string().nullable(),
    message: z.string(),
    severity: z.enum(connectorStatusSeverities),
  })
  .strict()

export const connectorRunSummarySchema: z.ZodType<ConnectorRunSummary> = z
  .object({
    id: z.string(),
    connectorInstanceId: z.string(),
    mode: z.string(),
    status: z.string(),
    coverage: z
      .object({ start: z.string().nullable(), end: z.string().nullable() })
      .strict(),
    filterSignature: z.string(),
    observationCount: z.number(),
    warningCount: z.number(),
    stats: z.unknown(),
    warnings: z.array(connectorWarningSchema),
    retryHints: retryAdviceSchema.nullable(),
    startedAt: z.string(),
    completedAt: z.string().nullable(),
  })
  .strict()
  .superRefine((run, context) => {
    if (run.retryHints?.state === 'not_due' && run.status !== 'skipped') {
      context.addIssue({
        code: 'custom',
        message: 'not-due connector runs must use the skipped status',
        path: ['status'],
      })
    }
  })

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

const connectorAuthSummarySchema = z
  .object({
    id: z.string(),
    mode: z.enum(connectorAuthModes),
    label: z.string().nullable(),
    configured: z.boolean(),
  })
  .strict()

export const connectorInstanceSummarySchema: z.ZodType<ConnectorInstanceSummary> = z
  .object({
    id: z.string(),
    connectorId: z.string(),
    connectorVersion: z.string(),
    displayName: z.string(),
    enabled: z.boolean(),
    auth: z.array(connectorAuthSummarySchema),
    config: z.unknown(),
    filters: z.unknown(),
    earliestBackfillDate: canonicalDateOnlySchema,
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict()

export const connectorInstancesListResultSchema: z.ZodType<ConnectorInstancesListResult> =
  z
    .object({
      items: z.array(connectorInstanceSummarySchema),
    })
    .strict()

export interface CreateConnectorInstanceInput {
  id: string
  connectorId: string
  connectorVersion: string
  displayName: string
  enabled: boolean
  auth?: ConnectorAuthReferenceInput[]
  config?: Record<string, unknown>
  filters?: Record<string, unknown>
  earliestBackfillDate?: CanonicalDateOnly
}

export interface UpdateConnectorInstanceInput {
  connectorInstanceId: string
  connectorVersion?: string
  displayName?: string
  enabled?: boolean
  auth?: ConnectorAuthReferenceInput[]
  config?: Record<string, unknown>
  filters?: Record<string, unknown>
  earliestBackfillDate?: CanonicalDateOnly
}

export const connectorAuthReferenceInputSchema: z.ZodType<ConnectorAuthReferenceInput> =
  z
    .object({
      id: z.string(),
      mode: z.enum(connectorAuthModes),
      label: z.string().nullable().optional(),
      secretKey: z.string().optional(),
      sessionKey: z.string().optional(),
    })
    .strict()

export const createConnectorInstanceInputSchema: z.ZodType<CreateConnectorInstanceInput> =
  z
    .object({
      id: z.string(),
      connectorId: z.string(),
      connectorVersion: z.string(),
      displayName: z.string(),
      enabled: z.boolean(),
      auth: z.array(connectorAuthReferenceInputSchema).optional(),
      config: z.record(z.string(), z.unknown()).optional(),
      filters: z.record(z.string(), z.unknown()).optional(),
      earliestBackfillDate: canonicalDateOnlySchema.optional(),
    })
    .strict()

export const updateConnectorInstanceInputSchema: z.ZodType<UpdateConnectorInstanceInput> =
  z
    .object({
      connectorInstanceId: z.string(),
      connectorVersion: z.string().optional(),
      displayName: z.string().optional(),
      enabled: z.boolean().optional(),
      auth: z.array(connectorAuthReferenceInputSchema).optional(),
      config: z.record(z.string(), z.unknown()).optional(),
      filters: z.record(z.string(), z.unknown()).optional(),
      earliestBackfillDate: canonicalDateOnlySchema.optional(),
    })
    .strict()

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

export const connectorRunsListResultSchema: z.ZodType<ConnectorRunsListResult> = z
  .object({
    items: z.array(connectorRunSummarySchema),
    total: z.number().int().nonnegative(),
    limit: z.number().int().nonnegative(),
    offset: z.number().int().nonnegative(),
    hasMore: z.boolean(),
  })
  .strict()

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
