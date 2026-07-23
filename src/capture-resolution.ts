import { z } from 'zod'
import { createCaptureInputSchema } from './capture.js'
import {
  lifecycleActorSchema,
  lifecycleBlockerSchema,
  lifecycleIdSchema,
  lifecycleInstantSchema,
  lifecycleUrlSchema,
  warningOverrideSchema,
} from './lifecycle-shared.js'
import {
  captureEvidenceReferenceSchema,
  jobDestinationSchema,
  jobExternalIdentitySchema,
  jobFactsSchema,
  jobIdSchema,
} from './job.js'

export const captureResolutionContractVersion = 1 as const
export const captureResolutionDefaultPageLimit = 50
export const captureResolutionMaximumPageLimit = 100
export const captureResolutionFilters = ['all', 'needs_attention', 'removed'] as const
export const captureResolutionSorts = ['observed_desc'] as const
export const captureResolutionKeysetOrder = {
  fields: ['observedAt', 'captureId'],
  directions: ['desc', 'desc'],
} as const

const positiveRevisionSchema = z.number().int().positive()
const idempotencyKeySchema = z.string().trim().min(1).max(200)
const boundedMessageSchema = z.string().trim().min(1).max(500)

export const captureResolutionCursorSchema = z
  .string()
  .min(1)
  .max(2_048)
  .brand<'CaptureResolutionCursor'>()
export type CaptureResolutionCursor = z.infer<typeof captureResolutionCursorSchema>

const pageInputFields = {
  filter: z.enum(captureResolutionFilters).default('all'),
  sort: z.literal('observed_desc').default('observed_desc'),
  limit: z.number().int().min(1).max(captureResolutionMaximumPageLimit)
    .default(captureResolutionDefaultPageLimit),
} as const

export const captureResolutionListInputSchema = z.union([
  z.object({
    ...pageInputFields,
    after: captureResolutionCursorSchema,
    before: z.never().optional(),
  }).strict(),
  z.object({
    ...pageInputFields,
    before: captureResolutionCursorSchema,
    after: z.never().optional(),
  }).strict(),
  z.object({
    ...pageInputFields,
    after: z.never().optional(),
    before: z.never().optional(),
  }).strict(),
])
export type CaptureResolutionListInput = z.input<typeof captureResolutionListInputSchema>

export const captureResolutionPageInfoSchema = z.object({
  startCursor: captureResolutionCursorSchema.nullable(),
  endCursor: captureResolutionCursorSchema.nullable(),
  hasPreviousPage: z.boolean(),
  hasNextPage: z.boolean(),
}).strict()
export type CaptureResolutionPageInfo = z.infer<typeof captureResolutionPageInfoSchema>

export const processingStages = ['destination', 'information', 'promotion'] as const
export type ProcessingStage = (typeof processingStages)[number]

export const processingReasonCodes = [
  'capture_removed',
  'superseded_by_revision',
  'operation_cancelled',
  'dependency_unavailable',
  'rate_limited',
  'request_timed_out',
  'transport_failed',
  'attempt_budget_exhausted',
  'provider_authentication_required',
  'provider_identity_invalid',
  'destination_not_found',
  'destination_unsupported',
  'destination_security_rejected',
  'insufficient_job_information',
  'company_resolution_required',
  'duplicate_job_conflict',
  'company_assignment_conflict',
  'promotion_validation_failed',
  'job_identity_conflict',
  'integrity_constraint_violated',
] as const
export type ProcessingReasonCode = (typeof processingReasonCodes)[number]

export const processingActionCodes = [
  'authenticate_provider',
  'correct_capture',
  'complete_job_information',
  'resolve_company',
  'resolve_company_assignment',
  'resolve_duplicate_job',
  'retry_now',
] as const
export type ProcessingActionCode = (typeof processingActionCodes)[number]

const processingDetailsSchema = z.record(
  z.string().trim().min(1).max(100),
  z.union([z.string().max(500), z.number(), z.boolean(), z.null()]),
).superRefine((details, context) => {
  if (Object.keys(details).length > 20 || JSON.stringify(details).length > 4_000) {
    context.addIssue({ code: 'custom', message: 'processing issue details exceed their bound' })
  }
  const forbiddenKey = Object.keys(details).find((key) =>
    /^(?:authorization|cookie|password|secret|token|ssn)$/i.test(key))
  if (forbiddenKey !== undefined) {
    context.addIssue({
      code: 'custom',
      message: 'processing issue details contain a forbidden sensitive key',
      path: [forbiddenKey],
    })
  }
})

