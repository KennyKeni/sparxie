import { z } from 'zod'

export const connectorScheduleCadenceKinds = ['interval', 'daily', 'weekly'] as const

export type ConnectorScheduleCadenceKind = (typeof connectorScheduleCadenceKinds)[number]

export type ConnectorSchedulingCapability =
  | { available: false }
  | {
      available: true
      supportedCadences: ConnectorScheduleCadenceKind[]
      minimumIntervalMinutes: number
      maximumCatchUpAgeMinutes: number
      timezoneModel: 'iana'
      missedOccurrencePolicy: 'coalesce_one'
    }

export const unavailableConnectorSchedulingCapability = {
  available: false,
} as const satisfies ConnectorSchedulingCapability

/** One-year hard ceiling for interval cadence and capability interval bounds (minutes). */
export const MAX_CONNECTOR_SCHEDULE_INTERVAL_MINUTES = 525_600

/**
 * Normative daily/weekly DST policy for connector schedules.
 * Sparxie validates declared policy shape/values; backends compute instants.
 *
 * - Nonexistent local time (spring-forward gap): first valid instant after the gap.
 * - Repeated local time (fall-back overlap): one occurrence at the earlier instant.
 */
export const connectorScheduleDstPolicy = {
  nonexistentLocalTime: 'first_valid_after_gap',
  repeatedLocalTime: 'earlier_instant',
} as const

export type ConnectorScheduleDstPolicy = typeof connectorScheduleDstPolicy

export const connectorScheduleStates = ['enabled', 'paused'] as const

export type ConnectorScheduleState = (typeof connectorScheduleStates)[number]

export interface ConnectorScheduleIntervalCadence {
  kind: 'interval'
  everyMinutes: number
}

export interface ConnectorScheduleDailyCadence {
  kind: 'daily'
  localTime: string
}

export interface ConnectorScheduleWeeklyCadence {
  kind: 'weekly'
  dayOfWeek: number
  localTime: string
}

export type ConnectorScheduleCadence =
  | ConnectorScheduleIntervalCadence
  | ConnectorScheduleDailyCadence
  | ConnectorScheduleWeeklyCadence

export interface UpsertConnectorScheduleInput {
  connectorInstanceId: string
  /** `null` creates; nonempty revision updates. Omission is invalid. */
  expectedRevision: string | null
  state: ConnectorScheduleState
  cadence: ConnectorScheduleCadence
  timezone: string
}

const localTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'localTime must be HH:mm')

export function isIanaTimeZone(value: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value })
    return true
  } catch {
    return false
  }
}

const ianaTimeZoneSchema = z.string().min(1).refine(isIanaTimeZone, {
  message: 'timezone must be a valid IANA time zone',
})

export const connectorScheduleCadenceSchema: z.ZodType<ConnectorScheduleCadence> =
  z.discriminatedUnion('kind', [
    z
      .object({
        kind: z.literal('interval'),
        everyMinutes: z
          .number()
          .int()
          .positive()
          .max(MAX_CONNECTOR_SCHEDULE_INTERVAL_MINUTES),
      })
      .strict(),
    z
      .object({
        kind: z.literal('daily'),
        localTime: localTimeSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal('weekly'),
        dayOfWeek: z.number().int().min(1).max(7),
        localTime: localTimeSchema,
      })
      .strict(),
  ])

export const upsertConnectorScheduleInputSchema: z.ZodType<UpsertConnectorScheduleInput> =
  z
    .object({
      connectorInstanceId: z.string().min(1),
      expectedRevision: z.string().min(1).nullable(),
      state: z.enum(connectorScheduleStates),
      cadence: connectorScheduleCadenceSchema,
      timezone: ianaTimeZoneSchema,
    })
    .strict()

export const connectorScheduleActorClasses = ['user', 'scheduler'] as const

export type ConnectorScheduleActorClass = (typeof connectorScheduleActorClasses)[number]

export const connectorScheduleAuditActions = [
  'upserted',
  'paused',
  'resumed',
  'deleted',
  'dispatched',
] as const

export type ConnectorScheduleAuditAction = (typeof connectorScheduleAuditActions)[number]

export const connectorScheduleAdmittedModes = ['scheduled', 'catch_up'] as const

