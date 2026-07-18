import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHttpValedictorianClient } from './index'
import {
  jsonResponse,
  mockFetch,
  sourcingFindingPayload,
  workflowRunPayload,
  workflowRunStepPayload,
} from './http-client.test-support.js'

function rawReceipt(capture?: Record<string, string>, intakeItemId = 'item-1') {
  return {
    intakeItemId, rawRecordId: 'raw-1', sourceEntityId: null,
    revision: { id: 'revision-1', rawRecordId: 'raw-1', revision: 1, contentHash: 'sha256:content', reused: false, createdAt: '2026-07-11T14:00:00.000Z' },
    occurrence: { id: 'occurrence-1', rawRecordId: 'raw-1', rawRevisionId: 'revision-1', ...(capture ? { capture } : {}), observedAt: '2026-07-11T14:00:00.000Z', receivedAt: '2026-07-11T14:00:01.000Z' },
  }
}

describe('HTTP Valedictorian client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('maps workflow run and sourcing finding methods to HTTP endpoints', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    const run = workflowRunPayload()
    const step = workflowRunStepPayload()
    const finding = sourcingFindingPayload('US')
    fetchMock.mockResolvedValueOnce(jsonResponse(run))
    fetchMock.mockResolvedValueOnce(jsonResponse(step))
    fetchMock.mockResolvedValueOnce(jsonResponse(workflowRunPayload({
      status: 'completed',
      completedAt: '2026-07-11T15:00:00.000Z',
      outcome: 'full_coverage',
      summary: 'Completed.',
    })))
    fetchMock.mockResolvedValueOnce(jsonResponse({
      items: [run],
      total: 1,
      limit: 25,
      offset: 0,
      hasMore: false,
    }))
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ items: [finding], total: 1, limit: 25, offset: 0, hasMore: false }),
    )
    for (let index = 0; index < 4; index += 1) {
      fetchMock.mockResolvedValueOnce(jsonResponse(finding))
    }
    fetchMock.mockResolvedValueOnce(jsonResponse(finding))
    vi.stubGlobal('fetch', fetchMock)
    const client = createHttpValedictorianClient({ baseUrl: 'http://127.0.0.1:4317' })
    const workspace = client.forWorkspace('workspace-1')

    await workspace.runs.start({
      runType: 'sourcing',
      actorType: 'agent',
      actorName: 'codex',
      sourceName: 'LinkedIn',
      summary: 'Started sourcing.',
    })
    await workspace.runs.step({
      workflowRunId: 'run-1',
      type: 'note',
      message: 'Reached frontier.',
      payload: { inspectedCount: 12 },
      actor: 'agent:codex',
    })
    await workspace.runs.complete({
      workflowRunId: 'run-1',
      outcome: 'full_coverage',
      summary: 'Completed.',
    })
    await workspace.runs.list({ runType: 'sourcing', sourceId: 'source-linkedin', limit: 25 })
    await workspace.sourcing.findings.list({
      workflowRunId: 'run-1',
      sourceId: 'source-linkedin',
      mergeStatus: 'new',
      destinationClass: 'third_party_job_posting',
      usability: 'usable',
      limit: 25,
    })
    await workspace.sourcing.findings.create({
      workflowRunId: 'run-1',
      sourceName: 'LinkedIn',
      companyName: 'Delta Labs',
      roleTitle: 'Software Engineering Intern',
      roleKind: 'internship',
      country: 'US',
      workMode: 'remote',
      officialUrl: 'https://jobs.example.com/delta',
      destinationClass: 'third_party_job_posting',
      destinationUrl: 'https://linkedin.com/jobs/view/123',
      intermediaryUrl: 'https://jobright.test/jobs/123',
      usability: 'usable',
    } as Parameters<typeof workspace.sourcing.findings.create>[0] & {
      destinationClass: string
      destinationUrl: string
      intermediaryUrl: string
      usability: string
    })
    await workspace.sourcing.findings.update({
      findingId: 'finding-1',
      priorityScore: 4,
      priorityBand: 'skip',
      destinationClass: 'employer_or_ats',
      destinationUrl: 'https://jobs.example.com/delta',
      intermediaryUrl: 'https://jobright.test/jobs/123',
      usability: 'usable',
    } as Parameters<typeof workspace.sourcing.findings.update>[0] & {
      destinationClass: string
      destinationUrl: string
      intermediaryUrl: string
      usability: string
    })
    await workspace.sourcing.findings.decide({
      findingId: 'finding-1',
      mergeStatus: 'not_fit',
      mergeNotes: 'Requires a non-student schedule.',
      destinationClass: null,
      destinationUrl: null,
      intermediaryUrl: 'https://jobright.test/jobs/123',
      usability: 'review_only',
    } as Parameters<typeof workspace.sourcing.findings.decide>[0] & {
      destinationClass: null
      destinationUrl: null
      intermediaryUrl: string
      usability: string
    })
    await workspace.sourcing.findings.promote({ findingId: 'finding-1' })
    await workspace.sourcing.candidates.process({
      workflowRunId: 'run-1',
      sourceId: 'source-linkedin',
      companyName: 'Delta Labs',
      roleTitle: 'Software Engineering Intern',
      roleKind: 'internship',
      country: 'US',
      workMode: 'remote',
      officialUrl: 'https://jobs.example.com/delta',
      score: {
        score: 8,
        band: 'high',
        roleRelevance: 3,
        careerSignal: 2,
        cityWorkMode: 2,
        compensationLogistics: 1,
        penalties: [],
        rationale: 'Strong fit.',
        rubricVersion: 'test',
      },
      cutoffScore: 7,
      destinationClass: 'employer_or_ats',
      destinationUrl: 'https://jobs.example.com/delta',
      intermediaryUrl: 'https://jobright.test/jobs/123',
      usability: 'usable',
    } as Parameters<typeof workspace.sourcing.candidates.process>[0] & {
      destinationClass: string
      destinationUrl: string
      intermediaryUrl: string
      usability: string
    })

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:4317/v1/workspaces/workspace-1/runs',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:4317/v1/workspaces/workspace-1/runs/run-1/steps',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'http://127.0.0.1:4317/v1/workspaces/workspace-1/runs/run-1/complete',
      expect.objectContaining({ method: 'PATCH' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      'http://127.0.0.1:4317/v1/workspaces/workspace-1/runs?runType=sourcing&sourceId=source-linkedin&limit=25',
      expect.objectContaining({ method: 'GET' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      'http://127.0.0.1:4317/v1/workspaces/workspace-1/sourcing/findings?workflowRunId=run-1&sourceId=source-linkedin&mergeStatus=new&destinationClass=third_party_job_posting&usability=usable&limit=25',
      expect.objectContaining({ method: 'GET' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      'http://127.0.0.1:4317/v1/workspaces/workspace-1/sourcing/findings',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      7,
      'http://127.0.0.1:4317/v1/workspaces/workspace-1/sourcing/findings/finding-1',
      expect.objectContaining({ method: 'PATCH' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      8,
      'http://127.0.0.1:4317/v1/workspaces/workspace-1/sourcing/findings/finding-1/decide',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      9,
      'http://127.0.0.1:4317/v1/workspaces/workspace-1/sourcing/findings/finding-1/promote',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      10,
      'http://127.0.0.1:4317/v1/workspaces/workspace-1/sourcing/candidates/process',
      expect.objectContaining({
        body: expect.stringContaining('"sourceId":"source-linkedin"') as string,
        method: 'POST',
      }),
    )

    for (const callIndex of [5, 6, 7, 9]) {
      const body = JSON.parse(String(fetchMock.mock.calls[callIndex]?.[1]?.body)) as Record<
        string,
        unknown
      >

      expect(body).not.toHaveProperty('destinationClass')
      expect(body).not.toHaveProperty('destinationUrl')
      expect(body).not.toHaveProperty('intermediaryUrl')
      expect(body).not.toHaveProperty('usability')
    }
  })

  it('batch-ingests sparse raw CLI records without conflating adapter and reported origin', async () => {
    const record = { intakeItemId: 'item-1', adapter: { id: 'valedictorian-cli', kind: 'cli' as const, version: '0.12.0' }, observedAt: '2026-07-10T14:00:00.000Z', reportedOrigin: { kind: 'job_board' as const, name: 'LinkedIn' }, payload: { href: 'https://www.linkedin.com/jobs/view/123' } }
    const input = { records: [record, { ...record, intakeItemId: 'item-2', observedAt: '2026-07-10T15:00:00.000Z' }] }, payload = { receipts: [rawReceipt(undefined, 'item-2'), rawReceipt()] }
    const fetchMock = mockFetch(jsonResponse(payload))
    const client = createHttpValedictorianClient({ baseUrl: 'http://127.0.0.1:4317' })
    const workspace = client.forWorkspace('workspace/raw intake')

    await expect(
      workspace.sourcing.rawRecords.ingestBatch(input),
    ).resolves.toEqual(payload)

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:4317/v1/workspaces/workspace%2Fraw%20intake/sourcing/raw-records/batch',
      expect.objectContaining({
        body: expect.any(String) as string,
        method: 'POST',
      }),
    )
    const request = fetchMock.mock.calls[0]?.[1]
    expect(JSON.parse(request?.body as string)).toEqual(input)
  })

  it('validates connector capture before fetch and strictly parses raw responses', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(jsonResponse({ receipts: [rawReceipt({
      connectorInstanceId: 'connector-1', connectorRunId: 'run-1', executionScopeId: 'scope_wrong_1',
    })] }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ receipts: [rawReceipt()] }))
    const mismatched = rawReceipt({
      connectorInstanceId: 'connector-1', connectorRunId: 'run-1', executionScopeId: 'scope_connector_1',
    })
    mismatched.occurrence.rawRevisionId = 'revision-other'
    fetchMock.mockResolvedValueOnce(jsonResponse({ receipts: [mismatched] }))
    fetchMock.mockResolvedValueOnce(jsonResponse({
      id: 'raw-1', sourceEntityId: null,
      adapter: { id: 'provider', kind: 'connector', version: '1.0.0' },
      reportedOrigin: null, createdAt: '2026-07-11T14:00:00.000Z',
      latestRevision: {
        id: 'revision-1', rawRecordId: 'raw-1', revision: 1,
        contentHash: 'sha256:content',
        adapter: { id: 'provider', kind: 'connector', version: '1.0.0' },
        reportedOrigin: null, observedAt: '2026-07-11T14:00:00.000Z',
        providerRecordId: null, providerSchema: null, payload: null, evidence: [],
        createdAt: '2026-07-11T14:00:00.000Z',
      },
      occurrences: [{
        id: 'occurrence-1', rawRecordId: 'raw-1', rawRevisionId: 'revision-1',
        observedAt: '2026-07-11T14:00:00.000Z', receivedAt: '2026-07-11T14:00:01.000Z',
      }],
    }))
    vi.stubGlobal('fetch', fetchMock)
    const rawRecords = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    }).forWorkspace('workspace-1').sourcing.rawRecords

    await expect(rawRecords.ingestBatch({ records: [{
      intakeItemId: 'item-1',
      adapter: { id: 'provider', kind: 'connector', version: '1.0.0' },
      capture: { connectorInstanceId: 'connector-1', connectorRunId: 'run-1' },
      observedAt: '2026-07-11T14:00:00.000Z',
    }] } as never)).rejects.toThrow()
    expect(fetchMock).not.toHaveBeenCalled()

    await expect(rawRecords.ingestBatch({ records: [{
      intakeItemId: 'item-1',
      adapter: { id: 'provider', kind: 'connector', version: '1.0.0' },
      capture: {
        connectorInstanceId: 'connector-1', connectorRunId: 'run-1',
        executionScopeId: 'scope_connector_1',
      },
      observedAt: '2026-07-11T14:00:00.000Z',
    }] })).rejects.toThrow()
    await expect(rawRecords.ingestBatch({ records: [{
      intakeItemId: 'item-1',
      adapter: { id: 'provider', kind: 'connector', version: '1.0.0' },
      capture: { connectorInstanceId: 'connector-1', connectorRunId: 'run-1', executionScopeId: 'scope_connector_1' },
      observedAt: '2026-07-11T14:00:00.000Z',
    }] })).rejects.toThrow()
    await expect(rawRecords.ingestBatch({ records: [{
      intakeItemId: 'item-1',
      adapter: { id: 'provider', kind: 'connector', version: '1.0.0' },
      capture: { connectorInstanceId: 'connector-1', connectorRunId: 'run-1', executionScopeId: 'scope_connector_1' },
      observedAt: '2026-07-11T14:00:00.000Z',
    }] })).rejects.toThrow()
    await expect(rawRecords.get('raw-1')).rejects.toThrow()
  })

  it('round-trips connector capture and canonical finding lineage on explicit workspace routes', async () => {
    const canonicalProjection = {
      rawRevisionId: 'raw-revision-1',
      canonicalCandidateId: 'candidate-1',
      destination: {
        class: 'third_party_job_posting' as const,
        url: 'https://job-board.example.test/jobs/1',
        intermediaryUrl: 'https://aggregator.example.test/jobs/1',
      },
      employmentType: 'full_time' as const,
      seniority: 'entry_level' as const,
      location: { raw: 'New York, NY', city: 'New York', region: 'NY', country: 'US' },
      compensation: {
        minimum: 100_000,
        maximum: 120_000,
        currency: 'USD',
        interval: 'year' as const,
        raw: '$100k-$120k',
      },
      postedAt: {
        value: '2026-07-11',
        precision: 'date' as const,
        raw: '2026-07-11',
      },
    }
    const finding = {
      ...sourcingFindingPayload('US'),
      ...canonicalProjection,
      workMode: 'hybrid' as const,
    }
    const capture = {
      connectorInstanceId: 'connector-instance-1', connectorRunId: 'connector-run-1',
      executionScopeId: 'scope_connector_1',
    }
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(jsonResponse({ receipts: [
      rawReceipt({ executionScopeId: capture.executionScopeId, connectorRunId: capture.connectorRunId, connectorInstanceId: capture.connectorInstanceId }, 'item-2'),
      rawReceipt(capture, 'item-1'),
    ] }))
    fetchMock.mockResolvedValueOnce(jsonResponse(finding))
    vi.stubGlobal('fetch', fetchMock)
    const workspace = createHttpValedictorianClient({
      baseUrl: 'http://127.0.0.1:4317',
    }).forWorkspace('workspace/one')

    await workspace.sourcing.rawRecords.ingestBatch({
      records: [
        {
          intakeItemId: 'item-1',
          adapter: { id: 'jobright', kind: 'connector', version: '2.1.0' },
          capture,
          observedAt: '2026-07-11T14:00:00.000Z',
        },
        {
          intakeItemId: 'item-2',
          adapter: { id: 'jobright', kind: 'connector', version: '2.1.0' },
          capture,
          observedAt: '2026-07-11T15:00:00.000Z',
        },
      ],
    })
    await expect(
      workspace.sourcing.findings.create({
        workflowRunId: 'workflow-run-1',
        companyName: 'Example Corp',
        roleTitle: 'Software Engineer',
        roleKind: 'full_time',
        workMode: 'hybrid',
        ...canonicalProjection,
      }),
    ).resolves.toEqual(finding)

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:4317/v1/workspaces/workspace%2Fone/sourcing/raw-records/batch',
      expect.objectContaining({
        body: expect.stringContaining('"connectorRunId":"connector-run-1"') as string,
        method: 'POST',
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:4317/v1/workspaces/workspace%2Fone/sourcing/findings',
      expect.objectContaining({
        body: expect.stringContaining('"canonicalCandidateId":"candidate-1"') as string,
        method: 'POST',
      }),
    )
  })

  it('round-trips an explicitly unknown sourcing country without a sentinel', async () => {
    const canonicalProjection = {
      rawRevisionId: 'raw-revision-1',
      canonicalCandidateId: 'candidate-1',
      destination: null,
      employmentType: 'unknown' as const,
      seniority: 'unknown' as const,
      location: { raw: 'Remote', city: null, region: null, country: null },
      compensation: null,
      postedAt: { value: null, precision: 'unknown' as const, raw: null },
    }
    const finding = {
      id: 'finding-1',
      workflowRunId: 'workflow-run-1',
      sourceId: 'source-1',
      sourceName: 'Example',
      companyName: 'Example Corp',
      roleTitle: 'Software Engineer',
      roleKind: 'full_time' as const,
      term: null,
      terms: [],
      timingMode: 'unknown' as const,
      startDate: null,
      endDate: null,
      city: null,
      region: null,
      country: null,
      workMode: 'remote' as const,
      locationRaw: 'Remote',
      officialUrl: null,
      sourceUrl: null,
      postedAge: null,
      priorityScore: null,
      priorityBand: null,
      fitNotes: null,
      duplicateNotes: null,
      blocker: null,
      policyBlocker: null,
      dispositionReason: null,
      mergeStatus: 'new' as const,
      mergedApplicationId: null,
      mergedApplicationCompanyName: null,
      mergedApplicationRoleTitle: null,
      mergeNotes: null,
      discoveredAt: '2026-07-11T14:00:00.000Z',
      createdAt: '2026-07-11T14:00:00.000Z',
      updatedAt: '2026-07-11T14:00:00.000Z',
      ...canonicalProjection,
    }
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(jsonResponse(finding))
    fetchMock.mockResolvedValueOnce(jsonResponse(finding))
    fetchMock.mockResolvedValueOnce(jsonResponse(finding))
    vi.stubGlobal('fetch', fetchMock)
    const workspace = createHttpValedictorianClient({
      baseUrl: 'http://127.0.0.1:4317',
    }).forWorkspace('workspace-1')

    await expect(
      workspace.sourcing.findings.create({
        workflowRunId: 'workflow-run-1',
        companyName: 'Example Corp',
        roleTitle: 'Software Engineer',
        roleKind: 'full_time',
        country: null,
        workMode: 'remote',
        ...canonicalProjection,
      }),
    ).resolves.toEqual(finding)
    await expect(
      workspace.sourcing.findings.update({ findingId: 'finding-1', country: null }),
    ).resolves.toEqual(finding)
    await expect(
      workspace.sourcing.findings.update({ findingId: 'finding-1', priorityScore: 4 }),
    ).resolves.toEqual(finding)

    const createBody = JSON.parse(
      String(fetchMock.mock.calls[0]?.[1]?.body),
    ) as Record<string, unknown>
    expect(createBody.country).toBeNull()
    expect(createBody.location).toEqual({
      raw: 'Remote',
      city: null,
      region: null,
      country: null,
    })

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:4317/v1/workspaces/workspace-1/sourcing/findings',
      expect.objectContaining({
        method: 'POST',
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:4317/v1/workspaces/workspace-1/sourcing/findings/finding-1',
      expect.objectContaining({
        body: JSON.stringify({ country: null }),
        method: 'PATCH',
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'http://127.0.0.1:4317/v1/workspaces/workspace-1/sourcing/findings/finding-1',
      expect.objectContaining({
        body: JSON.stringify({ priorityScore: 4 }),
        method: 'PATCH',
      }),
    )
  })

  it('rejects invalid finding payloads from every finding response method', async () => {
    const { country: _country, ...missingCountry } = sourcingFindingPayload()
    const invalidCountry = sourcingFindingPayload(42)
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ items: [missingCountry], total: 1, limit: 25, offset: 0, hasMore: false }),
    )
    for (let index = 0; index < 4; index += 1) {
      fetchMock.mockResolvedValueOnce(jsonResponse(invalidCountry))
    }
    vi.stubGlobal('fetch', fetchMock)
    const findings = createHttpValedictorianClient({
      baseUrl: 'http://127.0.0.1:4317',
    }).forWorkspace('workspace-1').sourcing.findings

    await expect(findings.list()).rejects.toThrow()
    await expect(
      findings.create({
        workflowRunId: 'workflow-run-1',
        companyName: 'Example Corp',
        roleTitle: 'Software Engineer',
        roleKind: 'full_time',
        country: null,
        workMode: 'remote',
      }),
    ).rejects.toThrow()
    await expect(findings.update({ findingId: 'finding-1', country: null })).rejects.toThrow()
    await expect(
      findings.decide({ findingId: 'finding-1', mergeStatus: 'not_fit' }),
    ).rejects.toThrow()
    await expect(findings.promote({ findingId: 'finding-1' })).rejects.toThrow()
  })

  it('reads raw records and normalization results through encoded workspace paths', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(jsonResponse({
      id: 'raw/record 1', sourceEntityId: null,
      adapter: { id: 'cli', kind: 'cli', version: '1.0.0' }, reportedOrigin: null,
      createdAt: '2026-07-11T14:00:00.000Z',
      latestRevision: {
        id: 'revision-1', rawRecordId: 'raw/record 1', revision: 1,
        contentHash: 'sha256:content',
        adapter: { id: 'cli', kind: 'cli', version: '1.0.0' },
        reportedOrigin: null, observedAt: '2026-07-11T14:00:00.000Z',
        providerRecordId: null, providerSchema: null, payload: null, evidence: [],
        createdAt: '2026-07-11T14:00:00.000Z',
      },
      occurrences: [{
        id: 'occurrence-old', rawRecordId: 'raw/record 1', rawRevisionId: 'revision-old',
        observedAt: '2026-07-10T14:00:00.000Z', receivedAt: '2026-07-10T14:00:01.000Z',
      }],
    }))
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        rawRecordId: 'raw/record 1',
        rawRevisionId: 'revision-1',
        canonicalSchemaVersion: 'candidate/v1',
        attempts: [{
          id: 'attempt-1', rawRevisionId: 'revision-1',
          resolver: {
            id: 'provider-resolver', version: '1.0.0', scopeRequirement: 'source', requiredInputs: [],
            outputFields: [], capabilities: ['network'], costClass: 'low', precedence: 10,
          },
          inputHash: 'sha256:provider-input',
          executionScopeId: 'scope_connector_1',
          operationOutcome: {
            kind: 'scope_rate_limited', executionScopeId: 'scope_connector_1',
            retryAt: '2026-07-11T14:01:00.000Z', serverMinimumDelayMs: 30_000,
          },
          status: 'blocked', startedAt: '2026-07-11T14:00:00.000Z',
          completedAt: '2026-07-11T14:00:01.000Z', outcomes: [],
        }],
        fieldOutcomes: [],
        updatedAt: '2026-07-11T14:00:01.000Z',
        status: 'pending',
        gate: null,
        canonicalCandidate: null,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const workspace = createHttpValedictorianClient({
      baseUrl: 'http://127.0.0.1:4317',
    }).forWorkspace('workspace/one')

    await workspace.sourcing.rawRecords.get('raw/record 1')
    await expect(
      workspace.sourcing.rawRecords.normalization.get('raw/record 1'),
    ).resolves.toMatchObject({
      attempts: [{ executionScopeId: 'scope_connector_1', operationOutcome: { kind: 'scope_rate_limited' } }],
    })

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:4317/v1/workspaces/workspace%2Fone/sourcing/raw-records/raw%2Frecord%201',
      expect.objectContaining({ method: 'GET' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:4317/v1/workspaces/workspace%2Fone/sourcing/raw-records/raw%2Frecord%201/normalization',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('rejects malformed normalization retry outcomes returned by the server', async () => {
    mockFetch(
      jsonResponse({
        rawRecordId: 'raw-1',
        rawRevisionId: 'revision-1',
        canonicalSchemaVersion: 'candidate/v1',
        attempts: [],
        fieldOutcomes: [
          {
            resolverId: 'resolver-1',
            resolverVersion: '1.0.0',
            field: 'companyName',
            inputHash: 'sha256:input',
            status: 'retry',
            retry: {
              state: 'scheduled',
              reason: 'captcha',
              attempt: 1,
              maxAttempts: 4,
              lastAttemptAt: '2026-07-11T14:00:00.000Z',
              computedDelayMs: 30_000,
              nextAttemptAt: '2026-07-11T14:00:30.000Z',
              horizonAt: '2026-07-11T15:00:00.000Z',
            },
          },
        ],
        updatedAt: '2026-07-11T14:00:01.000Z',
        status: 'pending',
        gate: null,
        canonicalCandidate: null,
      }),
    )
    const workspace = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    }).forWorkspace('workspace-1')

    await expect(
      workspace.sourcing.rawRecords.normalization.get('raw-1'),
    ).rejects.toThrow()
  })

  it('binds raw record and normalization reads to the requested record id', async () => {
    const rawRecord = {
      id: 'raw-other', sourceEntityId: null,
      adapter: { id: 'cli', kind: 'cli', version: '1.0.0' }, reportedOrigin: null,
      createdAt: '2026-07-11T14:00:00.000Z',
      latestRevision: {
        id: 'revision-1', rawRecordId: 'raw-other', revision: 1, contentHash: 'sha256:content',
        adapter: { id: 'cli', kind: 'cli', version: '1.0.0' }, reportedOrigin: null,
        observedAt: '2026-07-11T14:00:00.000Z', providerRecordId: null,
        providerSchema: null, payload: null, evidence: [], createdAt: '2026-07-11T14:00:00.000Z',
      }, occurrences: [],
    }
    const normalization = {
      rawRecordId: 'raw-other', rawRevisionId: 'revision-1', canonicalSchemaVersion: 'candidate/v1',
      attempts: [], fieldOutcomes: [], updatedAt: '2026-07-11T14:00:00.000Z',
      status: 'pending', gate: null, canonicalCandidate: null,
    }
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      .mockResolvedValueOnce(jsonResponse(rawRecord))
      .mockResolvedValueOnce(jsonResponse(normalization))
    vi.stubGlobal('fetch', fetchMock)
    const records = createHttpValedictorianClient({ baseUrl: 'https://valedictorian.test' })
      .forWorkspace('workspace-1').sourcing.rawRecords
    await expect(records.get('raw-requested')).rejects.toThrow()
    await expect(records.normalization.get('raw-requested')).rejects.toThrow()
  })

  it('replays precise invalidations with version selectors and field directives', async () => {
    const receipt = {
      replayId: 'replay-1',
      status: 'completed_with_failures',
      acceptedAt: '2026-07-11T14:00:00.000Z',
      completedAt: '2026-07-11T14:00:01.000Z',
      matchedRawRevisionIds: ['revision-1'],
      items: [
        {
          status: 'failed',
          rawRecordId: 'raw-1',
          rawRevisionId: 'revision-1',
          failure: { code: 'normalization_failed', retryable: false },
        },
      ],
    }
    const fetchMock = mockFetch(jsonResponse(receipt))
    const workspace = createHttpValedictorianClient({
      baseUrl: 'http://127.0.0.1:4317',
    }).forWorkspace('workspace-1')
    const input = {
      selector: {
        rawRevisionIds: ['revision-1'],
        inputHashes: ['sha256:input-1'],
      },
      invalidate: {
        resolverVersions: [{ resolverId: 'destination-url', version: '1.4.0' }],
        canonicalSchemaVersions: ['job-candidate/v2'],
        gatePolicyVersions: ['sourcing-gate/v3'],
      },
      targetVersions: {
        resolvers: [{ resolverId: 'destination-url', version: '1.5.0' }],
        canonicalSchemaVersion: 'job-candidate/v3',
        gatePolicyVersion: 'sourcing-gate/v4',
      },
      fieldDirectives: [
        {
          action: 'lock' as const,
          field: 'companyName',
          value: 'Example Corp',
          reason: 'user_accepted',
          inputHash: 'sha256:company',
          policyVersion: 'manual/v1',
        },
        {
          action: 'suppress' as const,
          field: 'destinationUrl',
          reason: 'unsafe_intermediary',
          inputHash: 'sha256:url',
          policyVersion: 'destination/v2',
        },
      ],
    }

    await expect(workspace.sourcing.rawRecords.replay(input)).resolves.toEqual(receipt)

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:4317/v1/workspaces/workspace-1/sourcing/raw-records/replay',
      expect.objectContaining({
        body: JSON.stringify(input),
        method: 'POST',
      }),
    )
  })

  it('rejects replay responses whose status contradicts their item outcomes', async () => {
    mockFetch(
      jsonResponse({
        replayId: 'replay-1',
        status: 'completed_with_failures',
        acceptedAt: '2026-07-11T14:00:00.000Z',
        completedAt: '2026-07-11T14:00:01.000Z',
        matchedRawRevisionIds: ['revision-1'],
        items: [
          {
            status: 'completed',
            rawRecordId: 'raw-1',
            rawRevisionId: 'revision-1',
          },
        ],
      }),
    )
    const workspace = createHttpValedictorianClient({
      baseUrl: 'http://127.0.0.1:4317',
    }).forWorkspace('workspace-1')

    await expect(
      workspace.sourcing.rawRecords.replay({
        selector: { rawRevisionIds: ['revision-1'] },
        invalidate: {},
      }),
    ).rejects.toThrow('Request failed')
  })
})