const processingIssueFields = {
  message: boundedMessageSchema,
  details: processingDetailsSchema,
} as const
const anyStageIssueFields = {
  stage: z.enum(processingStages),
  action: z.null(),
  causedBy: z.null(),
  ...processingIssueFields,
} as const
const transientReasons = [
  'dependency_unavailable',
  'rate_limited',
  'request_timed_out',
  'transport_failed',
] as const

export const processingIssueSchema = z.discriminatedUnion('code', [
  z.object({
    stage: z.literal('destination'),
    code: z.enum(transientReasons),
    action: z.null(),
    causedBy: z.null(),
    ...processingIssueFields,
  }).strict(),
  z.object({
    stage: z.literal('destination'),
    code: z.literal('provider_authentication_required'),
    action: z.literal('authenticate_provider'),
    causedBy: z.null(),
    ...processingIssueFields,
  }).strict(),
  z.object({
    stage: z.literal('destination'),
    code: z.enum([
      'provider_identity_invalid',
      'destination_not_found',
      'destination_unsupported',
    ]),
    action: z.enum(['correct_capture', 'complete_job_information']),
    causedBy: z.null(),
    ...processingIssueFields,
  }).strict(),
  z.object({
    stage: z.literal('destination'),
    code: z.literal('attempt_budget_exhausted'),
    action: z.enum(['retry_now', 'complete_job_information']),
    causedBy: z.enum(transientReasons),
    ...processingIssueFields,
  }).strict(),
  z.object({
    stage: z.literal('destination'),
    code: z.literal('destination_security_rejected'),
    action: z.null(),
    causedBy: z.null(),
    ...processingIssueFields,
  }).strict(),
  z.object({
    stage: z.literal('promotion'),
    code: z.literal('insufficient_job_information'),
    action: z.literal('complete_job_information'),
    causedBy: z.null(),
    ...processingIssueFields,
  }).strict(),
  z.object({
    stage: z.literal('promotion'),
    code: z.literal('company_resolution_required'),
    action: z.literal('resolve_company'),
    causedBy: z.null(),
    ...processingIssueFields,
  }).strict(),
  z.object({
    stage: z.literal('promotion'),
    code: z.literal('company_assignment_conflict'),
    action: z.literal('resolve_company_assignment'),
    causedBy: z.null(),
    ...processingIssueFields,
  }).strict(),
  z.object({
    stage: z.literal('promotion'),
    code: z.literal('duplicate_job_conflict'),
    action: z.literal('resolve_duplicate_job'),
    causedBy: z.null(),
    ...processingIssueFields,
  }).strict(),
  z.object({
    stage: z.literal('promotion'),
    code: z.literal('promotion_validation_failed'),
    action: z.literal('complete_job_information'),
    causedBy: z.null(),
    ...processingIssueFields,
  }).strict(),
  z.object({
    stage: z.literal('promotion'),
    code: z.literal('job_identity_conflict'),
    action: z.literal('resolve_duplicate_job'),
    causedBy: z.null(),
    ...processingIssueFields,
  }).strict(),
  z.object({
    stage: z.literal('promotion'),
    code: z.literal('integrity_constraint_violated'),
    action: z.null(),
    causedBy: z.null(),
    ...processingIssueFields,
  }).strict(),
  z.object({
    ...anyStageIssueFields,
    code: z.literal('superseded_by_revision'),
  }).strict(),
  z.object({
    ...anyStageIssueFields,
    code: z.enum(['capture_removed', 'operation_cancelled']),
  }).strict(),
])
export type ProcessingIssue = z.infer<typeof processingIssueSchema>

export const destinationResolutionStatuses = [
  'not_required',
  'queued',
  'running',
  'retry_wait',
  'resolved',
  'action_required',
  'exhausted',
  'blocked',
  'superseded',
  'cancelled',
] as const
export type DestinationResolutionStatus = (typeof destinationResolutionStatuses)[number]

export const jobInformationResolutionStatuses = [
  'awaiting_manual',
  'resolved',
  'superseded',
  'cancelled',
] as const
export type JobInformationResolutionStatus = (typeof jobInformationResolutionStatuses)[number]

export const promotionStatuses = [
  'not_ready',
  'blocked',
  'promoted',
  'superseded',
  'cancelled',
] as const
export type PromotionStatus = (typeof promotionStatuses)[number]

const stageProjectionFields = {
  generationId: lifecycleIdSchema,
  captureRevision: positiveRevisionSchema,
  updatedAt: lifecycleInstantSchema,
  attemptCount: z.number().int().nonnegative(),
} as const

