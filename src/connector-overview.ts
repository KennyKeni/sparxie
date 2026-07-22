import { z } from 'zod'
import { canonicalDateOnlySchema } from './canonical-date.js'
import {
  connectorActionRequiredSchema,
  connectorRunModes,
  connectorRunStatuses,
  connectorStatusSeverities,
  connectorStatusActionSchema,
  connectorStatusStates,
  connectorWarningSchema,
  type ConnectorActionRequired,
  type ConnectorHistoricalBackfillState,
  type ConnectorNewestFrontierState,
  type ConnectorRunMode,
  type ConnectorRunStatus,
  type ConnectorStatusAction,
  type ConnectorStatusSeverity,
  type ConnectorStatusState,
  type ConnectorWarning,
} from './connector.js'
import { compareUtf8Bytewise } from './string-ordering.js'
import { refineConnectorSynchronizationInvariants } from './connector-synchronization-invariants.js'
import {
  connectorOverviewHealthClassifications,
  deriveRunBackedOverviewHealth,
} from './connector-overview-health.js'

export const connectorOverviewRunOutcomes = [
  'in_progress',
  'failed',
  'cancelled',
  'yielded',
  'caught_up',
  'cooling_down',
  'action_required',
  'boundary_exhausted',
  'source_exhausted',
] as const

export type ConnectorOverviewRunOutcome =
  (typeof connectorOverviewRunOutcomes)[number]

/** Default connector overview page size when `limit` is omitted. */
export const DEFAULT_CONNECTOR_OVERVIEW_LIST_LIMIT = 50

/** Maximum connector overview page size. */
export const MAX_CONNECTOR_OVERVIEW_LIST_LIMIT = 100

/** Maximum length of an opaque connector overview continuation cursor. */
export const MAX_CONNECTOR_OVERVIEW_LIST_CURSOR_LENGTH = 1024

/**
 * Stable keyset order for overview pages. The opaque cursor represents the
 * final id under this order without exposing a backend cursor encoding.
 */
export const CONNECTOR_OVERVIEW_LIST_KEYSET_ORDER = [
  { field: 'id', direction: 'asc', collation: 'utf8_bytewise' },
] as const

export interface ConnectorOverviewListQuery {
  /**
   * Opaque continuation token returned by the preceding page. Cursors are
   * valid only with the same filter set; their encoding is backend-owned.
   */
  cursor?: string
  limit?: number
  enabled?: boolean
  severity?: ConnectorStatusSeverity
  status?: ConnectorStatusState
}

export const connectorOverviewErrorCodes = [
  'invalid_connector_overview_cursor',
] as const

export type ConnectorOverviewErrorCode =
  (typeof connectorOverviewErrorCodes)[number]

export interface ConnectorOverviewErrorPayload {
  code: ConnectorOverviewErrorCode
  message: string
}

export const connectorOverviewErrorPayloadSchema: z.ZodType<ConnectorOverviewErrorPayload> =
  z.object({
    code: z.enum(connectorOverviewErrorCodes),
    message: z.string().min(1),
  }).strict()

export const connectorOverviewListQuerySchema: z.ZodType<ConnectorOverviewListQuery> =
  z.object({
    cursor: z.string().min(1).max(MAX_CONNECTOR_OVERVIEW_LIST_CURSOR_LENGTH).optional(),
    limit: z.number().int().min(1).max(MAX_CONNECTOR_OVERVIEW_LIST_LIMIT).optional(),
    enabled: z.boolean().optional(),
    severity: z.enum(connectorStatusSeverities).optional(),
    status: z.enum(connectorStatusStates).optional(),
  }).strict()

/** Deterministic allowlisted query-param order for connector overview pages. */
export const connectorOverviewListQueryParamKeys = [
  'cursor',
  'limit',
  'enabled',
  'severity',
  'status',
] as const

export function connectorOverviewListQueryToSearchParams(
  query: ConnectorOverviewListQuery = {},
) {
  const params = new URLSearchParams()

  for (const key of connectorOverviewListQueryParamKeys) {
    const value = query[key]
    if (value !== undefined) params.set(key, String(value))
  }

  return params
}

export interface ConnectorOverviewHealth {
  severity: ConnectorStatusSeverity
  status: ConnectorStatusState
  statusLabel: string
  summary: string
  warningCount: number
  warnings: ConnectorWarning[]
}

