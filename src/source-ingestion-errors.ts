import { z } from 'zod'
import {
  parseValedictorianRetryAfterHeader,
  valedictorianFailureKindMessages,
  valedictorianInternalErrorBodySchema,
  valedictorianInternalErrorCode,
  valedictorianInternalErrorKind,
  valedictorianInternalErrorStatus,
  type ValedictorianFailureKind,
  type ValedictorianInternalErrorBody,
  type ValedictorianRetryAfter,
} from './http-error-contract.js'
import { careerSourceLifecycleStatuses } from './source-ingestion.js'

export const sourceAccessErrorBodies = Object.freeze({
  unauthorized: {
    code: 'unauthorized',
    message: valedictorianFailureKindMessages.authentication,
  },
  forbidden: {
    code: 'forbidden',
    message: valedictorianFailureKindMessages.authorization,
  },
} as const)

export const sourceAccessErrorStatusByCode = Object.freeze({
  unauthorized: 401,
  forbidden: 403,
} as const)

export const sourceAccessErrorKindByCode = Object.freeze({
  unauthorized: 'authentication',
  forbidden: 'authorization',
} as const satisfies Record<keyof typeof sourceAccessErrorBodies, ValedictorianFailureKind>)

export const sourceBrowseErrorBodies = Object.freeze({
  invalid_companies_query: {
    code: 'invalid_companies_query',
    message: 'The Companies query is malformed.',
  },
  invalid_jobs_query: {
    code: 'invalid_jobs_query',
    message: 'The CurrentJobIndex query is malformed.',
  },
  invalid_runs_query: {
    code: 'invalid_runs_query',
    message: 'The SourceRuns query is malformed.',
  },
  invalid_schedules_query: {
    code: 'invalid_schedules_query',
    message: 'The SourceSchedules query is malformed.',
  },
  invalid_sources_query: {
    code: 'invalid_sources_query',
    message: 'The CareerSources query is malformed.',
  },
} as const)

export const sourceBrowseErrorStatusByCode = Object.freeze({
  invalid_companies_query: 400,
  invalid_jobs_query: 400,
  invalid_runs_query: 400,
  invalid_schedules_query: 400,
  invalid_sources_query: 400,
} as const)

export const sourceBrowseErrorKindByCode = Object.freeze({
  invalid_companies_query: 'validation',
  invalid_jobs_query: 'validation',
  invalid_runs_query: 'validation',
  invalid_schedules_query: 'validation',
  invalid_sources_query: 'validation',
} as const satisfies Record<keyof typeof sourceBrowseErrorBodies, ValedictorianFailureKind>)

export const careerSourceErrorBodies = Object.freeze({
  career_source_not_found: {
    code: 'career_source_not_found',
    message: 'The CareerSource was not found.',
  },
  duplicate_career_source: {
    code: 'duplicate_career_source',
    message: 'The CareerSource is already registered.',
  },
  invalid_career_source_lifecycle: {
    code: 'invalid_career_source_lifecycle',
    message: 'The CareerSource lifecycle transition conflicts with its current state.',
  },
  invalid_lifecycle_status: {
    code: 'invalid_lifecycle_status',
    message: 'The CareerSource lifecycle request is malformed.',
  },
  invalid_source_registration: {
    code: 'invalid_source_registration',
    message: 'The CareerSource registration request is malformed.',
  },
  source_registration_validation_failed: {
    code: 'source_registration_validation_failed',
    message: 'The CareerSource registration is invalid.',
  },
} as const)

export const careerSourceErrorStatusByCode = Object.freeze({
  career_source_not_found: 404,
  duplicate_career_source: 409,
  invalid_career_source_lifecycle: 409,
  invalid_lifecycle_status: 400,
  invalid_source_registration: 400,
  source_registration_validation_failed: 422,
} as const)

export const careerSourceErrorKindByCode = Object.freeze({
  career_source_not_found: 'not_found',
  duplicate_career_source: 'conflict',
  invalid_career_source_lifecycle: 'conflict',
  invalid_lifecycle_status: 'validation',
  invalid_source_registration: 'validation',
  source_registration_validation_failed: 'validation',
} as const satisfies Record<keyof typeof careerSourceErrorBodies, ValedictorianFailureKind>)