const destinationResolutionStageBaseSchema = z.object({
  ...stageProjectionFields,
  status: z.enum(destinationResolutionStatuses),
  currentIssue: processingIssueSchema.nullable(),
  nextAttemptAt: lifecycleInstantSchema.nullable(),
  resolverId: lifecycleIdSchema.nullable(),
  resolverVersion: z.string().trim().min(1).max(100).nullable(),
  remoteOperationId: z.string().trim().min(1).max(500).nullable(),
}).strict()

function validDestinationIssue(status: DestinationResolutionStatus, issue: ProcessingIssue | null) {
  if (['not_required', 'queued', 'running', 'resolved'].includes(status)) return issue === null
  if (issue === null || issue.stage !== 'destination') return false
  if (status === 'retry_wait') return transientReasons.includes(issue.code as (typeof transientReasons)[number])
  if (status === 'action_required') {
    return [
      'provider_authentication_required',
      'provider_identity_invalid',
      'destination_not_found',
      'destination_unsupported',
    ].includes(issue.code)
  }
  if (status === 'exhausted') return issue.code === 'attempt_budget_exhausted'
  if (status === 'blocked') return issue.code === 'destination_security_rejected'
  if (status === 'superseded') return issue.code === 'superseded_by_revision'
  return issue.code === 'capture_removed' || issue.code === 'operation_cancelled'
}

export const destinationResolutionStageSchema = destinationResolutionStageBaseSchema
  .superRefine((stage, context) => {
    if (!validDestinationIssue(stage.status, stage.currentIssue)) {
      context.addIssue({
        code: 'custom',
        message: 'destination status and current issue violate the closed matrix',
        path: ['currentIssue'],
      })
    }
    if (stage.status !== 'retry_wait' && stage.nextAttemptAt !== null) {
      context.addIssue({
        code: 'custom',
        message: 'nextAttemptAt is only valid during retry_wait',
        path: ['nextAttemptAt'],
      })
    }
  })
export type DestinationResolutionStage = z.infer<typeof destinationResolutionStageSchema>

function terminalStageIssueSchema(stage: 'information' | 'promotion', status: string) {
  if (status === 'superseded') {
    return processingIssueSchema.refine(
      (issue) => issue.stage === stage && issue.code === 'superseded_by_revision',
    )
  }
  return processingIssueSchema.refine(
    (issue) => issue.stage === stage
      && (issue.code === 'capture_removed' || issue.code === 'operation_cancelled'),
  )
}

export const jobInformationResolutionStageSchema = z.discriminatedUnion('status', [
  z.object({
    ...stageProjectionFields,
    status: z.enum(['awaiting_manual', 'resolved']),
    currentIssue: z.null(),
  }).strict(),
  z.object({
    ...stageProjectionFields,
    status: z.literal('superseded'),
    currentIssue: terminalStageIssueSchema('information', 'superseded'),
  }).strict(),
  z.object({
    ...stageProjectionFields,
    status: z.literal('cancelled'),
    currentIssue: terminalStageIssueSchema('information', 'cancelled'),
  }).strict(),
])
export type JobInformationResolutionStage = z.infer<typeof jobInformationResolutionStageSchema>

const promotionBlockedIssueSchema = processingIssueSchema.refine((issue) =>
  issue.stage === 'promotion' && [
    'insufficient_job_information',
    'company_resolution_required',
    'company_assignment_conflict',
    'duplicate_job_conflict',
    'promotion_validation_failed',
    'job_identity_conflict',
    'integrity_constraint_violated',
  ].includes(issue.code))

export const promotionStageSchema = z.discriminatedUnion('status', [
  z.object({
    ...stageProjectionFields,
    status: z.enum(['not_ready', 'promoted']),
    currentIssue: z.null(),
  }).strict(),
  z.object({
    ...stageProjectionFields,
    status: z.literal('blocked'),
    currentIssue: promotionBlockedIssueSchema,
  }).strict(),
  z.object({
    ...stageProjectionFields,
    status: z.literal('superseded'),
    currentIssue: terminalStageIssueSchema('promotion', 'superseded'),
  }).strict(),
  z.object({
    ...stageProjectionFields,
    status: z.literal('cancelled'),
    currentIssue: terminalStageIssueSchema('promotion', 'cancelled'),
  }).strict(),
])
export type PromotionStage = z.infer<typeof promotionStageSchema>

export const processingSummaries = [
  'promoted',
  'blocked',
  'needs_action',
  'retrying',
  'processing',
  'awaiting_destination',
  'awaiting_information',
  'stopped',
] as const
export type ProcessingSummary = (typeof processingSummaries)[number]

export const captureResolutionGenerationStatuses = [
  'active',
  'promoted',
  'superseded',
  'cancelled',
] as const

