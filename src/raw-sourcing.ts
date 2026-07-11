import { z } from 'zod'
import type { WorkMode } from './application.js'
import type { SourcingDestinationClass } from './sourcing.js'

/** JSON-safe values accepted by the raw sourcing transport contract. */
export type JsonPrimitive = boolean | number | string | null

export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

export interface JsonObject {
  [key: string]: JsonValue
}

/** Server-enforced transport limits shared by compatible implementations. */
export const MAX_RAW_SOURCE_BATCH_RECORDS = 100
export const MAX_RAW_SOURCE_PAYLOAD_BYTES = 262_144
export const MAX_RAW_SOURCE_EVIDENCE_ITEMS = 50
export const MAX_RAW_SOURCE_EVIDENCE_VALUE_BYTES = 16_384

export const sourceAdapterKinds = ['connector', 'cli', 'manual', 'import'] as const

export type SourceAdapterKind = (typeof sourceAdapterKinds)[number]

export function isSourceAdapterKind(value: string): value is SourceAdapterKind {
  return (sourceAdapterKinds as readonly string[]).includes(value)
}

export const fieldResolutionStatuses = [
  'resolved',
  'not_applicable',
  'abstained',
  'blocked',
  'retry',
  'rejected',
  'conflict',
  'failed',
  'suppressed',
  'locked',
] as const

export type FieldResolutionStatus = (typeof fieldResolutionStatuses)[number]

export function isFieldResolutionStatus(value: string): value is FieldResolutionStatus {
  return (fieldResolutionStatuses as readonly string[]).includes(value)
}

export const normalizationStatuses = [
  'pending',
  'in_progress',
  'completed',
  'blocked',
  'failed',
] as const

export type NormalizationStatus = (typeof normalizationStatuses)[number]

export function isNormalizationStatus(value: string): value is NormalizationStatus {
  return (normalizationStatuses as readonly string[]).includes(value)
}

export const normalizationGateStatuses = [
  'passed',
  'needs_enrichment',
  'rejected',
  'failed',
] as const

export type NormalizationGateStatus = (typeof normalizationGateStatuses)[number]

export function isNormalizationGateStatus(
  value: string,
): value is NormalizationGateStatus {
  return (normalizationGateStatuses as readonly string[]).includes(value)
}

export interface SourceAdapterProvenance {
  id: string
  kind: SourceAdapterKind
  version: string
}

export interface ConnectorCaptureReference {
  connectorInstanceId: string
  connectorRunId: string
}

export const reportedOriginKinds = [
  'employer',
  'ats',
  'job_board',
  'aggregator',
  'referral',
  'other',
] as const

export type ReportedOriginKind = (typeof reportedOriginKinds)[number]

export function isReportedOriginKind(value: string): value is ReportedOriginKind {
  return (reportedOriginKinds as readonly string[]).includes(value)
}

export interface ReportedSourceOrigin {
  kind: ReportedOriginKind
  name: string
  providerId?: string | null
  url?: string | null
}

export interface RawSourceEvidenceInput {
  kind: string
  label: string
  value: JsonValue
}

interface RawSourceRecordInputBase {
  observedAt: string
  reportedOrigin?: ReportedSourceOrigin | null
  providerRecordId?: string | null
  providerSchema?: string | null
  payload?: JsonObject | null
  evidence?: RawSourceEvidenceInput[]
}

export type RawSourceRecordInput = RawSourceRecordInputBase &
  (
    | {
        adapter: SourceAdapterProvenance & { kind: 'connector' }
        /**
         * Server-bound connector references. The workspace and adapter identity
         * are derived from the request route and registered connector instance.
         */
        capture: ConnectorCaptureReference
      }
    | {
        adapter: SourceAdapterProvenance
        capture?: never
      }
  )

const rawIdentifierSchema = z.string().min(1)

export const sourceAdapterProvenanceSchema = z
  .object({
    id: rawIdentifierSchema,
    kind: z.enum(sourceAdapterKinds),
    version: rawIdentifierSchema,
  })
  .strict()

