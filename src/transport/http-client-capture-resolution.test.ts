import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createHttpValedictorianClient,
  valedictorianApiPaths,
} from '../index.js'
import { jsonResponse } from './http-client.test-support.js'

const captureId = 'capture/1'
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
  destination: null,
}
const effectiveCapture = {
  evidenceMode: 'reported' as const,
  adapter: { id: 'manual', kind: 'manual' as const, version: '1.0.0' },
  observedAt: now,
  providerRecordId: 'opening-448',
  providerSchema: 'opening/v1',
  payload: { title: 'Controls Intern' },
  evidence: [{ kind: 'posting_url', label: 'Listing', value: 'https://example.test' }],
}
const list = {
  items: [],
  pageInfo: {
    startCursor: null,
    endCursor: null,
    hasPreviousPage: false,
    hasNextPage: false,
  },
  totalCount: 0,
}
const detail = {
  captureId,
  captureRevision: 3,
  expectedGenerationId: 'generation-3',
  sourceSummary: {
    displayName: 'Campus Network',
    provider: 'campus',
    observedAt: now,
  },
  provenance: [],
  destination: { status: 'resolved', url: 'https://northstar.example/jobs/448' },
  rawEvidence: [{
    captureRevision: 3,
    evidenceIndex: 0,
    label: 'Listing',
    displayValue: 'Northstar Robotics — Controls Intern',
  }],
  exactEvidenceReferences: [{
    captureId,
    captureRevision: 3,
    evidenceIndexes: [0],
  }],
  jobDefaults: { companyName: 'Northstar Robotics' },
  lastIssue: null,
}

function commandResult(
  status: 'started' | 'corrected',
  requestGenerationId: string | null,
  idempotencyKey: string,
  captureRevision: number,
  generationId: string | null,
) {
  return {
    status,
    captureId,
    requestCaptureRevision: 3,
    requestGenerationId,
    idempotencyKey,
    captureRevision,
    generationId,
  }
}