export const captureResolutionGenerationTriggers = [
  'intake',
  'correction',
  'restore',
  'retry_destination',
  'replay',
  'manual_completion',
  'legacy_promotion',
] as const

function deriveProcessingSummary(generation: {
  status: (typeof captureResolutionGenerationStatuses)[number]
  destinationResolution: DestinationResolutionStage
  jobInformationResolution: JobInformationResolutionStage
  promotion: PromotionStage
}): ProcessingSummary {
  if (generation.promotion.status === 'promoted') return 'promoted'
  if (generation.status === 'cancelled' || generation.status === 'superseded') return 'stopped'
  if (generation.destinationResolution.status === 'blocked'
    || generation.promotion.status === 'blocked') return 'blocked'
  const destinationIssue = generation.destinationResolution.currentIssue
  if (generation.destinationResolution.status === 'action_required'
    || (generation.destinationResolution.status === 'exhausted'
      && destinationIssue?.action !== null)) return 'needs_action'
  if (generation.destinationResolution.status === 'retry_wait') return 'retrying'
  if (generation.destinationResolution.status === 'queued'
    || generation.destinationResolution.status === 'running') return 'processing'
  if (generation.destinationResolution.status !== 'resolved'
    && generation.destinationResolution.status !== 'not_required') {
    return generation.destinationResolution.status === 'exhausted'
      ? 'stopped'
      : 'awaiting_destination'
  }
  return 'awaiting_information'
}

export const captureResolutionGenerationProjectionSchema = z.object({
  id: lifecycleIdSchema,
  ordinal: z.number().int().positive(),
  trigger: z.enum(captureResolutionGenerationTriggers),
  status: z.enum(captureResolutionGenerationStatuses),
  processingSummary: z.enum(processingSummaries),
  destinationResolution: destinationResolutionStageSchema,
  jobInformationResolution: jobInformationResolutionStageSchema,
  promotion: promotionStageSchema,
  createdAt: lifecycleInstantSchema,
  updatedAt: lifecycleInstantSchema,
}).strict().superRefine((generation, context) => {
  const stages = [
    generation.destinationResolution,
    generation.jobInformationResolution,
    generation.promotion,
  ]
  if (stages.some((stage) => stage.generationId !== generation.id)) {
    context.addIssue({ code: 'custom', message: 'every stage must bind the generation id' })
  }
  if (new Set(stages.map((stage) => stage.captureRevision)).size !== 1) {
    context.addIssue({ code: 'custom', message: 'every stage must bind one Capture revision' })
  }
  const destinationTerminalForReplacement = [
    'not_required',
    'resolved',
    'action_required',
    'exhausted',
    'blocked',
  ]
  if (generation.status === 'active'
    && stages.some((stage) => stage.status === 'superseded' || stage.status === 'cancelled')) {
    context.addIssue({ code: 'custom', message: 'an active generation cannot expose replaced stages' })
  }
  if (generation.status === 'promoted'
    && (!['not_required', 'resolved'].includes(generation.destinationResolution.status)
      || generation.jobInformationResolution.status !== 'resolved'
      || generation.promotion.status !== 'promoted')) {
    context.addIssue({ code: 'custom', message: 'a promoted generation requires resolved stages' })
  }
  if (generation.promotion.status === 'promoted' && generation.status !== 'promoted') {
    context.addIssue({ code: 'custom', message: 'promoted promotion state requires a promoted generation' })
  }
  if (generation.status === 'superseded'
    && (!destinationTerminalForReplacement.includes(generation.destinationResolution.status)
      && generation.destinationResolution.status !== 'superseded'
      || !['resolved', 'superseded'].includes(generation.jobInformationResolution.status)
      || generation.promotion.status !== 'superseded')) {
    context.addIssue({ code: 'custom', message: 'a superseded generation must close nonterminal stages' })
  }
  if (generation.status === 'cancelled'
    && (!destinationTerminalForReplacement.includes(generation.destinationResolution.status)
      && generation.destinationResolution.status !== 'cancelled'
      || !['resolved', 'cancelled'].includes(generation.jobInformationResolution.status)
      || generation.promotion.status !== 'cancelled')) {
    context.addIssue({ code: 'custom', message: 'a cancelled generation must close nonterminal stages' })
  }
  if (generation.processingSummary !== deriveProcessingSummary(generation)) {
    context.addIssue({
      code: 'custom',
      message: 'processingSummary violates deterministic precedence',
      path: ['processingSummary'],
    })
  }
})
export type CaptureResolutionGenerationProjection =
  z.infer<typeof captureResolutionGenerationProjectionSchema>