export const connectorCaptureReferenceSchema = z
  .object({
    connectorInstanceId: rawIdentifierSchema,
    connectorRunId: rawIdentifierSchema,
  })
  .strict()

const reportedSourceOriginSchema = z
  .object({
    kind: z.enum(reportedOriginKinds),
    name: rawIdentifierSchema,
    providerId: z.string().nullable().optional(),
    url: z.string().nullable().optional(),
  })
  .strict()

const rawSourceEvidenceInputSchema = z
  .object({
    kind: rawIdentifierSchema,
    label: rawIdentifierSchema,
    value: z.json(),
  })
  .strict()

export const rawSourceRecordInputSchema = z
  .object({
    adapter: sourceAdapterProvenanceSchema,
    capture: connectorCaptureReferenceSchema.optional(),
    observedAt: z.iso.datetime({ offset: true }),
    reportedOrigin: reportedSourceOriginSchema.nullable().optional(),
    providerRecordId: z.string().nullable().optional(),
    providerSchema: z.string().nullable().optional(),
    payload: z.record(z.string(), z.json()).nullable().optional(),
    evidence: z.array(rawSourceEvidenceInputSchema).optional(),
  })
  .strict()
  .refine((record) => record.capture === undefined || record.adapter.kind === 'connector', {
    message: 'capture references require a connector adapter',
    path: ['capture'],
  })

export interface ConnectorCaptureBinding {
  requestWorkspaceId: string
  workspaceId: string
  connectorInstanceId: string
  connectorRunId: string
  adapter: SourceAdapterProvenance & { kind: 'connector' }
}

/**
 * Adds trusted route/registry correlation to raw intake validation. Servers
 * supply this binding after resolving the referenced connector instance/run.
 */
export function createBoundRawSourceRecordInputSchema(
  binding: ConnectorCaptureBinding,
) {
  return rawSourceRecordInputSchema.superRefine((record, context) => {
    if (record.capture === undefined) {
      return
    }

    const bound =
      binding.requestWorkspaceId === binding.workspaceId &&
      record.capture.connectorInstanceId === binding.connectorInstanceId &&
      record.capture.connectorRunId === binding.connectorRunId &&
      record.adapter.id === binding.adapter.id &&
      record.adapter.kind === binding.adapter.kind &&
      record.adapter.version === binding.adapter.version

    if (!bound) {
      context.addIssue({
        code: 'custom',
        message: 'capture must match the request workspace and registered connector lineage',
        path: ['capture'],
      })
    }
  })
}

export const batchRawSourceRecordsInputSchema = z
  .object({ records: z.array(rawSourceRecordInputSchema).max(MAX_RAW_SOURCE_BATCH_RECORDS) })
  .strict()

export interface BatchRawSourceRecordsInput {
  records: RawSourceRecordInput[]
}

export interface RawSourceRevisionReceipt {
  readonly id: string
  readonly rawRecordId: string
  readonly revision: number
  readonly contentHash: string
  readonly reused: boolean
  readonly createdAt: string
}

export interface RawSourceIntakeReceipt {
  readonly rawRecordId: string
  readonly sourceEntityId: string | null
  readonly revision: RawSourceRevisionReceipt
  readonly occurrence: RawSourceOccurrenceReceipt
}

export interface BatchRawSourceRecordsResult {
  receipts: RawSourceIntakeReceipt[]
}

export interface RawSourceRecord {
  id: string
  sourceEntityId: string | null
  adapter: SourceAdapterProvenance
  reportedOrigin: ReportedSourceOrigin | null
  createdAt: string
  latestRevision: RawSourceRevision
  occurrences: RawSourceOccurrenceReceipt[]
}

export interface RawSourceRevision {
  readonly id: string
  readonly rawRecordId: string
  readonly revision: number
  readonly contentHash: string
  readonly adapter: SourceAdapterProvenance
  readonly reportedOrigin: ReportedSourceOrigin | null
  readonly observedAt: string
  readonly providerRecordId: string | null
  readonly providerSchema: string | null
  readonly payload: JsonObject | null
  readonly evidence: RawSourceEvidenceInput[]
  readonly createdAt: string
}

