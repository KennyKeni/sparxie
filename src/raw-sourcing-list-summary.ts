import { z } from 'zod'
import {
  reportedOriginKinds,
  type NormalizationGateStatus,
  type ReportedOriginKind,
  type SourceAdapterKind,
  type SourceAdapterProvenance,
} from './raw-sourcing.js'

/**
 * Bound for list *query filter* identity params only.
 * Summary output identity/display scalars stay unbounded like intake/canonical contracts.
 */
export const MAX_RAW_SOURCE_LIST_IDENTIFIER_LENGTH = 256

/** Non-empty scalar matching intake/canonical identity and display string rules. */
const listOutputStringSchema = z.string().min(1)

/**
 * Provider identity scalars follow intake/revision rules: any string, including
 * empty, or null. Do not require nonempty — empty string is a persisted fact.
 */
const listProviderIdentitySchema = z.string().nullable()

/**
 * Keyset ordering id: nonempty and well-formed Unicode scalar string so UTF-8
 * bytewise compare stays total and injective (rejects lone surrogates).
 */
const listOrderingIdSchema = listOutputStringSchema.refine(
  isWellFormedUnicodeScalarString,
  { message: 'id must be a well-formed Unicode scalar string' },
)

/** Node >=22 `String.prototype.isWellFormed` without widening package `lib`. */
function isWellFormedUnicodeScalarString(value: string): boolean {
  return (value as string & { isWellFormed(): boolean }).isWellFormed()
}

const listInstantSchema = z.iso.datetime({ offset: true })

export function isRawSourceListInstant(value: string): boolean {
  return listInstantSchema.safeParse(value).success
}

const ISO_INSTANT_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(Z|[+-]\d{2}:\d{2})$/

/**
 * Exact timeline compare for offset-carrying ISO-8601 instants.
 * Accepts every precision Zod `z.iso.datetime({ offset: true })` accepts:
 * minute (`HH:mm`), second (`HH:mm:ss`), and fractional seconds of any length.
 * Missing seconds are treated as zero. Equal UTC instants with different offsets
 * compare equal. Does not use `Date.parse`.
 */
export function compareIsoInstants(left: string, right: string): number {
  const leftInstant = toExactUtcTimeline(left)
  const rightInstant = toExactUtcTimeline(right)

  if (leftInstant.unixSeconds !== rightInstant.unixSeconds) {
    return leftInstant.unixSeconds < rightInstant.unixSeconds ? -1 : 1
  }

  const fractionLength = Math.max(
    leftInstant.fraction.length,
    rightInstant.fraction.length,
  )
  const leftFraction = leftInstant.fraction.padEnd(fractionLength, '0')
  const rightFraction = rightInstant.fraction.padEnd(fractionLength, '0')

  if (leftFraction === rightFraction) {
    return 0
  }

  return leftFraction < rightFraction ? -1 : 1
}

