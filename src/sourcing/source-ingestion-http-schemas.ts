import { z } from 'zod'
import {
  careerSourceLifecycleStatuses,
  sourceConfidenceRuleKeys,
  sourceRunStatuses,
  type CareerSourceLifecycleResponse,
  type CareerSourceRegistrationResponse,
  type CareerSourcesListResponse,
  type SourceCompaniesListResponse,
  type SourceConfidenceRuleAttachmentInput,
  type SourceConfidenceRuleAttachmentResponse,
  type SourceEffectiveConfidenceRulesResponse,
  type SourceEvidenceArtifactResponse,
  type SourceJobSnapshotResponse,
  type SourceJobsListResponse,
  type SourceProbeResponse,
  type SourceRunOverrideResponse,
  type SourceRunRequestResponse,
  type SourceRunResponse,
  type SourceRunsListResponse,
  type SourceScheduleResponse,
  type SourceSchedulesListResponse,
} from './source-ingestion.js'

const sourceIngestionPaginationSchema = z
  .object({
    limit: z.number(),
    offset: z.number(),
    nextOffset: z.number().nullable(),
  })
  .strict()

const sourcedJobPostingSchema = z
  .object({
    active: z.boolean(),
    applyUrl: z.string().nullable(),
    companyId: z.string(),
    companyName: z.string(),
    companySlug: z.string(),
    contentHash: z.string().nullable(),
    detailUrl: z.string().nullable(),
    firstSeenAt: z.string(),
    lastSeenAt: z.string(),
    lastVerifiedAt: z.string(),
    latestSnapshotId: z.string(),
    locations: z.unknown(),
    sourceId: z.string(),
    sourceSlug: z.string(),
    stableJobKey: z.string(),
    title: z.string(),
  })
  .strict()

export const sourceJobsListResponseSchema: z.ZodType<SourceJobsListResponse> = z
  .object({
    jobs: z.array(sourcedJobPostingSchema),
    pagination: sourceIngestionPaginationSchema,
  })
  .strict()

const sourceCompanySummarySchema = z
  .object({
    activeJobCount: z.number(),
    careerSourceCount: z.number(),
    createdAt: z.string(),
    companyId: z.string(),
    companyName: z.string(),
    companySlug: z.string(),
    updatedAt: z.string(),
  })
  .strict()

export const sourceCompaniesListResponseSchema: z.ZodType<SourceCompaniesListResponse> = z
  .object({
    companies: z.array(sourceCompanySummarySchema),
    pagination: sourceIngestionPaginationSchema,
    summary: z
      .object({
        totalActiveJobs: z.number(),
        totalCompanies: z.number(),
      })
      .strict(),
  })
  .strict()

const sourceScheduleSummarySchema = z
  .object({
    cadence: z.enum(['hourly', 'daily', 'weekly']),
    enabled: z.boolean(),
    nextDueAt: z.string(),
    timezone: z.string(),
  })
  .strict()