export interface RawSourceOccurrenceReceipt {
  readonly id: string
  readonly rawRecordId: string
  readonly rawRevisionId: string
  readonly capture?: ConnectorCaptureReference | null
  readonly observedAt: string
  readonly receivedAt: string
}

export const canonicalCandidateFields = [
  'canonicalIdentity',
  'companyName',
  'roleTitle',
  'employmentType',
  'seniority',
  'workMode',
  'location',
  'destinationUrl',
  'sourceUrl',
  'providerJobId',
  'postedAt',
  'compensation',
] as const

export type CanonicalCandidateField = (typeof canonicalCandidateFields)[number]

export const resolverCapabilities = ['pure', 'network', 'model', 'browser'] as const

export type ResolverCapability = (typeof resolverCapabilities)[number]

export const resolverCostClasses = ['none', 'low', 'medium', 'high'] as const

export type ResolverCostClass = (typeof resolverCostClasses)[number]

export interface ResolverDeclaration {
  id: string
  version: string
  supportedAdapters?: {
    kinds?: SourceAdapterKind[]
    ids?: string[]
    versions?: string[]
  }
  supportedProviderSchemas?: string[]
  requiredInputs: string[]
  outputFields: CanonicalCandidateField[]
  capabilities: ResolverCapability[]
  costClass: ResolverCostClass
  /** Higher values run before lower values for the same field. */
  precedence: number
}

export const resolverApplicabilityStatuses = [
  'applicable',
  'not_applicable',
  'blocked',
] as const

export type ResolverApplicabilityStatus =
  (typeof resolverApplicabilityStatuses)[number]

export interface ResolverApplicabilityDecision {
  resolverId: string
  resolverVersion: string
  field: CanonicalCandidateField
  inputHash: string
  status: ResolverApplicabilityStatus
  reason?: string
  missingCapabilities?: ResolverCapability[]
}

export interface ResolutionEvidence {
  kind: string
  value: JsonValue
  path?: string
  sourceUrl?: string
}

interface FieldResolutionOutcomeBase {
  resolverId: string
  resolverVersion: string
  field: CanonicalCandidateField
  inputHash: string
  evidence?: ResolutionEvidence[]
}

export type FieldResolutionOutcome =
  | (FieldResolutionOutcomeBase & {
      status: 'resolved'
      value: JsonValue
      confidence: number
      authoritative?: boolean
    })
  | (FieldResolutionOutcomeBase & {
      status: 'not_applicable' | 'abstained' | 'blocked' | 'rejected' | 'failed'
      reason: string
    })
  | (FieldResolutionOutcomeBase & {
      status: 'retry'
      reason: string
      retryAfter?: string | null
    })
  | (FieldResolutionOutcomeBase & {
      status: 'conflict'
      reason: string
      values: JsonValue[]
    })
  | (FieldResolutionOutcomeBase & {
      status: 'suppressed'
      reason: string
      policyVersion: string
    })
  | (FieldResolutionOutcomeBase & {
      status: 'locked'
      value: JsonValue
      reason: string
      policyVersion: string
    })

export interface NormalizationAttempt {
  readonly id: string
  readonly rawRevisionId: string
  resolver: ResolverDeclaration
  inputHash: string
  status: NormalizationStatus
  applicability?: ResolverApplicabilityDecision[]
  startedAt: string
  completedAt: string | null
  outcomes: FieldResolutionOutcome[]
}

export const canonicalEmploymentTypes = [
  'full_time',
  'part_time',
  'contract',
  'temporary',
  'internship',
  'apprenticeship',
  'other',
  'unknown',
] as const

export type CanonicalEmploymentType = (typeof canonicalEmploymentTypes)[number]

export interface CanonicalLocation {
  raw: string | null
  city: string | null
  region: string | null
  country: string | null
}

export interface CanonicalCandidateDestination {
  class: SourcingDestinationClass
  url: string
  intermediaryUrl?: string | null
}

export const canonicalIdentityKinds = [
  'provider_job',
  'destination_url',
  'source_alias',
] as const

export type CanonicalIdentityKind = (typeof canonicalIdentityKinds)[number]