export interface ConnectorOverviewLatestRun {
  id: string
  mode: ConnectorRunMode
  status: ConnectorRunStatus
  outcome: ConnectorOverviewRunOutcome
  cancellationKind: 'user_skipped' | null
  observationCount: number
  warningCount: number
  newestFrontier: ConnectorNewestFrontierState
  historicalBackfill: ConnectorHistoricalBackfillState
  pendingResolutionCount: number
  startedAt: string
  completedAt: string | null
}

export interface ConnectorOverviewRecord {
  id: string
  connectorId: string
  connectorVersion: string | null
  displayName: string
  enabled: boolean
  health: ConnectorOverviewHealth
  actionRequired: ConnectorActionRequired[]
  actions: ConnectorStatusAction[]
  latestRun: ConnectorOverviewLatestRun | null
  cooldown: { retryAt: string } | null
}

export interface ConnectorOverviewListResult {
  items: ConnectorOverviewRecord[]
  /** Null ends the sequence; no total count is required or returned. */
  nextCursor: string | null
}

const newestFrontierSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('not_started') }).strict(),
  z.object({ state: z.literal('advancing') }).strict(),
  z.object({ state: z.literal('caught_up') }).strict(),
])

const boundarySchema = z.object({ earliestDate: canonicalDateOnlySchema }).strict()
const historicalBackfillSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('not_started'), boundary: boundarySchema }).strict(),
  z.object({ state: z.literal('advancing'), boundary: boundarySchema }).strict(),
  z.object({ state: z.literal('caught_up'), boundary: boundarySchema }).strict(),
  z.object({ state: z.literal('boundary_reached'), boundary: boundarySchema }).strict(),
  z.object({ state: z.literal('source_exhausted'), boundary: boundarySchema }).strict(),
])

const latestRunSchema: z.ZodType<ConnectorOverviewLatestRun> = z.object({
  id: z.string().min(1),
  mode: z.enum(connectorRunModes),
  status: z.enum(connectorRunStatuses),
  outcome: z.enum(connectorOverviewRunOutcomes),
  cancellationKind: z.literal('user_skipped').nullable(),
  observationCount: z.number().int().nonnegative(),
  warningCount: z.number().int().nonnegative(),
  newestFrontier: newestFrontierSchema,
  historicalBackfill: historicalBackfillSchema,
  pendingResolutionCount: z.number().int().nonnegative(),
  startedAt: z.iso.datetime({ offset: true }),
  completedAt: z.iso.datetime({ offset: true }).nullable(),
}).strict().superRefine((run, context) => {
  refineConnectorSynchronizationInvariants(run, context)
})

const connectorOverviewIdSchema = z.string().min(1).refine((value) => {
  for (const scalar of value) {
    const codePoint = scalar.codePointAt(0)!
    if (codePoint >= 0xD800 && codePoint <= 0xDFFF) return false
  }
  return true
}, { message: 'connector id must contain only Unicode scalar values' })

