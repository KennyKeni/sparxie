import { describe, expect, it } from 'vitest'
import {
  captureCompletionDetailSchema,
  captureListPresentationSchema,
  captureProcessingStartResultSchema,
  captureResolutionCommandResultSchema,
  captureResolutionDefaultPageLimit,
  captureResolutionGenerationProjectionSchema,
  captureResolutionKeysetOrder,
  captureResolutionListInputSchema,
  captureResolutionListResultSchema,
  captureResolutionMaximumPageLimit,
  captureResolutionPageInfoSchema,
  captureResolutionProjectionSchema,
  completeCaptureManuallyInputSchema,
  completeCaptureManuallyResultSchema,
  completionStaleRecoverySchema,
  correctCaptureResolutionInputSchema,
  correctCaptureResolutionResultSchema,
  destinationResolutionStageSchema,
  manualCompanyResolutionSchema,
  manualJobDuplicateResolutionDecisionSchema,
  processingIssueSchema,
} from './capture-resolution.js'

const captureId = 'capture-1'
const jobId = '018f6f88-4c35-7a62-9f2e-318dd8e164c5'
const now = '2026-07-23T12:00:00.000Z'
const actor = { id: 'user-7', type: 'user' as const }
const jobFacts = {
  companyName: 'Northstar Robotics',
  roleTitle: 'Controls Intern',
  sourceName: 'Campus Network',
  roleKind: 'internship' as const,
  term: null,
  terms: [],
  timingMode: 'unknown' as const,
  startDate: null,
  endDate: null,
  location: null,
  workMode: 'unknown' as const,
  employmentType: 'internship' as const,
  seniority: 'student' as const,
  compensation: null,
  postedAt: null,
  destination: {
    class: 'employer_or_ats' as const,
    url: 'https://northstar.example/jobs/448',
  },
}
const effectiveCapture = {
  evidenceMode: 'reported' as const,
  adapter: { id: 'manual', kind: 'manual' as const, version: '1.0.0' },
  observedAt: now,
  providerRecordId: 'opening-448',
  providerSchema: 'opening/v1',
  payload: { title: 'Controls Intern' },
  evidence: [{
    kind: 'posting_url',
    label: 'Listing',
    value: 'https://northstar.example/jobs/448',
  }],
}

function issue(
  code: 'destination_not_found' | 'transport_failed' | 'destination_security_rejected',
) {
  if (code === 'destination_not_found') {
    return {
      stage: 'destination' as const,
      code,
      action: 'complete_job_information' as const,
      causedBy: null,
      message: 'Enter a normal destination.',
      details: {},
    }
  }
  return {
    stage: 'destination' as const,
    code,
    action: null,
    causedBy: null,
    message: 'Destination processing stopped.',
    details: {},
  }
}

function destinationStage(
  status: 'not_required' | 'queued' | 'running' | 'retry_wait' | 'resolved' |
  'action_required' | 'exhausted' | 'blocked' | 'superseded' | 'cancelled',
  currentIssue: unknown = null,
) {
  return {
    generationId: 'generation-1',
    captureRevision: 3,
    updatedAt: now,
    attemptCount: 1,
    status,
    currentIssue,
    nextAttemptAt: status === 'retry_wait' ? '2026-07-23T12:01:00.000Z' : null,
    resolverId: null,
    resolverVersion: null,
    remoteOperationId: null,
  }
}

function generation(
  destinationStatus: 'not_required' | 'queued' | 'resolved' | 'action_required',
  processingSummary: 'processing' | 'awaiting_information' | 'needs_action',
  currentIssue: unknown = null,
) {
  const stageFields = {
    generationId: 'generation-1',
    captureRevision: 3,
    updatedAt: now,
    attemptCount: 0,
  }
  return {
    id: 'generation-1',
    ordinal: 2,
    trigger: 'intake' as const,
    status: 'active' as const,
    processingSummary,
    destinationResolution: destinationStage(destinationStatus, currentIssue),
    jobInformationResolution: {
      ...stageFields,
      status: 'awaiting_manual' as const,
      currentIssue: null,
    },
    promotion: {
      ...stageFields,
      status: 'not_ready' as const,
      currentIssue: null,
    },
    createdAt: now,
    updatedAt: now,
  }
}