export interface CanonicalSourceIdentity {
  kind: CanonicalIdentityKind
  value: string
}

export const canonicalSeniorities = [
  'internship',
  'entry_level',
  'associate',
  'mid_level',
  'senior',
  'staff',
  'principal',
  'manager',
  'director',
  'executive',
  'unknown',
] as const

export type CanonicalSeniority = (typeof canonicalSeniorities)[number]

export const canonicalCompensationIntervals = [
  'hour',
  'day',
  'week',
  'month',
  'year',
  'one_time',
  'unknown',
] as const

export type CanonicalCompensationInterval =
  (typeof canonicalCompensationIntervals)[number]

export interface CanonicalCompensation {
  minimum: number | null
  maximum: number | null
  currency: string | null
  interval: CanonicalCompensationInterval
  raw: string | null
}

export const canonicalPostedAtPrecisions = [
  'instant',
  'date',
  'relative',
  'unknown',
] as const

export type CanonicalPostedAtPrecision =
  (typeof canonicalPostedAtPrecisions)[number]

export type CanonicalPostedAt =
  | {
      value: null
      precision: 'unknown'
      raw: string | null
    }
  | {
      value: string
      precision: Exclude<CanonicalPostedAtPrecision, 'unknown'>
      raw: string | null
    }

export interface CanonicalSourceCandidateReference {
  id: string
  sourceEntityId: string
  rawRecordId: string
  rawRevisionId: string
  schemaVersion: string
}

export interface CanonicalSourceCandidate extends CanonicalSourceCandidateReference {
  canonicalIdentity: CanonicalSourceIdentity
  companyName: string
  roleTitle: string
  employmentType: CanonicalEmploymentType
  seniority: CanonicalSeniority
  workMode: WorkMode
  location: CanonicalLocation | null
  compensation: CanonicalCompensation | null
  postedAt: CanonicalPostedAt
  destination: CanonicalCandidateDestination | null
  sourceUrl: string | null
  providerJobId: string | null
  observedAt: string
}

interface NormalizationGateOutcomeBase {
  policyVersion: string
  requiredFields: CanonicalCandidateField[]
  missingFields: CanonicalCandidateField[]
  conflictingFields: CanonicalCandidateField[]
  reason?: string | null
  evaluatedAt: string
}

export interface PassedNormalizationGateOutcome
  extends NormalizationGateOutcomeBase {
  status: 'passed'
  missingFields: []
  conflictingFields: []
  candidate: CanonicalSourceCandidateReference
}

export interface NeedsEnrichmentNormalizationGateOutcome
  extends NormalizationGateOutcomeBase {
  status: 'needs_enrichment'
  candidate: null
}

export interface RejectedNormalizationGateOutcome
  extends NormalizationGateOutcomeBase {
  status: 'rejected'
  candidate: null
}

export interface FailedNormalizationGateOutcome
  extends NormalizationGateOutcomeBase {
  status: 'failed'
  candidate: null
}

export type NormalizationGateOutcome =
  | PassedNormalizationGateOutcome
  | NeedsEnrichmentNormalizationGateOutcome
  | RejectedNormalizationGateOutcome
  | FailedNormalizationGateOutcome

interface RawSourceNormalizationResultBase {
  rawRecordId: string
  rawRevisionId: string
  canonicalSchemaVersion: string
  attempts: NormalizationAttempt[]
  fieldOutcomes: FieldResolutionOutcome[]
  updatedAt: string
}