export const connectorOverviewRecordSchema: z.ZodType<ConnectorOverviewRecord> =
  z.object({
    id: connectorOverviewIdSchema,
    connectorId: z.string().min(1),
    connectorVersion: z.string().min(1).nullable(),
    displayName: z.string().min(1),
    enabled: z.boolean(),
    health: z.object({
      severity: z.enum(connectorStatusSeverities),
      status: z.enum(connectorStatusStates),
      statusLabel: z.string().min(1),
      summary: z.string().min(1),
      warningCount: z.number().int().nonnegative(),
      warnings: z.array(connectorWarningSchema),
    }).strict(),
    actionRequired: z.array(connectorActionRequiredSchema),
    actions: z.array(connectorStatusActionSchema),
    latestRun: latestRunSchema.nullable(),
    cooldown: z.object({ retryAt: z.iso.datetime({ offset: true }) }).strict().nullable(),
  }).strict().superRefine((record, context) => {
    if (record.health.warningCount !== record.health.warnings.length) {
      context.addIssue({
        code: 'custom',
        message: 'health warning count must equal warnings length',
        path: ['health', 'warningCount'],
      })
    }

    const hasAuthAction = record.actionRequired.some((action) => action.kind === 'auth')
    if (hasAuthAction !== (record.health.status === 'authentication_required')) {
      context.addIssue({
        code: 'custom',
        message: 'authentication-required health and auth action must agree',
        path: ['health', 'status'],
      })
    }
    if (record.health.status === 'authentication_required' && record.health.severity !== 'blocked') {
      context.addIssue({
        code: 'custom',
        message: 'authentication-required health must be blocked',
        path: ['health', 'severity'],
      })
    }
    const hasBlockingAction = record.actionRequired.some(
      (action) => action.kind === 'captcha'
        || action.kind === 'configuration'
        || action.kind === 'manual_review'
        || action.kind === 'rate_limit',
    )
    if (record.health.status === 'blocked' && !hasBlockingAction) {
      context.addIssue({
        code: 'custom',
        message: 'blocked health requires non-auth blocking evidence',
        path: ['health', 'status'],
      })
    }
    if (record.health.status === 'blocked' && record.health.severity !== 'blocked') {
      context.addIssue({
        code: 'custom',
        message: 'blocked configuration health must be blocked severity',
        path: ['health', 'severity'],
      })
    }

    const run = record.latestRun
    if (run !== null) {
      if (
        run.cancellationKind === 'user_skipped'
        && (run.status !== 'cancelled' || run.outcome !== 'cancelled')
      ) {
        context.addIssue({
          code: 'custom',
          message: 'user-skipped cancellation kind requires a cancelled run',
          path: ['latestRun', 'cancellationKind'],
        })
      }
      const active = run.status === 'queued' || run.status === 'running'
      if (active !== (run.outcome === 'in_progress') || active !== (run.completedAt === null)) {
        context.addIssue({
          code: 'custom',
          message: 'latest run activity, outcome, and completion must agree',
          path: ['latestRun', 'status'],
        })
      }
      if ((run.status === 'failed') !== (run.outcome === 'failed')) {
        context.addIssue({
          code: 'custom',
          message: 'failed latest run status and outcome must agree',
          path: ['latestRun', 'outcome'],
        })
      }
      if ((run.status === 'cancelled') !== (run.outcome === 'cancelled')) {
        context.addIssue({
          code: 'custom',
          message: 'cancelled latest run status and outcome must agree',
          path: ['latestRun', 'outcome'],
        })
      }
      if (run.completedAt !== null && Date.parse(run.completedAt) < Date.parse(run.startedAt)) {
        context.addIssue({
          code: 'custom',
          message: 'latest run completion cannot precede start',
          path: ['latestRun', 'completedAt'],
        })
      }
    }

    const derivedHealth = deriveRunBackedOverviewHealth(run)
    const healthClassification =
      connectorOverviewHealthClassifications[record.health.status]
    if (
      (healthClassification === 'run_backed' && record.health.status !== derivedHealth)
      || (
        derivedHealth !== null
        && healthClassification !== 'overlay'
        && record.health.status !== derivedHealth
      )
    ) {
      context.addIssue({
        code: 'custom',
        message: 'run-backed health must match the state derived from latest run',
        path: ['health', 'status'],
      })
    }
    if (record.health.status === 'caught_up' && (
      record.health.severity !== 'healthy'
      || record.actionRequired.length !== 0
    )) {
      context.addIssue({
        code: 'custom',
        message: 'caught-up health must be healthy, action-free, and run-backed',
        path: ['health', 'status'],
      })
    }

    const coolingDownHealth = record.health.status === 'cooling_down'
    const coolingDownRun = run?.outcome === 'cooling_down'
    const hasCooldown = record.cooldown !== null
    if (
      (coolingDownHealth && (!coolingDownRun || !hasCooldown))
      || (hasCooldown && (!coolingDownHealth || !coolingDownRun))
    ) {
      context.addIssue({
        code: 'custom',
        message: 'cooldown health, run outcome, and public retry instant must agree',
        path: ['cooldown'],
      })
    }
  })

export const connectorOverviewListResultSchema: z.ZodType<ConnectorOverviewListResult> =
  z.object({
    items: z.array(connectorOverviewRecordSchema).max(MAX_CONNECTOR_OVERVIEW_LIST_LIMIT),
    nextCursor: z.string().min(1).max(MAX_CONNECTOR_OVERVIEW_LIST_CURSOR_LENGTH).nullable(),
  }).strict().superRefine((result, context) => {
    for (let index = 1; index < result.items.length; index += 1) {
      const previous = result.items[index - 1]!
      const current = result.items[index]!
      if (compareUtf8Bytewise(current.id, previous.id) <= 0) {
        context.addIssue({
          code: 'custom',
          message: 'items must follow unique UTF-8 bytewise connector id ASC order',
          path: ['items', index, 'id'],
        })
      }
    }
  })
