import { z } from 'zod'
import {
  lifecycleActorSchema,
  lifecycleBlockerSchema,
  lifecycleIdSchema,
  lifecycleInstantSchema,
  lifecycleUrlSchema,
} from './lifecycle-shared.js'

export const workspaceCompanyContractVersion = 1 as const
export const companyDefaultPageLimit = 50
export const companyMaximumPageLimit = 100

export const companyIdSchema = lifecycleIdSchema.brand<'CompanyId'>()
export type CompanyId = z.infer<typeof companyIdSchema>
export const companyRevisionSchema = z.number().int().positive()
export const companyIdempotencyKeySchema = z.string().trim().min(1).max(200)
export const companyRationaleSchema = z.string().trim().min(1).max(1_000)
export const companyDisplayNameSchema = z.string().trim().min(1).max(500)
export const companyAliasValueSchema = z.string().trim().min(1).max(500)
export const companyWebsiteUrlSchema = lifecycleUrlSchema
export const companyNotesSchema = z.string().min(1).max(10_000).nullable()
export const companyStatuses = ['active', 'archived', 'merged'] as const
export type CompanyStatus = (typeof companyStatuses)[number]

export const companyAliasSchema = z.object({
  id: lifecycleIdSchema,
  value: companyAliasValueSchema,
}).strict()
export type CompanyAlias = z.infer<typeof companyAliasSchema>

export const workspaceCompanySchema = z.object({
  id: companyIdSchema,
  workspaceId: lifecycleIdSchema,
  displayName: companyDisplayNameSchema,
  aliases: z.array(companyAliasSchema),
  websiteUrl: companyWebsiteUrlSchema.nullable(),
  notes: companyNotesSchema,
  revision: companyRevisionSchema,
  status: z.enum(companyStatuses),
  mergedIntoCompanyId: companyIdSchema.nullable(),
  createdAt: lifecycleInstantSchema,
  updatedAt: lifecycleInstantSchema,
}).strict().superRefine((company, context) => {
  if ((company.status === 'merged') !== (company.mergedIntoCompanyId !== null)) {
    context.addIssue({
      code: 'custom',
      message: 'only a merged Company has a canonical Company target',
      path: ['mergedIntoCompanyId'],
    })
  }
  if (company.mergedIntoCompanyId === company.id) {
    context.addIssue({ code: 'custom', message: 'a merged Company cannot redirect to itself' })
  }
  if (new Set(company.aliases.map((alias) => alias.id)).size !== company.aliases.length) {
    context.addIssue({ code: 'custom', message: 'Company alias IDs must be unique' })
  }
})
export type WorkspaceCompany = z.infer<typeof workspaceCompanySchema>

export const companyCapabilitySchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('migrating'),
    completed: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    issueCount: z.number().int().nonnegative(),
  }).strict().superRefine((value, context) => {
    if (value.completed > value.total) {
      context.addIssue({ code: 'custom', message: 'completed cannot exceed total' })
    }
  }),
  z.object({
    status: z.literal('blocked'),
    issueCount: z.number().int().positive(),
    reason: z.enum([
      'migration_failed',
      'invalid_legacy_data',
      'integrity_check_failed',
    ]),
    message: z.string().trim().min(1).max(500),
    remediation: z.null(),
  }).strict(),
  z.object({ status: z.literal('ready') }).strict(),
])
export type CompanyCapability = z.infer<typeof companyCapabilitySchema>

export function createCompanyPageInputSchema<
  Cursor extends z.ZodType,
  Filter extends z.ZodType,
  Sort extends z.ZodType,
>(cursor: Cursor, filter: Filter, sort: Sort) {
  const fields = {
    filter,
    sort,
    limit: z.number().int().min(1).max(companyMaximumPageLimit)
      .default(companyDefaultPageLimit),
  }
  return z.union([
    z.object({
      ...fields,
      after: cursor,
      before: z.never().optional(),
    }).strict(),
    z.object({
      ...fields,
      before: cursor,
      after: z.never().optional(),
    }).strict(),
    z.object({
      ...fields,
      after: z.never().optional(),
      before: z.never().optional(),
    }).strict(),
  ])
}