export type ConnectorScheduleAdmittedMode = (typeof connectorScheduleAdmittedModes)[number]

export const connectorScheduleOccurrenceOutcomes = [
  'admitted',
  'completed',
  'failed',
  'skipped',
  'cancelled',
] as const

export type ConnectorScheduleOccurrenceOutcome =
  (typeof connectorScheduleOccurrenceOutcomes)[number]

const scheduleTimestampSchema = z.iso.datetime({ offset: true, precision: 3 })

export interface ConnectorScheduleOccurrenceSummary {
  id: string
  scheduleId: string
  scheduleRevision: string
  nominalAt: string
  idempotencyKey: string
  admittedMode: ConnectorScheduleAdmittedMode
  outcome: ConnectorScheduleOccurrenceOutcome
  connectorRunId: string | null
  createdAt: string
}

/** Deterministic occurrence identity: schedule revision plus canonical nominal instant. */
export function connectorScheduleOccurrenceIdempotencyKey(
  scheduleRevision: string,
  nominalAt: string,
): string {
  return `${scheduleRevision}:${nominalAt}`
}

/** Closed statuses for sanitized schedule last-run summaries; keep equal to connectorRunStatuses. */
export const connectorScheduleLastRunStatuses = [
  'queued',
  'running',
  'completed',
  'partial_success',
  'failed',
  'cancelled',
  'skipped',
] as const

export type ConnectorScheduleLastRunStatus = (typeof connectorScheduleLastRunStatuses)[number]

/** Scheduled execution modes only; manual runs are not schedule last-run summaries. */
export const connectorScheduleLastRunModes = ['scheduled', 'catch_up'] as const

export type ConnectorScheduleLastRunMode = (typeof connectorScheduleLastRunModes)[number]

export interface ConnectorScheduleLastRunSummary {
  id: string
  status: ConnectorScheduleLastRunStatus
  mode: ConnectorScheduleLastRunMode
  startedAt: string
  completedAt: string | null
}

export interface ConnectorScheduleSummary {
  id: string
  connectorInstanceId: string
  revision: string
  state: ConnectorScheduleState
  cadence: ConnectorScheduleCadence
  timezone: string
  nextEligibleAt: string
  createdAt: string
  updatedAt: string
  lastOccurrence: ConnectorScheduleOccurrenceSummary | null
  lastRun: ConnectorScheduleLastRunSummary | null
}

export interface ConnectorScheduleAuditEvent {
  id: string
  scheduleId: string
  actorClass: ConnectorScheduleActorClass
  action: ConnectorScheduleAuditAction
  revision: string
  at: string
}

export const connectorScheduleOccurrenceSummarySchema: z.ZodType<ConnectorScheduleOccurrenceSummary> =
  z
    .object({
      id: z.string().min(1),
      scheduleId: z.string().min(1),
      scheduleRevision: z.string().min(1),
      nominalAt: scheduleTimestampSchema,
      idempotencyKey: z.string().min(1),
      admittedMode: z.enum(connectorScheduleAdmittedModes),
      outcome: z.enum(connectorScheduleOccurrenceOutcomes),
      connectorRunId: z.string().min(1).nullable(),
      createdAt: scheduleTimestampSchema,
    })
    .strict()
    .superRefine((occurrence, context) => {
      const expected = connectorScheduleOccurrenceIdempotencyKey(
        occurrence.scheduleRevision,
        occurrence.nominalAt,
      )

      if (occurrence.idempotencyKey !== expected) {
        context.addIssue({
          code: 'custom',
          message: 'idempotencyKey must equal scheduleRevision:nominalAt',
          path: ['idempotencyKey'],
        })
      }
    })

export const connectorScheduleLastRunSummarySchema: z.ZodType<ConnectorScheduleLastRunSummary> =
  z
    .object({
      id: z.string().min(1),
      status: z.enum(connectorScheduleLastRunStatuses),
      mode: z.enum(connectorScheduleLastRunModes),
      startedAt: scheduleTimestampSchema,
      completedAt: scheduleTimestampSchema.nullable(),
    })
    .strict()

