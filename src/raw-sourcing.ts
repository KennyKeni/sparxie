import { z } from 'zod'
import { workModes, type WorkMode } from './application.js'
import {
  retryAdviceSchema,
  type CancelledRetryAdvice,
  type ExhaustedRetryAdvice,
  type NotDueRetryAdvice,
  type ScheduledRetryAdvice,
} from './retry.js'
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
  'exhausted',
  'cancelled',
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
      retry: ScheduledRetryAdvice | NotDueRetryAdvice
    })
  | (FieldResolutionOutcomeBase & {
      status: 'exhausted'
      retry: ExhaustedRetryAdvice
    })
  | (FieldResolutionOutcomeBase & {
      status: 'cancelled'
      retry: CancelledRetryAdvice
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

export const MAX_CANONICAL_RELATIVE_POSTED_AT_LENGTH = 256

export const canonicalPostedAtSchema = z.discriminatedUnion('precision', [
  z
    .object({
      value: z.iso.datetime({ offset: true }),
      precision: z.literal('instant'),
      raw: z.string().nullable(),
    })
    .strict(),
  z
    .object({
      value: z.iso.date(),
      precision: z.literal('date'),
      raw: z.string().nullable(),
    })
    .strict(),
  z
    .object({
      value: z.string().min(1).max(MAX_CANONICAL_RELATIVE_POSTED_AT_LENGTH),
      precision: z.literal('relative'),
      raw: z.string().nullable(),
    })
    .strict(),
  z
    .object({
      value: z.null(),
      precision: z.literal('unknown'),
      raw: z.string().nullable(),
    })
    .strict(),
])

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

const resolutionEvidenceSchema = z
  .object({
    kind: rawIdentifierSchema,
    value: z.json(),
    path: z.string().optional(),
    sourceUrl: z.string().optional(),
  })
  .strict()

const fieldResolutionOutcomeBaseShape = {
  resolverId: rawIdentifierSchema,
  resolverVersion: rawIdentifierSchema,
  field: z.enum(canonicalCandidateFields),
  inputHash: rawIdentifierSchema,
  evidence: z.array(resolutionEvidenceSchema).optional(),
} as const

const schedulableRetryAdviceSchema = retryAdviceSchema.refine(
  (
    advice,
  ): advice is ScheduledRetryAdvice | NotDueRetryAdvice =>
    advice.state === 'scheduled' || advice.state === 'not_due',
  { message: 'retry outcomes require schedulable retry advice' },
)

const exhaustedRetryAdviceSchema = retryAdviceSchema.refine(
  (advice): advice is ExhaustedRetryAdvice => advice.state === 'exhausted',
  { message: 'exhausted outcomes require exhausted retry advice' },
)

const cancelledRetryAdviceSchema = retryAdviceSchema.refine(
  (advice): advice is CancelledRetryAdvice => advice.state === 'cancelled',
  { message: 'cancelled outcomes require cancelled retry advice' },
)

const fieldResolutionOutcomeSchema = z.union([
  z
    .object({
      ...fieldResolutionOutcomeBaseShape,
      status: z.literal('resolved'),
      value: z.json(),
      confidence: z.number(),
      authoritative: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      ...fieldResolutionOutcomeBaseShape,
      status: z.enum(['not_applicable', 'abstained', 'blocked', 'rejected', 'failed']),
      reason: z.string(),
    })
    .strict(),
  z
    .object({
      ...fieldResolutionOutcomeBaseShape,
      status: z.literal('retry'),
      retry: schedulableRetryAdviceSchema,
    })
    .strict(),
  z
    .object({
      ...fieldResolutionOutcomeBaseShape,
      status: z.literal('exhausted'),
      retry: exhaustedRetryAdviceSchema,
    })
    .strict(),
  z
    .object({
      ...fieldResolutionOutcomeBaseShape,
      status: z.literal('cancelled'),
      retry: cancelledRetryAdviceSchema,
    })
    .strict(),
  z
    .object({
      ...fieldResolutionOutcomeBaseShape,
      status: z.literal('conflict'),
      reason: z.string(),
      values: z.array(z.json()),
    })
    .strict(),
  z
    .object({
      ...fieldResolutionOutcomeBaseShape,
      status: z.literal('suppressed'),
      reason: z.string(),
      policyVersion: rawIdentifierSchema,
    })
    .strict(),
  z
    .object({
      ...fieldResolutionOutcomeBaseShape,
      status: z.literal('locked'),
      value: z.json(),
      reason: z.string(),
      policyVersion: rawIdentifierSchema,
    })
    .strict(),
])

const resolverDeclarationSchema = z
  .object({
    id: rawIdentifierSchema,
    version: rawIdentifierSchema,
    supportedAdapters: z
      .object({
        kinds: z.array(z.enum(sourceAdapterKinds)).optional(),
        ids: z.array(rawIdentifierSchema).optional(),
        versions: z.array(rawIdentifierSchema).optional(),
      })
      .strict()
      .optional(),
    supportedProviderSchemas: z.array(z.string()).optional(),
    requiredInputs: z.array(z.string()),
    outputFields: z.array(z.enum(canonicalCandidateFields)),
    capabilities: z.array(z.enum(resolverCapabilities)),
    costClass: z.enum(resolverCostClasses),
    precedence: z.number(),
  })
  .strict()

const resolverApplicabilityDecisionSchema = z
  .object({
    resolverId: rawIdentifierSchema,
    resolverVersion: rawIdentifierSchema,
    field: z.enum(canonicalCandidateFields),
    inputHash: rawIdentifierSchema,
    status: z.enum(resolverApplicabilityStatuses),
    reason: z.string().optional(),
    missingCapabilities: z.array(z.enum(resolverCapabilities)).optional(),
  })
  .strict()

const normalizationAttemptSchema = z
  .object({
    id: rawIdentifierSchema,
    rawRevisionId: rawIdentifierSchema,
    resolver: resolverDeclarationSchema,
    inputHash: rawIdentifierSchema,
    status: z.enum(normalizationStatuses),
    applicability: z.array(resolverApplicabilityDecisionSchema).optional(),
    startedAt: z.iso.datetime({ offset: true }),
    completedAt: z.iso.datetime({ offset: true }).nullable(),
    outcomes: z.array(fieldResolutionOutcomeSchema),
  })
  .strict()

const canonicalSourceCandidateReferenceSchema = z
  .object({
    id: rawIdentifierSchema,
    sourceEntityId: rawIdentifierSchema,
    rawRecordId: rawIdentifierSchema,
    rawRevisionId: rawIdentifierSchema,
    schemaVersion: rawIdentifierSchema,
  })
  .strict()

const canonicalSourceCandidateSchema = z
  .object({
    ...canonicalSourceCandidateReferenceSchema.shape,
    canonicalIdentity: z
      .object({
        kind: z.enum(canonicalIdentityKinds),
        value: rawIdentifierSchema,
      })
      .strict(),
    companyName: rawIdentifierSchema,
    roleTitle: rawIdentifierSchema,
    employmentType: z.enum(canonicalEmploymentTypes),
    seniority: z.enum(canonicalSeniorities),
    workMode: z.enum(workModes),
    location: z
      .object({
        raw: z.string().nullable(),
        city: z.string().nullable(),
        region: z.string().nullable(),
        country: z.string().nullable(),
      })
      .strict()
      .nullable(),
    compensation: z
      .object({
        minimum: z.number().nullable(),
        maximum: z.number().nullable(),
        currency: z.string().nullable(),
        interval: z.enum(canonicalCompensationIntervals),
        raw: z.string().nullable(),
      })
      .strict()
      .nullable(),
    postedAt: canonicalPostedAtSchema,
    destination: z
      .object({
        class: z.enum(['employer_or_ats', 'third_party_job_posting']),
        url: rawIdentifierSchema,
        intermediaryUrl: z.string().nullable().optional(),
      })
      .strict()
      .nullable(),
    sourceUrl: z.string().nullable(),
    providerJobId: z.string().nullable(),
    observedAt: z.iso.datetime({ offset: true }),
  })
  .strict()

const normalizationGateBaseShape = {
  policyVersion: rawIdentifierSchema,
  requiredFields: z.array(z.enum(canonicalCandidateFields)),
  reason: z.string().nullable().optional(),
  evaluatedAt: z.iso.datetime({ offset: true }),
} as const

const passedNormalizationGateOutcomeSchema = z
  .object({
    ...normalizationGateBaseShape,
    status: z.literal('passed'),
    missingFields: z.tuple([]),
    conflictingFields: z.tuple([]),
    candidate: canonicalSourceCandidateReferenceSchema,
  })
  .strict()

const needsEnrichmentNormalizationGateOutcomeSchema = z
  .object({
    ...normalizationGateBaseShape,
    status: z.literal('needs_enrichment'),
    missingFields: z.array(z.enum(canonicalCandidateFields)),
    conflictingFields: z.array(z.enum(canonicalCandidateFields)),
    candidate: z.null(),
  })
  .strict()

const rejectedNormalizationGateOutcomeSchema = z
  .object({
    ...normalizationGateBaseShape,
    status: z.literal('rejected'),
    missingFields: z.array(z.enum(canonicalCandidateFields)),
    conflictingFields: z.array(z.enum(canonicalCandidateFields)),
    candidate: z.null(),
  })
  .strict()

const failedNormalizationGateOutcomeSchema = z
  .object({
    ...normalizationGateBaseShape,
    status: z.literal('failed'),
    missingFields: z.array(z.enum(canonicalCandidateFields)),
    conflictingFields: z.array(z.enum(canonicalCandidateFields)),
    candidate: z.null(),
  })
  .strict()

const normalizationResultBaseShape = {
  rawRecordId: rawIdentifierSchema,
  rawRevisionId: rawIdentifierSchema,
  canonicalSchemaVersion: rawIdentifierSchema,
  attempts: z.array(normalizationAttemptSchema),
  fieldOutcomes: z.array(fieldResolutionOutcomeSchema),
  updatedAt: z.iso.datetime({ offset: true }),
} as const

const unfinishedRawSourceNormalizationResultSchema = z
  .object({
    ...normalizationResultBaseShape,
    status: z.enum(['pending', 'in_progress', 'blocked']),
    gate: z.null(),
    canonicalCandidate: z.null(),
  })
  .strict()

const failedRawSourceNormalizationResultSchema = z
  .object({
    ...normalizationResultBaseShape,
    status: z.literal('failed'),
    gate: z.union([failedNormalizationGateOutcomeSchema, z.null()]),
    canonicalCandidate: z.null(),
  })
  .strict()

const passedRawSourceNormalizationResultSchema = z
  .object({
    ...normalizationResultBaseShape,
    status: z.literal('completed'),
    gate: passedNormalizationGateOutcomeSchema,
    canonicalCandidate: canonicalSourceCandidateSchema,
  })
  .strict()

const nonPassingRawSourceNormalizationResultSchema = z
  .object({
    ...normalizationResultBaseShape,
    status: z.literal('completed'),
    gate: z.union([
      needsEnrichmentNormalizationGateOutcomeSchema,
      rejectedNormalizationGateOutcomeSchema,
    ]),
    canonicalCandidate: z.null(),
  })
  .strict()

/** Runtime correlation guard for persisted normalization and gate outcomes. */
export const rawSourceNormalizationResultSchema: z.ZodType<RawSourceNormalizationResult> = z
  .union([
    unfinishedRawSourceNormalizationResultSchema,
    failedRawSourceNormalizationResultSchema,
    passedRawSourceNormalizationResultSchema,
    nonPassingRawSourceNormalizationResultSchema,
  ])
  .superRefine((result, context) => {
    for (const [attemptIndex, attempt] of result.attempts.entries()) {
      if (attempt.rawRevisionId !== result.rawRevisionId) {
        context.addIssue({
          code: 'custom',
          message: 'normalization attempts must match the result raw revision',
          path: ['attempts', attemptIndex, 'rawRevisionId'],
        })
      }

      for (const [applicabilityIndex, applicability] of
        (attempt.applicability ?? []).entries()) {
        if (
          applicability.resolverId !== attempt.resolver.id ||
          applicability.resolverVersion !== attempt.resolver.version ||
          applicability.inputHash !== attempt.inputHash
        ) {
          context.addIssue({
            code: 'custom',
            message: 'applicability must match its parent resolver and input lineage',
            path: ['attempts', attemptIndex, 'applicability', applicabilityIndex],
          })
        }
        if (!attempt.resolver.outputFields.includes(applicability.field)) {
          context.addIssue({
            code: 'custom',
            message: 'applicability field must be declared by its parent resolver',
            path: ['attempts', attemptIndex, 'applicability', applicabilityIndex, 'field'],
          })
        }
      }

      for (const [outcomeIndex, outcome] of attempt.outcomes.entries()) {
        if (
          outcome.resolverId !== attempt.resolver.id ||
          outcome.resolverVersion !== attempt.resolver.version ||
          outcome.inputHash !== attempt.inputHash
        ) {
          context.addIssue({
            code: 'custom',
            message: 'outcome must match its parent resolver and input lineage',
            path: ['attempts', attemptIndex, 'outcomes', outcomeIndex],
          })
        }
        if (!attempt.resolver.outputFields.includes(outcome.field)) {
          context.addIssue({
            code: 'custom',
            message: 'outcome field must be declared by its parent resolver',
            path: ['attempts', attemptIndex, 'outcomes', outcomeIndex, 'field'],
          })
        }
      }
    }

    if (
      result.status !== 'completed' ||
      result.gate.status !== 'passed' ||
      result.gate.candidate === null ||
      result.canonicalCandidate === null
    ) return

    const lineageKeys = ['id', 'sourceEntityId', 'rawRecordId', 'rawRevisionId', 'schemaVersion'] as const
    const gateAndCandidateMatch = lineageKeys.every(
      (key) => result.gate.candidate[key] === result.canonicalCandidate[key],
    )
    const resultLineageMatches =
      result.canonicalCandidate.rawRecordId === result.rawRecordId &&
      result.canonicalCandidate.rawRevisionId === result.rawRevisionId &&
      result.canonicalCandidate.schemaVersion === result.canonicalSchemaVersion

    if (!gateAndCandidateMatch || !resultLineageMatches) {
      context.addIssue({
        code: 'custom',
        message: 'gate, candidate, and raw revision lineage must match exactly',
      })
    }
  })

export * from './raw-sourcing-replay.js'