export function createCompanyPageSchema<
  T extends z.ZodType,
  PageInfo extends z.ZodType,
>(item: T, pageInfo: PageInfo) {
  return z.object({
    items: z.array(item).max(companyMaximumPageLimit),
    pageInfo,
    totalCount: z.number().int().nonnegative(),
  }).strict().superRefine((page, context) => {
    const value = page as {
      items: unknown[]
      pageInfo: { startCursor: unknown; endCursor: unknown }
      totalCount: number
    }
    const absent = value.pageInfo.startCursor === null && value.pageInfo.endCursor === null
    const present = value.pageInfo.startCursor !== null && value.pageInfo.endCursor !== null
    if ((value.items.length === 0 && !absent) || (value.items.length > 0 && !present)) {
      context.addIssue({ code: 'custom', message: 'page cursors must match item presence' })
    }
    if (value.totalCount < value.items.length) {
      context.addIssue({ code: 'custom', message: 'totalCount cannot be smaller than the page' })
    }
  })
}

export const companyWriteContextFields = {
  workspaceId: lifecycleIdSchema,
  actor: lifecycleActorSchema,
  rationale: companyRationaleSchema,
  idempotencyKey: companyIdempotencyKeySchema,
} as const

export const companyRevisionWriteFields = {
  ...companyWriteContextFields,
  companyId: companyIdSchema,
  expectedCompanyRevision: companyRevisionSchema,
} as const

export const companyStaleGuardSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('company_revision'),
    companyId: companyIdSchema,
    expectedRevision: companyRevisionSchema,
    currentRevision: companyRevisionSchema,
  }).strict(),
  z.object({
    kind: z.literal('assignment_revision'),
    jobId: lifecycleIdSchema,
    expectedRevision: companyRevisionSchema,
    currentRevision: companyRevisionSchema,
  }).strict(),
  z.object({
    kind: z.literal('duplicate_candidate_revision'),
    candidateId: lifecycleIdSchema,
    expectedRevision: companyRevisionSchema,
    currentRevision: companyRevisionSchema,
  }).strict(),
]).superRefine((guard, context) => {
  if (guard.expectedRevision === guard.currentRevision) {
    context.addIssue({ code: 'custom', message: 'a stale guard must report changed state' })
  }
})
export type CompanyStaleGuard = z.infer<typeof companyStaleGuardSchema>

export const companyCommandFailureSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('stale_guard'),
    blocker: z.object({
      code: z.literal('impossible_state'),
      message: z.string().trim().min(1).max(500),
      field: z.string().trim().min(1).max(200).optional(),
    }).strict(),
    recovery: z.object({
      action: z.literal('refresh_and_resubmit'),
      guards: z.array(companyStaleGuardSchema).min(1).max(3),
    }).strict().superRefine((recovery, context) => {
      const keys = recovery.guards.map((guard) => `${guard.kind}:${
        'companyId' in guard ? guard.companyId
          : 'jobId' in guard ? guard.jobId : guard.candidateId
      }`)
      if (new Set(keys).size !== keys.length) {
        context.addIssue({ code: 'custom', message: 'stale guards must be unique' })
      }
    }),
  }).strict(),
  z.object({
    kind: z.literal('lifecycle_failure'),
    blocker: lifecycleBlockerSchema,
  }).strict(),
])
export type CompanyCommandFailure = z.infer<typeof companyCommandFailureSchema>

export const companyBlockedResultFields = {
  status: z.literal('blocked'),
  workspaceId: lifecycleIdSchema,
  idempotencyKey: companyIdempotencyKeySchema,
  failure: companyCommandFailureSchema,
} as const
