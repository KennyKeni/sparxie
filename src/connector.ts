import { z } from 'zod'
import {
  canonicalDateOnlySchema,
  type CanonicalDateOnly,
} from './canonical-date.js'
import {
  connectorRunScheduleOccurrenceLinkSchema,
  type ConnectorRunScheduleOccurrenceLink,
} from './connector-schedule.js'
import {
  connectorRunLifecycleCountsSchema,
  type ConnectorRunLifecycleCounts,
} from './connector-run-lifecycle.js'
import {
  sourceExecutionScopeIdSchema,
  sourceOperationOutcomeSchema,
  type SourceExecutionScopeId,
  type SourceOperationOutcome,
} from './source-execution.js'
import { refineConnectorSynchronizationInvariants } from './connector-synchronization-invariants.js'

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
  'failed',
  'cancelled',
  'skipped',
] as const

export type ConnectorRunStatus = (typeof connectorRunStatuses)[number]

export const connectorStatusSeverities = ['healthy', 'warning', 'blocked'] as const

export type ConnectorStatusSeverity = (typeof connectorStatusSeverities)[number]

export const connectorStatusStates = [
  'authentication_required',
  'backfilling',
  'blocked',
  'boundary_exhausted',
  'cancelled',
  'caught_up',
  'checking_newest',
  'cooling_down',
  'failed',
  'never_run',
  'queued',
  'resolving',
  'skipped',
  'source_exhausted',
] as const

export type ConnectorStatusState = (typeof connectorStatusStates)[number]

/** Retired connector instances are excluded from normal instance lists. */
export const connectorInstanceListLifecycleStates = ['enabled', 'disabled'] as const

export type ConnectorInstanceListLifecycleState =
  (typeof connectorInstanceListLifecycleStates)[number]

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

export type ConnectorNewestFrontierState =
  | { state: 'not_started' }
  | { state: 'advancing' | 'caught_up' }

export interface ConnectorBackfillBoundary {
  earliestDate: CanonicalDateOnly
}

export type ConnectorHistoricalBackfillState =
  | { state: 'not_started'; boundary: ConnectorBackfillBoundary }
  | {
      state: 'advancing' | 'caught_up' | 'boundary_reached' | 'source_exhausted'
      boundary: ConnectorBackfillBoundary
    }

export type ConnectorSynchronizationOutcome =
  | { kind: 'in_progress' }
  | { kind: 'failed'; reason: string }
  | { kind: 'cancelled'; reason: string }
  | { kind: 'yielded'; reason: 'invocation_budget' | 'operation_timeout' }
  | { kind: 'caught_up' }
  | {
      kind: 'cooling_down'
      operation: Extract<SourceOperationOutcome, { kind: 'scope_rate_limited' }>
    }
  | {
      kind: 'action_required'
      operation: Extract<SourceOperationOutcome, { kind: 'authentication_expired' }>
    }
  | { kind: 'boundary_exhausted' }
  | { kind: 'source_exhausted' }

