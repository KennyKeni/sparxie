import { z } from 'zod'
import {
  companyAliasValueSchema,
  companyBlockedResultFields,
  companyDisplayNameSchema,
  companyIdSchema,
  companyNotesSchema,
  companyRevisionSchema,
  companyRevisionWriteFields,
  companyWebsiteUrlSchema,
  companyWriteContextFields,
  workspaceCompanySchema,
} from './company-shared.js'
import { lifecycleBlockerSchema, lifecycleIdSchema } from './lifecycle-shared.js'

const nullableNotesInputSchema = z.union([
  z.literal('').transform(() => null),
  companyNotesSchema,
])

export const createCompanyInputSchema = z.object({
  ...companyWriteContextFields,
  displayName: companyDisplayNameSchema,
  websiteUrl: companyWebsiteUrlSchema.nullable().default(null),
  notes: nullableNotesInputSchema.default(null),
}).strict()
export type CreateCompanyInput = z.input<typeof createCompanyInputSchema>

export const updateCompanyInputSchema = z.object({
  ...companyRevisionWriteFields,
  displayName: companyDisplayNameSchema.optional(),
  websiteUrl: companyWebsiteUrlSchema.nullable().optional(),
}).strict().refine(
  (input) => input.displayName !== undefined || input.websiteUrl !== undefined,
  { message: 'at least one Company field must be updated' },
)
export type UpdateCompanyInput = z.input<typeof updateCompanyInputSchema>

export const updateCompanyNotesInputSchema = z.object({
  ...companyRevisionWriteFields,
  notes: nullableNotesInputSchema,
}).strict()
export type UpdateCompanyNotesInput = z.input<typeof updateCompanyNotesInputSchema>

export const addCompanyAliasInputSchema = z.object({
  ...companyRevisionWriteFields,
  value: companyAliasValueSchema,
}).strict()
export type AddCompanyAliasInput = z.input<typeof addCompanyAliasInputSchema>

export const updateCompanyAliasInputSchema = z.object({
  ...companyRevisionWriteFields,
  aliasId: lifecycleIdSchema,
  value: companyAliasValueSchema,
}).strict()
export type UpdateCompanyAliasInput = z.input<typeof updateCompanyAliasInputSchema>

export const removeCompanyAliasInputSchema = z.object({
  ...companyRevisionWriteFields,
  aliasId: lifecycleIdSchema,
}).strict()
export type RemoveCompanyAliasInput = z.input<typeof removeCompanyAliasInputSchema>

export const archiveCompanyInputSchema = z.object(companyRevisionWriteFields).strict()
export type ArchiveCompanyInput = z.input<typeof archiveCompanyInputSchema>
export const restoreCompanyInputSchema = z.object(companyRevisionWriteFields).strict()
export type RestoreCompanyInput = z.input<typeof restoreCompanyInputSchema>

const successCorrelationFields = {
  workspaceId: lifecycleIdSchema,
  companyId: companyIdSchema,
  requestCompanyRevision: companyRevisionSchema.nullable(),
  idempotencyKey: z.string().trim().min(1).max(200),
} as const

function mutationResultSchema<S extends 'updated' | 'archived' | 'restored'>(
  status: S,
  allowedCompanyStatuses: ReadonlySet<'active' | 'archived' | 'merged'>,
) {
  return z.discriminatedUnion('status', [
    z.object({
      ...successCorrelationFields,
      status: z.literal(status),
      requestCompanyRevision: companyRevisionSchema,
      company: workspaceCompanySchema,
    }).strict(),
    z.object({
      ...companyBlockedResultFields,
      companyId: companyIdSchema,
      requestCompanyRevision: companyRevisionSchema,
    }).strict(),
  ]).superRefine((result, context) => {
    if (!('company' in result)) {
      if (result.failure.kind === 'stale_guard'
        && result.failure.recovery.guards.some((guard) =>
          guard.kind !== 'company_revision'
          || guard.companyId !== result.companyId
          || guard.expectedRevision !== result.requestCompanyRevision)) {
        context.addIssue({
          code: 'custom',
          message: 'stale guards must correlate the requested Company revision',
        })
      }
      return
    }
    if (result.company.workspaceId !== result.workspaceId
      || result.company.id !== result.companyId) {
      context.addIssue({ code: 'custom', message: 'result Company must match request correlation' })
    }
    if (!allowedCompanyStatuses.has(result.company.status)) {
      context.addIssue({ code: 'custom', message: 'result Company has an invalid lifecycle state' })
    }
    if (result.company.revision <= result.requestCompanyRevision) {
      context.addIssue({ code: 'custom', message: 'a Company mutation must advance revision' })
    }
  })
}

export const createCompanyResultSchema = z.discriminatedUnion('status', [
  z.object({
    ...successCorrelationFields,
    status: z.literal('created'),
    requestCompanyRevision: z.null(),
    company: workspaceCompanySchema,
  }).strict().superRefine((result, context) => {
    if (result.company.workspaceId !== result.workspaceId
      || result.company.id !== result.companyId) {
      context.addIssue({ code: 'custom', message: 'created Company must match correlation' })
    }
    if (result.company.status !== 'active') {
      context.addIssue({ code: 'custom', message: 'a created Company must be active' })
    }
  }),
  z.object({
    ...companyBlockedResultFields,
    failure: z.object({
      kind: z.literal('lifecycle_failure'),
      blocker: lifecycleBlockerSchema,
    }).strict(),
  }).strict(),
])
export type CreateCompanyResult = z.infer<typeof createCompanyResultSchema>
export const updateCompanyResultSchema = mutationResultSchema(
  'updated',
  new Set(['active', 'archived']),
)
export type UpdateCompanyResult = z.infer<typeof updateCompanyResultSchema>
export const updateCompanyNotesResultSchema = mutationResultSchema(
  'updated',
  new Set(['active', 'archived', 'merged']),
)
export type UpdateCompanyNotesResult = z.infer<typeof updateCompanyNotesResultSchema>
export const archiveCompanyResultSchema = mutationResultSchema('archived', new Set(['archived']))
export type ArchiveCompanyResult = z.infer<typeof archiveCompanyResultSchema>
export const restoreCompanyResultSchema = mutationResultSchema('restored', new Set(['active']))
export type RestoreCompanyResult = z.infer<typeof restoreCompanyResultSchema>

export type CompanyUpdatedResult = UpdateCompanyResult