function completionInput() {
  return {
    captureId,
    expectedCaptureRevision: 3,
    expectedGenerationId: 'generation-1',
    idempotencyKey: 'complete:capture-1:r3:g1',
    actor,
    jobFacts,
    destination: jobFacts.destination,
    externalIdentities: [],
    evidenceReferences: [{
      captureId,
      captureRevision: 3,
      evidenceIndexes: [0],
    }],
    companyResolution: {
      action: 'use_local' as const,
      companyId: 'company-1',
      expectedCompanyRevision: 4,
      restoreIfArchived: false,
    },
  }
}

describe('Capture resolution v1 contracts', () => {
  it('uses one stable observed sort and preserves opaque cursor bytes', () => {
    expect(captureResolutionListInputSchema.parse({
      after: '  opaque cursor  ',
    })).toEqual({
      filter: 'all',
      sort: 'observed_desc',
      limit: captureResolutionDefaultPageLimit,
      after: '  opaque cursor  ',
    })
    expect(captureResolutionMaximumPageLimit).toBe(100)
    expect(captureResolutionKeysetOrder).toEqual({
      fields: ['observedAt', 'captureId'],
      directions: ['desc', 'desc'],
    })
    expect(captureResolutionListInputSchema.safeParse({
      filter: 'removed',
      before: 'previous',
      after: 'next',
    }).success).toBe(false)
    expect(captureResolutionListInputSchema.safeParse({
      sort: 'updated_desc',
    }).success).toBe(false)
    expect(captureResolutionListInputSchema.safeParse({
      limit: 101,
    }).success).toBe(false)
  })

  it('publishes list page boundaries, total count, and nested presentation', () => {
    expect(captureResolutionPageInfoSchema.parse({
      startCursor: ' start ',
      endCursor: ' end ',
      hasPreviousPage: true,
      hasNextPage: true,
    })).toEqual({
      startCursor: ' start ',
      endCursor: ' end ',
      hasPreviousPage: true,
      hasNextPage: true,
    })
    const row = {
      captureId,
      captureRevision: 3,
      observedAt: now,
      lead: {
        roleTitle: 'Controls Intern',
        companyName: 'Northstar Robotics',
        fallbackLabel: 'Captured lead',
      },
      source: { displayName: 'Campus Network', provider: 'campus' },
      destination: { state: 'resolved' as const, displayHost: 'northstar.example' },
      readiness: 'ready' as const,
      processingSummary: 'awaiting_information' as const,
      activeProcessing: true,
      linkedJob: null,
      primaryIntent: { kind: 'complete_job_information' as const },
    }
    expect(captureListPresentationSchema.parse(row)).toEqual(row)
    expect(captureListPresentationSchema.safeParse({
      ...row,
      readiness: 'materialization_pending',
    }).success).toBe(false)
    const emptyPage = {
      items: [],
      pageInfo: {
        startCursor: null,
        endCursor: null,
        hasPreviousPage: false,
        hasNextPage: false,
      },
      totalCount: 0,
    }
    expect(captureResolutionListResultSchema.parse(emptyPage)).toEqual(emptyPage)
    expect(captureResolutionListResultSchema.safeParse({
      ...emptyPage,
      pageInfo: { ...emptyPage.pageInfo, startCursor: 'half-present' },
    }).success).toBe(false)
    expect(captureResolutionListResultSchema.safeParse({
      ...emptyPage,
      pageInfo: { ...emptyPage.pageInfo, endCursor: 'half-present' },
    }).success).toBe(false)
    const nonemptyPage = {
      items: [row],
      pageInfo: {
        startCursor: 'start',
        endCursor: 'end',
        hasPreviousPage: false,
        hasNextPage: false,
      },
      totalCount: 1,
    }
    expect(captureResolutionListResultSchema.parse(nonemptyPage)).toEqual(nonemptyPage)
    expect(captureResolutionListResultSchema.safeParse({
      ...nonemptyPage,
      pageInfo: { ...nonemptyPage.pageInfo, startCursor: null },
    }).success).toBe(false)
    expect(captureResolutionListResultSchema.safeParse({
      ...nonemptyPage,
      pageInfo: { ...nonemptyPage.pageInfo, endCursor: null },
    }).success).toBe(false)
  })

  it('enforces projection readiness, three stages, and deterministic summary precedence', () => {
    const ready = {
      readiness: 'ready' as const,
      captureId,
      captureRevision: 3,
      generation: generation('queued', 'processing'),
    }
    expect(captureResolutionProjectionSchema.parse(ready)).toEqual(ready)
    expect(captureResolutionProjectionSchema.safeParse({
      ...ready,
      generation: { ...ready.generation, processingSummary: 'awaiting_destination' },
    }).success).toBe(false)
    expect(captureResolutionProjectionSchema.safeParse({
      ...ready,
      captureRevision: 4,
    }).success).toBe(false)
    expect(captureResolutionProjectionSchema.safeParse({
      readiness: 'materialization_blocked',
      captureId,
      captureRevision: 3,
      issue: {
        code: 'revision_materialization_failed',
        action: 'retry_now',
        message: 'Malformed history.',
      },
    }).success).toBe(false)
    expect(captureResolutionProjectionSchema.safeParse({
      readiness: 'removed',
      captureId,
      captureRevision: 3,
      generation: generation('resolved', 'awaiting_information'),
    }).success).toBe(false)
  })

  it('enforces the closed stage/reason/action matrix', () => {
    const actionRequired = destinationStage(
      'action_required',
      issue('destination_not_found'),
    )
    expect(destinationResolutionStageSchema.parse(actionRequired)).toEqual(actionRequired)
    expect(destinationResolutionStageSchema.safeParse({
      ...actionRequired,
      currentIssue: issue('transport_failed'),
    }).success).toBe(false)
    expect(processingIssueSchema.safeParse({
      ...issue('destination_not_found'),
      action: 'authenticate_provider',
    }).success).toBe(false)
    expect(processingIssueSchema.safeParse({
      ...issue('destination_security_rejected'),
      details: { authorization: 'unsafe' },
    }).success).toBe(false)
  })

  it('returns fresh bounded completion detail with safe URLs and exact lineage', () => {
    const detail = {
      captureId,
      captureRevision: 3,
      expectedGenerationId: 'generation-1',
      sourceSummary: {
        displayName: 'Campus Network',
        provider: 'campus',
        observedAt: now,
      },
      provenance: [{
        kind: 'source' as const,
        label: 'Listing',
        url: 'https://source.example/opening/448',
      }],
      destination: {
        status: 'resolved' as const,
        url: 'https://northstar.example/jobs/448',
      },
      rawEvidence: [{
        captureRevision: 3,
        evidenceIndex: 0,
        label: 'Listing',
        displayValue: 'https://northstar.example/jobs/448',
      }],
      exactEvidenceReferences: [{
        captureId,
        captureRevision: 3,
        evidenceIndexes: [0],
      }],
      jobDefaults: { companyName: 'Northstar Robotics' },
      lastIssue: null,
    }
    expect(captureCompletionDetailSchema.parse(detail)).toEqual(detail)
    expect(captureCompletionDetailSchema.safeParse({
      ...detail,
      provenance: [{ kind: 'source', label: 'Unsafe', url: 'javascript:alert(1)' }],
    }).success).toBe(false)
    expect(captureCompletionDetailSchema.safeParse({
      ...detail,
      destination: { status: 'resolved', url: 'ftp://northstar.example/jobs/448' },
    }).success).toBe(false)
    expect(captureCompletionDetailSchema.safeParse({
      ...detail,
      rawEvidence: [{ ...detail.rawEvidence[0], rawPayload: { token: 'secret' } }],
    }).success).toBe(false)
  })

  it('corrects with one reconstructable effective Capture snapshot', () => {
    const correction = {
      captureId,
      expectedCaptureRevision: 3,
      expectedGenerationId: null,
      idempotencyKey: 'correct:capture-1:r3',
      actor,
      rationale: 'Repair malformed history.',
      effectiveCapture,
    }
    expect(correctCaptureResolutionInputSchema.parse(correction)).toEqual(correction)
    expect(correctCaptureResolutionInputSchema.safeParse({
      ...correction,
      effectiveCapture: {
        providerRecordId: effectiveCapture.providerRecordId,
        evidence: effectiveCapture.evidence,
      },
    }).success).toBe(false)
  })

  it('guards Company and optional duplicate choices without create_new', () => {
    expect(manualCompanyResolutionSchema.safeParse({
      action: 'use_local',
      companyId: 'company-1',
      restoreIfArchived: false,
    }).success).toBe(false)
    expect(manualCompanyResolutionSchema.safeParse({
      action: 'create_local',
      displayName: 'Northstar Robotics',
      websiteUrl: 'ftp://northstar.example',
    }).success).toBe(false)
    expect(manualJobDuplicateResolutionDecisionSchema.parse({
      action: 'attach',
      targetJobId: jobId,
      expectedJobFactsRevision: 4,
      expectedAssignmentRevision: 2,
    }).action).toBe('attach')
    expect(manualJobDuplicateResolutionDecisionSchema.safeParse({
      action: 'create_new',
    }).success).toBe(false)
    expect(completeCaptureManuallyInputSchema.parse(completionInput()))
      .not.toHaveProperty('duplicateResolution')
  })

  it('requires exact nonempty lineage and a promotable destination or strong identity', () => {
    const input = completionInput()
    expect(completeCaptureManuallyInputSchema.parse(input)).toEqual(input)
    expect(completeCaptureManuallyInputSchema.safeParse({
      ...input,
      destination: {
        class: 'employer_or_ats',
        url: 'https://northstar.example/jobs/448',
      },
      externalIdentities: [],
    }).success).toBe(true)
    expect(completeCaptureManuallyInputSchema.safeParse({
      ...input,
      destination: {
        class: 'third_party_job_posting',
        url: 'https://board.example/jobs/448',
      },
      externalIdentities: [],
    }).success).toBe(false)
    expect(completeCaptureManuallyInputSchema.safeParse({
      ...input,
      evidenceReferences: [{ captureId, captureRevision: 3, evidenceIndexes: [] }],
    }).success).toBe(false)
    expect(completeCaptureManuallyInputSchema.safeParse({
      ...input,
      evidenceReferences: [{
        captureId,
        captureRevision: 2,
        evidenceIndexes: [0],
      }],
    }).success).toBe(false)
    expect(completeCaptureManuallyInputSchema.safeParse({
      ...input,
      destination: null,
      externalIdentities: [],
    }).success).toBe(false)
    expect(completeCaptureManuallyInputSchema.safeParse({
      ...input,
      destination: null,
      externalIdentities: [{
        kind: 'ats_job',
        provider: 'greenhouse',
        account: 'northstar',
        value: '448',
        strength: 'strong',
      }],
    }).success).toBe(true)
    expect(completeCaptureManuallyInputSchema.safeParse({
      ...input,
      destination: {
        class: 'employer_or_ats',
        url: 'javascript:alert(1)',
      },
    }).success).toBe(false)
  })

  it('closes guarded command and completion recovery results', () => {
    expect(captureResolutionCommandResultSchema.parse({
      status: 'started',
      captureId,
      requestCaptureRevision: 3,
      requestGenerationId: 'generation-1',
      idempotencyKey: 'retry-1',
      captureRevision: 3,
      generationId: 'generation-2',
    }).generationId).toBe('generation-2')
    expect(captureProcessingStartResultSchema.safeParse({
      status: 'corrected',
      captureId,
      requestCaptureRevision: 3,
      requestGenerationId: 'generation-1',
      idempotencyKey: 'correct-1',
      captureRevision: 4,
      generationId: 'generation-2',
    }).success).toBe(false)
    expect(correctCaptureResolutionResultSchema.safeParse({
      status: 'started',
      captureId,
      requestCaptureRevision: 3,
      requestGenerationId: 'generation-1',
      idempotencyKey: 'retry-1',
      captureRevision: 3,
      generationId: 'generation-2',
    }).success).toBe(false)
    expect(captureProcessingStartResultSchema.safeParse({
      status: 'started',
      captureId,
      requestCaptureRevision: 3,
      requestGenerationId: 'generation-1',
      idempotencyKey: 'retry-1',
      captureRevision: 3,
      generationId: 'generation-1',
    }).success).toBe(false)
    expect(captureProcessingStartResultSchema.safeParse({
      status: 'started',
      captureId,
      requestCaptureRevision: 3,
      requestGenerationId: 'generation-1',
      idempotencyKey: 'retry-1',
      captureRevision: 4,
      generationId: 'generation-2',
    }).success).toBe(false)
    expect(correctCaptureResolutionResultSchema.safeParse({
      status: 'corrected',
      captureId,
      requestCaptureRevision: 3,
      requestGenerationId: 'generation-1',
      idempotencyKey: 'correct-1',
      captureRevision: 4,
      generationId: null,
    }).success).toBe(false)
    expect(correctCaptureResolutionResultSchema.safeParse({
      status: 'corrected',
      captureId,
      requestCaptureRevision: 3,
      requestGenerationId: 'generation-1',
      idempotencyKey: 'correct-1',
      captureRevision: 3,
      generationId: 'generation-1',
    }).success).toBe(false)
    expect(completeCaptureManuallyResultSchema.parse({
      status: 'duplicate_blocked',
      blockerCode: 'deterministic_duplicate',
      conflictingJobs: [{
        jobId,
        jobFactsRevision: 4,
        companyId: 'company-1',
        companyRevision: 7,
        assignmentRevision: 2,
      }],
      allowedDecisions: ['attach', 'merge'],
    }).status).toBe('duplicate_blocked')
    expect(completeCaptureManuallyResultSchema.safeParse({
      status: 'blocked',
      failure: {
        kind: 'lifecycle_failure',
        blocker: { code: 'provider_rate_limited', message: 'Retry later.' },
      },
    }).success).toBe(false)
    const staleRecovery = {
      action: 'refresh_and_resubmit' as const,
      guards: [
        { kind: 'capture_revision' as const, expectedRevision: 3, currentRevision: 4 },
        {
          kind: 'generation' as const,
          expectedGenerationId: 'generation-1',
          currentGenerationId: 'generation-4',
        },
        {
          kind: 'company_revision' as const,
          companyId: 'company-1',
          expectedRevision: 2,
          currentRevision: 3,
        },
        {
          kind: 'assignment_revision' as const,
          jobId,
          expectedRevision: 1,
          currentRevision: 2,
        },
      ],
    }
    expect(completionStaleRecoverySchema.parse(staleRecovery)).toEqual(staleRecovery)
    expect(completeCaptureManuallyResultSchema.parse({
      status: 'blocked',
      failure: {
        kind: 'stale_guard',
        blocker: {
          code: 'impossible_state',
          message: 'Completion guards are stale.',
          field: 'expectedCaptureRevision',
        },
        recovery: staleRecovery,
      },
    }).failure).toMatchObject({ kind: 'stale_guard', recovery: staleRecovery })
    expect(completeCaptureManuallyResultSchema.safeParse({
      status: 'blocked',
      failure: {
        kind: 'stale_guard',
        blocker: { code: 'impossible_state', message: 'Input is stale.' },
      },
    }).success).toBe(false)
    expect(completeCaptureManuallyResultSchema.safeParse({
      status: 'blocked',
      failure: {
        kind: 'lifecycle_failure',
        blocker: { code: 'invalid_input', message: 'Input is invalid.' },
        recovery: staleRecovery,
      },
    }).success).toBe(false)
    expect(completeCaptureManuallyResultSchema.safeParse({
      status: 'blocked',
      failure: {
        kind: 'stale_guard',
        blocker: { code: 'invalid_input', message: 'Input is invalid.' },
        recovery: staleRecovery,
      },
    }).success).toBe(false)
    expect(completeCaptureManuallyResultSchema.safeParse({
      status: 'blocked',
      failure: {
        kind: 'lifecycle_failure',
        blocker: {
          code: 'impossible_state',
          message: 'Stored integrity state is invalid.',
        },
      },
    }).success).toBe(true)
    expect(completionStaleRecoverySchema.safeParse({
      action: 'refresh_and_resubmit',
      guards: [staleRecovery.guards[0], staleRecovery.guards[0]],
    }).success).toBe(false)
    expect(completionStaleRecoverySchema.safeParse({
      action: 'refresh_and_resubmit',
      guards: [{
        kind: 'capture_revision',
        expectedRevision: 3,
        currentRevision: 3,
      }],
    }).success).toBe(false)
  })

  it('rejects a generation whose three stages disagree on identity', () => {
    const value = generation('resolved', 'awaiting_information')
    expect(captureResolutionGenerationProjectionSchema.safeParse({
      ...value,
      promotion: { ...value.promotion, generationId: 'generation-other' },
    }).success).toBe(false)
  })
})