export interface ConnectorInstanceSummary {
  id: string
  connectorId: string
  connectorVersion: string
  displayName: string
  enabled: boolean
  lifecycle: ConnectorInstanceListLifecycleState
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

export interface ConnectorRunSummaryBase {
  id: string
  connectorInstanceId: string
  executionScopeId: SourceExecutionScopeId
  status: ConnectorRunStatus
  filterSignature: string
  observationCount: number
  warningCount: number
  warnings: ConnectorWarning[]
  newestFrontier: ConnectorNewestFrontierState
  historicalBackfill: ConnectorHistoricalBackfillState
  pendingResolutionCount: number
  lifecycleCounts?: ConnectorRunLifecycleCounts
  outcome: ConnectorSynchronizationOutcome
  startedAt: string
  completedAt: string | null
}

export type ConnectorRunSummary =
  | (ConnectorRunSummaryBase & {
      mode: 'manual'
      scheduleOccurrence: null
    })
  | (ConnectorRunSummaryBase & {
      mode: 'scheduled'
      scheduleOccurrence: ConnectorRunScheduleOccurrenceLink & { admittedMode: 'scheduled' }
    })
  | (ConnectorRunSummaryBase & {
      mode: 'catch_up'
      scheduleOccurrence: ConnectorRunScheduleOccurrenceLink & { admittedMode: 'catch_up' }
    })

export const connectorWarningSchema = z
  .object({
    code: z.string(),
    label: z.string().nullable(),
    message: z.string(),
    severity: z.enum(connectorStatusSeverities),
  })
  .strict()

const connectorRunSummaryBaseShape = {
  id: z.string(),
  connectorInstanceId: z.string(),
  executionScopeId: sourceExecutionScopeIdSchema,
  status: z.enum(connectorRunStatuses),
  filterSignature: z.string(),
  observationCount: z.number().int().nonnegative(),
  warningCount: z.number().int().nonnegative(),
  warnings: z.array(connectorWarningSchema),
  newestFrontier: z.discriminatedUnion('state', [
    z.object({ state: z.literal('not_started') }).strict(),
    z.object({ state: z.literal('advancing') }).strict(),
    z.object({ state: z.literal('caught_up') }).strict(),
  ]),
  historicalBackfill: z.discriminatedUnion('state', [
    z.object({ state: z.literal('not_started'), boundary: z.object({ earliestDate: canonicalDateOnlySchema }).strict() }).strict(),
    z.object({ state: z.literal('advancing'), boundary: z.object({ earliestDate: canonicalDateOnlySchema }).strict() }).strict(),
    z.object({ state: z.literal('caught_up'), boundary: z.object({ earliestDate: canonicalDateOnlySchema }).strict() }).strict(),
    z.object({ state: z.literal('boundary_reached'), boundary: z.object({ earliestDate: canonicalDateOnlySchema }).strict() }).strict(),
    z.object({ state: z.literal('source_exhausted'), boundary: z.object({ earliestDate: canonicalDateOnlySchema }).strict() }).strict(),
  ]),
  pendingResolutionCount: z.number().int().nonnegative(),
  lifecycleCounts: connectorRunLifecycleCountsSchema.optional(),
  outcome: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('in_progress') }).strict(),
    z.object({ kind: z.literal('failed'), reason: z.string().min(1).max(512) }).strict(),
    z.object({ kind: z.literal('cancelled'), reason: z.string().min(1).max(512) }).strict(),
    z.object({ kind: z.literal('yielded'), reason: z.enum(['invocation_budget', 'operation_timeout']) }).strict(),
    z.object({ kind: z.literal('caught_up') }).strict(),
    z.object({
      kind: z.literal('cooling_down'),
      operation: sourceOperationOutcomeSchema.refine(
        (value): value is Extract<SourceOperationOutcome, { kind: 'scope_rate_limited' }> =>
          value.kind === 'scope_rate_limited',
      ),
    }).strict(),
    z.object({
      kind: z.literal('action_required'),
      operation: sourceOperationOutcomeSchema.refine(
        (value): value is Extract<SourceOperationOutcome, { kind: 'authentication_expired' }> =>
          value.kind === 'authentication_expired',
      ),
    }).strict(),
    z.object({ kind: z.literal('boundary_exhausted') }).strict(),
    z.object({ kind: z.literal('source_exhausted') }).strict(),
  ]),
  startedAt: z.iso.datetime({ offset: true }),
  completedAt: z.iso.datetime({ offset: true }).nullable(),
}

function refineContinuousRun(
  run: ConnectorRunSummaryBase,
  context: z.RefinementCtx,
) {
  if (run.lifecycleCounts !== undefined) {
    if (run.lifecycleCounts.scope.connectorRunId !== run.id) {
      context.addIssue({
        code: 'custom',
        message: 'lifecycle count scope must match the run id',
        path: ['lifecycleCounts', 'scope', 'connectorRunId'],
      })
    }
    if (run.lifecycleCounts.scope.executionScopeId !== run.executionScopeId) {
      context.addIssue({
        code: 'custom',
        message: 'lifecycle count scope must match the execution scope',
        path: ['lifecycleCounts', 'scope', 'executionScopeId'],
      })
    }
  }
  if (run.warningCount !== run.warnings.length) {
    context.addIssue({ code: 'custom', message: 'warning count must equal warnings length', path: ['warningCount'] })
  }
  const invocationInProgress = run.status === 'queued' || run.status === 'running'
  if (
    run.lifecycleCounts !== undefined
    && invocationInProgress !== (run.lifecycleCounts.source === 'live_current')
  ) {
    context.addIssue({
      code: 'custom',
      message: 'lifecycle count provenance must match invocation activity',
      path: ['lifecycleCounts', 'source'],
    })
  }
  if (invocationInProgress !== (run.outcome.kind === 'in_progress')) {
    context.addIssue({
      code: 'custom', message: 'queued/running invocations require in-progress outcome',
      path: ['outcome'],
    })
  }
  if ((run.status === 'failed') !== (run.outcome.kind === 'failed')) {
    context.addIssue({ code: 'custom', message: 'failed status and outcome must agree', path: ['outcome'] })
  }
  if ((run.status === 'cancelled') !== (run.outcome.kind === 'cancelled')) {
    context.addIssue({ code: 'custom', message: 'cancelled status and outcome must agree', path: ['outcome'] })
  }
  if (invocationInProgress !== (run.completedAt === null)) {
    context.addIssue({
      code: 'custom', message: 'only queued/running invocations omit completion time',
      path: ['completedAt'],
    })
  }
  if (run.completedAt !== null && Date.parse(run.completedAt) < Date.parse(run.startedAt)) {
    context.addIssue({
      code: 'custom', message: 'completion cannot precede start', path: ['completedAt'],
    })
  }
  refineConnectorSynchronizationInvariants({
    status: run.status,
    outcome: run.outcome.kind,
    newestFrontier: run.newestFrontier,
    historicalBackfill: run.historicalBackfill,
    pendingResolutionCount: run.pendingResolutionCount,
  }, context)
  const operation = run.outcome.kind === 'cooling_down' ||
    run.outcome.kind === 'action_required' ? run.outcome.operation : null
  if (operation !== null && operation.executionScopeId !== run.executionScopeId) {
    context.addIssue({
      code: 'custom', message: 'run operation scope must match the run scope',
      path: ['outcome', 'operation', 'executionScopeId'],
    })
  }
}

