import { z } from 'zod'
import {
  companyBlockedResultFields,
  companyIdSchema,
  companyIdempotencyKeySchema,
  companyRevisionSchema,
  companyRationaleSchema,
  companyWriteContextFields,
  createCompanyPageInputSchema,
  createCompanyPageSchema,
  workspaceCompanySchema,
} from './company-shared.js'
import {
  companyMatchReasonSchema,
  companySearchResultSchema,
} from './company-query.js'
import { lifecycleActorSchema, lifecycleIdSchema, lifecycleInstantSchema } from './lifecycle-shared.js'

export const companyDuplicateFilters = ['open', 'all'] as const
export const companyDuplicateSorts = ['score_desc'] as const
export const companyDuplicateReviewDecisions = ['mark_distinct', 'merge'] as const
export const companyDuplicateReviewDecisionSchema = z.enum(
  companyDuplicateReviewDecisions,
)
export type CompanyDuplicateFilter = (typeof companyDuplicateFilters)[number]
export type CompanyDuplicateSort = (typeof companyDuplicateSorts)[number]
export type CompanyDuplicateReviewDecision =
  (typeof companyDuplicateReviewDecisions)[number]
export const companyDuplicateKeysetOrder = {
  fields: ['score', 'updatedAt', 'candidateId'],
  directions: ['desc', 'desc', 'asc'],
} as const
export const companyDuplicateCursorSchema = z
  .string()
  .min(1)
  .max(2_048)
  .brand<'CompanyDuplicateCursor'>()
export type CompanyDuplicateCursor = z.infer<typeof companyDuplicateCursorSchema>
export const companyDuplicatePageInfoSchema = z.object({
  startCursor: companyDuplicateCursorSchema.nullable(),
  endCursor: companyDuplicateCursorSchema.nullable(),
  hasPreviousPage: z.boolean(),
  hasNextPage: z.boolean(),
}).strict()
export type CompanyDuplicatePageInfo = z.infer<typeof companyDuplicatePageInfoSchema>
export const companyDuplicateListInputSchema = createCompanyPageInputSchema(
  companyDuplicateCursorSchema,
  z.enum(companyDuplicateFilters).default('open'),
  z.literal('score_desc').default('score_desc'),
)
type CompanyDuplicatePageInputFields = {
  filter?: (typeof companyDuplicateFilters)[number]
  sort?: (typeof companyDuplicateSorts)[number]
  limit?: number
}
export type CompanyDuplicateListInput = CompanyDuplicatePageInputFields & (
  | { after: CompanyDuplicateCursor; before?: never }
  | { before: CompanyDuplicateCursor; after?: never }
  | { after?: never; before?: never }
)

export const companyDuplicateCandidateRowSchema = z.object({
  candidateId: lifecycleIdSchema,
  candidateRevision: companyRevisionSchema,
  left: companySearchResultSchema,
  right: companySearchResultSchema,
  score: z.number().min(0).max(1),
  reasons: z.array(companyMatchReasonSchema).min(1),
  status: z.enum(['open', 'marked_distinct', 'resolved_by_merge']),
  updatedAt: lifecycleInstantSchema,
}).strict().superRefine((candidate, context) => {
  if (candidate.left.companyId >= candidate.right.companyId) {
    context.addIssue({ code: 'custom', message: 'candidate pairs use canonical Company ID order' })
  }
  const codes = candidate.reasons.map((reason) => reason.code)
  if (new Set(codes).size !== codes.length) {
    context.addIssue({ code: 'custom', message: 'candidate reason codes must be unique' })
  }
})
export type CompanyDuplicateCandidateRow = z.infer<typeof companyDuplicateCandidateRowSchema>
export type CompanyDuplicateStatus = CompanyDuplicateCandidateRow['status']
export const companyDuplicatePageSchema = createCompanyPageSchema(
  companyDuplicateCandidateRowSchema,
  companyDuplicatePageInfoSchema,
)
export type CompanyDuplicatePage = z.infer<typeof companyDuplicatePageSchema>

export const markCompaniesDistinctInputSchema = z.object({
  ...companyWriteContextFields,
  candidateId: lifecycleIdSchema,
  expectedCandidateRevision: companyRevisionSchema,
  leftCompanyId: companyIdSchema,
  expectedLeftCompanyRevision: companyRevisionSchema,
  rightCompanyId: companyIdSchema,
  expectedRightCompanyRevision: companyRevisionSchema,
}).strict().refine((input) => input.leftCompanyId < input.rightCompanyId, {
  message: 'Company IDs must use canonical pair order',
})
export type MarkCompaniesDistinctInput = z.input<typeof markCompaniesDistinctInputSchema>

