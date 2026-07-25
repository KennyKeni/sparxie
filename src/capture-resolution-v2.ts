import { z } from 'zod'
import {
  captureResolutionGenerationStatuses,
  captureResolutionGenerationTriggers,
  captureResolutionListResultSchema,
  completeCaptureManuallyResultSchema,
  destinationResolutionStatuses,
  jobInformationResolutionStageSchema,
  manualCompanyResolutionSchema,
  manualJobDuplicateResolutionDecisionSchema,
  processingIssueSchema,
  processingSummaries,
  promotionStageSchema,
} from './capture-resolution.js'
import type {
  DestinationResolutionStatus,
  JobInformationResolutionStage,
  ProcessingIssue,
  ProcessingSummary,
  PromotionStage,
} from './capture-resolution.js'
import { resolvedDestinationProviderStatusSchema } from './capture-resolution-provider-status.js'
import {
  lifecycleActorSchema,
  lifecycleIdSchema,
  lifecycleInstantSchema,
  lifecycleUrlSchema,
  warningOverrideSchema,
} from './lifecycle-shared.js'
import {
  captureEvidenceReferenceSchema,
  jobDestinationV2Schema,
  jobExternalIdentitySchema,
  jobFactsV2Schema,
} from './job.js'

/** URL-only Capture-resolution contract, published alongside v1. */
export const captureResolutionV2ContractVersion = 2 as const

const positiveRevisionSchema = z.number().int().positive()
const idempotencyKeySchema = z.string().trim().min(1).max(200)
const boundedMessageSchema = z.string().trim().min(1).max(500)

export const destinationResolutionStageV2Schema = z.object({
  generationId: lifecycleIdSchema,
  captureRevision: positiveRevisionSchema,
  updatedAt: lifecycleInstantSchema,
  attemptCount: z.number().int().nonnegative(),
  status: z.enum(destinationResolutionStatuses),
  currentIssue: processingIssueSchema.nullable(),
  nextAttemptAt: lifecycleInstantSchema.nullable(),
  resolverId: lifecycleIdSchema.nullable(),
  resolverVersion: z.string().trim().min(1).max(100).nullable(),
  remoteOperationId: z.string().trim().min(1).max(500).nullable(),
  providerStatus: resolvedDestinationProviderStatusSchema.optional(),
}).strict().superRefine((stage, context) => {
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
  if (stage.status !== 'resolved' && stage.providerStatus !== undefined) {
    context.addIssue({
      code: 'custom',
      message: 'provider status is only valid for resolved destinations',
      path: ['providerStatus'],
    })
  }
})
export type DestinationResolutionStageV2 = z.infer<typeof destinationResolutionStageV2Schema>

function validDestinationIssue(status: DestinationResolutionStatus, issue: ProcessingIssue | null) {
  if (['not_required', 'queued', 'running', 'resolved'].includes(status)) return issue === null
  if (issue === null || issue.stage !== 'destination') return false
  if (status === 'retry_wait') {
    return ['dependency_unavailable', 'rate_limited', 'request_timed_out', 'transport_failed']
      .includes(issue.code)
  }
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

function deriveProcessingSummaryV2(generation: {
  status: (typeof captureResolutionGenerationStatuses)[number]
  destinationResolution: DestinationResolutionStageV2
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

export const captureResolutionGenerationProjectionV2Schema = z.object({
  id: lifecycleIdSchema,
  ordinal: z.number().int().positive(),
  trigger: z.enum(captureResolutionGenerationTriggers),
  status: z.enum(captureResolutionGenerationStatuses),
  processingSummary: z.enum(processingSummaries),
  destinationResolution: destinationResolutionStageV2Schema,
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
    context.addIssue({ message: 'promoted promotion state requires a promoted generation', code: 'custom' })
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
  if (generation.processingSummary !== deriveProcessingSummaryV2(generation)) {
    context.addIssue({
      code: 'custom',
      message: 'processingSummary violates deterministic precedence',
      path: ['processingSummary'],
    })
  }
})
export type CaptureResolutionGenerationProjectionV2 =
  z.infer<typeof captureResolutionGenerationProjectionV2Schema>

export const captureResolutionProjectionV2Schema = z.discriminatedUnion('readiness', [
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
    generation: captureResolutionGenerationProjectionV2Schema,
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
export type CaptureResolutionProjectionV2 = z.infer<typeof captureResolutionProjectionV2Schema>

/** V2 list rows retain the v1 presentation shape; V2 details carry provider status. */
export const captureResolutionListResultV2Schema = captureResolutionListResultSchema
export type CaptureResolutionListResultV2 = z.infer<typeof captureResolutionListResultV2Schema>

const captureCompletionDestinationV2Schema = z.object({
  status: z.enum(['not_required', 'resolved', 'action_required', 'exhausted', 'blocked']),
  url: lifecycleUrlSchema.nullable(),
  providerStatus: resolvedDestinationProviderStatusSchema.optional(),
}).strict().superRefine((destination, context) => {
  if (destination.status !== 'resolved' && destination.providerStatus !== undefined) {
    context.addIssue({
      code: 'custom',
      message: 'destination provider status requires a resolved destination',
      path: ['providerStatus'],
    })
  }
})

export const captureCompletionDetailV2Schema = z.object({
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
  destination: captureCompletionDestinationV2Schema,
  rawEvidence: z.array(z.object({
    captureRevision: positiveRevisionSchema,
    evidenceIndex: z.number().int().nonnegative(),
    label: z.string().trim().min(1).max(200),
    displayValue: z.string().max(4_000),
  }).strict()).max(50),
  exactEvidenceReferences: z.array(captureEvidenceReferenceSchema).max(50),
  jobDefaults: jobFactsV2Schema.partial().strict(),
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
export type CaptureCompletionDetailV2 = z.infer<typeof captureCompletionDetailV2Schema>

export const completeCaptureManuallyV2InputSchema = z.object({
  captureId: lifecycleIdSchema,
  expectedCaptureRevision: positiveRevisionSchema,
  expectedGenerationId: lifecycleIdSchema.nullable(),
  idempotencyKey: idempotencyKeySchema,
  actor: lifecycleActorSchema,
  jobFacts: jobFactsV2Schema,
  destination: jobDestinationV2Schema.nullable(),
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
  const jobFactsDestination = input.jobFacts.destination
  const destinationsMatch = input.destination === null
    ? jobFactsDestination === null
    : jobFactsDestination !== null && input.destination.url === jobFactsDestination.url
  if (!destinationsMatch) {
    context.addIssue({
      code: 'custom',
      message: 'completion destination must equal jobFacts.destination',
      path: ['destination'],
    })
  }
  const hasStrongIdentity = input.externalIdentities.some((identity) =>
    identity.strength === 'strong')
  if (input.destination === null && !hasStrongIdentity) {
    context.addIssue({
      code: 'custom',
      message: 'completion requires a destination URL or strong external identity',
      path: ['destination'],
    })
  }
})
export type CompleteCaptureManuallyV2Input = z.infer<typeof completeCaptureManuallyV2InputSchema>

export const completeCaptureManuallyV2ResultSchema = completeCaptureManuallyResultSchema
export type CompleteCaptureManuallyV2Result =
  z.infer<typeof completeCaptureManuallyV2ResultSchema>
