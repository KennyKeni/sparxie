import { z } from 'zod'
import {
  historyListInputSchema,
  lifecycleActorSchema,
  lifecycleAuditEvidenceSchema,
  lifecycleIdSchema,
  lifecycleInstantSchema,
  lifecycleListPageShape,
  lifecycleUrlSchema,
  mutationResultSchema,
  removalInputSchema,
  removalResultSchema,
  restoreInputSchema,
  restoreResultSchema,
  uuidV7Schema,
} from './lifecycle-shared.js'

export const jobRoleKinds = ['internship', 'co_op', 'new_grad', 'entry_level', 'experienced', 'other'] as const
export const lifecycleJobTimingModes = ['fixed', 'rolling', 'unknown'] as const
export const lifecycleJobSeasons = ['spring', 'summer', 'fall', 'winter'] as const
export const jobWorkModes = ['onsite', 'hybrid', 'remote', 'unknown'] as const
export const jobEmploymentTypes = ['internship', 'temporary', 'part_time', 'full_time', 'contract', 'unknown'] as const
export const jobSeniorities = ['student', 'entry', 'mid', 'senior', 'lead', 'unknown'] as const
export const jobDestinationClasses = ['employer_or_ats', 'third_party_job_posting'] as const

export const jobTermSchema = z.object({ season: z.enum(lifecycleJobSeasons), year: z.number().int().min(2000).max(2200) }).strict()
export const jobLocationSchema = z.object({
  display: z.string().trim().min(1).max(500),
  city: z.string().trim().min(1).max(200).nullable(),
  region: z.string().trim().min(1).max(200).nullable(),
  country: z.string().trim().min(1).max(200).nullable(),
}).strict()

export const jobCompensationSchema = z.object({
  minimum: z.number().nonnegative().nullable(), maximum: z.number().nonnegative().nullable(),
  currency: z.string().trim().min(3).max(3).nullable(),
  interval: z.enum(['hour', 'day', 'week', 'month', 'year', 'unknown']),
  display: z.string().trim().min(1).max(500),
}).strict()

export const jobDestinationSchema = z.object({
  class: z.enum(jobDestinationClasses), url: lifecycleUrlSchema,
}).strict()

export const jobFactsSchema = z.object({
  companyName: z.string().trim().min(1).max(500),
  roleTitle: z.string().trim().min(1).max(500),
  sourceName: z.string().trim().min(1).max(500),
  roleKind: z.enum(jobRoleKinds),
  term: z.string().trim().min(1).max(200).nullable(),
  terms: z.array(jobTermSchema).max(20),
  timingMode: z.enum(lifecycleJobTimingModes),
  startDate: z.iso.date().nullable(),
  endDate: z.iso.date().nullable(),
  location: jobLocationSchema.nullable(),
  workMode: z.enum(jobWorkModes),
  employmentType: z.enum(jobEmploymentTypes),
  seniority: z.enum(jobSeniorities),
  compensation: jobCompensationSchema.nullable(),
  postedAt: z.iso.date().nullable(),
  destination: jobDestinationSchema.nullable(),
}).strict()

export type JobFacts = z.infer<typeof jobFactsSchema>

export const captureEvidenceReferenceSchema = z.object({
  captureId: lifecycleIdSchema,
  captureRevision: z.number().int().positive(),
  evidenceIndexes: z.array(z.number().int().nonnegative()).max(50),
}).strict()

export type CaptureEvidenceReference = z.infer<typeof captureEvidenceReferenceSchema>

export const jobExternalIdentityKinds = ['ats_job', 'employer_job', 'canonical_destination', 'posting'] as const
export const jobExternalIdentitySchema = z.object({
  kind: z.enum(jobExternalIdentityKinds),
  provider: z.string().trim().toLowerCase().min(1).max(200),
  account: z.string().trim().toLowerCase().min(1).max(500).nullable(),
  value: z.string().trim().min(1).max(2_000),
  strength: z.enum(['strong', 'provisional']),
}).strict().superRefine((identity, context) => {
  if (identity.strength === 'strong' && identity.account === null) {
    context.addIssue({ code: 'custom', message: 'strong identities require a normalized account', path: ['account'] })
  }
})

