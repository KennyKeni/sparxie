import { z } from 'zod'
import {
  duplicateResolutionSchemaFor, historyListInputSchema, lifecycleActorSchema, lifecycleAuditEvidenceSchema,
  lifecycleIdSchema, lifecycleInstantSchema, lifecycleListResultSchema, lifecycleUrlSchema,
  mutationResultSchema, removalInputSchema, removalResultSchema, restoreInputSchema,
  restoreResultSchema, warningOverrideSchema,
} from './lifecycle-shared.js'
import {
  jobDestinationSchema, jobLocationSchema, jobRoleKinds, jobTermSchema,
  lifecycleJobTimingModes, jobWorkModes, jobIdSchema,
} from './job.js'
import { opportunityIdSchema } from './opportunity.js'

export const pursuitApplicationStatuses = ['active', 'submitted', 'interviewing', 'offered', 'withdrawn', 'rejected', 'accepted'] as const
export type PursuitApplicationStatus = (typeof pursuitApplicationStatuses)[number]
export const applicationIdSchema = lifecycleIdSchema.brand<'ApplicationId'>()
export type ApplicationId = z.infer<typeof applicationIdSchema>
export const applicationDuplicateResolutionSchema = duplicateResolutionSchemaFor(applicationIdSchema)
export type ApplicationDuplicateResolutionDecision = z.infer<typeof applicationDuplicateResolutionSchema>

export const pursuitLinkInputSchema = z.object({
  kind: z.string().trim().min(1).max(100), label: z.string().trim().min(1).max(200), url: lifecycleUrlSchema,
}).strict()

export const pursuitLinkSchema = pursuitLinkInputSchema.extend({ id: lifecycleIdSchema, isPrimary: z.boolean() }).strict()
export type PursuitLink = z.infer<typeof pursuitLinkSchema>

export const applicationPursuitSnapshotSchema = z.object({
  jobFactsRevision: z.number().int().positive(), capturedAt: lifecycleInstantSchema,
  companyName: z.string().trim().min(1).max(500), roleTitle: z.string().trim().min(1).max(500),
  sourceName: z.string().trim().min(1).max(500), roleKind: z.enum(jobRoleKinds),
  term: z.string().trim().min(1).max(200).nullable(), terms: z.array(jobTermSchema).max(20),
  timingMode: z.enum(lifecycleJobTimingModes), startDate: z.iso.date().nullable(), endDate: z.iso.date().nullable(),
  location: jobLocationSchema.nullable(), workMode: z.enum(jobWorkModes),
  initialDestination: jobDestinationSchema.nullable(), initialLinks: z.array(pursuitLinkInputSchema).max(50),
}).strict()

export type ApplicationPursuitSnapshot = z.infer<typeof applicationPursuitSnapshotSchema>

export const applicationSchema = z.object({
  id: applicationIdSchema, workspaceId: lifecycleIdSchema, opportunityId: opportunityIdSchema, jobId: jobIdSchema,
  revision: z.number().int().positive(), status: z.enum(pursuitApplicationStatuses),
  snapshot: applicationPursuitSnapshotSchema,
  companyName: z.string().trim().min(1).max(500), sourceName: z.string().trim().min(1).max(500),
  links: z.array(pursuitLinkSchema).max(100),
  createdAt: lifecycleInstantSchema, updatedAt: lifecycleInstantSchema, removedAt: lifecycleInstantSchema.nullable(),
}).strict()

export type Application = z.infer<typeof applicationSchema>

export const lifecycleApplicationListInputSchema = z.object({
  opportunityId: lifecycleIdSchema.optional(), jobId: jobIdSchema.optional(),
  status: z.enum(pursuitApplicationStatuses).optional(), includeRemoved: z.boolean().optional(),
  limit: z.number().int().min(1).max(200).optional(), cursor: lifecycleIdSchema.optional(),
}).strict()
export type LifecycleApplicationListInput = z.infer<typeof lifecycleApplicationListInputSchema>
export const lifecycleApplicationListResultSchema = lifecycleListResultSchema(applicationSchema)
export type LifecycleApplicationListResult = z.infer<typeof lifecycleApplicationListResultSchema>

export const createApplicationInputSchema = z.object({
  idempotencyKey: lifecycleIdSchema, actor: lifecycleActorSchema,
  opportunityId: opportunityIdSchema, jobId: jobIdSchema,
  expectedJobFactsRevision: z.number().int().positive(),
  initialLinks: z.array(pursuitLinkInputSchema).max(50),
  override: warningOverrideSchema.optional(), duplicateResolution: applicationDuplicateResolutionSchema.optional(),
}).strict()
export type CreateApplicationInput = z.infer<typeof createApplicationInputSchema>

const applicationEditBase = {
  applicationId: lifecycleIdSchema, expectedRevision: z.number().int().positive(), actor: lifecycleActorSchema,
} as const

export const updateApplicationCompanyInputSchema = z.object({
  ...applicationEditBase, companyName: z.string().trim().min(1).max(500),
  rationale: z.string().trim().min(1).max(1_000),
}).strict()
export type UpdateApplicationCompanyInput = z.infer<typeof updateApplicationCompanyInputSchema>