const scheduledOccurrenceLinkSchema = connectorRunScheduleOccurrenceLinkSchema.and(
  z.object({ admittedMode: z.literal('scheduled') }).strict(),
)

const catchUpOccurrenceLinkSchema = connectorRunScheduleOccurrenceLinkSchema.and(
  z.object({ admittedMode: z.literal('catch_up') }).strict(),
)

export const connectorRunSummarySchema: z.ZodType<ConnectorRunSummary> = z
  .discriminatedUnion('mode', [
    z
      .object({
        ...connectorRunSummaryBaseShape,
        mode: z.literal('manual'),
        scheduleOccurrence: z.null(),
      })
      .strict()
      .superRefine(refineContinuousRun),
    z
      .object({
        ...connectorRunSummaryBaseShape,
        mode: z.literal('scheduled'),
        scheduleOccurrence: scheduledOccurrenceLinkSchema,
      })
      .strict()
      .superRefine(refineContinuousRun),
    z
      .object({
        ...connectorRunSummaryBaseShape,
        mode: z.literal('catch_up'),
        scheduleOccurrence: catchUpOccurrenceLinkSchema,
      })
      .strict()
      .superRefine(refineContinuousRun),
  ])

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
  opportunityId: string | null
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

export const connectorActionRequiredSchema = z.object({
  id: z.string(),
  kind: z.enum(connectorActionRequiredKinds),
  label: z.string(),
  message: z.string(),
  severity: z.enum(connectorStatusSeverities),
}).strict()

export const connectorStatusActionSchema = z.object({
  id: z.enum(['configure', 'reconnect', 'review', 'skip', 'wait']),
  label: z.string(),
}).strict()

export const connectorStatusSummarySchema: z.ZodType<ConnectorStatusSummary> =
  z.object({
    id: z.string(),
    connectorId: z.string(),
    connectorVersion: z.string().nullable(),
    displayName: z.string(),
    enabled: z.boolean(),
    auth: z.array(connectorAuthSummarySchema),
    actionRequired: z.array(connectorActionRequiredSchema),
    actions: z.array(connectorStatusActionSchema),
    lastRunAt: z.iso.datetime({ offset: true }).nullable(),
    latestRunId: z.string().nullable(),
    observationCount: z.number().int().nonnegative(),
    severity: z.enum(connectorStatusSeverities),
    status: z.enum(connectorStatusStates),
    statusLabel: z.string(),
    summary: z.string(),
    warningCount: z.number().int().nonnegative(),
    warnings: z.array(connectorWarningSchema),
  }).strict().superRefine((status, context) => {
    if (status.warningCount !== status.warnings.length) {
      context.addIssue({ code: 'custom', message: 'warning count must equal warnings length', path: ['warningCount'] })
    }
    if ((status.lastRunAt === null) !== (status.latestRunId === null)) {
      context.addIssue({
        code: 'custom', message: 'last run time and id must be present together',
        path: ['latestRunId'],
      })
    }
    if (status.status === 'never_run' && status.lastRunAt !== null) {
      context.addIssue({
        code: 'custom', message: 'never-run status cannot reference a run', path: ['lastRunAt'],
      })
    }
    const hasAuthAction = status.actionRequired.some((action) => action.kind === 'auth')
    if (hasAuthAction !== (status.status === 'authentication_required')) {
      context.addIssue({
        code: 'custom', message: 'authentication-required status and auth action must agree',
        path: ['status'],
      })
    }
    if (status.status === 'authentication_required' && status.severity !== 'blocked') {
      context.addIssue({ code: 'custom', message: 'authentication required must be blocked', path: ['severity'] })
    }
    if (status.status === 'caught_up' &&
        (status.severity !== 'healthy' || status.actionRequired.length !== 0 || status.lastRunAt === null)) {
      context.addIssue({ code: 'custom', message: 'caught-up status must be healthy, actionable-free, and run-backed', path: ['status'] })
    }
  })