export const sourceScheduleErrorBodies = Object.freeze({
  career_source_not_runnable: {
    code: 'career_source_not_runnable',
    details: { status: 'candidate' },
    message: 'The CareerSource cannot run in its current lifecycle status.',
  },
  invalid_source_schedule: {
    code: 'invalid_source_schedule',
    message: 'The SourceSchedule request is malformed.',
  },
  source_schedule_not_found: {
    code: 'source_schedule_not_found',
    message: 'The SourceSchedule was not found.',
  },
  source_schedule_validation_failed: {
    code: 'source_schedule_validation_failed',
    message: 'The SourceSchedule is invalid.',
  },
} as const)

export const sourceScheduleErrorStatusByCode = Object.freeze({
  career_source_not_runnable: 409,
  invalid_source_schedule: 400,
  source_schedule_not_found: 404,
  source_schedule_validation_failed: 422,
} as const)

export const sourceScheduleErrorKindByCode = Object.freeze({
  career_source_not_runnable: 'conflict',
  invalid_source_schedule: 'validation',
  source_schedule_not_found: 'not_found',
  source_schedule_validation_failed: 'validation',
} as const satisfies Record<keyof typeof sourceScheduleErrorBodies, ValedictorianFailureKind>)

export const sourceRunErrorBodies = Object.freeze({
  evidence_artifact_not_found: {
    code: 'evidence_artifact_not_found',
    message: 'The EvidenceBundle artifact was not found.',
  },
  invalid_run_override: {
    code: 'invalid_run_override',
    message: 'The SourceRun override request is malformed.',
  },
  job_snapshot_not_found: {
    code: 'job_snapshot_not_found',
    message: 'The JobSnapshot was not found.',
  },
  run_admission_denied: {
    code: 'run_admission_denied',
    message: 'The SourceRun could not be admitted in the current state.',
  },
  run_override_validation_failed: {
    code: 'run_override_validation_failed',
    message: 'The SourceRun override is invalid.',
  },
  source_run_not_found: {
    code: 'source_run_not_found',
    message: 'The SourceRun was not found.',
  },
} as const)

export const sourceRunErrorStatusByCode = Object.freeze({
  evidence_artifact_not_found: 404,
  invalid_run_override: 400,
  job_snapshot_not_found: 404,
  run_admission_denied: 409,
  run_override_validation_failed: 422,
  source_run_not_found: 404,
} as const)

export const sourceRunErrorKindByCode = Object.freeze({
  evidence_artifact_not_found: 'not_found',
  invalid_run_override: 'validation',
  job_snapshot_not_found: 'not_found',
  run_admission_denied: 'conflict',
  run_override_validation_failed: 'validation',
  source_run_not_found: 'not_found',
} as const satisfies Record<keyof typeof sourceRunErrorBodies, ValedictorianFailureKind>)

export const sourceProbeErrorBodies = Object.freeze({
  browser_execution_unavailable: {
    code: 'browser_execution_unavailable',
    message: 'Browser execution is temporarily unavailable.',
  },
  browser_execution_validation_failed: {
    code: 'browser_execution_validation_failed',
    message: 'The browser execution request is invalid.',
  },
  invalid_source_probe_request: {
    code: 'invalid_source_probe_request',
    message: 'The source probe request is malformed.',
  },
  probe_failed: {
    code: 'probe_failed',
    message: 'The source probe could not validate the Career URL.',
  },
  source_extraction_validation_failed: {
    code: 'source_extraction_validation_failed',
    message: 'The source extraction request is invalid.',
  },
  source_extraction_unavailable: {
    code: 'source_extraction_unavailable',
    message: 'Source extraction is temporarily unavailable.',
  },
} as const)

export const sourceProbeErrorStatusByCode = Object.freeze({
  browser_execution_unavailable: 503,
  browser_execution_validation_failed: 422,
  invalid_source_probe_request: 400,
  probe_failed: 422,
  source_extraction_validation_failed: 422,
  source_extraction_unavailable: 503,
} as const)

export const sourceProbeErrorKindByCode = Object.freeze({
  browser_execution_unavailable: 'unavailable',
  browser_execution_validation_failed: 'validation',
  invalid_source_probe_request: 'validation',
  probe_failed: 'validation',
  source_extraction_validation_failed: 'validation',
  source_extraction_unavailable: 'unavailable',
} as const satisfies Record<keyof typeof sourceProbeErrorBodies, ValedictorianFailureKind>)