export type RawSourceNormalizationResult =
  | (RawSourceNormalizationResultBase & {
      status: 'pending' | 'in_progress' | 'blocked'
      gate: null
      canonicalCandidate: null
    })
  | (RawSourceNormalizationResultBase & {
      status: 'completed'
      gate: PassedNormalizationGateOutcome
      canonicalCandidate: CanonicalSourceCandidate
    })
  | (RawSourceNormalizationResultBase & {
      status: 'completed'
      gate:
        | NeedsEnrichmentNormalizationGateOutcome
        | RejectedNormalizationGateOutcome
      canonicalCandidate: null
    })
  | (RawSourceNormalizationResultBase & {
      status: 'failed'
      gate: FailedNormalizationGateOutcome | null
      canonicalCandidate: null
    })

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Runtime correlation guard for persisted normalization and gate outcomes. */
export const rawSourceNormalizationResultSchema = z
  .custom<RawSourceNormalizationResult>(isObjectRecord)
  .superRefine((result, context) => {
    const gate = isObjectRecord(result.gate) ? result.gate : null
    const candidate = isObjectRecord(result.canonicalCandidate)
      ? result.canonicalCandidate
      : null

    if (result.status === 'pending' || result.status === 'in_progress' || result.status === 'blocked') {
      if (result.gate !== null || result.canonicalCandidate !== null) {
        context.addIssue({
          code: 'custom',
          message: 'unfinished normalization cannot carry a gate or candidate',
        })
      }
      return
    }

    if (result.status === 'failed') {
      if (candidate !== null || (gate !== null && gate.status !== 'failed')) {
        context.addIssue({
          code: 'custom',
          message: 'failed normalization can carry only a failed gate and no candidate',
        })
      }
      return
    }

    if (result.status !== 'completed' || gate === null) {
      context.addIssue({ code: 'custom', message: 'completed normalization requires a gate' })
      return
    }

    if (gate.status !== 'passed') {
      if (
        (gate.status !== 'needs_enrichment' && gate.status !== 'rejected') ||
        candidate !== null
      ) {
        context.addIssue({
          code: 'custom',
          message: 'non-passing completed gate cannot carry a canonical candidate',
        })
      }
      return
    }

    if (
      !Array.isArray(gate.missingFields) ||
      gate.missingFields.length > 0 ||
      !Array.isArray(gate.conflictingFields) ||
      gate.conflictingFields.length > 0
    ) {
      context.addIssue({
        code: 'custom',
        message: 'passed gate cannot report missing or conflicting candidate facts',
      })
    }

    const gateCandidate = isObjectRecord(gate.candidate) ? gate.candidate : null
    if (candidate === null || gateCandidate === null) {
      context.addIssue({ code: 'custom', message: 'passed gate requires its canonical candidate' })
      return
    }

    const lineageKeys = ['id', 'sourceEntityId', 'rawRecordId', 'rawRevisionId', 'schemaVersion'] as const
    const gateAndCandidateMatch = lineageKeys.every(
      (key) => gateCandidate[key] === candidate[key],
    )
    const resultLineageMatches =
      candidate.rawRecordId === result.rawRecordId &&
      candidate.rawRevisionId === result.rawRevisionId &&
      candidate.schemaVersion === result.canonicalSchemaVersion

    if (!gateAndCandidateMatch || !resultLineageMatches) {
      context.addIssue({
        code: 'custom',
        message: 'gate, candidate, and raw revision lineage must match exactly',
      })
    }
  })

export interface ResolverVersionRef {
  resolverId: string
  version: string
}

export type RawSourceReplaySelector =
  | {
      rawRecordIds: string[]
      rawRevisionIds?: string[]
      inputHashes?: string[]
    }
  | {
      rawRecordIds?: string[]
      rawRevisionIds: string[]
      inputHashes?: string[]
    }
  | {
      rawRecordIds?: string[]
      rawRevisionIds?: string[]
      inputHashes: string[]
    }

export interface RawSourceReplayInvalidation {
  resolverVersions?: ResolverVersionRef[]
  canonicalSchemaVersions?: string[]
  gatePolicyVersions?: string[]
}

export interface RawSourceReplayTargetVersions {
  resolvers?: ResolverVersionRef[]
  canonicalSchemaVersion?: string
  gatePolicyVersion?: string
}

export type RawSourceFieldDirective =
  | {
      action: 'lock'
      field: CanonicalCandidateField
      value: JsonValue
      reason: string
      inputHash: string
      policyVersion: string
    }
  | {
      action: 'suppress'
      field: CanonicalCandidateField
      reason: string
      inputHash: string
      policyVersion: string
    }

