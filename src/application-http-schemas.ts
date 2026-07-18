import { z } from 'zod'
import {
  applicationAttemptActorTypes,
  applicationAttemptStatuses,
  applicationAttemptStepTypes,
  applicationStatuses,
  roleKinds,
  workModes,
  type ApplicationAttempt,
  type ApplicationAttemptStep,
  type ApplicationDetail,
  type ApplicationEvent,
  type ApplicationEventsListResult,
  type ApplicationLinkRecord,
  type ApplicationLinksListResult,
  type ApplicationListItem,
  type ApplicationListResult,
  type ApplicationAttemptsListResult,
} from './application.js'
import { jobSeasons, jobTimingModes } from './job-timing.js'

const jobTermSchema = z
  .object({
    season: z.enum(jobSeasons),
    year: z.number(),
  })
  .strict()

const applicationLinkSummarySchema = z
  .object({
    label: z.string(),
    url: z.string(),
  })
  .strict()

const applicationListItemSchema: z.ZodType<ApplicationListItem> = z
  .object({
    id: z.string(),
    companyName: z.string(),
    roleTitle: z.string(),
    roleKind: z.enum(roleKinds),
    sourceName: z.string(),
    status: z.enum(applicationStatuses),
    term: z.string().nullable(),
    terms: z.array(jobTermSchema),
    timingMode: z.enum(jobTimingModes),
    startDate: z.string().nullable(),
    endDate: z.string().nullable(),
    location: z.string(),
    workMode: z.enum(workModes),
    hasApplied: z.boolean(),
    currentPriorityScore: z.number().nullable(),
    currentPriorityBand: z.string().nullable(),
    primaryLink: applicationLinkSummarySchema.nullable(),
    notes: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict()

export const applicationListResultSchema: z.ZodType<ApplicationListResult> = z
  .object({
    items: z.array(applicationListItemSchema),
    total: z.number(),
    limit: z.number(),
    offset: z.number(),
    hasMore: z.boolean(),
  })
  .strict()

export const applicationDetailSchema: z.ZodType<ApplicationDetail> = applicationListItemSchema

export const applicationLinkRecordSchema: z.ZodType<ApplicationLinkRecord> = z
  .object({
    id: z.string(),
    applicationId: z.string(),
    kind: z.string(),
    label: z.string(),
    url: z.string(),
    externalId: z.string().nullable().optional(),
    isPrimary: z.boolean(),
    discoveredAt: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    deletedAt: z.string().nullable(),
  })
  .strict()

export const applicationLinksListResultSchema: z.ZodType<ApplicationLinksListResult> = z
  .object({
    items: z.array(applicationLinkRecordSchema),
    total: z.number(),
    limit: z.number(),
    offset: z.number(),
    hasMore: z.boolean(),
  })
  .strict()

const applicationEventSchema: z.ZodType<ApplicationEvent> = z
  .object({
    id: z.string(),
    applicationId: z.string(),
    type: z.string(),
    message: z.string(),
    payloadJson: z.string(),
    actor: z.string(),
    createdAt: z.string(),
  })
  .strict()

export const applicationEventsListResultSchema: z.ZodType<ApplicationEventsListResult> = z
  .object({
    items: z.array(applicationEventSchema),
    total: z.number(),
    limit: z.number(),
    offset: z.number(),
    hasMore: z.boolean(),
  })
  .strict()

export const applicationAttemptStepSchema: z.ZodType<ApplicationAttemptStep> = z
  .object({
    id: z.string(),
    attemptId: z.string(),
    applicationId: z.string(),
    sequence: z.number(),
    type: z.enum(applicationAttemptStepTypes),
    message: z.string(),
    payloadJson: z.string(),
    actor: z.string(),
    createdAt: z.string(),
  })
  .strict()

export const applicationAttemptSchema: z.ZodType<ApplicationAttempt> = z
  .object({
    id: z.string(),
    applicationId: z.string(),
    status: z.enum(applicationAttemptStatuses),
    outcome: z.enum(applicationStatuses).nullable(),
    actorType: z.enum(applicationAttemptActorTypes),
    actorName: z.string().nullable(),
    entryUrl: z.string().nullable(),
    resumeVariant: z.string().nullable(),
    resumeArtifactPath: z.string().nullable(),
    summary: z.string().nullable(),
    stopReason: z.string().nullable(),
    confirmationUrl: z.string().nullable(),
    confirmationText: z.string().nullable(),
    startedAt: z.string(),
    completedAt: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
    steps: z.array(applicationAttemptStepSchema),
  })
  .strict()

export const applicationAttemptsListResultSchema: z.ZodType<ApplicationAttemptsListResult> = z
  .object({
    items: z.array(applicationAttemptSchema),
    total: z.number(),
    limit: z.number(),
    offset: z.number(),
    hasMore: z.boolean(),
  })
  .strict()