export const connectorScheduleSummarySchema: z.ZodType<ConnectorScheduleSummary> = z
  .object({
    id: z.string().min(1),
    connectorInstanceId: z.string().min(1),
    revision: z.string().min(1),
    state: z.enum(connectorScheduleStates),
    cadence: connectorScheduleCadenceSchema,
    timezone: ianaTimeZoneSchema,
    nextEligibleAt: scheduleTimestampSchema,
    createdAt: scheduleTimestampSchema,
    updatedAt: scheduleTimestampSchema,
    lastOccurrence: connectorScheduleOccurrenceSummarySchema.nullable(),
    lastRun: connectorScheduleLastRunSummarySchema.nullable(),
  })
  .strict()

export const connectorScheduleAuditEventSchema: z.ZodType<ConnectorScheduleAuditEvent> = z
  .object({
    id: z.string().min(1),
    scheduleId: z.string().min(1),
    actorClass: z.enum(connectorScheduleActorClasses),
    action: z.enum(connectorScheduleAuditActions),
    revision: z.string().min(1),
    at: scheduleTimestampSchema,
  })
  .strict()

export interface ConnectorScheduleRevisionInput {
  connectorInstanceId: string
  expectedRevision: string
}

export type PauseConnectorScheduleInput = ConnectorScheduleRevisionInput
export type ResumeConnectorScheduleInput = ConnectorScheduleRevisionInput
export type DeleteConnectorScheduleInput = ConnectorScheduleRevisionInput

const connectorScheduleRevisionInputSchema = z
  .object({
    connectorInstanceId: z.string().min(1),
    expectedRevision: z.string().min(1),
  })
  .strict()

export const pauseConnectorScheduleInputSchema: z.ZodType<PauseConnectorScheduleInput> =
  connectorScheduleRevisionInputSchema

export const resumeConnectorScheduleInputSchema: z.ZodType<ResumeConnectorScheduleInput> =
  connectorScheduleRevisionInputSchema

export const deleteConnectorScheduleInputSchema: z.ZodType<DeleteConnectorScheduleInput> =
  connectorScheduleRevisionInputSchema

export interface DispatchConnectorScheduleDueInput {
  connectorInstanceId: string
  expectedRevision: string
}

export const dispatchConnectorScheduleDueInputSchema: z.ZodType<DispatchConnectorScheduleDueInput> =
  z
    .object({
      connectorInstanceId: z.string().min(1),
      expectedRevision: z.string().min(1),
    })
    .strict()

export type DispatchConnectorScheduleDueResult =
  | { status: 'not_due'; nextEligibleAt: string }
  | { status: 'unavailable' }
  | { status: 'paused' }
  | { status: 'connector_disabled' }
  | { status: 'deferred_active'; activeRunId: string }
  | {
      status: 'admitted'
      occurrence: ConnectorScheduleOccurrenceSummary & {
        admittedMode: 'scheduled'
        connectorRunId: string
      }
      run: ConnectorScheduleLastRunSummary & { mode: 'scheduled' }
    }
  | {
      status: 'admitted'
      occurrence: ConnectorScheduleOccurrenceSummary & {
        admittedMode: 'catch_up'
        connectorRunId: string
      }
      run: ConnectorScheduleLastRunSummary & { mode: 'catch_up' }
    }

export const dispatchConnectorScheduleDueResultSchema: z.ZodType<DispatchConnectorScheduleDueResult> =
  z.discriminatedUnion('status', [
    z
      .object({
        status: z.literal('not_due'),
        nextEligibleAt: scheduleTimestampSchema,
      })
      .strict(),
    z.object({ status: z.literal('unavailable') }).strict(),
    z.object({ status: z.literal('paused') }).strict(),
    z.object({ status: z.literal('connector_disabled') }).strict(),
    z
      .object({
        status: z.literal('deferred_active'),
        activeRunId: z.string().min(1),
      })
      .strict(),
    z
      .object({
        status: z.literal('admitted'),
        occurrence: connectorScheduleOccurrenceSummarySchema,
        run: connectorScheduleLastRunSummarySchema,
      })
      .strict()
      .superRefine((result, context) => {
        if (result.occurrence.connectorRunId === null) {
          context.addIssue({
            code: 'custom',
            message: 'admitted occurrence must link a connector run',
            path: ['occurrence', 'connectorRunId'],
          })
          return
        }

        if (result.occurrence.connectorRunId !== result.run.id) {
          context.addIssue({
            code: 'custom',
            message: 'admitted occurrence connectorRunId must equal run.id',
            path: ['occurrence', 'connectorRunId'],
          })
        }

        if (result.occurrence.admittedMode !== result.run.mode) {
          context.addIssue({
            code: 'custom',
            message: 'admitted occurrence admittedMode must equal run.mode',
            path: ['occurrence', 'admittedMode'],
          })
        }
      }),
  ]) as z.ZodType<DispatchConnectorScheduleDueResult>