export const connectorInstanceSummarySchema: z.ZodType<ConnectorInstanceSummary> = z
  .object({
    id: z.string(),
    connectorId: z.string(),
    connectorVersion: z.string(),
    displayName: z.string(),
    enabled: z.boolean(),
    lifecycle: z.enum(connectorInstanceListLifecycleStates),
    auth: z.array(connectorAuthSummarySchema),
    config: z.unknown(),
    filters: z.unknown(),
    earliestBackfillDate: canonicalDateOnlySchema,
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict()
  .superRefine((instance, context) => {
    if ((instance.lifecycle === 'enabled') !== instance.enabled) {
      context.addIssue({
        code: 'custom',
        message: 'lifecycle must agree with enabled state',
        path: ['lifecycle'],
      })
    }
  })

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
  status?: ConnectorRunStatus
  mode?: ConnectorRunMode
  limit?: number
  offset?: number
}

export const connectorRunsListInputSchema: z.ZodType<ConnectorRunsListInput> =
  z.object({
    connectorInstanceId: z.string().min(1),
    status: z.enum(connectorRunStatuses).optional(),
    mode: z.enum(connectorRunModes).optional(),
    limit: z.number().int().nonnegative().optional(),
    offset: z.number().int().nonnegative().optional(),
  }).strict()

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
  /** Ordinary triggers are manual-only; scheduled/catch_up require due dispatch. */
  mode?: 'manual'
  filterSignature?: string | null
  filters?: unknown
  reason?: string | null
  dryRun?: boolean
}

export const triggerConnectorRunInputSchema: z.ZodType<TriggerConnectorRunInput> = z
  .object({
    connectorInstanceId: z.string().min(1),
    mode: z.literal('manual').optional(),
    filterSignature: z.string().nullable().optional(),
    filters: z.unknown().optional(),
    reason: z.string().nullable().optional(),
    dryRun: z.boolean().optional(),
  })
  .strict()

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

export const connectorCreateErrorCodes = ['already_configured'] as const

export type ConnectorCreateErrorCode = (typeof connectorCreateErrorCodes)[number]

function freezeConnectorCreateErrorBodies<Value extends Record<string, object>>(
  value: Value,
): Readonly<Value> {
  for (const nested of Object.values(value)) Object.freeze(nested)
  return Object.freeze(value)
}

export const connectorCreateErrorBodies = freezeConnectorCreateErrorBodies({
  already_configured: {
    code: 'already_configured',
    message: 'This connector is already configured. Manage the existing instance.',
  },
} as const)

export type ConnectorCreateErrorBody =
  (typeof connectorCreateErrorBodies)[ConnectorCreateErrorCode]

export type ConnectorCreateErrorPayload = ConnectorCreateErrorBody

export const connectorCreateErrorStatusByCode = Object.freeze({
  already_configured: 409,
} as const satisfies Record<ConnectorCreateErrorCode, 409>)

export const connectorCreateErrorKindByCode = Object.freeze({
  already_configured: 'conflict',
} as const satisfies Record<ConnectorCreateErrorCode, 'conflict'>)

const connectorCreateErrorBodyInnerSchema: z.ZodType<ConnectorCreateErrorBody> = z
  .object({
    code: z.enum(connectorCreateErrorCodes),
    message: z.string(),
  })
  .strict()
  .transform((value, context) => {
    const canonical = connectorCreateErrorBodies[value.code]
    if (value.message !== canonical.message) {
      context.addIssue({ code: 'custom', message: 'invalid connector create error body' })
      return z.NEVER
    }
    return { code: canonical.code, message: canonical.message } as ConnectorCreateErrorBody
  })

export const connectorCreateErrorBodySchema: z.ZodType<ConnectorCreateErrorBody> =
  connectorCreateErrorBodyInnerSchema

export const connectorCreateErrorPayloadSchema = connectorCreateErrorBodySchema