export type JobExternalIdentity = z.infer<typeof jobExternalIdentitySchema>

export const jobAvailabilityStates = ['open', 'closed', 'unknown'] as const
export const jobAvailabilitySchema = z.object({
  state: z.enum(jobAvailabilityStates), observedAt: lifecycleInstantSchema,
}).strict()

export const jobSchema = z.object({
  id: uuidV7Schema,
  workspaceId: lifecycleIdSchema,
  factsRevision: z.number().int().positive(),
  facts: jobFactsSchema,
  availabilityRevision: z.number().int().positive(),
  availability: jobAvailabilitySchema,
  externalIdentities: z.array(jobExternalIdentitySchema).max(100),
  captureEvidenceReferences: z.array(captureEvidenceReferenceSchema).min(1).max(100),
  createdAt: lifecycleInstantSchema,
  updatedAt: lifecycleInstantSchema,
  removedAt: lifecycleInstantSchema.nullable(),
}).strict()

export type Job = z.infer<typeof jobSchema>

export const jobListInputSchema = z.object({
  availability: z.enum(jobAvailabilityStates).optional(), includeRemoved: z.boolean().optional(),
  limit: z.number().int().min(1).max(200).optional(), cursor: lifecycleIdSchema.optional(),
}).strict()
export type JobListInput = z.infer<typeof jobListInputSchema>
export const jobListResultSchema = z.object({ items: z.array(jobSchema), ...lifecycleListPageShape }).strict()
export type JobListResult = z.infer<typeof jobListResultSchema>

export const correctJobFactsInputSchema = z.object({
  jobId: uuidV7Schema, expectedFactsRevision: z.number().int().positive(), actor: lifecycleActorSchema,
  rationale: z.string().trim().min(1).max(1_000), facts: jobFactsSchema,
  evidenceReferences: z.array(captureEvidenceReferenceSchema).min(1).max(100),
}).strict()
export type CorrectJobFactsInput = z.infer<typeof correctJobFactsInputSchema>

export const updateJobAvailabilityInputSchema = z.object({
  jobId: uuidV7Schema, expectedAvailabilityRevision: z.number().int().positive(),
  actor: lifecycleActorSchema, availability: jobAvailabilitySchema,
  evidenceReferences: z.array(captureEvidenceReferenceSchema).min(1).max(100),
}).strict()
export type UpdateJobAvailabilityInput = z.infer<typeof updateJobAvailabilityInputSchema>

export const addJobExternalIdentityInputSchema = z.object({
  jobId: uuidV7Schema, actor: lifecycleActorSchema, identity: jobExternalIdentitySchema,
}).strict()
export type AddJobExternalIdentityInput = z.infer<typeof addJobExternalIdentityInputSchema>

export const removeJobExternalIdentityInputSchema = z.object({
  jobId: uuidV7Schema, actor: lifecycleActorSchema, identity: jobExternalIdentitySchema,
  rationale: z.string().trim().min(1).max(1_000),
}).strict()
export type RemoveJobExternalIdentityInput = z.infer<typeof removeJobExternalIdentityInputSchema>

export const jobMutationResultSchema = mutationResultSchema(jobSchema)
export type JobMutationResult = z.infer<typeof jobMutationResultSchema>

export const jobHistoryKinds = ['created', 'facts_corrected', 'availability_changed', 'identity_added', 'identity_removed', 'removed', 'restored'] as const
export const jobHistoryEntrySchema = z.object({
  jobId: uuidV7Schema, sequence: z.number().int().positive(), kind: z.enum(jobHistoryKinds),
  snapshot: jobSchema, audit: lifecycleAuditEvidenceSchema,
}).strict()
export type JobHistoryEntry = z.infer<typeof jobHistoryEntrySchema>
export const jobHistoryInputSchema = historyListInputSchema
export const jobHistoryResultSchema = z.object({ items: z.array(jobHistoryEntrySchema), ...lifecycleListPageShape }).strict()
export type JobHistoryResult = z.infer<typeof jobHistoryResultSchema>

export const removeJobInputSchema = removalInputSchema
export const removeJobResultSchema = removalResultSchema
export const restoreJobInputSchema = restoreInputSchema
export const restoreJobResultSchema = restoreResultSchema
