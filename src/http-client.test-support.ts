import { vi } from 'vitest'
import { defaultPolicyConfig } from './policy.js'

export function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status: 200,
    ...init,
  })
}

export function mockFetch(response: Response) {
  const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
  fetchMock.mockResolvedValue(response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

export function connectorInstanceSummaryPayload(
  overrides: Record<string, unknown> = {},
) {
  return {
    id: 'jobright/session 1',
    connectorId: 'jobright.resolver',
    connectorVersion: '0.1.0',
    displayName: 'Jobright',
    enabled: true,
    lifecycle: 'enabled',
    auth: [
      {
        id: 'jobright-session',
        mode: 'browser_session',
        label: 'Jobright session',
        configured: true,
      },
    ],
    config: {
      publicFeedUrl: 'https://jobright.test/feed.json',
    },
    filters: {
      roleKeywords: ['intern'],
    },
    earliestBackfillDate: '2026-07-04',
    createdAt: '2026-07-11T14:00:00.000Z',
    updatedAt: '2026-07-11T14:00:00.000Z',
    ...overrides,
  }
}

export function applicationDetailPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: 'application-1',
    companyName: 'Versant Media',
    roleTitle: 'Software Engineer Intern',
    roleKind: 'internship',
    sourceName: 'LinkedIn',
    status: 'queued',
    term: null,
    terms: [],
    timingMode: 'unknown',
    startDate: null,
    endDate: null,
    location: 'Remote',
    workMode: 'remote',
    hasApplied: false,
    currentPriorityScore: null,
    currentPriorityBand: null,
    primaryLink: null,
    notes: null,
    createdAt: '2026-07-11T14:00:00.000Z',
    updatedAt: '2026-07-11T14:00:00.000Z',
    ...overrides,
  }
}

export function applicationLinkRecordPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: 'link-1',
    applicationId: 'application-1',
    kind: 'official',
    label: 'official',
    url: 'https://jobs.example.com/1',
    externalId: null,
    isPrimary: true,
    discoveredAt: '2026-07-11T14:00:00.000Z',
    createdAt: '2026-07-11T14:00:00.000Z',
    updatedAt: '2026-07-11T14:00:00.000Z',
    deletedAt: null,
    ...overrides,
  }
}

export function applicationAttemptStepPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: 'step-1',
    attemptId: 'attempt-1',
    applicationId: 'application-1',
    sequence: 1,
    type: 'page_verified',
    message: 'Verified page.',
    payloadJson: '{}',
    actor: 'agent:codex',
    createdAt: '2026-07-11T14:00:00.000Z',
    ...overrides,
  }
}

export function applicationAttemptPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: 'attempt-1',
    applicationId: 'application-1',
    status: 'in_progress',
    outcome: null,
    actorType: 'agent',
    actorName: 'codex',
    entryUrl: null,
    resumeVariant: null,
    resumeArtifactPath: null,
    summary: 'Started.',
    stopReason: null,
    confirmationUrl: null,
    confirmationText: null,
    startedAt: '2026-07-11T14:00:00.000Z',
    completedAt: null,
    createdAt: '2026-07-11T14:00:00.000Z',
    updatedAt: '2026-07-11T14:00:00.000Z',
    steps: [],
    ...overrides,
  }
}

export function actionQueueListPayload() {
  return {
    items: [],
    total: 0,
    limit: 25,
    offset: 0,
    hasMore: false,
    actionBucketCounts: {
      apply_now: 0,
      manual_review_pickup: 0,
      needs_user_info: 0,
      stale_lock_recovery: 0,
      user_review_required: 0,
      blocked: 0,
      skip_below_cutoff: 0,
    },
  }
}

export function workflowRunStepPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: 'step-1',
    workflowRunId: 'run-1',
    sequence: 1,
    type: 'note',
    message: 'Reached frontier.',
    payloadJson: '{}',
    actor: 'agent:codex',
    createdAt: '2026-07-11T14:00:00.000Z',
    ...overrides,
  }
}