export const captureResolutionProjectionSchema = z.discriminatedUnion('readiness', [
  z.object({
    readiness: z.literal('materialization_pending'),
    captureId: lifecycleIdSchema,
    captureRevision: positiveRevisionSchema,
    issue: z.null(),
  }).strict(),
  z.object({
    readiness: z.literal('materialization_blocked'),
    captureId: lifecycleIdSchema,
    captureRevision: positiveRevisionSchema,
    issue: z.object({
      code: z.literal('revision_materialization_failed'),
      action: z.literal('correct_capture'),
      message: boundedMessageSchema,
    }).strict(),
  }).strict(),
  z.object({
    readiness: z.literal('removed'),
    captureId: lifecycleIdSchema,
    captureRevision: positiveRevisionSchema,
    generation: z.null(),
  }).strict(),
  z.object({
    readiness: z.literal('ready'),
    captureId: lifecycleIdSchema,
    captureRevision: positiveRevisionSchema,
    generation: captureResolutionGenerationProjectionSchema,
  }).strict(),
]).superRefine((projection, context) => {
  if (projection.readiness === 'ready'
    && projection.generation.destinationResolution.captureRevision
      !== projection.captureRevision) {
    context.addIssue({
      code: 'custom',
      message: 'ready projection revision must equal its generation revision',
      path: ['generation'],
    })
  }
})
export type CaptureResolutionProjection = z.infer<typeof captureResolutionProjectionSchema>

export const capturePrimaryIntentSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('complete_job_information') }).strict(),
  z.object({
    kind: z.literal('authenticate_provider'),
    connectorInstanceId: lifecycleIdSchema,
  }).strict(),
  z.object({ kind: z.literal('correct_capture') }).strict(),
  z.object({ kind: z.literal('retry_now') }).strict(),
  z.object({ kind: z.literal('resolve_company') }).strict(),
  z.object({
    kind: z.literal('resolve_company_assignment'),
    jobId: jobIdSchema,
    currentCompanyId: lifecycleIdSchema,
  }).strict(),
  z.object({
    kind: z.literal('resolve_duplicate_job'),
    conflictingJobIds: z.array(jobIdSchema).min(1).max(20),
    supportedActions: z.array(z.enum(['attach', 'merge'])).min(1).max(2),
  }).strict(),
  z.object({ kind: z.literal('view_job'), jobId: jobIdSchema }).strict(),
])
export type CapturePrimaryIntent = z.infer<typeof capturePrimaryIntentSchema>

export const captureListDestinationStates = [
  'not_required',
  'resolving',
  'resolved',
  'unavailable',
  'blocked',
] as const
export const captureReadinessStates = [
  'materialization_pending',
  'materialization_blocked',
  'ready',
  'removed',
] as const

export const captureListPresentationSchema = z.object({
  captureId: lifecycleIdSchema,
  captureRevision: positiveRevisionSchema,
  observedAt: lifecycleInstantSchema,
  lead: z.object({
    roleTitle: z.string().trim().min(1).max(500).nullable(),
    companyName: z.string().trim().min(1).max(500).nullable(),
    fallbackLabel: z.string().trim().min(1).max(500),
  }).strict(),
  source: z.object({
    displayName: z.string().trim().min(1).max(500),
    provider: z.string().trim().min(1).max(200),
  }).strict(),
  destination: z.object({
    state: z.enum(captureListDestinationStates),
    displayHost: z.string().trim().min(1).max(253).nullable(),
  }).strict(),
  readiness: z.enum(captureReadinessStates),
  processingSummary: z.enum(processingSummaries).nullable(),
  activeProcessing: z.boolean(),
  linkedJob: z.object({
    jobId: jobIdSchema,
    roleTitle: z.string().trim().min(1).max(500),
    companyName: z.string().trim().min(1).max(500),
  }).strict().nullable(),
  primaryIntent: capturePrimaryIntentSchema.nullable(),
}).strict().superRefine((row, context) => {
  if ((row.readiness === 'ready') !== (row.processingSummary !== null)) {
    context.addIssue({
      code: 'custom',
      message: 'processingSummary exists exactly when readiness is ready',
      path: ['processingSummary'],
    })
  }
})
export type CaptureListPresentation = z.infer<typeof captureListPresentationSchema>

