import { z } from 'zod'
import {
  actionQueueBuckets,
  type ActionQueueListResult,
} from '../action-queue.js'
import { pursuitApplicationStatuses } from '../lifecycle-application.js'
import { jobWorkModes } from '../job.js'
import type {
  ConnectorCheckpoint,
  ConnectorCheckpointsListResult,
  ConnectorObservation,
  ConnectorObservationsListResult,
} from '../connector/connector.js'
import {
  policyDecisionStatuses,
  policyEvidenceTags,
  policySubjectTypes,
  type PolicyConfig,
  type PolicyDecision,
  type PolicyEvidenceRecord,
  type PolicyRunWindowDecision,
} from '../policy.js'
import {
  profileSecretKinds,
  type ProfileSecretSummary,
  type ProfileSecretsListResult,
  type ProfileSensitiveDetails,
} from '../profile.js'
import type { ScoreRecord } from '../scoring.js'
import {
  applicationAttemptActorTypes,
  applicationAttemptStepTypes,
} from '../application.js'
import {
  runStatuses,
  runTypes,
  type WorkflowRun,
  type WorkflowRunStep,
  type WorkflowRunsListResult,
} from '../workflow-run.js'

const applicationLinkSummarySchema = z
  .object({
    label: z.string(),
    url: z.string(),
  })
  .strict()

const policyReasonSchema = z
  .object({
    code: z.string(),
    message: z.string(),
  })
  .strict()

export const scoreRecordSchema: z.ZodType<ScoreRecord> = z
  .object({
    applicationId: z.string(),
    score: z.number(),
    band: z.string(),
    roleRelevance: z.number(),
    careerSignal: z.number(),
    cityWorkMode: z.number(),
    compensationLogistics: z.number(),
    penalties: z.array(z.number()),
    rationale: z.string(),
    rubricVersion: z.string(),
    id: z.string(),
    createdAt: z.string(),
  })
  .strict()

const actionQueueListItemSchema = z
  .object({
    id: z.string(),
    companyName: z.string(),
    roleTitle: z.string(),
    sourceName: z.string(),
    status: z.enum(pursuitApplicationStatuses),
    location: z.string(),
    workMode: z.enum(jobWorkModes),
    hasApplied: z.boolean(),
    currentPriorityScore: z.number().nullable(),
    currentPriorityBand: z.string().nullable(),
    primaryLink: applicationLinkSummarySchema.nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
    actionBucket: z.enum(actionQueueBuckets),
    nextAction: z.enum(actionQueueBuckets),
    reason: z.string(),
    policyReasons: z.array(policyReasonSchema),
  })
  .strict()

const actionBucketCountsSchema = z.object(
  Object.fromEntries(actionQueueBuckets.map((bucket) => [bucket, z.number()])) as Record<
    (typeof actionQueueBuckets)[number],
    z.ZodNumber
  >,
)

export const actionQueueListResultSchema: z.ZodType<ActionQueueListResult> = z
  .object({
    items: z.array(actionQueueListItemSchema),
    total: z.number(),
    limit: z.number(),
    offset: z.number(),
    hasMore: z.boolean(),
    actionBucketCounts: actionBucketCountsSchema,
  })
  .strict()

const policyTimeWindowSchema = z
  .object({
    start: z.string(),
    end: z.string(),
    timezone: z.string(),
  })
  .strict()

export const policyConfigSchema: z.ZodType<PolicyConfig> = z
  .object({
    version: z.literal(2),
    scoring: z.object({ applyCutoff: z.number() }).strict(),
    actionQueue: z.object({ staleLockHours: z.number() }).strict(),
    manualReview: z
      .object({
        pickupDelayHours: z.number(),
        daytimeWindow: policyTimeWindowSchema,
        nonOverridableTags: z.array(z.enum(policyEvidenceTags)),
        manualReviewCompanyPatterns: z.array(z.string()),
        explicitApprovalCompanyPatterns: z.array(z.string()),
      })
      .strict(),
    officialPath: z
      .object({
        allowedNativePlatforms: z.array(z.string()),
        highRiskFormBuilders: z.array(z.string()),
        requireEmployerDomainVerificationForHighRiskForms: z.boolean(),
      })
      .strict(),
    verification: z
      .object({
        requireFinalReviewReceiptForSubmit: z.boolean(),
        requireSecondPassForSubmit: z.boolean(),
      })
      .strict(),
    retries: z
      .object({
        captchaSecurityMinProfileAttempts: z.number(),
        platformErrorMinProfileAttempts: z.number(),
        loginNeededRequiresRecoveryAttempt: z.boolean(),
      })
      .strict(),
    sourcing: z
      .object({
        timezone: z.string(),
        overlapMinutes: z.number(),
        weekdayNormalCadenceHours: z.number(),
        weekdayOvernightCadenceHours: z.number(),
        weekendCadenceHours: z.number(),
        minimumNormalLookbackHours: z.number(),
        overnightStartHour: z.number(),
        overnightEndHour: z.number(),
      })
      .strict(),
  })
  .strict()

export const policyDecisionSchema: z.ZodType<PolicyDecision> = z
  .object({
    action: z.string(),
    configVersion: z.literal(2),
    reasons: z.array(policyReasonSchema),
    requiredEvidence: z.array(z.enum(policyEvidenceTags)),
    status: z.enum(policyDecisionStatuses),
    tags: z.array(z.enum(policyEvidenceTags)),
  })
  .strict()