export const markCompaniesDistinctResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('marked_distinct'),
    workspaceId: lifecycleIdSchema,
    candidateId: lifecycleIdSchema,
    requestCandidateRevision: companyRevisionSchema,
    leftCompanyId: companyIdSchema,
    requestLeftCompanyRevision: companyRevisionSchema,
    rightCompanyId: companyIdSchema,
    requestRightCompanyRevision: companyRevisionSchema,
    idempotencyKey: companyIdempotencyKeySchema,
    candidate: companyDuplicateCandidateRowSchema,
  }).strict().superRefine((result, context) => {
    if (result.candidate.candidateId !== result.candidateId
      || result.candidate.candidateRevision <= result.requestCandidateRevision
      || result.candidate.status !== 'marked_distinct'
      || result.candidate.left.companyId !== result.leftCompanyId
      || result.candidate.left.revision !== result.requestLeftCompanyRevision
      || result.candidate.right.companyId !== result.rightCompanyId
      || result.candidate.right.revision !== result.requestRightCompanyRevision) {
      context.addIssue({
        code: 'custom',
        message: 'marked-distinct result must preserve and advance the requested pair',
      })
    }
  }),
  z.object({
    ...companyBlockedResultFields,
    candidateId: lifecycleIdSchema,
    requestCandidateRevision: companyRevisionSchema,
    leftCompanyId: companyIdSchema,
    requestLeftCompanyRevision: companyRevisionSchema,
    rightCompanyId: companyIdSchema,
    requestRightCompanyRevision: companyRevisionSchema,
  }).strict(),
]).superRefine((result, context) => {
  if (result.status !== 'blocked' || result.failure.kind !== 'stale_guard') return
  const companies = new Map([
    [result.leftCompanyId, result.requestLeftCompanyRevision],
    [result.rightCompanyId, result.requestRightCompanyRevision],
  ])
  if (result.failure.recovery.guards.some((guard) =>
    guard.kind === 'duplicate_candidate_revision'
      ? guard.candidateId !== result.candidateId
        || guard.expectedRevision !== result.requestCandidateRevision
      : guard.kind === 'company_revision'
        ? companies.get(guard.companyId) !== guard.expectedRevision
        : true)) {
    context.addIssue({ code: 'custom', message: 'stale guards must correlate the requested pair' })
  }
})
export type MarkCompaniesDistinctResult = z.infer<typeof markCompaniesDistinctResultSchema>

export const companyMergeConfirmationSchema = z.string().min(1).max(500)

export const mergeCompaniesInputSchema = z.object({
  workspaceId: lifecycleIdSchema,
  winnerCompanyId: companyIdSchema,
  expectedWinnerCompanyRevision: companyRevisionSchema,
  loserCompanyId: companyIdSchema,
  expectedLoserCompanyRevision: companyRevisionSchema,
  actor: lifecycleActorSchema,
  rationale: companyRationaleSchema,
  loserDisplayNameConfirmation: companyMergeConfirmationSchema,
  acknowledgeNoUndo: z.literal(true),
  idempotencyKey: companyIdempotencyKeySchema,
}).strict().refine((input) => input.winnerCompanyId !== input.loserCompanyId, {
  message: 'merge winner and loser must be different Companies',
})
export type MergeCompaniesInput = z.input<typeof mergeCompaniesInputSchema>

export const mergeCompaniesResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('merged'),
    workspaceId: lifecycleIdSchema,
    idempotencyKey: companyIdempotencyKeySchema,
    requestWinnerCompanyRevision: companyRevisionSchema,
    requestLoserCompanyRevision: companyRevisionSchema,
    canonical: workspaceCompanySchema,
    merged: workspaceCompanySchema,
    redirectPath: z.tuple([companyIdSchema]),
    reassignedJobCount: z.number().int().nonnegative(),
    flattenedRedirectCount: z.number().int().nonnegative(),
    resolvedCandidateCount: z.number().int().nonnegative(),
    historyPreserved: z.literal(true),
    notesPreserved: z.object({ winner: z.literal(true), loser: z.literal(true) }).strict(),
  }).strict().superRefine((result, context) => {
    if (result.canonical.status !== 'active'
      || result.canonical.workspaceId !== result.workspaceId
      || result.merged.status !== 'merged'
      || result.merged.workspaceId !== result.workspaceId
      || result.merged.mergedIntoCompanyId !== result.canonical.id
      || result.redirectPath[0] !== result.canonical.id
      || result.canonical.revision <= result.requestWinnerCompanyRevision
      || result.merged.revision <= result.requestLoserCompanyRevision) {
      context.addIssue({ code: 'custom', message: 'merge result violates canonical redirect rules' })
    }
  }),
  z.object({
    ...companyBlockedResultFields,
    winnerCompanyId: companyIdSchema,
    requestWinnerCompanyRevision: companyRevisionSchema,
    loserCompanyId: companyIdSchema,
    requestLoserCompanyRevision: companyRevisionSchema,
  }).strict(),
]).superRefine((result, context) => {
  if (result.status !== 'blocked' || result.failure.kind !== 'stale_guard') return
  const companies = new Map([
    [result.winnerCompanyId, result.requestWinnerCompanyRevision],
    [result.loserCompanyId, result.requestLoserCompanyRevision],
  ])
  if (result.failure.recovery.guards.some((guard) =>
    guard.kind !== 'company_revision'
    || companies.get(guard.companyId) !== guard.expectedRevision)) {
    context.addIssue({ code: 'custom', message: 'stale guards must correlate merge Companies' })
  }
})
export type MergeCompaniesResult = z.infer<typeof mergeCompaniesResultSchema>
