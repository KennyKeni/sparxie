import { z } from 'zod'
import { applicationDuplicateResolutionSchema, applicationSchema, pursuitLinkInputSchema } from './lifecycle-application.js'
import { captureEvidenceReferenceSchema, jobDuplicateResolutionSchema, jobExternalIdentitySchema, jobFactsSchema, jobIdSchema, jobSchema } from './job.js'
import { lifecycleActorSchema, lifecycleIdSchema, promotionResultSchema, warningOverrideSchema } from './lifecycle-shared.js'
import { opportunityCutoffStates, opportunityDispositions, opportunityDuplicateResolutionSchema, opportunityFitStates, opportunitySchema } from './opportunity.js'

const promotionBase = {
  idempotencyKey: lifecycleIdSchema,
  actor: lifecycleActorSchema,
} as const

export const promoteCaptureToJobInputSchema = z.object({
  ...promotionBase,
  captureId: lifecycleIdSchema,
  captureRevision: z.number().int().positive(),
  selectedFacts: jobFactsSchema,
  evidenceReferences: z.array(captureEvidenceReferenceSchema).min(1).max(100),
  externalIdentities: z.array(jobExternalIdentitySchema).max(100),
  override: warningOverrideSchema.optional(),
  duplicateResolution: jobDuplicateResolutionSchema.optional(),
}).strict().superRefine((input, context) => {
  if (!input.evidenceReferences.some((reference) =>
    reference.captureId === input.captureId && reference.captureRevision === input.captureRevision)) {
    context.addIssue({ code: 'custom', message: 'selected facts must reference the promoted Capture revision', path: ['evidenceReferences'] })
  }
})
export type PromoteCaptureToJobInput = z.infer<typeof promoteCaptureToJobInputSchema>
export const promoteCaptureToJobResultSchema = promotionResultSchema(jobSchema, jobDuplicateResolutionSchema)
export type PromoteCaptureToJobResult = z.infer<typeof promoteCaptureToJobResultSchema>

export const promoteJobToOpportunityInputSchema = z.object({
  ...promotionBase,
  jobId: jobIdSchema,
  expectedFactsRevision: z.number().int().positive(),
  evaluation: z.object({
    fit: z.enum(opportunityFitStates), rank: z.number().int().positive().nullable(),
    cutoff: z.enum(opportunityCutoffStates), disposition: z.enum(opportunityDispositions),
  }).strict(),
  override: warningOverrideSchema.optional(),
  duplicateResolution: opportunityDuplicateResolutionSchema.optional(),
}).strict()
export type PromoteJobToOpportunityInput = z.infer<typeof promoteJobToOpportunityInputSchema>
export const promoteJobToOpportunityResultSchema = promotionResultSchema(opportunitySchema, opportunityDuplicateResolutionSchema)
export type PromoteJobToOpportunityResult = z.infer<typeof promoteJobToOpportunityResultSchema>

export const promoteOpportunityToApplicationInputSchema = z.object({
  ...promotionBase,
  opportunityId: lifecycleIdSchema,
  expectedJobId: jobIdSchema,
  initialLinks: z.array(pursuitLinkInputSchema).max(50).optional(),
  override: warningOverrideSchema.optional(),
  duplicateResolution: applicationDuplicateResolutionSchema.optional(),
}).strict()
export type PromoteOpportunityToApplicationInput = z.infer<typeof promoteOpportunityToApplicationInputSchema>
export const promoteOpportunityToApplicationResultSchema = promotionResultSchema(applicationSchema, applicationDuplicateResolutionSchema)
export type PromoteOpportunityToApplicationResult = z.infer<typeof promoteOpportunityToApplicationResultSchema>