export const connectorScheduleErrorCodes = [
  'connector_scheduling_unavailable',
  'invalid_timezone',
  'invalid_cadence',
  'schedule_too_frequent',
  'stale_schedule_revision',
  'schedule_dispatch_conflict',
] as const

export type ConnectorScheduleErrorCode = (typeof connectorScheduleErrorCodes)[number]

export interface ConnectorScheduleErrorPayload {
  code: ConnectorScheduleErrorCode
  message: string
}

export const connectorScheduleErrorPayloadSchema: z.ZodType<ConnectorScheduleErrorPayload> =
  z
    .object({
      code: z.enum(connectorScheduleErrorCodes),
      message: z.string().min(1),
    })
    .strict()

export const MAX_CONNECTOR_SCHEDULE_HISTORY_LIMIT = 200

export interface ConnectorScheduleHistoryListInput {
  connectorInstanceId: string
  limit: number
  offset: number
}

export const connectorScheduleHistoryListInputSchema: z.ZodType<ConnectorScheduleHistoryListInput> =
  z
    .object({
      connectorInstanceId: z.string().min(1),
      limit: z.number().int().positive().max(MAX_CONNECTOR_SCHEDULE_HISTORY_LIMIT),
      offset: z.number().int().nonnegative(),
    })
    .strict()

export interface ConnectorScheduleAuditListResult {
  items: ConnectorScheduleAuditEvent[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

export const connectorScheduleAuditListResultSchema: z.ZodType<ConnectorScheduleAuditListResult> =
  z
    .object({
      items: z.array(connectorScheduleAuditEventSchema),
      total: z.number().int().nonnegative(),
      limit: z.number().int().positive().max(MAX_CONNECTOR_SCHEDULE_HISTORY_LIMIT),
      offset: z.number().int().nonnegative(),
      hasMore: z.boolean(),
    })
    .strict()

export interface ConnectorScheduleOccurrenceListResult {
  items: ConnectorScheduleOccurrenceSummary[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

export const connectorScheduleOccurrenceListResultSchema: z.ZodType<ConnectorScheduleOccurrenceListResult> =
  z
    .object({
      items: z.array(connectorScheduleOccurrenceSummarySchema),
      total: z.number().int().nonnegative(),
      limit: z.number().int().positive().max(MAX_CONNECTOR_SCHEDULE_HISTORY_LIMIT),
      offset: z.number().int().nonnegative(),
      hasMore: z.boolean(),
    })
    .strict()

/** Public schedule-occurrence provenance attached to connector runs. */
export interface ConnectorRunScheduleOccurrenceLink {
  scheduleId: string
  scheduleRevision: string
  occurrenceId: string
  nominalAt: string
  admittedMode: ConnectorScheduleAdmittedMode
  idempotencyKey: string
}

export const connectorRunScheduleOccurrenceLinkSchema: z.ZodType<ConnectorRunScheduleOccurrenceLink> =
  z
    .object({
      scheduleId: z.string().min(1),
      scheduleRevision: z.string().min(1),
      occurrenceId: z.string().min(1),
      nominalAt: scheduleTimestampSchema,
      admittedMode: z.enum(connectorScheduleAdmittedModes),
      idempotencyKey: z.string().min(1),
    })
    .strict()
    .superRefine((link, context) => {
      const expected = connectorScheduleOccurrenceIdempotencyKey(
        link.scheduleRevision,
        link.nominalAt,
      )

      if (link.idempotencyKey !== expected) {
        context.addIssue({
          code: 'custom',
          message: 'idempotencyKey must equal scheduleRevision:nominalAt',
          path: ['idempotencyKey'],
        })
      }
    })