export interface ReplayRawSourceRecordsInput {
  selector: RawSourceReplaySelector
  invalidate: RawSourceReplayInvalidation
  targetVersions?: RawSourceReplayTargetVersions
  fieldDirectives?: RawSourceFieldDirective[]
}

const replayIdentifierSchema = z.string().min(1)
const replayTimestampSchema = z.iso.datetime({ offset: true })

export const completedRawSourceReplayItemSchema = z
  .object({
    status: z.literal('completed'),
    rawRecordId: replayIdentifierSchema,
    rawRevisionId: replayIdentifierSchema,
    normalizationRunId: replayIdentifierSchema.optional(),
  })
  .strict()

export type CompletedRawSourceReplayItem = z.infer<
  typeof completedRawSourceReplayItemSchema
>

export const rawSourceReplayFailureCodes = [
  'normalization_failed',
  'persistence_failed',
  'internal_error',
] as const

export type RawSourceReplayFailureCode =
  (typeof rawSourceReplayFailureCodes)[number]

/**
 * Closed replay failure data. Implementations must map thrown values to this
 * shape rather than exposing messages, causes, URLs, or provider data.
 */
export const rawSourceReplayFailureSchema = z
  .object({
    code: z.enum(rawSourceReplayFailureCodes),
    retryable: z.boolean(),
  })
  .strict()

export type RawSourceReplayFailure = z.infer<typeof rawSourceReplayFailureSchema>

export const failedRawSourceReplayItemSchema = z
  .object({
    status: z.literal('failed'),
    rawRecordId: replayIdentifierSchema,
    rawRevisionId: replayIdentifierSchema,
    normalizationRunId: replayIdentifierSchema.optional(),
    failure: rawSourceReplayFailureSchema,
  })
  .strict()

export type FailedRawSourceReplayItem = z.infer<
  typeof failedRawSourceReplayItemSchema
>

export const rawSourceReplayItemSchema = z.discriminatedUnion('status', [
  completedRawSourceReplayItemSchema,
  failedRawSourceReplayItemSchema,
])

export type RawSourceReplayItem = z.infer<typeof rawSourceReplayItemSchema>

const rawSourceReplayReceiptBaseShape = {
  replayId: replayIdentifierSchema,
  acceptedAt: replayTimestampSchema,
  completedAt: replayTimestampSchema,
  matchedRawRevisionIds: z.array(replayIdentifierSchema),
} as const

const completedRawSourceReplayReceiptSchema = z
  .object({
    ...rawSourceReplayReceiptBaseShape,
    status: z.literal('completed'),
    items: z.array(completedRawSourceReplayItemSchema),
  })
  .strict()

const completedWithFailuresRawSourceReplayReceiptSchema = z
  .object({
    ...rawSourceReplayReceiptBaseShape,
    status: z.literal('completed_with_failures'),
    items: z.array(rawSourceReplayItemSchema).min(1),
  })
  .strict()
  .refine((receipt) => receipt.items.some((item) => item.status === 'failed'), {
    message: 'completed_with_failures requires at least one failed item',
    path: ['items'],
  })

export const rawSourceReplayReceiptSchema = z
  .union([
    completedRawSourceReplayReceiptSchema,
    completedWithFailuresRawSourceReplayReceiptSchema,
  ])
  .superRefine((receipt, context) => {
    if (Date.parse(receipt.completedAt) < Date.parse(receipt.acceptedAt)) {
      context.addIssue({
        code: 'custom',
        message: 'completedAt must not precede acceptedAt',
        path: ['completedAt'],
      })
    }

    const matchedIds = new Set(receipt.matchedRawRevisionIds)
    const itemIds = new Set(receipt.items.map((item) => item.rawRevisionId))

    if (
      matchedIds.size !== receipt.matchedRawRevisionIds.length ||
      itemIds.size !== receipt.items.length ||
      matchedIds.size !== itemIds.size ||
      [...matchedIds].some((id) => !itemIds.has(id))
    ) {
      context.addIssue({
        code: 'custom',
        message: 'items must identify every matched raw revision exactly once',
        path: ['items'],
      })
    }
  })

export type RawSourceReplayReceipt = z.infer<typeof rawSourceReplayReceiptSchema>