describe('Capture resolution HTTP client', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('publishes safe paths for every query and command', () => {
    expect(valedictorianApiPaths.captureResolution)
      .toBe('/v1/capture-resolution/captures')
    expect(valedictorianApiPaths.captureResolutionDetail(captureId))
      .toBe('/v1/capture-resolution/captures/capture%2F1')
    expect(valedictorianApiPaths.captureResolutionRetry(captureId).endsWith('/retry')).toBe(true)
    expect(valedictorianApiPaths.captureResolutionReplay(captureId).endsWith('/replay')).toBe(true)
    expect(valedictorianApiPaths.captureResolutionCorrection(captureId).endsWith('/correction')).toBe(true)
    expect(valedictorianApiPaths.captureResolutionCompletion(captureId).endsWith('/completion')).toBe(true)
  })

  it('exposes all operations and accepts truthful advanced identities', async () => {
    const responses = [
      jsonResponse(list),
      jsonResponse(detail),
      jsonResponse(commandResult('started', 'generation-1', 'retry-1', 3, 'generation-2')),
      jsonResponse(commandResult('started', 'generation-2', 'replay-1', 3, 'generation-3')),
      jsonResponse(commandResult('corrected', 'generation-3', 'correct-1', 4, 'generation-4')),
      jsonResponse({
        status: 'created',
        jobId,
        companyId: 'company-1',
        createdJob: true,
        existingJobComparison: 'not_compared',
      }),
    ]
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    for (const response of responses) fetchMock.mockResolvedValueOnce(response)
    vi.stubGlobal('fetch', fetchMock)
    const client = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    }).forWorkspace('workspace 1').captureResolution

    await client.list({ after: ' opaque cursor ', limit: 25 })
    await client.get(captureId)
    await expect(client.retry({
      captureId,
      expectedCaptureRevision: 3,
      expectedGenerationId: 'generation-1',
      idempotencyKey: 'retry-1',
      actor,
    })).resolves.toMatchObject({ generationId: 'generation-2' })
    await expect(client.replay({
      captureId,
      expectedCaptureRevision: 3,
      expectedGenerationId: 'generation-2',
      idempotencyKey: 'replay-1',
      actor,
      rationale: 'Replay current evidence.',
    })).resolves.toMatchObject({ generationId: 'generation-3' })
    await expect(client.correct({
      captureId,
      expectedCaptureRevision: 3,
      expectedGenerationId: 'generation-3',
      idempotencyKey: 'correct-1',
      actor,
      rationale: 'Repair the effective snapshot.',
      effectiveCapture,
    })).resolves.toMatchObject({ captureRevision: 4, generationId: 'generation-4' })
    await expect(client.complete({
      captureId,
      expectedCaptureRevision: 3,
      expectedGenerationId: 'generation-3',
      idempotencyKey: 'complete-1',
      actor,
      jobFacts,
      destination: {
        class: 'employer_or_ats',
        url: 'https://northstar.example/jobs/448',
      },
      externalIdentities: [],
      evidenceReferences: [{ captureId, captureRevision: 3, evidenceIndexes: [0] }],
      companyResolution: {
        action: 'use_local',
        companyId: 'company-1',
        expectedCompanyRevision: 2,
        restoreIfArchived: false,
      },
    })).resolves.toMatchObject({
      createdJob: true,
    })

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://valedictorian.test/v1/workspaces/workspace%201/capture-resolution/captures?filter=all&sort=observed_desc&limit=25&after=+opaque+cursor+',
      expect.objectContaining({ method: 'GET' }),
    )
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      expect.stringContaining('/capture-resolution/captures?'),
      expect.stringContaining('/capture-resolution/captures/capture%2F1'),
      expect.stringContaining('/capture-resolution/captures/capture%2F1/retry'),
      expect.stringContaining('/capture-resolution/captures/capture%2F1/replay'),
      expect.stringContaining('/capture-resolution/captures/capture%2F1/correction'),
      expect.stringContaining('/capture-resolution/captures/capture%2F1/completion'),
    ])
  })

  it('returns stale-guard blockers and rejects mismatched response correlation', async () => {
    const stale = {
      status: 'blocked',
      captureId,
      requestCaptureRevision: 3,
      requestGenerationId: 'generation-1',
      idempotencyKey: 'retry-1',
      currentCaptureRevision: 4,
      currentGenerationId: 'generation-4',
      blocker: {
        code: 'impossible_state',
        message: 'Capture revision is stale.',
        field: 'expectedCaptureRevision',
      },
    }
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(jsonResponse(stale))
    fetchMock.mockResolvedValueOnce(jsonResponse({
      status: 'started',
      captureId,
      requestCaptureRevision: 3,
      requestGenerationId: 'wrong-generation',
      idempotencyKey: 'retry-1',
      captureRevision: 4,
      generationId: 'generation-5',
    }))
    vi.stubGlobal('fetch', fetchMock)
    const client = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    }).forWorkspace('workspace-1').captureResolution
    const input = {
      captureId,
      expectedCaptureRevision: 3,
      expectedGenerationId: 'generation-1',
      idempotencyKey: 'retry-1',
      actor,
    }

    await expect(client.retry(input)).resolves.toMatchObject({
      status: 'blocked',
      currentCaptureRevision: 4,
      currentGenerationId: 'generation-4',
    })
    await expect(client.retry(input)).rejects.toThrow('Request failed')
  })

  it('rejects null or non-successor identities from command responses', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(jsonResponse(
      commandResult('started', 'generation-1', 'retry-1', 3, 'generation-1'),
    ))
    fetchMock.mockResolvedValueOnce(jsonResponse(
      commandResult('corrected', 'generation-1', 'correct-1', 4, null),
    ))
    vi.stubGlobal('fetch', fetchMock)
    const client = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    }).forWorkspace('workspace-1').captureResolution

    await expect(client.retry({
      captureId,
      expectedCaptureRevision: 3,
      expectedGenerationId: 'generation-1',
      idempotencyKey: 'retry-1',
      actor,
    })).rejects.toThrow('Request failed')
    await expect(client.correct({
      captureId,
      expectedCaptureRevision: 3,
      expectedGenerationId: 'generation-1',
      idempotencyKey: 'correct-1',
      actor,
      rationale: 'Repair the effective snapshot.',
      effectiveCapture,
    })).rejects.toThrow('Request failed')
  })

  it('returns structured completion guards for refresh and resubmit', async () => {
    const staleRecovery = {
      action: 'refresh_and_resubmit',
      guards: [
        { kind: 'capture_revision', expectedRevision: 3, currentRevision: 4 },
        {
          kind: 'generation',
          expectedGenerationId: 'generation-3',
          currentGenerationId: 'generation-4',
        },
      ],
    }
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(jsonResponse({
      status: 'blocked',
      failure: {
        kind: 'stale_guard',
        blocker: {
          code: 'impossible_state',
          message: 'Completion guards are stale.',
        },
        recovery: staleRecovery,
      },
    }))
    vi.stubGlobal('fetch', fetchMock)
    const client = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    }).forWorkspace('workspace-1').captureResolution

    await expect(client.complete({
      captureId,
      expectedCaptureRevision: 3,
      expectedGenerationId: 'generation-3',
      idempotencyKey: 'complete-stale',
      actor,
      jobFacts,
      destination: {
        class: 'employer_or_ats',
        url: 'https://northstar.example/jobs/448',
      },
      externalIdentities: [],
      evidenceReferences: [{ captureId, captureRevision: 3, evidenceIndexes: [0] }],
      companyResolution: {
        action: 'use_local',
        companyId: 'company-1',
        expectedCompanyRevision: 2,
        restoreIfArchived: false,
      },
    })).resolves.toMatchObject({
      failure: { kind: 'stale_guard', recovery: staleRecovery },
    })
  })

  it('rejects stale completion guards unrelated to the submitted request', async () => {
    const otherJobId = '018f6f88-4c35-7a62-9f2e-318dd8e164d6'
    const staleBlocked = (guard: Record<string, unknown>) => jsonResponse({
      status: 'blocked',
      failure: {
        kind: 'stale_guard',
        blocker: { code: 'impossible_state', message: 'A guard is stale.' },
        recovery: { action: 'refresh_and_resubmit', guards: [guard] },
      },
    })
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    const responses = [
      staleBlocked({ kind: 'capture_revision', expectedRevision: 2, currentRevision: 4 }),
      staleBlocked({
        kind: 'generation',
        expectedGenerationId: 'generation-other',
        currentGenerationId: 'generation-4',
      }),
      staleBlocked({
        kind: 'company_revision',
        companyId: 'company-other',
        expectedRevision: 2,
        currentRevision: 3,
      }),
      staleBlocked({
        kind: 'assignment_revision',
        jobId,
        expectedRevision: 1,
        currentRevision: 3,
      }),
      staleBlocked({
        kind: 'company_revision',
        companyId: 'company-1',
        expectedRevision: 2,
        currentRevision: 3,
      }),
      staleBlocked({
        kind: 'assignment_revision',
        jobId,
        expectedRevision: 2,
        currentRevision: 3,
      }),
      staleBlocked({
        kind: 'assignment_revision',
        jobId: otherJobId,
        expectedRevision: 2,
        currentRevision: 3,
      }),
    ]
    for (const response of responses) fetchMock.mockResolvedValueOnce(response)
    vi.stubGlobal('fetch', fetchMock)
    const client = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    }).forWorkspace('workspace-1').captureResolution
    const baseInput = {
      captureId,
      expectedCaptureRevision: 3,
      expectedGenerationId: 'generation-3',
      idempotencyKey: 'complete-stale',
      actor,
      jobFacts,
      destination: {
        class: 'employer_or_ats' as const,
        url: 'https://northstar.example/jobs/448',
      },
      externalIdentities: [],
      evidenceReferences: [{ captureId, captureRevision: 3, evidenceIndexes: [0] }],
      companyResolution: {
        action: 'use_local' as const,
        companyId: 'company-1',
        expectedCompanyRevision: 2,
        restoreIfArchived: false,
      },
    }
    const duplicateResolution = {
      action: 'attach' as const,
      targetJobId: jobId,
      expectedJobFactsRevision: 4,
      expectedAssignmentRevision: 2,
    }

    await expect(client.complete(baseInput)).rejects.toThrow('Request failed')
    await expect(client.complete(baseInput)).rejects.toThrow('Request failed')
    await expect(client.complete(baseInput)).rejects.toThrow('Request failed')
    await expect(client.complete({
      ...baseInput,
      duplicateResolution,
    })).rejects.toThrow('Request failed')
    await expect(client.complete({
      ...baseInput,
      companyResolution: {
        action: 'create_local',
        displayName: 'Northstar Robotics',
      },
    })).rejects.toThrow('Request failed')
    await expect(client.complete(baseInput)).rejects.toThrow('Request failed')
    await expect(client.complete({
      ...baseInput,
      duplicateResolution,
    })).rejects.toThrow('Request failed')
  })
})