export const captureResolutionListResultSchema = z.object({
  items: z.array(captureListPresentationSchema).max(captureResolutionMaximumPageLimit),
  pageInfo: captureResolutionPageInfoSchema,
  totalCount: z.number().int().nonnegative(),
}).strict().superRefine((page, context) => {
  const cursorsAbsent = page.pageInfo.startCursor === null
    && page.pageInfo.endCursor === null
  const cursorsPresent = page.pageInfo.startCursor !== null
    && page.pageInfo.endCursor !== null
  if ((page.items.length === 0 && !cursorsAbsent)
    || (page.items.length > 0 && !cursorsPresent)) {
    context.addIssue({ code: 'custom', message: 'page boundary cursors must match item presence' })
  }
  if (page.totalCount < page.items.length) {
    context.addIssue({ code: 'custom', message: 'totalCount cannot be smaller than the page' })
  }
})
export type CaptureResolutionListResult = z.infer<typeof captureResolutionListResultSchema>

export const captureCompletionDetailSchema = z.object({
  captureId: lifecycleIdSchema,
  captureRevision: positiveRevisionSchema,
  expectedGenerationId: lifecycleIdSchema.nullable(),
  sourceSummary: z.object({
    displayName: z.string().trim().min(1).max(500),
    provider: z.string().trim().min(1).max(200),
    observedAt: lifecycleInstantSchema,
  }).strict(),
  provenance: z.array(z.object({
    kind: z.enum(['source', 'destination', 'job']),
    label: z.string().trim().min(1).max(500),
    url: lifecycleUrlSchema.nullable(),
  }).strict()).max(20),
  destination: z.object({
    status: z.enum(['not_required', 'resolved', 'action_required', 'exhausted', 'blocked']),
    url: lifecycleUrlSchema.nullable(),
  }).strict(),
  rawEvidence: z.array(z.object({
    captureRevision: positiveRevisionSchema,
    evidenceIndex: z.number().int().nonnegative(),
    label: z.string().trim().min(1).max(200),
    displayValue: z.string().max(4_000),
  }).strict()).max(50),
  exactEvidenceReferences: z.array(captureEvidenceReferenceSchema).max(50),
  jobDefaults: jobFactsSchema.partial().strict(),
  lastIssue: processingIssueSchema.nullable(),
}).strict().superRefine((detail, context) => {
  for (const [index, reference] of detail.exactEvidenceReferences.entries()) {
    if (reference.captureId !== detail.captureId
      || reference.captureRevision !== detail.captureRevision) {
      context.addIssue({
        code: 'custom',
        message: 'detail evidence reference must bind the current Capture revision',
        path: ['exactEvidenceReferences', index],
      })
    }
  }
  for (const [index, evidence] of detail.rawEvidence.entries()) {
    if (evidence.captureRevision !== detail.captureRevision) {
      context.addIssue({
        code: 'custom',
        message: 'display evidence must bind the current Capture revision',
        path: ['rawEvidence', index, 'captureRevision'],
      })
    }
  }
})
export type CaptureCompletionDetail = z.infer<typeof captureCompletionDetailSchema>

const commandGuardFields = {
  captureId: lifecycleIdSchema,
  expectedCaptureRevision: positiveRevisionSchema,
  expectedGenerationId: lifecycleIdSchema.nullable(),
  idempotencyKey: idempotencyKeySchema,
  actor: lifecycleActorSchema,
} as const

export const retryCaptureProcessingInputSchema = z.object({
  ...commandGuardFields,
  expectedGenerationId: lifecycleIdSchema,
}).strict()
export type RetryCaptureProcessingInput = z.infer<typeof retryCaptureProcessingInputSchema>

export const replayCaptureRevisionInputSchema = z.object({
  ...commandGuardFields,
  expectedGenerationId: lifecycleIdSchema,
  rationale: z.string().trim().min(1).max(1_000),
}).strict()
export type ReplayCaptureRevisionInput = z.infer<typeof replayCaptureRevisionInputSchema>

export const correctCaptureResolutionInputSchema = z.object({
  ...commandGuardFields,
  rationale: z.string().trim().min(1).max(1_000),
  effectiveCapture: createCaptureInputSchema,
}).strict()
export type CorrectCaptureResolutionInput = z.infer<typeof correctCaptureResolutionInputSchema>

export const manualCompanyResolutionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('use_local'),
    companyId: lifecycleIdSchema,
    expectedCompanyRevision: positiveRevisionSchema,
    restoreIfArchived: z.boolean(),
  }).strict(),
  z.object({
    action: z.literal('create_local'),
    displayName: z.string().trim().min(1).max(500),
    websiteUrl: lifecycleUrlSchema.optional(),
  }).strict(),
])
export type ManualCompanyResolution = z.infer<typeof manualCompanyResolutionSchema>

export const manualJobDuplicateResolutionDecisionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('attach'),
    targetJobId: jobIdSchema,
    expectedJobFactsRevision: positiveRevisionSchema,
    expectedAssignmentRevision: positiveRevisionSchema,
  }).strict(),
  z.object({
    action: z.literal('merge'),
    targetJobId: jobIdSchema,
    expectedJobFactsRevision: positiveRevisionSchema,
    expectedAssignmentRevision: positiveRevisionSchema,
  }).strict(),
])
export type ManualJobDuplicateResolutionDecision =
  z.infer<typeof manualJobDuplicateResolutionDecisionSchema>

export const completeCaptureManuallyInputSchema = z.object({
  ...commandGuardFields,
  jobFacts: jobFactsSchema,
  destination: jobDestinationSchema.nullable(),
  externalIdentities: z.array(jobExternalIdentitySchema).max(100),
  evidenceReferences: z.array(captureEvidenceReferenceSchema).min(1).max(50),
  companyResolution: manualCompanyResolutionSchema,
  duplicateResolution: manualJobDuplicateResolutionDecisionSchema.optional(),
  override: warningOverrideSchema.optional(),
}).strict().superRefine((input, context) => {
  let evidenceIndexCount = 0
  for (const [index, reference] of input.evidenceReferences.entries()) {
    evidenceIndexCount += reference.evidenceIndexes.length
    if (reference.captureId !== input.captureId
      || reference.captureRevision !== input.expectedCaptureRevision) {
      context.addIssue({
        code: 'custom',
        message: 'evidence reference must bind the expected Capture revision',
        path: ['evidenceReferences', index],
      })
    }
  }
  if (evidenceIndexCount === 0) {
    context.addIssue({
      code: 'custom',
      message: 'completion requires at least one exact evidence index',
      path: ['evidenceReferences'],
    })
  }
  const hasStrongIdentity = input.externalIdentities.some((identity) =>
    identity.strength === 'strong')
  if (!hasStrongIdentity
    && (input.destination === null || input.destination.class !== 'employer_or_ats')) {
    context.addIssue({
      code: 'custom',
      message: 'completion requires an employer/ATS destination or strong external identity',
      path: ['destination'],
    })
  }
})
export type CompleteCaptureManuallyInput = z.infer<typeof completeCaptureManuallyInputSchema>

const commandResultCorrelationFields = {
  captureId: lifecycleIdSchema,
  requestCaptureRevision: positiveRevisionSchema,
  requestGenerationId: lifecycleIdSchema.nullable(),
  idempotencyKey: idempotencyKeySchema,
} as const

const captureProcessingStartedResultSchema = z.object({
    ...commandResultCorrelationFields,
    status: z.literal('started'),
    captureRevision: positiveRevisionSchema,
    generationId: lifecycleIdSchema,
  }).strict()
const captureCorrectedResultSchema = z.object({
    ...commandResultCorrelationFields,
    status: z.literal('corrected'),
    captureRevision: positiveRevisionSchema,
    generationId: lifecycleIdSchema,
  }).strict()
const captureCommandBlockedResultSchema = z.object({
    ...commandResultCorrelationFields,
    status: z.literal('blocked'),
    currentCaptureRevision: positiveRevisionSchema,
    currentGenerationId: lifecycleIdSchema.nullable(),
    blocker: lifecycleBlockerSchema,
  }).strict()

export const captureProcessingStartResultSchema = z.discriminatedUnion('status', [
  captureProcessingStartedResultSchema,
  captureCommandBlockedResultSchema,
]).superRefine((result, context) => {
  if (result.status === 'started'
    && (result.captureRevision !== result.requestCaptureRevision
      || result.generationId === result.requestGenerationId)) {
    context.addIssue({
      code: 'custom',
      message: 'processing start must retain the Capture revision and return a successor generation',
    })
  }
})
export type CaptureProcessingStartResult = z.infer<typeof captureProcessingStartResultSchema>

export const correctCaptureResolutionResultSchema = z.discriminatedUnion('status', [
  captureCorrectedResultSchema,
  captureCommandBlockedResultSchema,
]).superRefine((result, context) => {
  if (result.status === 'corrected'
    && (result.captureRevision <= result.requestCaptureRevision
      || result.generationId === result.requestGenerationId)) {
    context.addIssue({
      code: 'custom',
      message: 'correction must advance the Capture revision and generation',
    })
  }
})
export type CorrectCaptureResolutionResult = z.infer<typeof correctCaptureResolutionResultSchema>