export const policyRunWindowDecisionSchema: z.ZodType<PolicyRunWindowDecision> = z
  .object({
    action: z.string(),
    configVersion: z.literal(2),
    reasons: z.array(policyReasonSchema),
    requiredEvidence: z.array(z.enum(policyEvidenceTags)),
    status: z.enum(policyDecisionStatuses),
    tags: z.array(z.enum(policyEvidenceTags)),
    cadenceHours: z.number(),
    overlapMinutes: z.number(),
    recommendedCoverageStartedAt: z.string(),
    recommendedCoverageEndedAt: z.string(),
    timezone: z.string(),
  })
  .strict()

export const policyEvidenceRecordSchema: z.ZodType<PolicyEvidenceRecord> = z
  .object({
    id: z.string(),
    subjectType: z.enum(policySubjectTypes),
    subjectId: z.string(),
    tag: z.enum(policyEvidenceTags),
    source: z.string(),
    note: z.string().nullable(),
    payloadJson: z.string(),
    createdAt: z.string(),
  })
  .strict()

export const policyEvidenceListResultSchema = z.array(policyEvidenceRecordSchema)

export const profileSecretSummarySchema: z.ZodType<ProfileSecretSummary> = z
  .object({
    key: z.string(),
    kind: z.enum(profileSecretKinds),
    label: z.string(),
    updatedAt: z.string(),
  })
  .strict()

export const profileSecretsListResultSchema: z.ZodType<ProfileSecretsListResult> = z
  .object({
    items: z.array(profileSecretSummarySchema),
  })
  .strict()

export const profileSensitiveDetailsSchema: z.ZodType<ProfileSensitiveDetails> = z
  .object({
    dateOfBirth: z.string().nullable().optional(),
    disabilityStatus: z.string().nullable(),
    gender: z.string().nullable(),
    hispanicLatino: z.string().nullable(),
    raceEthnicity: z.string().nullable(),
    veteranStatus: z.string().nullable(),
    birthDay: z.string().nullable(),
    birthMonth: z.string().nullable(),
    birthYear: z.string().nullable(),
    ssnLast4: z.string().nullable(),
  })
  .strict()

const connectorCoverageWindowSchema = z
  .object({
    start: z.string().nullable(),
    end: z.string().nullable(),
  })
  .strict()

const connectorCheckpointSchema: z.ZodType<ConnectorCheckpoint> = z
  .object({
    connectorInstanceId: z.string(),
    filterSignature: z.string(),
    checkpoint: z.unknown(),
    schemaVersion: z.string(),
    coverage: connectorCoverageWindowSchema,
  })
  .strict()

export const connectorCheckpointsListResultSchema: z.ZodType<ConnectorCheckpointsListResult> = z
  .object({
    items: z.array(connectorCheckpointSchema),
  })
  .strict()

const connectorObservationSchema: z.ZodType<ConnectorObservation> = z
  .object({
    id: z.string(),
    connectorInstanceId: z.string(),
    connectorRunId: z.string(),
    connectorId: z.string(),
    connectorVersion: z.string(),
    sourceRecordKey: z.string(),
    observedAt: z.string(),
    companyName: z.string(),
    roleTitle: z.string(),
    locationRaw: z.string().nullable(),
    descriptionText: z.string().nullable(),
    pay: z.unknown(),
    links: z
      .object({
        source: z.string().nullable(),
        intermediary: z.string().nullable(),
        official: z.string().nullable(),
      })
      .strict(),
    resolution: z
      .object({
        status: z.string(),
        method: z.string().nullable(),
        reason: z.string().nullable(),
      })
      .strict(),
    dedupeKeys: z.array(z.string()),
    sourceMetadata: z.unknown(),
    evidence: z.array(
      z
        .object({
          type: z.string(),
          capturedAt: z.string(),
          sourceUrl: z.string().nullable(),
        })
        .strict(),
    ),
    opportunityId: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict()

export const connectorObservationsListResultSchema: z.ZodType<ConnectorObservationsListResult> =
  z
    .object({
      items: z.array(connectorObservationSchema),
      total: z.number(),
      limit: z.number(),
      offset: z.number(),
      hasMore: z.boolean(),
    })
    .strict()

export const workflowRunStepSchema: z.ZodType<WorkflowRunStep> = z
  .object({
    id: z.string(),
    workflowRunId: z.string(),
    sequence: z.number(),
    type: z.union([z.enum(applicationAttemptStepTypes), z.string()]),
    message: z.string(),
    payloadJson: z.string(),
    actor: z.string(),
    createdAt: z.string(),
  })
  .strict()

export const workflowRunSchema: z.ZodType<WorkflowRun> = z
  .object({
    id: z.string(),
    runType: z.enum(runTypes),
    status: z.enum(runStatuses),
    actorType: z.enum(applicationAttemptActorTypes),
    actorName: z.string().nullable(),
    sourceId: z.string().nullable(),
    sourceName: z.string().nullable(),
    subjectApplicationId: z.string().nullable(),
    startedAt: z.string(),
    completedAt: z.string().nullable(),
    coverageStartedAt: z.string().nullable(),
    coverageEndedAt: z.string().nullable(),
    timezone: z.string().nullable(),
    inputJson: z.string(),
    summary: z.string().nullable(),
    outcome: z.enum(pursuitApplicationStatuses).nullable(),
    blocker: z.string().nullable(),
    metadataJson: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    steps: z.array(workflowRunStepSchema),
  })
  .strict()

export const workflowRunsListResultSchema: z.ZodType<WorkflowRunsListResult> = z
  .object({
    items: z.array(workflowRunSchema),
    total: z.number(),
    limit: z.number(),
    offset: z.number(),
    hasMore: z.boolean(),
  })
  .strict()