export const sourceRuleErrorBodies = Object.freeze({
  invalid_rule_attachment: {
    code: 'invalid_rule_attachment',
    message: 'The ConfidenceRule attachment request is malformed.',
  },
  rule_attachment_conflict: {
    code: 'rule_attachment_conflict',
    message: 'The ConfidenceRule attachment conflicts with the current state.',
  },
  rule_attachment_not_found: {
    code: 'rule_attachment_not_found',
    message: 'The ConfidenceRule attachment was not found.',
  },
  rule_attachment_validation_failed: {
    code: 'rule_attachment_validation_failed',
    message: 'The ConfidenceRule attachment is invalid.',
  },
} as const)

export const sourceRuleErrorStatusByCode = Object.freeze({
  invalid_rule_attachment: 400,
  rule_attachment_conflict: 409,
  rule_attachment_not_found: 404,
  rule_attachment_validation_failed: 422,
} as const)

export const sourceRuleErrorKindByCode = Object.freeze({
  invalid_rule_attachment: 'validation',
  rule_attachment_conflict: 'conflict',
  rule_attachment_not_found: 'not_found',
  rule_attachment_validation_failed: 'validation',
} as const satisfies Record<keyof typeof sourceRuleErrorBodies, ValedictorianFailureKind>)

export const sourceInfrastructureErrorBodies = Object.freeze({
  source_rate_limited: {
    code: 'source_rate_limited',
    message: valedictorianFailureKindMessages.rate_limit,
  },
  source_unavailable: {
    code: 'source_unavailable',
    message: valedictorianFailureKindMessages.unavailable,
  },
} as const)

export const sourceInfrastructureErrorStatusByCode = Object.freeze({
  source_rate_limited: 429,
  source_unavailable: 503,
} as const)

export const sourceInfrastructureErrorKindByCode = Object.freeze({
  source_rate_limited: 'rate_limit',
  source_unavailable: 'unavailable',
} as const satisfies Record<
  keyof typeof sourceInfrastructureErrorBodies,
  ValedictorianFailureKind
>)

type BodyMap = Readonly<Record<string, { readonly code: string; readonly message: string }>>
type BodyFromMap<Map extends BodyMap> = Map[keyof Map]

export type SourceAccessErrorBody = BodyFromMap<typeof sourceAccessErrorBodies>
export type SourceBrowseErrorBody = BodyFromMap<typeof sourceBrowseErrorBodies>
export type CareerSourceErrorBody = BodyFromMap<typeof careerSourceErrorBodies>
export type SourceRunErrorBody = BodyFromMap<typeof sourceRunErrorBodies>
export type SourceProbeErrorBody = BodyFromMap<typeof sourceProbeErrorBodies>
export type SourceRuleErrorBody = BodyFromMap<typeof sourceRuleErrorBodies>
export type SourceInfrastructureErrorBody = BodyFromMap<typeof sourceInfrastructureErrorBodies>

export interface CareerSourceNotRunnableErrorBody {
  readonly code: 'career_source_not_runnable'
  readonly message: typeof sourceScheduleErrorBodies.career_source_not_runnable.message
  readonly details: {
    readonly status: (typeof careerSourceLifecycleStatuses)[number]
  }
}

export function createCareerSourceNotRunnableErrorBody(
  status: (typeof careerSourceLifecycleStatuses)[number],
): CareerSourceNotRunnableErrorBody {
  return {
    ...sourceScheduleErrorBodies.career_source_not_runnable,
    details: { status },
  }
}

type SimpleSourceScheduleErrorBody = BodyFromMap<
  Omit<typeof sourceScheduleErrorBodies, 'career_source_not_runnable'>
>
export type SourceScheduleErrorBody =
  | CareerSourceNotRunnableErrorBody
  | SimpleSourceScheduleErrorBody

export type SourceIngestionErrorBody =
  | SourceAccessErrorBody
  | SourceBrowseErrorBody
  | CareerSourceErrorBody
  | SourceScheduleErrorBody
  | SourceRunErrorBody
  | SourceProbeErrorBody
  | SourceRuleErrorBody
  | SourceInfrastructureErrorBody
  | ValedictorianInternalErrorBody

export type SourceIngestionErrorCode = SourceIngestionErrorBody['code']

const simpleBodies = {
  ...sourceAccessErrorBodies,
  ...sourceBrowseErrorBodies,
  ...careerSourceErrorBodies,
  ...sourceScheduleErrorBodies,
  ...sourceRunErrorBodies,
  ...sourceProbeErrorBodies,
  ...sourceRuleErrorBodies,
  ...sourceInfrastructureErrorBodies,
} as const

