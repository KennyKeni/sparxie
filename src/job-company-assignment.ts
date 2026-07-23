import { z } from 'zod'
import { jobIdSchema } from './job.js'
import {
  companyBlockedResultFields,
  companyDisplayNameSchema,
  companyIdSchema,
  companyIdempotencyKeySchema,
  companyRevisionSchema,
  companyWriteContextFields,
  createCompanyPageInputSchema,
  createCompanyPageSchema,
} from './company-shared.js'
import { lifecycleIdSchema } from './lifecycle-shared.js'

export const jobCompanyAssignmentContractVersion = 1 as const
export const companyAssignedJobFilters = ['all'] as const
export const companyAssignedJobSorts = ['role_title_asc'] as const
export type CompanyAssignedJobFilter = (typeof companyAssignedJobFilters)[number]
export type CompanyAssignedJobSort = (typeof companyAssignedJobSorts)[number]
export const companyAssignedJobKeysetOrder = {
  fields: ['roleTitle', 'jobId'],
  directions: ['asc', 'asc'],
} as const
export const companyAssignedJobCursorSchema = z
  .string()
  .min(1)
  .max(2_048)
  .brand<'CompanyAssignedJobCursor'>()
export type CompanyAssignedJobCursor = z.infer<typeof companyAssignedJobCursorSchema>
export const companyAssignedJobPageInfoSchema = z.object({
  startCursor: companyAssignedJobCursorSchema.nullable(),
  endCursor: companyAssignedJobCursorSchema.nullable(),
  hasPreviousPage: z.boolean(),
  hasNextPage: z.boolean(),
}).strict()
export type CompanyAssignedJobPageInfo = z.infer<typeof companyAssignedJobPageInfoSchema>

export const jobCompanyAssignmentPresentationSchema = z.object({
  jobId: jobIdSchema,
  assignmentRevision: companyRevisionSchema,
  workspaceCompany: z.object({
    companyId: companyIdSchema,
    revision: companyRevisionSchema,
    displayName: companyDisplayNameSchema,
    status: z.enum(['active', 'archived']),
  }).strict(),
  jobFactsCompanyName: companyDisplayNameSchema,
  roleTitle: z.string().trim().min(1).max(500),
  namesDiffer: z.boolean(),
}).strict()
export type JobCompanyAssignmentPresentation =
  z.infer<typeof jobCompanyAssignmentPresentationSchema>

export const companyAssignedJobListInputSchema = createCompanyPageInputSchema(
  companyAssignedJobCursorSchema,
  z.enum(companyAssignedJobFilters).default('all'),
  z.enum(companyAssignedJobSorts).default('role_title_asc'),
)
type CompanyAssignedJobPageInputFields = {
  filter?: CompanyAssignedJobFilter
  sort?: CompanyAssignedJobSort
  limit?: number
}
export type CompanyAssignedJobListInput = CompanyAssignedJobPageInputFields & (
  | { after: CompanyAssignedJobCursor; before?: never }
  | { before: CompanyAssignedJobCursor; after?: never }
  | { after?: never; before?: never }
)
export const companyAssignedJobPageSchema = createCompanyPageSchema(
  jobCompanyAssignmentPresentationSchema,
  companyAssignedJobPageInfoSchema,
)
export type CompanyAssignedJobPage = z.infer<typeof companyAssignedJobPageSchema>

export const reassignJobCompanyInputSchema = z.object({
  ...companyWriteContextFields,
  jobId: jobIdSchema,
  expectedAssignmentRevision: companyRevisionSchema,
  destinationCompanyId: companyIdSchema,
  expectedDestinationCompanyRevision: companyRevisionSchema,
}).strict()
export type ReassignJobCompanyInput = z.input<typeof reassignJobCompanyInputSchema>

export const reassignJobCompanyResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('reassigned'),
    workspaceId: lifecycleIdSchema,
    jobId: jobIdSchema,
    requestAssignmentRevision: companyRevisionSchema,
    requestDestinationCompanyRevision: companyRevisionSchema,
    idempotencyKey: companyIdempotencyKeySchema,
    assignment: jobCompanyAssignmentPresentationSchema,
    jobFactsChanged: z.literal(false),
  }).strict().superRefine((result, context) => {
    if (result.assignment.jobId !== result.jobId
      || result.assignment.assignmentRevision <= result.requestAssignmentRevision
      || result.assignment.workspaceCompany.revision
        !== result.requestDestinationCompanyRevision) {
      context.addIssue({ code: 'custom', message: 'reassignment must advance the assignment only' })
    }
  }),
  z.object({
    ...companyBlockedResultFields,
    jobId: jobIdSchema,
    requestAssignmentRevision: companyRevisionSchema,
    destinationCompanyId: companyIdSchema,
    requestDestinationCompanyRevision: companyRevisionSchema,
  }).strict(),
]).superRefine((result, context) => {
  if (result.status !== 'blocked' || result.failure.kind !== 'stale_guard') return
  if (result.failure.recovery.guards.some((guard) =>
    guard.kind === 'assignment_revision'
      ? guard.jobId !== result.jobId
        || guard.expectedRevision !== result.requestAssignmentRevision
      : guard.kind === 'company_revision'
        ? guard.companyId !== result.destinationCompanyId
          || guard.expectedRevision !== result.requestDestinationCompanyRevision
        : true)) {
    context.addIssue({
      code: 'custom',
      message: 'stale guards must correlate assignment and destination revisions',
    })
  }
})
export type ReassignJobCompanyResult = z.infer<typeof reassignJobCompanyResultSchema>
