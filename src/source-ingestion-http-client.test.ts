import { describe, expect, it, vi } from 'vitest'
import { ValedictorianHttpError, ValedictorianSourceHttpClient } from './index'

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status: 200,
    ...init,
  })
}

describe('Valedictorian source HTTP client', () => {
  it('lists sourced jobs with query params and bearer auth', async () => {
    const payload = {
      jobs: [
        {
          active: true,
          applyUrl: 'https://jobs.example.com/apply/1',
          companyId: 'com_1',
          companyName: 'Figma',
          contentHash: 'hash:one',
          detailUrl: 'https://jobs.example.com/roles/1',
          firstSeenAt: '2026-07-05T12:00:00.000Z',
          lastSeenAt: '2026-07-05T12:00:00.000Z',
          lastVerifiedAt: '2026-07-05T12:30:00.000Z',
          latestSnapshotId: 'snp_1',
          locations: [{ rawText: 'New York, NY' }],
          sourceId: 'src_greenhouse',
          stableJobKey: 'job-1',
          title: 'Software Engineer Intern',
        },
      ],
      pagination: {
        limit: 25,
        nextOffset: 35,
        offset: 10,
      },
    }
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValue(jsonResponse(payload))
    const client = new ValedictorianSourceHttpClient({
      baseUrl: 'https://source.test/api/',
      fetch: fetchMock,
      token: 'reader-token',
    })

    await expect(client.listJobs({ limit: 25, offset: 10 })).resolves.toEqual(payload)

    expect(fetchMock).toHaveBeenCalledWith('https://source.test/jobs?limit=25&offset=10', {
      headers: {
        accept: 'application/json',
        authorization: 'Bearer reader-token',
      },
      method: 'GET',
    })
  })

  it('lists source runs with sourceId and limit query params', async () => {
    const payload = {
      runs: [
        {
          completedAt: '2026-07-05T12:31:00.000Z',
          diff: {
            addedCount: 1,
            changedCount: 0,
            previousSnapshotId: null,
            removedCount: 0,
          },
          evidencePath: 'evidence/sources/src_greenhouse/runs/run_1',
          normalizedJobCount: 12,
          outcome: 'published',
          rawJobCount: 12,
          sourceId: 'src_greenhouse',
          sourceRunId: 'run_1',
          startedAt: '2026-07-05T12:30:00.000Z',
          status: 'published',
        },
      ],
    }
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValue(jsonResponse(payload))
    const client = new ValedictorianSourceHttpClient({
      baseUrl: 'https://source.test/api/',
      fetch: fetchMock,
      token: 'reader-token',
    })

    await expect(client.listRuns({ sourceId: 'src_greenhouse', limit: 5 })).resolves.toEqual(
      payload,
    )

    expect(fetchMock).toHaveBeenCalledWith(
      'https://source.test/runs?sourceId=src_greenhouse&limit=5',
      {
        headers: {
          accept: 'application/json',
          authorization: 'Bearer reader-token',
        },
        method: 'GET',
      },
    )
  })

  it('gets a source run by id', async () => {
    const payload = {
      run: {
        confidenceResults: [
          {
            message: 'Sharp drop from the previous snapshot.',
            outcome: 'failed',
            ruleKey: 'sharp_drop_guard',
            severity: 'block_publish',
          },
        ],
        completedAt: '2026-07-05T12:31:00.000Z',
        diff: {
          addedCount: 0,
          changedCount: 0,
          previousSnapshotId: 'snp_previous',
          removedCount: 10,
        },
        evidenceArtifacts: ['response-summary.json', 'snapshot-diff.json'],
        evidenceBundleId: 'evb_1',
        evidencePath: 'evidence/sources/src_greenhouse/runs/run_1',
        normalizedJobCount: 12,
        outcome: 'suspect',
        rawJobCount: 12,
        sourceId: 'src_greenhouse',
        sourceRunId: 'run 1',
        startedAt: '2026-07-05T12:30:00.000Z',
        status: 'suspect',
      },
    }
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValue(jsonResponse(payload))
    const client = new ValedictorianSourceHttpClient({
      baseUrl: 'https://source.test/api/',
      fetch: fetchMock,
      token: 'reader-token',
    })

    await expect(client.getRun('run 1')).resolves.toEqual(payload)

    expect(fetchMock).toHaveBeenCalledWith('https://source.test/runs/run%201', {
      headers: {
        accept: 'application/json',
        authorization: 'Bearer reader-token',
      },
      method: 'GET',
    })
  })

  it('lists registered CareerSources with pagination', async () => {
    const payload = {
      pagination: {
        limit: 10,
        nextOffset: 20,
        offset: 10,
      },
      sources: [
        {
          activeStrategyVersionId: 'str_1',
          canonicalHost: 'boards.greenhouse.io',
          companyId: 'com_1',
          companyName: 'Figma',
          createdAt: '2026-07-05T12:00:00.000Z',
          entryUrl: 'https://boards.greenhouse.io/figma',
          id: 'src_greenhouse',
          latestSnapshotId: null,
          observedProvider: 'greenhouse',
          politenessPolicy: {},
          sourceType: 'provider_api',
          status: 'active',
          updatedAt: '2026-07-05T12:30:00.000Z',
        },
      ],
    }
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValue(jsonResponse(payload))
    const client = new ValedictorianSourceHttpClient({
      baseUrl: 'https://source.test/api/',
      fetch: fetchMock,
      token: 'reader-token',
    })

    await expect(client.listSources({ limit: 10, offset: 10 })).resolves.toEqual(payload)

    expect(fetchMock).toHaveBeenCalledWith('https://source.test/sources?limit=10&offset=10', {
      headers: {
        accept: 'application/json',
        authorization: 'Bearer reader-token',
      },
      method: 'GET',
    })
  })

  it('maps operator-write methods to source API routes', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    for (let index = 0; index < 8; index += 1) {
      fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }))
    }
    const client = new ValedictorianSourceHttpClient({
      baseUrl: 'https://source.test/api/',
      fetch: fetchMock,
      token: 'writer-token',
    })

    await client.createSource({
      companyName: 'Figma',
      careerUrl: 'https://boards.greenhouse.io/figma',
      config: { boardToken: 'figma' },
      templateKey: 'greenhouse_board_api',
    })
    await client.probeSource('src green')
    await client.getSchedule('src green')
    await client.setSchedule('src green', {
      cadence: 'hourly',
      nextDueAt: '2026-07-05T13:00:00.000Z',
      priority: 4,
      timezone: 'UTC',
    })
    await client.disableSchedule('src green')
    await client.requestRun('src green')
    await client.acceptBaseline('run suspect', 'operator verified the baseline')
    await client.forcePublish('run suspect', 'operator reviewed the evidence')

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://source.test/sources',
      expect.objectContaining({
        body: JSON.stringify({
          companyName: 'Figma',
          careerUrl: 'https://boards.greenhouse.io/figma',
          config: { boardToken: 'figma' },
          template: 'greenhouse_board_api',
        }),
        headers: {
          accept: 'application/json',
          authorization: 'Bearer writer-token',
          'content-type': 'application/json',
        },
        method: 'POST',
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://source.test/sources/src%20green/probe',
      expect.objectContaining({ body: '{}', method: 'POST' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'https://source.test/sources/src%20green/schedule',
      expect.objectContaining({ method: 'GET' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      'https://source.test/sources/src%20green/schedule',
      expect.objectContaining({
        body: JSON.stringify({
          cadence: 'hourly',
          nextDueAt: '2026-07-05T13:00:00.000Z',
          priority: 4,
          timezone: 'UTC',
        }),
        method: 'POST',
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      'https://source.test/sources/src%20green/schedule',
      expect.objectContaining({ method: 'DELETE' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      'https://source.test/sources/src%20green/run-requests',
      expect.objectContaining({ body: '{}', method: 'POST' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      7,
      'https://source.test/runs/run%20suspect/accept-baseline',
      expect.objectContaining({
        body: JSON.stringify({ reason: 'operator verified the baseline' }),
        method: 'POST',
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      8,
      'https://source.test/runs/run%20suspect/force-publish',
      expect.objectContaining({
        body: JSON.stringify({ reason: 'operator reviewed the evidence' }),
        method: 'POST',
      }),
    )
  })

  it('maps source API errors to the shared HTTP error type', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValue(
      jsonResponse({ error: 'source_run_not_found' }, { status: 404, statusText: 'Not Found' }),
    )
    const client = new ValedictorianSourceHttpClient({
      baseUrl: 'https://source.test/',
      fetch: fetchMock,
      token: 'reader-token',
    })

    let error: unknown

    try {
      await client.getRun('missing')
    } catch (caught) {
      error = caught
    }

    expect(error).toBeInstanceOf(ValedictorianHttpError)
    expect(error).toMatchObject({
      body: { error: 'source_run_not_found' },
      message: 'source_run_not_found',
      status: 404,
    })
  })
})