const statusByCode: Readonly<Record<string, number>> = {
  ...sourceAccessErrorStatusByCode,
  ...sourceBrowseErrorStatusByCode,
  ...careerSourceErrorStatusByCode,
  ...sourceScheduleErrorStatusByCode,
  ...sourceRunErrorStatusByCode,
  ...sourceProbeErrorStatusByCode,
  ...sourceRuleErrorStatusByCode,
  ...sourceInfrastructureErrorStatusByCode,
}

const kindByCode: Readonly<Record<string, ValedictorianFailureKind>> = {
  ...sourceAccessErrorKindByCode,
  ...sourceBrowseErrorKindByCode,
  ...careerSourceErrorKindByCode,
  ...sourceScheduleErrorKindByCode,
  ...sourceRunErrorKindByCode,
  ...sourceProbeErrorKindByCode,
  ...sourceRuleErrorKindByCode,
  ...sourceInfrastructureErrorKindByCode,
}

function canonicalBodySchema(code: keyof typeof simpleBodies): z.ZodType {
  const body = simpleBodies[code]
  return z.object({ code: z.literal(code), message: z.literal(body.message) }).strict()
}

const schemaByCode: Record<string, z.ZodType> = Object.fromEntries(
  Object.keys(simpleBodies).map((code) => [code, canonicalBodySchema(code as keyof typeof simpleBodies)]),
)

schemaByCode.career_source_not_runnable = z
  .object({
    code: z.literal('career_source_not_runnable'),
    details: z.object({ status: z.enum(careerSourceLifecycleStatuses) }).strict(),
    message: z.literal(sourceScheduleErrorBodies.career_source_not_runnable.message),
  })
  .strict()

function unionSchema(codes: readonly string[]): z.ZodType {
  const schemas = codes.map((code) => schemaByCode[code]!)
  return z.union(schemas as [z.ZodType, z.ZodType, ...z.ZodType[]])
}

export const sourceAccessErrorBodySchema: z.ZodType<SourceAccessErrorBody> =
  unionSchema(Object.keys(sourceAccessErrorBodies)) as z.ZodType<SourceAccessErrorBody>
export const sourceBrowseErrorBodySchema: z.ZodType<SourceBrowseErrorBody> =
  unionSchema(Object.keys(sourceBrowseErrorBodies)) as z.ZodType<SourceBrowseErrorBody>
export const careerSourceErrorBodySchema: z.ZodType<CareerSourceErrorBody> =
  unionSchema(Object.keys(careerSourceErrorBodies)) as z.ZodType<CareerSourceErrorBody>
export const sourceScheduleErrorBodySchema: z.ZodType<SourceScheduleErrorBody> =
  unionSchema(Object.keys(sourceScheduleErrorBodies)) as z.ZodType<SourceScheduleErrorBody>
export const sourceRunErrorBodySchema: z.ZodType<SourceRunErrorBody> =
  unionSchema(Object.keys(sourceRunErrorBodies)) as z.ZodType<SourceRunErrorBody>
export const sourceProbeErrorBodySchema: z.ZodType<SourceProbeErrorBody> =
  unionSchema(Object.keys(sourceProbeErrorBodies)) as z.ZodType<SourceProbeErrorBody>
export const sourceRuleErrorBodySchema: z.ZodType<SourceRuleErrorBody> =
  unionSchema(Object.keys(sourceRuleErrorBodies)) as z.ZodType<SourceRuleErrorBody>
export const sourceInfrastructureErrorBodySchema: z.ZodType<SourceInfrastructureErrorBody> =
  unionSchema(Object.keys(sourceInfrastructureErrorBodies)) as z.ZodType<
    SourceInfrastructureErrorBody
  >

export const sourceIngestionSharedEndpointErrorCodes = Object.freeze([
  'unauthorized',
  'forbidden',
  'source_rate_limited',
  'source_unavailable',
  'internal_error',
] as const)

