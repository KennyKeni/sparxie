import { z } from 'zod'
import {
  companyIdSchema,
  companyRevisionSchema,
  companyRationaleSchema,
  createCompanyPageInputSchema,
  createCompanyPageSchema,
} from './company-shared.js'
import {
  lifecycleActorSchema,
  lifecycleIdSchema,
  lifecycleInstantSchema,
} from './lifecycle-shared.js'

export const companyHistoryContractVersion = 1 as const
export const companyHistoryEventKinds = [
  'created',
  'updated',
  'alias_added',
  'alias_updated',
  'alias_removed',
  'archived',
  'restored',
  'merged',
] as const
export type CompanyHistoryEventKind = (typeof companyHistoryEventKinds)[number]
export const companyHistoryChangedFields = [
  'display_name',
  'website_url',
  'notes',
  'aliases',
  'status',
  'canonical_company',
] as const
export type CompanyHistoryChangedField = (typeof companyHistoryChangedFields)[number]
export const companyHistoryFilters = ['all'] as const
export const companyHistorySorts = ['occurred_desc'] as const
export type CompanyHistoryFilter = (typeof companyHistoryFilters)[number]
export type CompanyHistorySort = (typeof companyHistorySorts)[number]
export const companyHistoryKeysetOrder = {
  fields: ['occurredAt', 'eventId'],
  directions: ['desc', 'desc'],
} as const

export const companyHistoryCursorSchema = z
  .string()
  .min(1)
  .max(2_048)
  .brand<'CompanyHistoryCursor'>()
export type CompanyHistoryCursor = z.infer<typeof companyHistoryCursorSchema>
export const companyHistoryPageInfoSchema = z.object({
  startCursor: companyHistoryCursorSchema.nullable(),
  endCursor: companyHistoryCursorSchema.nullable(),
  hasPreviousPage: z.boolean(),
  hasNextPage: z.boolean(),
}).strict()
export type CompanyHistoryPageInfo = z.infer<typeof companyHistoryPageInfoSchema>

export const companyHistoryListInputSchema = createCompanyPageInputSchema(
  companyHistoryCursorSchema,
  z.enum(companyHistoryFilters).default('all'),
  z.enum(companyHistorySorts).default('occurred_desc'),
)
type CompanyHistoryPageInputFields = {
  filter?: CompanyHistoryFilter
  sort?: CompanyHistorySort
  limit?: number
}
export type CompanyHistoryListInput = CompanyHistoryPageInputFields & (
  | { after: CompanyHistoryCursor; before?: never }
  | { before: CompanyHistoryCursor; after?: never }
  | { after?: never; before?: never }
)

export const companyHistoryEventSchema = z.object({
  eventId: lifecycleIdSchema,
  workspaceId: lifecycleIdSchema,
  companyId: companyIdSchema,
  companyRevision: companyRevisionSchema,
  kind: z.enum(companyHistoryEventKinds),
  occurredAt: lifecycleInstantSchema,
  actor: lifecycleActorSchema,
  rationale: companyRationaleSchema,
  change: z.object({
    priorRevision: companyRevisionSchema.nullable(),
    newRevision: companyRevisionSchema,
    changedFields: z.array(z.enum(companyHistoryChangedFields))
      .min(1)
      .max(companyHistoryChangedFields.length),
    aliasId: lifecycleIdSchema.nullable(),
    relatedCompanyId: companyIdSchema.nullable(),
    affectedJobCount: z.number().int().nonnegative(),
  }).strict(),
}).strict().superRefine((event, context) => {
  if (event.companyRevision !== event.change.newRevision) {
    context.addIssue({ code: 'custom', message: 'event revision must equal the new revision' })
  }
  if (event.kind === 'created') {
    if (event.change.priorRevision !== null) {
      context.addIssue({ code: 'custom', message: 'created events have no prior revision' })
    }
  } else if (event.change.priorRevision === null
    || event.change.newRevision <= event.change.priorRevision) {
    context.addIssue({ code: 'custom', message: 'history changes must advance revision' })
  }
  const fields = event.change.changedFields
  const fieldSet = new Set(fields)
  if (fieldSet.size !== fields.length) {
    context.addIssue({ code: 'custom', message: 'changed fields must be unique' })
  }
  const hasOnly = (allowed: readonly CompanyHistoryChangedField[]) =>
    fields.every((field) => allowed.includes(field))
  const hasNoRelationshipMetadata = event.change.aliasId === null
    && event.change.relatedCompanyId === null
    && event.change.affectedJobCount === 0
  if (event.kind === 'created') {
    if (!fieldSet.has('display_name')
      || !hasOnly(['display_name', 'website_url', 'notes'])
      || !hasNoRelationshipMetadata) {
      context.addIssue({ code: 'custom', message: 'created event metadata is contradictory' })
    }
  } else if (event.kind === 'updated') {
    if (!hasOnly(['display_name', 'website_url', 'notes'])
      || !hasNoRelationshipMetadata) {
      context.addIssue({ code: 'custom', message: 'updated event metadata is contradictory' })
    }
  } else if (event.kind === 'alias_added'
    || event.kind === 'alias_updated'
    || event.kind === 'alias_removed') {
    if (fields.length !== 1
      || fields[0] !== 'aliases'
      || event.change.aliasId === null
      || event.change.relatedCompanyId !== null
      || event.change.affectedJobCount !== 0) {
      context.addIssue({ code: 'custom', message: 'alias event metadata is contradictory' })
    }
  } else if (event.kind === 'archived' || event.kind === 'restored') {
    if (fields.length !== 1
      || fields[0] !== 'status'
      || !hasNoRelationshipMetadata) {
      context.addIssue({ code: 'custom', message: 'lifecycle event metadata is contradictory' })
    }
  } else if (!fieldSet.has('status')
    || !fieldSet.has('canonical_company')
    || !hasOnly(['status', 'canonical_company', 'aliases'])
    || event.change.aliasId !== null
    || event.change.relatedCompanyId === null
    || event.change.relatedCompanyId === event.companyId) {
    context.addIssue({ code: 'custom', message: 'merge event metadata is contradictory' })
  }
})
export type CompanyHistoryEvent = z.infer<typeof companyHistoryEventSchema>

export const companyHistoryPageSchema = createCompanyPageSchema(
  companyHistoryEventSchema,
  companyHistoryPageInfoSchema,
)
export type CompanyHistoryPage = z.infer<typeof companyHistoryPageSchema>
