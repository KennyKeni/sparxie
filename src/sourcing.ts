import { z } from 'zod'
import { roleKinds, workModes, type RoleKind, type WorkMode } from './application.js'
import type { JobTerm, JobTimingMode } from './job-timing.js'
import type { ScoreInput } from './scoring.js'
import {
  canonicalCompensationIntervals,
  canonicalEmploymentTypes,
  canonicalPostedAtPrecisions,
  canonicalSeniorities,
  type CanonicalCandidateDestination,
  type CanonicalCompensation,
  type CanonicalEmploymentType,
  type CanonicalLocation,
  type CanonicalPostedAt,
  type CanonicalSeniority,
} from './raw-sourcing.js'

export const sourcingMergeStatuses = [
  'new',
  'merged',
  'duplicate',
  'below_cutoff',
  'blocked',
  'not_fit',
  'not_pursued',
  'archived',
] as const

export type SourcingMergeStatus = (typeof sourcingMergeStatuses)[number]

export const writableSourcingMergeStatuses = [
  'new',
  'duplicate',
  'below_cutoff',
  'blocked',
  'not_fit',
  'not_pursued',
  'archived',
] as const

export type WritableSourcingMergeStatus = (typeof writableSourcingMergeStatuses)[number]

export const manualSourcingDecisionStatuses = [
  'blocked',
  'not_fit',
  'not_pursued',
  'archived',
] as const

export type ManualSourcingDecisionStatus = (typeof manualSourcingDecisionStatuses)[number]

export const sourcingDestinationClasses = [
  'employer_or_ats',
  'third_party_job_posting',
] as const

export type SourcingDestinationClass = (typeof sourcingDestinationClasses)[number]

export const sourcingUsabilities = ['usable', 'review_only'] as const

export type SourcingUsability = (typeof sourcingUsabilities)[number]

export interface SourcingFindingCanonicalProjection {
  rawRevisionId: string
  canonicalCandidateId: string
  destination: CanonicalCandidateDestination | null
  employmentType: CanonicalEmploymentType
  seniority: CanonicalSeniority
  workMode: WorkMode
  location: CanonicalLocation | null
  compensation: CanonicalCompensation | null
  postedAt: CanonicalPostedAt
}

const canonicalLocationSchema = z
  .object({
    raw: z.string().nullable(),
    city: z.string().nullable(),
    region: z.string().nullable(),
    country: z.string().nullable(),
  })
  .strict()

const canonicalCompensationSchema = z
  .object({
    minimum: z.number().nullable(),
    maximum: z.number().nullable(),
    currency: z.string().nullable(),
    interval: z.enum(canonicalCompensationIntervals),
    raw: z.string().nullable(),
  })
  .strict()

export const sourcingFindingCanonicalProjectionSchema = z
  .object({
    rawRevisionId: z.string().min(1),
    canonicalCandidateId: z.string().min(1),
    destination: z
      .object({
        class: z.enum(sourcingDestinationClasses),
        url: z.string().min(1),
        intermediaryUrl: z.string().nullable().optional(),
      })
      .strict()
      .nullable(),
    employmentType: z.enum(canonicalEmploymentTypes),
    seniority: z.enum(canonicalSeniorities),
    workMode: z.enum(workModes),
    location: canonicalLocationSchema.nullable(),
    compensation: canonicalCompensationSchema.nullable(),
    postedAt: z
      .object({
        value: z.string().nullable(),
        precision: z.enum(canonicalPostedAtPrecisions),
        raw: z.string().nullable(),
      })
      .strict()
      .refine(
        (postedAt) =>
          (postedAt.precision === 'unknown') === (postedAt.value === null),
        { message: 'unknown posted time must not carry a canonical value' },
      ),
  })
  .strict()

export function isSourcingMergeStatus(value: string): value is SourcingMergeStatus {
  return (sourcingMergeStatuses as readonly string[]).includes(value)
}

export function isWritableSourcingMergeStatus(
  value: string,
): value is WritableSourcingMergeStatus {
  return (writableSourcingMergeStatuses as readonly string[]).includes(value)
}

export function isManualSourcingDecisionStatus(
  value: string,
): value is ManualSourcingDecisionStatus {
  return (manualSourcingDecisionStatuses as readonly string[]).includes(value)
}

export function isSourcingDestinationClass(value: string): value is SourcingDestinationClass {
  return (sourcingDestinationClasses as readonly string[]).includes(value)
}

export function isSourcingUsability(value: string): value is SourcingUsability {
  return (sourcingUsabilities as readonly string[]).includes(value)
}

export interface SourcingFinding extends Partial<SourcingFindingCanonicalProjection> {
  id: string
  workflowRunId: string
  sourceId: string
  sourceName: string
  companyName: string
  roleTitle: string
  roleKind: RoleKind
  term: string | null
  terms: JobTerm[]
  timingMode: JobTimingMode
  startDate: string | null
  endDate: string | null
  city: string | null
  region: string | null
  country: string
  workMode: WorkMode
  locationRaw: string | null
  officialUrl: string | null
  sourceUrl: string | null
  destinationClass?: SourcingDestinationClass | null
  destinationUrl?: string | null
  intermediaryUrl?: string | null
  usability?: SourcingUsability
  postedAge: string | null
  priorityScore: number | null
  priorityBand: string | null
  fitNotes: string | null
  duplicateNotes: string | null
  blocker: string | null
  policyBlocker: string | null
  dispositionReason: string | null
  mergeStatus: SourcingMergeStatus
  mergedApplicationId: string | null
  mergedApplicationCompanyName: string | null
  mergedApplicationRoleTitle: string | null
  mergeNotes: string | null
  discoveredAt: string
  createdAt: string
  updatedAt: string
}

