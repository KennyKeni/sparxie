import { z } from 'zod'
import { lifecycleIdSchema, lifecycleInstantSchema } from './lifecycle-shared.js'
import {
  companyDisplayNameSchema,
  companyIdSchema,
  companyRevisionSchema,
  companyWebsiteUrlSchema,
  createCompanyPageInputSchema,
  createCompanyPageSchema,
  workspaceCompanySchema,
} from './company-shared.js'
import { companyHistoryEventKinds } from './company-history.js'

export const companySearchScopes = ['active', 'active_and_archived'] as const
export type CompanySearchScope = (typeof companySearchScopes)[number]
export const companySearchInputSchema = z.object({
  query: z.string().trim().min(1).max(500),
  scope: z.enum(companySearchScopes).default('active'),
  limit: z.number().int().min(1).max(50).default(20),
}).strict()
export type CompanySearchInput = z.input<typeof companySearchInputSchema>

export const companySearchResultSchema = z.object({
  companyId: companyIdSchema,
  revision: companyRevisionSchema,
  displayName: companyDisplayNameSchema,
  websiteUrl: companyWebsiteUrlSchema.nullable(),
  status: z.enum(['active', 'archived']),
  assignedJobCount: z.number().int().nonnegative(),
}).strict()
export type CompanySearchResult = z.infer<typeof companySearchResultSchema>

export const companySearchPageSchema = z.object({
  items: z.array(companySearchResultSchema).max(50),
  truncated: z.boolean(),
}).strict()
export type CompanySearchPage = z.infer<typeof companySearchPageSchema>

export const companyMatchReasonCodes = [
  'normalized_name_similarity',
  'alias_similarity',
  'same_declared_domain',
] as const
export type CompanyMatchReasonCode = (typeof companyMatchReasonCodes)[number]
export const companyMatchReasonSchema = z.object({
  code: z.enum(companyMatchReasonCodes),
  label: z.string().trim().min(1).max(200),
}).strict()
export type CompanyMatchReason = z.infer<typeof companyMatchReasonSchema>

export const companyMatchPreviewInputSchema = z.object({
  displayName: companyDisplayNameSchema,
  websiteUrl: companyWebsiteUrlSchema.nullable().default(null),
  limit: z.number().int().min(1).max(50).default(20),
}).strict()
export type CompanyMatchPreviewInput = z.input<typeof companyMatchPreviewInputSchema>

export const companyMatchPreviewSchema = z.object({
  companyId: companyIdSchema,
  revision: companyRevisionSchema,
  displayName: companyDisplayNameSchema,
  websiteUrl: companyWebsiteUrlSchema.nullable(),
  score: z.number().min(0).max(1),
  reasons: z.array(companyMatchReasonSchema).min(1).max(companyMatchReasonCodes.length),
}).strict().superRefine((match, context) => {
  const codes = match.reasons.map((reason) => reason.code)
  if (new Set(codes).size !== codes.length) {
    context.addIssue({ code: 'custom', message: 'match reason codes must be unique' })
  }
})
export type CompanyMatchPreview = z.infer<typeof companyMatchPreviewSchema>

export const companyMatchPreviewPageSchema = z.object({
  items: z.array(companyMatchPreviewSchema).max(50),
  truncated: z.boolean(),
}).strict()
export type CompanyMatchPreviewPage = z.infer<typeof companyMatchPreviewPageSchema>

export const companyDirectoryFilters = ['all', 'active', 'archived', 'merged'] as const
export const companyDirectorySorts = ['display_name_asc'] as const
export type CompanyDirectoryFilter = (typeof companyDirectoryFilters)[number]
export type CompanyDirectorySort = (typeof companyDirectorySorts)[number]
export const companyDirectoryKeysetOrder = {
  fields: ['normalizedDisplayName', 'companyId'],
  directions: ['asc', 'asc'],
} as const
export const companyDirectoryCursorSchema = z
  .string()
  .min(1)
  .max(2_048)
  .brand<'CompanyDirectoryCursor'>()