function toExactUtcTimeline(value: string): {
  unixSeconds: number
  fraction: string
} {
  const match = ISO_INSTANT_PATTERN.exec(value)
  if (!match) {
    throw new RangeError(`invalid ISO instant: ${value}`)
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  const second = match[6] === undefined ? 0 : Number(match[6])
  const fraction = match[7] ?? ''
  const offset = match[8]!

  const localUnixSeconds =
    daysFromCivil(year, month, day) * 86_400 + hour * 3_600 + minute * 60 + second

  return {
    unixSeconds: localUnixSeconds - offsetSeconds(offset),
    fraction,
  }
}

/** Howard Hinnant's civil-from-days inverse: days since Unix epoch for Y-M-D. */
function daysFromCivil(year: number, month: number, day: number): number {
  let y = year
  y -= month <= 2 ? 1 : 0
  const era = Math.floor(y / 400)
  const yearOfEra = y - era * 400
  const dayOfYear =
    Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1
  const dayOfEra =
    yearOfEra * 365 +
    Math.floor(yearOfEra / 4) -
    Math.floor(yearOfEra / 100) +
    dayOfYear
  return era * 146_097 + dayOfEra - 719_468
}

function offsetSeconds(offset: string): number {
  if (offset === 'Z') {
    return 0
  }

  const sign = offset[0] === '-' ? -1 : 1
  const hours = Number(offset.slice(1, 3))
  const minutes = Number(offset.slice(4, 6))
  return sign * (hours * 3_600 + minutes * 60)
}

export interface RawSourceListReportedOrigin {
  kind: ReportedOriginKind
  name: string
  /** Explicit sparse fact: required when origin exists, may be null. */
  providerId: string | null
}

export interface RawSourceListLatestRevision {
  id: string
  revision: number
  observedAt: string
  createdAt: string
}

interface RawSourceRecordSummaryCore {
  id: string
  sourceEntityId: string | null
  reportedOrigin: RawSourceListReportedOrigin | null
  providerRecordId: string | null
  companyName: string | null
  roleTitle: string | null
  createdAt: string
  firstObservedAt: string
  lastObservedAt: string
  firstReceivedAt: string
  lastReceivedAt: string
  occurrenceCount: number
  revisionCount: number
  latestRevision: RawSourceListLatestRevision
}

type ConnectorSummaryCapture = {
  adapter: SourceAdapterProvenance & { kind: 'connector' }
  connectorInstanceId: string
  latestConnectorRunId: string
}

type NonConnectorSummaryCapture = {
  adapter: SourceAdapterProvenance & { kind: Exclude<SourceAdapterKind, 'connector'> }
  connectorInstanceId: null
  latestConnectorRunId: null
}

type RawOnlyLifecycle = {
  normalizationStatus: 'raw_only'
  normalizationUpdatedAt: null
  normalizationRawRevisionId: null
  gateStatus: null
  canonicalCandidateId: null
  projectionStatus: 'not_eligible'
  findingId: null
}

type UnfinishedLifecycle = {
  normalizationStatus: 'pending' | 'in_progress' | 'blocked'
  normalizationUpdatedAt: string
  normalizationRawRevisionId: string
  gateStatus: null
  canonicalCandidateId: null
  projectionStatus: 'not_eligible'
  findingId: null
}

type CompletedNonPassingLifecycle = {
  normalizationStatus: 'completed'
  normalizationUpdatedAt: string
  normalizationRawRevisionId: string
  gateStatus: Exclude<NormalizationGateStatus, 'passed' | 'failed'>
  canonicalCandidateId: null
  projectionStatus: 'not_eligible'
  findingId: null
}

type CompletedPassedPendingLifecycle = {
  normalizationStatus: 'completed'
  normalizationUpdatedAt: string
  normalizationRawRevisionId: string
  gateStatus: 'passed'
  canonicalCandidateId: string
  projectionStatus: 'pending'
  findingId: null
}

type CompletedPassedProjectedLifecycle = {
  normalizationStatus: 'completed'
  normalizationUpdatedAt: string
  normalizationRawRevisionId: string
  gateStatus: 'passed'
  canonicalCandidateId: string
  projectionStatus: 'projected'
  findingId: string
}

type CompletedPassedFailedProjectionLifecycle = {
  normalizationStatus: 'completed'
  normalizationUpdatedAt: string
  normalizationRawRevisionId: string
  gateStatus: 'passed'
  canonicalCandidateId: string
  projectionStatus: 'failed'
  findingId: null
}

type FailedNormalizationLifecycle = {
  normalizationStatus: 'failed'
  normalizationUpdatedAt: string
  normalizationRawRevisionId: string
  gateStatus: 'failed' | null
  canonicalCandidateId: null
  projectionStatus: 'not_eligible'
  findingId: null
}

type RawSourceRecordLifecycle =
  | RawOnlyLifecycle
  | UnfinishedLifecycle
  | CompletedNonPassingLifecycle
  | CompletedPassedPendingLifecycle
  | CompletedPassedProjectedLifecycle
  | CompletedPassedFailedProjectionLifecycle
  | FailedNormalizationLifecycle

export type RawSourceRecordSummary = RawSourceRecordSummaryCore &
  (ConnectorSummaryCapture | NonConnectorSummaryCapture) &
  RawSourceRecordLifecycle

const listReportedOriginSchema = z
  .object({
    kind: z.enum(reportedOriginKinds),
    name: listOutputStringSchema,
    providerId: listProviderIdentitySchema,
  })
  .strict()

const listLatestRevisionSchema = z
  .object({
    id: listOutputStringSchema,
    revision: z.number().int().positive(),
    observedAt: listInstantSchema,
    createdAt: listInstantSchema,
  })
  .strict()

const summaryCoreShape = {
  id: listOrderingIdSchema,
  sourceEntityId: listOutputStringSchema.nullable(),
  reportedOrigin: listReportedOriginSchema.nullable(),
  providerRecordId: listProviderIdentitySchema,
  companyName: listOutputStringSchema.nullable(),
  roleTitle: listOutputStringSchema.nullable(),
  createdAt: listInstantSchema,
  firstObservedAt: listInstantSchema,
  lastObservedAt: listInstantSchema,
  firstReceivedAt: listInstantSchema,
  lastReceivedAt: listInstantSchema,
  occurrenceCount: z.number().int().positive(),
  revisionCount: z.number().int().positive(),
  latestRevision: listLatestRevisionSchema,
} as const

const connectorCaptureShape = {
  adapter: z
    .object({
      id: listOutputStringSchema,
      kind: z.literal('connector'),
      version: listOutputStringSchema,
    })
    .strict(),
  connectorInstanceId: listOutputStringSchema,
  latestConnectorRunId: listOutputStringSchema,
} as const

const nonConnectorCaptureShape = {
  adapter: z
    .object({
      id: listOutputStringSchema,
      kind: z.enum(['cli', 'manual', 'import']),
      version: listOutputStringSchema,
    })
    .strict(),
  connectorInstanceId: z.null(),
  latestConnectorRunId: z.null(),
} as const

function summaryBranch<Lifecycle extends z.ZodRawShape>(lifecycleShape: Lifecycle) {
  return z.union([
    z.object({ ...summaryCoreShape, ...connectorCaptureShape, ...lifecycleShape }).strict(),
    z
      .object({ ...summaryCoreShape, ...nonConnectorCaptureShape, ...lifecycleShape })
      .strict(),
  ])
}

const rawOnlyLifecycleShape = {
  normalizationStatus: z.literal('raw_only'),
  normalizationUpdatedAt: z.null(),
  normalizationRawRevisionId: z.null(),
  gateStatus: z.null(),
  canonicalCandidateId: z.null(),
  projectionStatus: z.literal('not_eligible'),
  findingId: z.null(),
} as const

const unfinishedLifecycleShape = {
  normalizationStatus: z.enum(['pending', 'in_progress', 'blocked']),
  normalizationUpdatedAt: listInstantSchema,
  normalizationRawRevisionId: listOutputStringSchema,
  gateStatus: z.null(),
  canonicalCandidateId: z.null(),
  projectionStatus: z.literal('not_eligible'),
  findingId: z.null(),
} as const

const completedNonPassingLifecycleShape = {
  normalizationStatus: z.literal('completed'),
  normalizationUpdatedAt: listInstantSchema,
  normalizationRawRevisionId: listOutputStringSchema,
  gateStatus: z.enum(['needs_enrichment', 'rejected']),
  canonicalCandidateId: z.null(),
  projectionStatus: z.literal('not_eligible'),
  findingId: z.null(),
} as const

const completedPassedPendingLifecycleShape = {
  normalizationStatus: z.literal('completed'),
  normalizationUpdatedAt: listInstantSchema,
  normalizationRawRevisionId: listOutputStringSchema,
  gateStatus: z.literal('passed'),
  canonicalCandidateId: listOutputStringSchema,
  projectionStatus: z.literal('pending'),
  findingId: z.null(),
} as const

const completedPassedProjectedLifecycleShape = {
  normalizationStatus: z.literal('completed'),
  normalizationUpdatedAt: listInstantSchema,
  normalizationRawRevisionId: listOutputStringSchema,
  gateStatus: z.literal('passed'),
  canonicalCandidateId: listOutputStringSchema,
  projectionStatus: z.literal('projected'),
  findingId: listOutputStringSchema,
} as const

const completedPassedFailedProjectionLifecycleShape = {
  normalizationStatus: z.literal('completed'),
  normalizationUpdatedAt: listInstantSchema,
  normalizationRawRevisionId: listOutputStringSchema,
  gateStatus: z.literal('passed'),
  canonicalCandidateId: listOutputStringSchema,
  projectionStatus: z.literal('failed'),
  findingId: z.null(),
} as const

const failedNormalizationLifecycleShape = {
  normalizationStatus: z.literal('failed'),
  normalizationUpdatedAt: listInstantSchema,
  normalizationRawRevisionId: listOutputStringSchema,
  gateStatus: z.literal('failed').nullable(),
  canonicalCandidateId: z.null(),
  projectionStatus: z.literal('not_eligible'),
  findingId: z.null(),
} as const

function refineSummaryLineage(
  summary: {
    createdAt: string
    firstObservedAt: string
    lastObservedAt: string
    firstReceivedAt: string
    lastReceivedAt: string
    occurrenceCount: number
    revisionCount: number
    latestRevision: RawSourceListLatestRevision
    normalizationUpdatedAt: string | null
    normalizationRawRevisionId: string | null
  },
  context: z.RefinementCtx,
) {
  if (
    areRawSourceListInstants(summary.firstObservedAt, summary.lastObservedAt) &&
    compareIsoInstants(summary.firstObservedAt, summary.lastObservedAt) > 0
  ) {
    context.addIssue({
      code: 'custom',
      message: 'firstObservedAt must be at or before lastObservedAt',
      path: ['firstObservedAt'],
    })
  }

  if (
    areRawSourceListInstants(summary.firstReceivedAt, summary.lastReceivedAt) &&
    compareIsoInstants(summary.firstReceivedAt, summary.lastReceivedAt) > 0
  ) {
    context.addIssue({
      code: 'custom',
      message: 'firstReceivedAt must be at or before lastReceivedAt',
      path: ['firstReceivedAt'],
    })
  }

  if (summary.latestRevision.revision !== summary.revisionCount) {
    context.addIssue({
      code: 'custom',
      message: 'latestRevision.revision must equal revisionCount',
      path: ['latestRevision', 'revision'],
    })
  }

  if (summary.revisionCount > summary.occurrenceCount) {
    context.addIssue({
      code: 'custom',
      message: 'revisionCount must be at or below occurrenceCount',
      path: ['revisionCount'],
    })
  }

  if (
    areRawSourceListInstants(
      summary.latestRevision.observedAt,
      summary.firstObservedAt,
      summary.lastObservedAt,
    ) &&
    (
      compareIsoInstants(summary.latestRevision.observedAt, summary.firstObservedAt) < 0 ||
      compareIsoInstants(summary.latestRevision.observedAt, summary.lastObservedAt) > 0
    )
  ) {
    context.addIssue({
      code: 'custom',
      message: 'latestRevision.observedAt must lie within first/last observed',
      path: ['latestRevision', 'observedAt'],
    })
  }

  if (
    areRawSourceListInstants(summary.latestRevision.createdAt, summary.createdAt) &&
    compareIsoInstants(summary.latestRevision.createdAt, summary.createdAt) < 0
  ) {
    context.addIssue({
      code: 'custom',
      message: 'latestRevision.createdAt must not precede record createdAt',
      path: ['latestRevision', 'createdAt'],
    })
  }
  if (
    areRawSourceListInstants(
      summary.latestRevision.createdAt,
      summary.firstReceivedAt,
      summary.lastReceivedAt,
    ) &&
    (
      compareIsoInstants(summary.latestRevision.createdAt, summary.firstReceivedAt) < 0 ||
      compareIsoInstants(summary.latestRevision.createdAt, summary.lastReceivedAt) > 0
    )
  ) {
    context.addIssue({
      code: 'custom',
      message: 'latestRevision.createdAt must lie within first/last received',
      path: ['latestRevision', 'createdAt'],
    })
  }

  if (
    summary.normalizationRawRevisionId !== null &&
    summary.normalizationRawRevisionId !== summary.latestRevision.id
  ) {
    context.addIssue({
      code: 'custom',
      message: 'normalizationRawRevisionId must equal latestRevision.id',
      path: ['normalizationRawRevisionId'],
    })
  }

  if (
    summary.normalizationUpdatedAt !== null &&
    areRawSourceListInstants(
      summary.normalizationUpdatedAt,
      summary.latestRevision.createdAt,
    ) &&
    compareIsoInstants(
      summary.normalizationUpdatedAt,
      summary.latestRevision.createdAt,
    ) < 0
  ) {
    context.addIssue({
      code: 'custom',
      message: 'normalizationUpdatedAt must not precede latestRevision.createdAt',
      path: ['normalizationUpdatedAt'],
    })
  }
}

function areRawSourceListInstants(...values: string[]): boolean {
  return values.every(isRawSourceListInstant)
}

export const rawSourceRecordSummarySchema: z.ZodType<RawSourceRecordSummary> = z
  .union([
    summaryBranch(rawOnlyLifecycleShape),
    summaryBranch(unfinishedLifecycleShape),
    summaryBranch(completedNonPassingLifecycleShape),
    summaryBranch(completedPassedPendingLifecycleShape),
    summaryBranch(completedPassedProjectedLifecycleShape),
    summaryBranch(completedPassedFailedProjectionLifecycleShape),
    summaryBranch(failedNormalizationLifecycleShape),
  ])
  .superRefine(refineSummaryLineage)