export const updateApplicationSourceInputSchema = z.object({
  ...applicationEditBase, sourceName: z.string().trim().min(1).max(500),
  rationale: z.string().trim().min(1).max(1_000),
}).strict()
export type UpdateApplicationSourceInput = z.infer<typeof updateApplicationSourceInputSchema>

export const updatePursuitApplicationStatusInputSchema = z.object({
  ...applicationEditBase, status: z.enum(pursuitApplicationStatuses),
  rationale: z.string().trim().min(1).max(1_000),
}).strict()
export type UpdatePursuitApplicationStatusInput = z.infer<typeof updatePursuitApplicationStatusInputSchema>

export const createPursuitLinkInputSchema = z.object({ ...applicationEditBase, link: pursuitLinkInputSchema, primary: z.boolean() }).strict()
export type CreatePursuitLinkInput = z.infer<typeof createPursuitLinkInputSchema>
export const updatePursuitLinkInputSchema = z.object({ ...applicationEditBase, linkId: lifecycleIdSchema, link: pursuitLinkInputSchema, primary: z.boolean() }).strict()
export type UpdatePursuitLinkInput = z.infer<typeof updatePursuitLinkInputSchema>
export const removePursuitLinkInputSchema = z.object({
  ...applicationEditBase, linkId: lifecycleIdSchema, rationale: z.string().trim().min(1).max(1_000),
}).strict()
export type RemovePursuitLinkInput = z.infer<typeof removePursuitLinkInputSchema>

export const refreshApplicationSnapshotInputSchema = z.object({
  ...applicationEditBase, expectedJobFactsRevision: z.number().int().positive(),
  preserveCompanyEdit: z.boolean(), preserveSourceEdit: z.boolean(), preserveLinkEdits: z.boolean(),
  rationale: z.string().trim().min(1).max(1_000),
}).strict()
export type RefreshApplicationSnapshotInput = z.infer<typeof refreshApplicationSnapshotInputSchema>

export const applicationMutationResultSchema = mutationResultSchema(applicationSchema, applicationDuplicateResolutionSchema)
export type ApplicationMutationResult = z.infer<typeof applicationMutationResultSchema>

export const applicationHistoryKinds = ['created', 'status_changed', 'company_edited', 'source_edited', 'link_created', 'link_updated', 'link_removed', 'snapshot_refreshed', 'removed', 'restored'] as const
export const applicationHistoryEntrySchema = z.object({
  applicationId: lifecycleIdSchema, revision: z.number().int().positive(), kind: z.enum(applicationHistoryKinds),
  snapshot: applicationSchema, audit: lifecycleAuditEvidenceSchema,
}).strict().superRefine((entry, context) => {
  if (entry.applicationId !== entry.snapshot.id) {
    context.addIssue({ code: 'custom', message: 'history Application id must equal the snapshot id', path: ['applicationId'] })
  }
})
export type ApplicationHistoryEntry = z.infer<typeof applicationHistoryEntrySchema>
export const lifecycleApplicationHistoryInputSchema = historyListInputSchema
export const lifecycleApplicationHistoryResultSchema = lifecycleListResultSchema(applicationHistoryEntrySchema)
export type LifecycleApplicationHistoryResult = z.infer<typeof lifecycleApplicationHistoryResultSchema>

export const applicationTechnicalStates = ['pending', 'running', 'succeeded', 'failed'] as const
export const applicationAttemptRecordSchema = z.object({
  id: lifecycleIdSchema, workspaceId: lifecycleIdSchema, applicationId: lifecycleIdSchema,
  state: z.enum(applicationTechnicalStates), startedAt: lifecycleInstantSchema,
  completedAt: lifecycleInstantSchema.nullable(), summary: z.string().trim().min(1).max(2_000).nullable(),
}).strict()
export type ApplicationAttemptRecord = z.infer<typeof applicationAttemptRecordSchema>

export const applicationEventRecordSchema = z.object({
  id: lifecycleIdSchema, workspaceId: lifecycleIdSchema, applicationId: lifecycleIdSchema,
  type: z.string().trim().min(1).max(100), occurredAt: lifecycleInstantSchema,
  actor: lifecycleActorSchema, summary: z.string().trim().min(1).max(2_000),
}).strict()
export type ApplicationEventRecord = z.infer<typeof applicationEventRecordSchema>

export const applicationTechnicalListInputSchema = z.object({
  applicationId: lifecycleIdSchema, limit: z.number().int().min(1).max(200).optional(),
  cursor: lifecycleIdSchema.optional(),
}).strict()
export type ApplicationTechnicalListInput = z.infer<typeof applicationTechnicalListInputSchema>
export const applicationAttemptsListResultSchema = lifecycleListResultSchema(applicationAttemptRecordSchema)
export type ApplicationAttemptsListResult = z.infer<typeof applicationAttemptsListResultSchema>
export const applicationEventsListResultSchema = lifecycleListResultSchema(applicationEventRecordSchema)
export type ApplicationEventsListResult = z.infer<typeof applicationEventsListResultSchema>

export const removeLifecycleApplicationInputSchema = removalInputSchema
export const removeLifecycleApplicationResultSchema = removalResultSchema
export const restoreLifecycleApplicationInputSchema = restoreInputSchema
export const restoreLifecycleApplicationResultSchema = restoreResultSchema