export const captureResolutionCommandResultSchema = z.discriminatedUnion('status', [
  captureProcessingStartedResultSchema,
  captureCorrectedResultSchema,
  captureCommandBlockedResultSchema,
]).superRefine((result, context) => {
  if (result.status === 'started'
    && (result.captureRevision !== result.requestCaptureRevision
      || result.generationId === result.requestGenerationId)) {
    context.addIssue({
      code: 'custom',
      message: 'processing start must retain the Capture revision and return a successor generation',
    })
  }
  if (result.status === 'corrected'
    && (result.captureRevision <= result.requestCaptureRevision
      || result.generationId === result.requestGenerationId)) {
    context.addIssue({
      code: 'custom',
      message: 'correction must advance the Capture revision and generation',
    })
  }
})
export type CaptureResolutionCommandResult = z.infer<typeof captureResolutionCommandResultSchema>

const conflictingJobSchema = z.object({
  jobId: jobIdSchema,
  jobFactsRevision: positiveRevisionSchema,
  companyId: lifecycleIdSchema,
  companyRevision: positiveRevisionSchema,
  assignmentRevision: positiveRevisionSchema,
}).strict()

export const completionStaleGuardSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('capture_revision'),
    expectedRevision: positiveRevisionSchema,
    currentRevision: positiveRevisionSchema,
  }).strict(),
  z.object({
    kind: z.literal('generation'),
    expectedGenerationId: lifecycleIdSchema.nullable(),
    currentGenerationId: lifecycleIdSchema.nullable(),
  }).strict(),
  z.object({
    kind: z.literal('company_revision'),
    companyId: lifecycleIdSchema,
    expectedRevision: positiveRevisionSchema,
    currentRevision: positiveRevisionSchema,
  }).strict(),
  z.object({
    kind: z.literal('assignment_revision'),
    jobId: jobIdSchema,
    expectedRevision: positiveRevisionSchema,
    currentRevision: positiveRevisionSchema,
  }).strict(),
]).superRefine((guard, context) => {
  const unchanged = guard.kind === 'generation'
    ? guard.expectedGenerationId === guard.currentGenerationId
    : guard.expectedRevision === guard.currentRevision
  if (unchanged) {
    context.addIssue({ code: 'custom', message: 'stale guard must report changed state' })
  }
})
export type CompletionStaleGuard = z.infer<typeof completionStaleGuardSchema>

export const completionStaleRecoverySchema = z.object({
  action: z.literal('refresh_and_resubmit'),
  guards: z.array(completionStaleGuardSchema).min(1).max(4),
}).strict().superRefine((recovery, context) => {
  const kinds = recovery.guards.map((guard) => guard.kind)
  if (new Set(kinds).size !== kinds.length) {
    context.addIssue({ code: 'custom', message: 'stale recovery guard kinds must be unique' })
  }
})
export type CompletionStaleRecovery = z.infer<typeof completionStaleRecoverySchema>

const completionStaleBlockerSchema = z.object({
  code: z.literal('impossible_state'),
  message: z.string().trim().min(1).max(500),
  field: z.string().trim().min(1).max(200).optional(),
}).strict()

export const completeCaptureBlockedFailureSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('stale_guard'),
    blocker: completionStaleBlockerSchema,
    recovery: completionStaleRecoverySchema,
  }).strict(),
  z.object({
    kind: z.literal('lifecycle_failure'),
    blocker: lifecycleBlockerSchema,
  }).strict(),
])
export type CompleteCaptureBlockedFailure =
  z.infer<typeof completeCaptureBlockedFailureSchema>

export const completeCaptureManuallyResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('created'),
    jobId: jobIdSchema,
    companyId: lifecycleIdSchema,
    createdJob: z.boolean(),
    existingJobComparison: z.enum(['equivalent', 'different', 'not_compared']),
  }).strict(),
  z.object({
    status: z.literal('duplicate_blocked'),
    blockerCode: z.enum(['deterministic_duplicate', 'strong_identity_conflict']),
    conflictingJobs: z.array(conflictingJobSchema).min(1).max(20),
    allowedDecisions: z.array(z.enum(['attach', 'merge'])).min(1).max(2),
  }).strict(),
  z.object({
    status: z.literal('company_assignment_blocked'),
    blockerCode: z.literal('invalid_input'),
    existingJobId: jobIdSchema,
    currentCompanyId: lifecycleIdSchema,
    currentCompanyRevision: positiveRevisionSchema,
    assignmentRevision: positiveRevisionSchema,
    allowedRecovery: z.array(z.enum([
      'use_existing_company',
      'reassign_company',
    ])).min(1).max(2),
  }).strict(),
  z.object({
    status: z.literal('blocked'),
    failure: completeCaptureBlockedFailureSchema,
  }).strict(),
])
export type CompleteCaptureManuallyResult =
  z.infer<typeof completeCaptureManuallyResultSchema>
