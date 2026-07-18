import { describe, expect, it, vi } from 'vitest'
import {
  careerSourcesListQueryToSearchParams,
  sourceCompaniesListQueryToSearchParams,
  sourceJobsListQueryToSearchParams,
  sourceRunsListQueryToSearchParams,
  sourceSchedulesListQueryToSearchParams,
  ValedictorianHttpError,
  ValedictorianSourceHttpClient,
} from './index'
import {
  sourceLifecyclePayload,
  sourceProbePayload,
  sourceRegistrationPayload,
  sourceRunOverridePayload,
  sourceRunRequestPayload,
  sourceSchedulePayload,
} from './http-client.test-support.js'

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
          companyId: '11111111-1111-4111-8111-111111111111',
          companyName: 'Figma',
          companySlug: 'figma',
          contentHash: 'hash:one',
          detailUrl: 'https://jobs.example.com/roles/1',
          firstSeenAt: '2026-07-05T12:00:00.000Z',
          lastSeenAt: '2026-07-05T12:00:00.000Z',
          lastVerifiedAt: '2026-07-05T12:30:00.000Z',
          latestSnapshotId: '33333333-3333-4333-8333-333333333333',
          locations: [{ rawText: 'New York, NY' }],
          sourceId: '22222222-2222-4222-8222-222222222222',
          sourceSlug: 'figma-greenhouse',
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

    await expect(
      client.listJobs({
        active: false,
        limit: 25,
        offset: 10,
        search: 'designer',
        sort: 'title_asc',
      }),
    ).resolves.toEqual(payload)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://source.test/jobs?limit=25&offset=10&active=false&search=designer&sort=title_asc',
      {
        headers: {
          accept: 'application/json',
          authorization: 'Bearer reader-token',
        },
        method: 'GET',
      },
    )
  })

  it('lists Companies with query params and bearer auth', async () => {
    const payload = {
      companies: [
        {
          activeJobCount: 2,
          careerSourceCount: 1,
          createdAt: '2026-07-05T12:00:00.000Z',
          companyId: '11111111-1111-4111-8111-111111111111',
          companyName: 'Figma',
          companySlug: 'figma',
          updatedAt: '2026-07-05T12:30:00.000Z',
        },
      ],
      pagination: {
        limit: 25,
        nextOffset: null,
        offset: 0,
      },
      summary: {
        totalActiveJobs: 2,
        totalCompanies: 1,
      },
    }
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValue(jsonResponse(payload))
    const client = new ValedictorianSourceHttpClient({
      baseUrl: 'https://source.test/api/',
      fetch: fetchMock,
      token: 'reader-token',
    })

    await expect(client.listCompanies({ limit: 25, offset: 0 })).resolves.toEqual(payload)

    expect(fetchMock).toHaveBeenCalledWith('https://source.test/companies?limit=25&offset=0', {
      headers: {
        accept: 'application/json',
        authorization: 'Bearer reader-token',
      },
      method: 'GET',
    })
  })

  it('serializes Company dashboard browse query params', () => {
    expect(
      sourceCompaniesListQueryToSearchParams({
        limit: 25,
        offset: 50,
        search: 'figma',
        sort: 'updated_desc',
      }).toString(),
    ).toBe('limit=25&offset=50&search=figma&sort=updated_desc')
  })

  it('lists source runs with sourceId and limit query params', async () => {
    const payload = {
      pagination: {
        limit: 5,
        nextOffset: null,
        offset: 10,
      },
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
          sourceId: '22222222-2222-4222-8222-222222222222',
          sourceSlug: 'figma-greenhouse',
          sourceRunId: '66666666-6666-4666-8666-666666666666',
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

    await expect(
      client.listRuns({
        limit: 5,
        offset: 10,
        outcome: 'failed',
        sort: 'completed_desc',
        sourceRef: 'figma-greenhouse',
        status: 'failed',
      }),
    ).resolves.toEqual(payload)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://source.test/runs?sourceRef=figma-greenhouse&limit=5&offset=10&status=failed&outcome=failed&sort=completed_desc',
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
        evidenceBundleId: '55555555-5555-4555-8555-555555555555',
        evidencePath: 'evidence/sources/src_greenhouse/runs/run_1',
        normalizedJobCount: 12,
        outcome: 'suspect',
        rawJobCount: 12,
        sourceId: '22222222-2222-4222-8222-222222222222',
        sourceSlug: 'figma-greenhouse',
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
          activeStrategyVersionId: '44444444-4444-4444-8444-444444444444',
          canonicalHost: 'boards.greenhouse.io',
          companyId: '11111111-1111-4111-8111-111111111111',
          companyName: 'Figma',
          companySlug: 'figma',
          createdAt: '2026-07-05T12:00:00.000Z',
          entryUrl: 'https://boards.greenhouse.io/figma',
          id: '22222222-2222-4222-8222-222222222222',
          latestSnapshotId: null,
          observedProvider: 'greenhouse',
          politenessPolicy: {},
          sourceType: 'provider_api',
          slug: 'figma-greenhouse',
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

  it('lists SourceSchedules with scheduler query params and bearer auth', async () => {
    const payload = {
      pagination: {
        limit: 25,
        nextOffset: null,
        offset: 0,
      },
      schedules: [
        {
          cadence: 'hourly',
          canonicalHost: 'boards.greenhouse.io',
          companyId: '11111111-1111-4111-8111-111111111111',
          companyName: 'Figma',
          companySlug: 'figma',
          createdAt: '2026-07-05T12:00:00.000Z',
          cronExpression: null,
          enabled: true,
          entryUrl: 'https://boards.greenhouse.io/figma',
          id: '77777777-7777-4777-8777-777777777777',
          intervalMinutes: null,
          jitterSeconds: 0,
          nextDueAt: '2026-07-05T13:00:00.000Z',
          priority: 0,
          sourceId: '22222222-2222-4222-8222-222222222222',
          sourceSlug: 'figma-greenhouse',
          sourceStatus: 'active',
          timezone: 'UTC',
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

    await expect(
      client.listSchedules({
        cadence: 'hourly',
        companyRef: 'figma',
        enabled: true,
        limit: 25,
        offset: 0,
        search: 'figma',
        sort: 'next_due_asc',
        sourceRef: 'figma-greenhouse',
      }),
    ).resolves.toEqual(payload)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://source.test/schedules?limit=25&offset=0&search=figma&enabled=true&cadence=hourly&companyRef=figma&sourceRef=figma-greenhouse&sort=next_due_asc',
      {
        headers: {
          accept: 'application/json',
          authorization: 'Bearer reader-token',
        },
        method: 'GET',
      },
    )
  })

  it('serializes CareerSource dashboard browse query params', () => {
    expect(
      careerSourcesListQueryToSearchParams({
        limit: 10,
        observedProvider: 'greenhouse',
        offset: 20,
        scheduleEnabled: true,
        search: 'figma',
        sort: 'company_asc',
        sourceType: 'provider_api',
        status: 'active',
      }).toString(),
    ).toBe(
      'limit=10&offset=20&search=figma&status=active&observedProvider=greenhouse&sourceType=provider_api&scheduleEnabled=true&sort=company_asc',
    )
  })

  it('serializes CurrentJobIndex dashboard browse query params', () => {
    expect(
      sourceJobsListQueryToSearchParams({
        active: false,
        companyRef: 'figma',
        limit: 10,
        offset: 20,
        search: 'designer',
        sourceRef: 'figma-greenhouse',
        sort: 'first_seen_asc',
        staleBefore: '2026-07-02T00:00:00.000Z',
      }).toString(),
    ).toBe(
      'limit=10&offset=20&active=false&companyRef=figma&sourceRef=figma-greenhouse&search=designer&staleBefore=2026-07-02T00%3A00%3A00.000Z&sort=first_seen_asc',
    )
  })

  it('serializes SourceSchedule dashboard browse query params', () => {
    expect(
      sourceSchedulesListQueryToSearchParams({
        cadence: 'weekly',
        companyRef: 'figma',
        enabled: false,
        limit: 10,
        offset: 20,
        search: 'figma',
        sort: 'company_desc',
        sourceRef: 'figma-greenhouse',
      }).toString(),
    ).toBe(
      'limit=10&offset=20&search=figma&enabled=false&cadence=weekly&companyRef=figma&sourceRef=figma-greenhouse&sort=company_desc',
    )
  })

  it('serializes SourceRun dashboard browse query params', () => {
    expect(
      sourceRunsListQueryToSearchParams({
        limit: 5,
        offset: 10,
        outcome: 'failed',
        sort: 'completed_desc',
        sourceRef: 'figma-greenhouse',
        status: 'failed',
      }).toString(),
    ).toBe(
      'sourceRef=figma-greenhouse&limit=5&offset=10&status=failed&outcome=failed&sort=completed_desc',
    )
  })

  it('maps operator-write methods to source API routes', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    for (const response of [
      sourceRegistrationPayload(),
      sourceProbePayload(),
      sourceProbePayload(),
      sourceLifecyclePayload(),
      sourceLifecyclePayload(),
      sourceLifecyclePayload({ status: 'active' }),
      sourceSchedulePayload(),
      sourceSchedulePayload(),
      { schedule: null },
      sourceRunRequestPayload(),
      sourceRunOverridePayload('accept_baseline'),
      sourceRunOverridePayload('force_publish'),
    ]) {
      fetchMock.mockResolvedValueOnce(jsonResponse(response))
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
    await client.probeCareerUrl({
      browserFallback: true,
      browserProxy: { mode: 'none' },
      url: 'https://figma.com/careers',
    })
    await client.updateSourceLifecycle('src green', { status: 'paused' })
    await client.pauseSource('src green')
    await client.resumeSource('src green')
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
      'https://source.test/source-probes',
      expect.objectContaining({
        body: JSON.stringify({
          browserFallback: true,
          browserProxy: { mode: 'none' },
          url: 'https://figma.com/careers',
        }),
        method: 'POST',
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      'https://source.test/sources/src%20green/lifecycle',
      expect.objectContaining({
        body: JSON.stringify({ status: 'paused' }),
        method: 'POST',
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      'https://source.test/sources/src%20green/lifecycle',
      expect.objectContaining({
        body: JSON.stringify({ status: 'paused' }),
        method: 'POST',
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      'https://source.test/sources/src%20green/lifecycle',
      expect.objectContaining({
        body: JSON.stringify({ status: 'active' }),
        method: 'POST',
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      7,
      'https://source.test/sources/src%20green/schedule',
      expect.objectContaining({ method: 'GET' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      8,
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
      9,
      'https://source.test/sources/src%20green/schedule',
      expect.objectContaining({ method: 'DELETE' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      10,
      'https://source.test/sources/src%20green/run-requests',
      expect.objectContaining({ body: '{}', method: 'POST' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      11,
      'https://source.test/runs/run%20suspect/accept-baseline',
      expect.objectContaining({
        body: JSON.stringify({ reason: 'operator verified the baseline' }),
        method: 'POST',
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      12,
      'https://source.test/runs/run%20suspect/force-publish',
      expect.objectContaining({
        body: JSON.stringify({ reason: 'operator reviewed the evidence' }),
        method: 'POST',
      }),
    )
  })

  it('maps source API errors to a scrubbed shared HTTP error', async () => {
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
      body: null,
      message: 'Request failed',
      status: 404,
    })
    expect(JSON.stringify(error)).not.toContain('source_run_not_found')
    expect(String(error)).not.toContain('source_run_not_found')
  })
})
