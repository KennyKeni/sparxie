import { z } from 'zod'
import {
  duplicateResolutionSchema, historyListInputSchema, lifecycleActorSchema, lifecycleAuditEvidenceSchema,
  lifecycleIdSchema, lifecycleInstantSchema, lifecycleListResultSchema, mutationResultSchema,
  removalInputSchema, removalResultSchema, restoreInputSchema, restoreResultSchema,
  warningOverrideSchema,
} from './lifecycle-shared.js'
import { jobIdSchema } from './job.js'

export const opportunityFitStates = ['fit', 'possible', 'not_fit', 'unknown'] as const
export const opportunityCutoffStates = ['above', 'below', 'not_evaluated'] as const
export const opportunityDispositions = ['reviewing', 'pursue', 'hold', 'declined', 'archived'] as const

export const opportunitySchema = z.object({
  id: lifecycleIdSchema, workspaceId: lifecycleIdSchema, jobId: jobIdSchema,
  revision: z.number().int().positive(), fit: z.enum(opportunityFitStates),
  rank: z.number().int().positive().nullable(), cutoff: z.enum(opportunityCutoffStates),
  disposition: z.enum(opportunityDispositions), override: warningOverrideSchema.nullable(),
  createdAt: lifecycleInstantSchema, updatedAt: lifecycleInstantSchema,
  removedAt: lifecycleInstantSchema.nullable(),
}).strict()

export type Opportunity = z.infer<typeof opportunitySchema>

export const opportunityListInputSchema = z.object({
  jobId: jobIdSchema.optional(), fit: z.enum(opportunityFitStates).optional(),
  disposition: z.enum(opportunityDispositions).optional(), includeRemoved: z.boolean().optional(),
  limit: z.number().int().min(1).max(200).optional(), cursor: lifecycleIdSchema.optional(),
}).strict()
export type OpportunityListInput = z.infer<typeof opportunityListInputSchema>
export const opportunityListResultSchema = lifecycleListResultSchema(opportunitySchema)
export type OpportunityListResult = z.infer<typeof opportunityListResultSchema>

export const createOpportunityInputSchema = z.object({
  idempotencyKey: lifecycleIdSchema, actor: lifecycleActorSchema,
  jobId: jobIdSchema, expectedJobFactsRevision: z.number().int().positive(),
  fit: z.enum(opportunityFitStates), rank: z.number().int().positive().nullable(),
  cutoff: z.enum(opportunityCutoffStates), disposition: z.enum(opportunityDispositions),
  override: warningOverrideSchema.optional(), duplicateResolution: duplicateResolutionSchema.optional(),
}).strict()
export type CreateOpportunityInput = z.infer<typeof createOpportunityInputSchema>

export const updateOpportunityEvaluationInputSchema = z.object({
  opportunityId: lifecycleIdSchema, expectedRevision: z.number().int().positive(), actor: lifecycleActorSchema,
  fit: z.enum(opportunityFitStates), rank: z.number().int().positive().nullable(),
  cutoff: z.enum(opportunityCutoffStates), override: warningOverrideSchema.nullable().optional(),
}).strict()
export type UpdateOpportunityEvaluationInput = z.infer<typeof updateOpportunityEvaluationInputSchema>

export const updateOpportunityDispositionInputSchema = z.object({
  opportunityId: lifecycleIdSchema, expectedRevision: z.number().int().positive(), actor: lifecycleActorSchema,
  disposition: z.enum(opportunityDispositions), rationale: z.string().trim().min(1).max(1_000),
  override: warningOverrideSchema.nullable().optional(),
}).strict()
export type UpdateOpportunityDispositionInput = z.infer<typeof updateOpportunityDispositionInputSchema>

export const opportunityMutationResultSchema = mutationResultSchema(opportunitySchema)
export type OpportunityMutationResult = z.infer<typeof opportunityMutationResultSchema>

export const opportunityHistoryKinds = ['created', 'evaluation_changed', 'disposition_changed', 'removed', 'restored'] as const
export const opportunityHistoryEntrySchema = z.object({
  opportunityId: lifecycleIdSchema, revision: z.number().int().positive(), kind: z.enum(opportunityHistoryKinds),
  snapshot: opportunitySchema, audit: lifecycleAuditEvidenceSchema,
}).strict()
export type OpportunityHistoryEntry = z.infer<typeof opportunityHistoryEntrySchema>
export const opportunityHistoryInputSchema = historyListInputSchema
export const opportunityHistoryResultSchema = lifecycleListResultSchema(opportunityHistoryEntrySchema)
export type OpportunityHistoryResult = z.infer<typeof opportunityHistoryResultSchema>

export const removeOpportunityInputSchema = removalInputSchema
export const removeOpportunityResultSchema = removalResultSchema
export const restoreOpportunityInputSchema = restoreInputSchema
export const restoreOpportunityResultSchema = restoreResultSchema