const careerSourceSummarySchema = z
  .object({
    id: z.string(),
    companyId: z.string(),
    companyName: z.string(),
    companySlug: z.string(),
    entryUrl: z.string(),
    canonicalHost: z.string(),
    sourceType: z.string(),
    observedProvider: z.string().nullable(),
    activeStrategyVersionId: z.string().nullable(),
    latestSnapshotId: z.string().nullable(),
    slug: z.string(),
    status: z.enum(careerSourceLifecycleStatuses),
    politenessPolicy: z.record(z.string(), z.unknown()),
    schedule: sourceScheduleSummarySchema.nullable().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict()

export const careerSourcesListResponseSchema: z.ZodType<CareerSourcesListResponse> = z
  .object({
    sources: z.array(careerSourceSummarySchema),
    pagination: sourceIngestionPaginationSchema,
  })
  .strict()

export const careerSourceLifecycleResponseSchema: z.ZodType<CareerSourceLifecycleResponse> = z
  .object({
    source: z
      .object({
        id: z.string(),
        slug: z.string(),
        status: z.enum(careerSourceLifecycleStatuses),
        updatedAt: z.string(),
      })
      .strict(),
  })
  .strict()

export const careerSourceRegistrationResponseSchema: z.ZodType<CareerSourceRegistrationResponse> =
  z
    .object({
      source: z
        .object({
          companyId: z.string(),
          companySlug: z.string(),
          sourceId: z.string(),
          sourceSlug: z.string(),
          strategyVersionId: z.string(),
        })
        .strict(),
    })
    .strict()

const sourceProbeDiscoveryMethods = [
  'browser_render_provider_link',
  'direct_provider_url',
  'static_provider_link',
] as const

const sourceProbeResultSchema = z
  .object({
    candidateTemplate: z.string().nullable(),
    config: z.record(z.string(), z.unknown()),
    discoveryMethod: z.enum(sourceProbeDiscoveryMethods).optional(),
    evidence: z.record(z.string(), z.unknown()),
    failedRequirement: z.string().nullable(),
    listingCount: z.number().nullable(),
    observedProvider: z.string(),
    probedCareerUrl: z.string().optional(),
    readiness: z.enum(['not-ready', 'ready']),
    sampleStableJobKey: z.string().nullable(),
    submittedCareerUrl: z.string().optional(),
  })
  .strict()

export const sourceProbeResponseSchema: z.ZodType<SourceProbeResponse> = z
  .object({
    probe: sourceProbeResultSchema,
  })
  .strict()

const sourceScheduleSchema = z
  .object({
    cadence: z.enum(['hourly', 'daily', 'weekly']),
    cronExpression: z.string().nullable(),
    enabled: z.boolean(),
    id: z.string(),
    intervalMinutes: z.number().nullable(),
    jitterSeconds: z.number(),
    nextDueAt: z.string(),
    priority: z.number(),
    sourceId: z.string(),
    sourceSlug: z.string(),
    timezone: z.string(),
  })
  .strict()

export const sourceScheduleResponseSchema: z.ZodType<SourceScheduleResponse> = z
  .object({
    schedule: sourceScheduleSchema.nullable(),
  })
  .strict()

const sourceScheduleBrowseRowSchema = sourceScheduleSchema
  .extend({
    canonicalHost: z.string(),
    companyId: z.string(),
    companyName: z.string(),
    companySlug: z.string(),
    createdAt: z.string(),
    entryUrl: z.string(),
    sourceStatus: z.enum(careerSourceLifecycleStatuses),
    updatedAt: z.string(),
  })
  .strict()

export const sourceSchedulesListResponseSchema: z.ZodType<SourceSchedulesListResponse> = z
  .object({
    pagination: sourceIngestionPaginationSchema,
    schedules: z.array(sourceScheduleBrowseRowSchema),
  })
  .strict()

export const sourceRunRequestResponseSchema: z.ZodType<SourceRunRequestResponse> = z
  .object({
    requestId: z.string(),
    admission: z
      .object({
        admitted: z.boolean(),
      })
      .catchall(z.unknown())
      .optional(),
  })
  .strict()

export const sourceRunOverrideResponseSchema: z.ZodType<SourceRunOverrideResponse> = z
  .object({
    override: z
      .object({
        kind: z.enum(['accept_baseline', 'force_publish']),
        overriddenRuleKeys: z.array(z.string()),
        publishedJobCount: z.number(),
        snapshotId: z.string(),
        sourceRunId: z.string(),
      })
      .strict(),
  })
  .strict()

const sourceRunDiffSchema = z
  .object({
    addedCount: z.number(),
    changedCount: z.number(),
    previousSnapshotId: z.string().nullable(),
    removedCount: z.number(),
  })
  .strict()

const sourceRunSummarySchema = z
  .object({
    completedAt: z.string().nullable(),
    diff: sourceRunDiffSchema,
    evidencePath: z.string().nullable(),
    normalizedJobCount: z.number().nullable(),
    outcome: z.union([z.enum(sourceRunStatuses), z.string()]),
    rawJobCount: z.number().nullable(),
    sourceId: z.string().nullable(),
    sourceSlug: z.string().nullable(),
    sourceRunId: z.string(),
    startedAt: z.string().nullable(),
    status: z.enum(sourceRunStatuses),
  })
  .strict()

export const sourceRunsListResponseSchema: z.ZodType<SourceRunsListResponse> = z
  .object({
    pagination: sourceIngestionPaginationSchema,
    runs: z.array(sourceRunSummarySchema),
  })
  .strict()

const sourceRunConfidenceResultSchema = z
  .object({
    message: z.string().nullable(),
    outcome: z.string(),
    ruleKey: z.string(),
    severity: z.string(),
  })
  .strict()

export const sourceRunResponseSchema: z.ZodType<SourceRunResponse> = z
  .object({
    run: sourceRunSummarySchema
      .extend({
        confidenceResults: z.array(sourceRunConfidenceResultSchema),
        evidenceArtifacts: z.array(z.string()),
        evidenceBundleId: z.string().nullable(),
      })
      .strict(),
  })
  .strict()

export const sourceEvidenceArtifactResponseSchema: z.ZodType<SourceEvidenceArtifactResponse> = z
  .object({
    bytes: z.instanceof(Uint8Array),
    contentType: z.string().nullable(),
  })
  .strict()

const sourceConfidenceRuleScopeKindSchema = z.enum(['global', 'provider', 'source'])
const sourceConfidenceRuleSeveritySchema = z.enum(['block_publish', 'info', 'warn'])
const sourceConfidenceRuleParamsSchema = z.record(z.string(), z.number())

const sourceConfidenceRuleLayerSchema = z
  .object({
    attachmentId: z.string(),
    scopeKind: sourceConfidenceRuleScopeKindSchema,
    scopeRef: z.string().nullable(),
  })
  .strict()

const sourceConfidenceRuleAttachmentSchema = z
  .object({
    createdAt: z.string(),
    createdBy: z.string(),
    enabled: z.boolean(),
    id: z.string(),
    params: sourceConfidenceRuleParamsSchema.nullable(),
    revokedAt: z.string().nullable(),
    ruleKey: z.enum(sourceConfidenceRuleKeys),
    scopeKind: sourceConfidenceRuleScopeKindSchema,
    scopeRef: z.string().nullable(),
    severity: sourceConfidenceRuleSeveritySchema.nullable(),
  })
  .strict()

export const sourceConfidenceRuleAttachmentInputSchema:
  z.ZodType<SourceConfidenceRuleAttachmentInput> = z
  .object({
    enabled: z.boolean(),
    params: sourceConfidenceRuleParamsSchema.nullable().optional(),
    ruleKey: z.enum(sourceConfidenceRuleKeys),
    scopeKind: sourceConfidenceRuleScopeKindSchema,
    scopeRef: z.string().nullable().optional(),
    severity: sourceConfidenceRuleSeveritySchema.nullable().optional(),
  })
  .strict()

export const sourceConfidenceRuleAttachmentResponseSchema:
  z.ZodType<SourceConfidenceRuleAttachmentResponse> = z
  .object({ attachment: sourceConfidenceRuleAttachmentSchema })
  .strict()

export const sourceEffectiveConfidenceRulesResponseSchema:
  z.ZodType<SourceEffectiveConfidenceRulesResponse> = z
  .object({
    providerKey: z.string(),
    rules: z.array(z
      .object({
        attachmentId: z.string().nullable(),
        enabled: z.boolean(),
        layers: z.array(sourceConfidenceRuleLayerSchema),
        params: sourceConfidenceRuleParamsSchema,
        provenance: sourceConfidenceRuleLayerSchema.nullable(),
        ruleKey: z.enum(sourceConfidenceRuleKeys),
        severity: sourceConfidenceRuleSeveritySchema,
        severityAttachmentId: z.string().nullable(),
      })
      .strict()),
    sourceId: z.string(),
    sourceSlug: z.string().optional(),
  })
  .strict()

const sourceJobSnapshotSampleSchema = z
  .object({
    applyUrl: z.string().nullable(),
    detailUrl: z.string().nullable(),
    locations: z.array(z
      .object({
        city: z.string().optional(),
        countryCode: z.string().optional(),
        rawText: z.string(),
        region: z.string().optional(),
        remote: z.boolean().optional(),
      })
      .strict()),
    stableJobKey: z.string(),
    title: z.string(),
  })
  .strict()

export const sourceJobSnapshotResponseSchema: z.ZodType<SourceJobSnapshotResponse> = z
  .object({
    snapshot: z
      .object({
        addedCount: z.number(),
        changedCount: z.number(),
        jobCount: z.number(),
        previousSnapshotId: z.string().nullable(),
        publishedAt: z.string(),
        removedCount: z.number(),
        sampleJobs: z.array(sourceJobSnapshotSampleSchema),
        snapshotId: z.string(),
        sourceId: z.string(),
        sourceRunId: z.string(),
      })
      .strict(),
  })
  .strict()