export interface SourcingFindingsListInput {
  workflowRunId?: string
  sourceId?: string
  source?: string
  mergeStatus?: SourcingMergeStatus
  destinationClass?: SourcingDestinationClass
  usability?: SourcingUsability
  limit?: number
  offset?: number
}

export interface SourcingFindingsListResult {
  items: SourcingFinding[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

/**
 * @deprecated Compatibility input for producers that already own canonical data.
 * New sourcing producers should use BatchRawSourceRecordsInput.
 */
interface CreateSourcingFindingInputBase {
  workflowRunId: string
  sourceId?: string | null
  sourceName?: string | null
  companyName: string
  roleTitle: string
  roleKind: RoleKind
  term?: string | null
  terms?: JobTerm[] | null
  timingMode?: JobTimingMode
  startDate?: string | null
  endDate?: string | null
  city?: string | null
  region?: string | null
  country?: string
  workMode: WorkMode
  locationRaw?: string | null
  officialUrl?: string | null
  sourceUrl?: string | null
  postedAge?: string | null
  priorityScore?: number | null
  priorityBand?: string | null
  fitNotes?: string | null
  duplicateNotes?: string | null
  blocker?: string | null
  policyBlocker?: string | null
  dispositionReason?: string | null
  mergeStatus?: WritableSourcingMergeStatus
  discoveredAt?: string | null
}

type SourcingFindingCanonicalCreateFields = Omit<
  SourcingFindingCanonicalProjection,
  'workMode'
>

type LegacySourcingFindingCreateFields = {
  [Key in keyof SourcingFindingCanonicalCreateFields]?: never
}

export type CreateSourcingFindingInput = CreateSourcingFindingInputBase &
  (SourcingFindingCanonicalCreateFields | LegacySourcingFindingCreateFields)

const canonicalFindingCreateKeys = [
  'rawRevisionId',
  'canonicalCandidateId',
  'destination',
  'employmentType',
  'seniority',
  'location',
  'compensation',
  'postedAt',
] as const

export const createSourcingFindingInputSchema = z
  .object({
    workflowRunId: z.string().min(1),
    companyName: z.string().min(1),
    roleTitle: z.string().min(1),
    roleKind: z.enum(roleKinds),
    workMode: z.enum(workModes),
  })
  .passthrough()
  .superRefine((input, context) => {
    if (!canonicalFindingCreateKeys.some((key) => key in input)) {
      return
    }

    const projection = sourcingFindingCanonicalProjectionSchema.safeParse({
      ...Object.fromEntries(
        canonicalFindingCreateKeys
          .filter((key) => key in input)
          .map((key) => [key, input[key]]),
      ),
      workMode: input.workMode,
    })
    if (!projection.success) {
      for (const issue of projection.error.issues) {
        context.addIssue({ ...issue })
      }
    }
  })

export interface UpdateSourcingFindingInput {
  findingId: string
  sourceId?: string | null
  sourceName?: string | null
  companyName?: string
  roleTitle?: string
  roleKind?: RoleKind
  term?: string | null
  terms?: JobTerm[] | null
  timingMode?: JobTimingMode
  startDate?: string | null
  endDate?: string | null
  city?: string | null
  region?: string | null
  country?: string
  workMode?: WorkMode
  locationRaw?: string | null
  officialUrl?: string | null
  sourceUrl?: string | null
  postedAge?: string | null
  priorityScore?: number | null
  priorityBand?: string | null
  fitNotes?: string | null
  duplicateNotes?: string | null
  blocker?: string | null
  policyBlocker?: string | null
  dispositionReason?: string | null
  mergeStatus?: WritableSourcingMergeStatus
  mergeNotes?: string | null
}

export interface PromoteSourcingFindingInput {
  findingId: string
}

export interface SetSourcingFindingDecisionInput {
  findingId: string
  mergeStatus: ManualSourcingDecisionStatus
  mergeNotes?: string | null
  policyBlocker?: string | null
  dispositionReason?: string | null
}

export type SourcingCandidateScoreInput = Omit<ScoreInput, 'applicationId'>

/**
 * @deprecated Compatibility input for producers that already own canonical data.
 * New sourcing producers should use BatchRawSourceRecordsInput.
 */
export interface ProcessSourcingCandidateInput {
  workflowRunId: string
  sourceId?: string | null
  sourceName?: string | null
  companyName: string
  roleTitle: string
  roleKind: RoleKind
  term?: string | null
  terms?: JobTerm[] | null
  timingMode?: JobTimingMode
  startDate?: string | null
  endDate?: string | null
  city?: string | null
  region?: string | null
  country?: string
  workMode: WorkMode
  locationRaw?: string | null
  officialUrl?: string | null
  sourceUrl?: string | null
  postedAge?: string | null
  rawMetadata?: unknown
  score?: SourcingCandidateScoreInput | null
  cutoffScore?: number | null
}