export type CompanyDirectoryCursor = z.infer<typeof companyDirectoryCursorSchema>
export const companyDirectoryPageInfoSchema = z.object({
  startCursor: companyDirectoryCursorSchema.nullable(),
  endCursor: companyDirectoryCursorSchema.nullable(),
  hasPreviousPage: z.boolean(),
  hasNextPage: z.boolean(),
}).strict()
export type CompanyDirectoryPageInfo = z.infer<typeof companyDirectoryPageInfoSchema>
export const companyDirectoryListInputSchema = createCompanyPageInputSchema(
  companyDirectoryCursorSchema,
  z.enum(companyDirectoryFilters).default('all'),
  z.literal('display_name_asc').default('display_name_asc'),
)
type CompanyDirectoryPageInputFields = {
  filter?: (typeof companyDirectoryFilters)[number]
  sort?: (typeof companyDirectorySorts)[number]
  limit?: number
}
export type CompanyDirectoryListInput = CompanyDirectoryPageInputFields & (
  | { after: CompanyDirectoryCursor; before?: never }
  | { before: CompanyDirectoryCursor; after?: never }
  | { after?: never; before?: never }
)

export const companyDirectoryRowSchema = z.object({
  companyId: companyIdSchema,
  revision: companyRevisionSchema,
  displayName: companyDisplayNameSchema,
  websiteHost: z.string().trim().min(1).max(253).nullable(),
  status: z.enum(['active', 'archived', 'merged']),
  assignedJobCount: z.number().int().nonnegative(),
  openDuplicateCandidateCount: z.number().int().nonnegative(),
  updatedAt: lifecycleInstantSchema,
  canonicalCompanyId: companyIdSchema,
}).strict().superRefine((row, context) => {
  if (row.status !== 'merged' && row.companyId !== row.canonicalCompanyId) {
    context.addIssue({ code: 'custom', message: 'non-merged rows are canonical' })
  }
  if (row.status === 'merged' && row.companyId === row.canonicalCompanyId) {
    context.addIssue({ code: 'custom', message: 'merged rows identify another canonical Company' })
  }
})
export type CompanyDirectoryRow = z.infer<typeof companyDirectoryRowSchema>
export type CompanyDirectoryStatus = CompanyDirectoryRow['status']
export const companyDirectoryPageSchema = createCompanyPageSchema(
  companyDirectoryRowSchema,
  companyDirectoryPageInfoSchema,
)
export type CompanyDirectoryPage = z.infer<typeof companyDirectoryPageSchema>

export const workspaceCompanyLookupSchema = z.object({
  requested: workspaceCompanySchema,
  canonical: workspaceCompanySchema,
  redirectPath: z.array(companyIdSchema).max(1),
}).strict().superRefine((lookup, context) => {
  if (lookup.canonical.status === 'merged') {
    context.addIssue({ code: 'custom', message: 'canonical Company must be terminal' })
  }
  if (lookup.requested.workspaceId !== lookup.canonical.workspaceId) {
    context.addIssue({ code: 'custom', message: 'lookup resources must share a workspace' })
  }
  const redirected = lookup.requested.id !== lookup.canonical.id
  if (redirected !== (lookup.redirectPath.length === 1)
    || (redirected && lookup.redirectPath[0] !== lookup.canonical.id)) {
    context.addIssue({ code: 'custom', message: 'redirect path must identify the canonical Company' })
  }
  if (redirected && (lookup.requested.status !== 'merged'
    || lookup.requested.mergedIntoCompanyId !== lookup.canonical.id)) {
    context.addIssue({ code: 'custom', message: 'only a merged requested Company redirects' })
  }
})
export type WorkspaceCompanyLookup = z.infer<typeof workspaceCompanyLookupSchema>

export const companyHistorySummarySchema = z.object({
  lastEventAt: lifecycleInstantSchema.nullable(),
  eventCount: z.number().int().nonnegative(),
  recentEvents: z.array(z.object({
    eventId: lifecycleIdSchema,
    kind: z.enum(companyHistoryEventKinds),
    occurredAt: lifecycleInstantSchema,
  }).strict()).max(20),
}).strict()
export type CompanyHistorySummary = z.infer<typeof companyHistorySummarySchema>

export const companyDetailSchema = z.object({
  lookup: workspaceCompanyLookupSchema,
  assignedJobCount: z.number().int().nonnegative(),
  openDuplicateCandidateCount: z.number().int().nonnegative(),
  history: companyHistorySummarySchema,
}).strict()
export type CompanyDetail = z.infer<typeof companyDetailSchema>