export const sourceIngestionEndpointErrorCodes = Object.freeze({
  acceptBaseline: ['source_run_not_found', 'invalid_run_override', 'run_override_validation_failed',
    'run_admission_denied'],
  createSource: ['invalid_source_registration', 'source_registration_validation_failed',
    'duplicate_career_source'],
  deleteRuleAttachment: ['rule_attachment_not_found'],
  disableSchedule: ['source_schedule_not_found'],
  forcePublish: ['source_run_not_found', 'invalid_run_override', 'run_override_validation_failed',
    'run_admission_denied'],
  getEffectiveRules: ['career_source_not_found'],
  getRun: ['source_run_not_found'],
  getRunEvidenceArtifact: ['source_run_not_found', 'evidence_artifact_not_found'],
  getSchedule: ['career_source_not_found'],
  getSnapshot: ['job_snapshot_not_found'],
  listCompanies: ['invalid_companies_query'],
  listJobs: ['invalid_jobs_query'],
  listRuns: ['invalid_runs_query'],
  listSchedules: ['invalid_schedules_query'],
  listSources: ['invalid_sources_query'],
  probeCareerUrl: ['invalid_source_probe_request', 'probe_failed',
    'browser_execution_validation_failed', 'browser_execution_unavailable',
    'source_extraction_validation_failed', 'source_extraction_unavailable'],
  probeSource: ['career_source_not_found', 'probe_failed',
    'browser_execution_validation_failed', 'browser_execution_unavailable',
    'source_extraction_validation_failed', 'source_extraction_unavailable'],
  putRuleAttachment: ['invalid_rule_attachment', 'rule_attachment_validation_failed',
    'rule_attachment_conflict', 'career_source_not_found'],
  requestRun: ['career_source_not_found', 'career_source_not_runnable'],
  setSchedule: ['career_source_not_found', 'invalid_source_schedule',
    'source_schedule_validation_failed'],
  updateSourceLifecycle: ['career_source_not_found', 'invalid_lifecycle_status',
    'invalid_career_source_lifecycle'],
} as const satisfies Readonly<Record<string, readonly SourceIngestionErrorCode[]>>)

export type SourceIngestionEndpoint = keyof typeof sourceIngestionEndpointErrorCodes

export type SourceIngestionEndpointErrorValidation =
  | {
      readonly ok: true
      readonly body: SourceIngestionErrorBody
      readonly kind: ValedictorianFailureKind
      readonly status: number
      readonly retryAfter?: ValedictorianRetryAfter
    }
  | {
      readonly ok: false
      readonly reason:
        | 'invalid_retry_after'
        | 'malformed_body'
        | 'status_mismatch'
        | 'unexpected_code'
        | 'unknown_code'
    }

function responseCode(body: unknown): string | null {
  if (typeof body !== 'object' || body === null || !('code' in body)) return null
  return typeof body.code === 'string' ? body.code : null
}

export function validateSourceIngestionEndpointError({
  body,
  endpoint,
  retryAfterHeader,
  status,
}: {
  readonly body: unknown
  readonly endpoint: SourceIngestionEndpoint
  readonly retryAfterHeader?: string | null
  readonly status: number
}): SourceIngestionEndpointErrorValidation {
  const code = responseCode(body)
  if (code === valedictorianInternalErrorCode) {
    const internal = valedictorianInternalErrorBodySchema.safeParse(body)
    if (!internal.success) return { ok: false, reason: 'malformed_body' }
    if (status !== valedictorianInternalErrorStatus) {
      return { ok: false, reason: 'status_mismatch' }
    }
    return {
      body: internal.data,
      kind: valedictorianInternalErrorKind,
      ok: true,
      status,
    }
  }
  if (code === null || !Object.prototype.hasOwnProperty.call(schemaByCode, code)) {
    return { ok: false, reason: 'unknown_code' }
  }

  const allowed = new Set<string>([
    ...sourceIngestionSharedEndpointErrorCodes,
    ...sourceIngestionEndpointErrorCodes[endpoint],
  ])
  if (!allowed.has(code)) return { ok: false, reason: 'unexpected_code' }

  const parsed = schemaByCode[code]?.safeParse(body)
  if (!parsed?.success) return { ok: false, reason: 'malformed_body' }
  if (statusByCode[code] !== status) return { ok: false, reason: 'status_mismatch' }

  const authoritativeRetry = code === 'source_rate_limited' || code === 'source_unavailable'
  let retryAfter: ValedictorianRetryAfter | undefined
  if (authoritativeRetry && retryAfterHeader?.trim()) {
    retryAfter = parseValedictorianRetryAfterHeader(retryAfterHeader)
    if (retryAfter === undefined) return { ok: false, reason: 'invalid_retry_after' }
  }

  return {
    body: parsed.data as SourceIngestionErrorBody,
    kind: kindByCode[code]!,
    ok: true,
    ...(retryAfter === undefined ? {} : { retryAfter }),
    status,
  }
}