export function workflowRunPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: 'run-1',
    runType: 'sourcing',
    status: 'in_progress',
    actorType: 'agent',
    actorName: 'codex',
    sourceId: null,
    sourceName: 'LinkedIn',
    subjectApplicationId: null,
    startedAt: '2026-07-11T14:00:00.000Z',
    completedAt: null,
    coverageStartedAt: null,
    coverageEndedAt: null,
    timezone: null,
    inputJson: '{}',
    summary: 'Started sourcing.',
    outcome: null,
    blocker: null,
    metadataJson: '{}',
    createdAt: '2026-07-11T14:00:00.000Z',
    updatedAt: '2026-07-11T14:00:00.000Z',
    steps: [],
    ...overrides,
  }
}

export function policyDecisionPayload(overrides: Record<string, unknown> = {}) {
  return {
    action: 'allow',
    configVersion: 2,
    reasons: [],
    requiredEvidence: [],
    status: 'allow',
    tags: [],
    ...overrides,
  }
}

export function policyRunWindowDecisionPayload() {
  return {
    ...policyDecisionPayload(),
    cadenceHours: 1,
    overlapMinutes: 30,
    recommendedCoverageStartedAt: '2026-06-08T17:00:00.000Z',
    recommendedCoverageEndedAt: '2026-06-08T18:00:00.000Z',
    timezone: 'America/New_York',
  }
}

export function policyEvidenceRecordPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evidence-1',
    subjectType: 'application',
    subjectId: 'application-1',
    tag: 'explicit_user_approval',
    source: 'user',
    note: 'Approved.',
    payloadJson: '{}',
    createdAt: '2026-07-11T14:00:00.000Z',
    ...overrides,
  }
}

export function profileSensitiveDetailsPayload(overrides: Record<string, unknown> = {}) {
  return {
    disabilityStatus: 'No',
    gender: null,
    hispanicLatino: null,
    raceEthnicity: null,
    veteranStatus: null,
    birthDay: null,
    birthMonth: null,
    birthYear: null,
    ssnLast4: null,
    ...overrides,
  }
}

export function profileSecretSummaryPayload(overrides: Record<string, unknown> = {}) {
  return {
    key: 'greenhouse_password',
    kind: 'password',
    label: 'Greenhouse',
    updatedAt: '2026-07-11T14:00:00.000Z',
    ...overrides,
  }
}

export function connectorCheckpointsListPayload() {
  return {
    items: [
      {
        connectorInstanceId: 'jobright/session 1',
        filterSignature: 'all',
        checkpoint: {},
        schemaVersion: '1',
        coverage: { start: null, end: null },
      },
    ],
  }
}

export function connectorObservationsListPayload() {
  return {
    items: [],
    total: 0,
    limit: 50,
    offset: 0,
    hasMore: false,
  }
}

export { defaultPolicyConfig }

export function sourceRegistrationPayload() {
  return {
    source: {
      companyId: 'company-1',
      companySlug: 'figma',
      sourceId: 'source-1',
      sourceSlug: 'figma-greenhouse',
      strategyVersionId: 'strategy-1',
    },
  }
}

export function sourceProbePayload() {
  return {
    probe: {
      candidateTemplate: 'greenhouse_board_api',
      config: {},
      evidence: {},
      failedRequirement: null,
      listingCount: 1,
      observedProvider: 'greenhouse',
      readiness: 'ready',
      sampleStableJobKey: 'job-1',
    },
  }
}

export function sourceLifecyclePayload(
  overrides: { status?: string } = {},
) {
  return {
    source: {
      id: 'source-1',
      slug: 'figma-greenhouse',
      status: overrides.status ?? 'paused',
      updatedAt: '2026-07-11T14:00:00.000Z',
    },
  }
}

export function sourceSchedulePayload() {
  return {
    schedule: {
      cadence: 'hourly',
      cronExpression: null,
      enabled: true,
      id: 'schedule-1',
      intervalMinutes: 60,
      jitterSeconds: 0,
      nextDueAt: '2026-07-05T13:00:00.000Z',
      priority: 4,
      sourceId: 'source-1',
      sourceSlug: 'figma-greenhouse',
      timezone: 'UTC',
    },
  }
}

export function sourceRunRequestPayload() {
  return { requestId: 'request-1' }
}

export function sourceRunOverridePayload(kind: 'accept_baseline' | 'force_publish') {
  return {
    override: {
      kind,
      overriddenRuleKeys: [],
      publishedJobCount: 1,
      snapshotId: 'snapshot-1',
      sourceRunId: 'run-1',
    },
  }
}
