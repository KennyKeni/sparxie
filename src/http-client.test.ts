import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHttpValedictorianClient } from './index'
import { jsonResponse, mockFetch, connectorInstanceSummaryPayload } from './http-client.test-support.js'

describe('HTTP Valedictorian client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('lists applications with query params and bearer auth', async () => {
    const payload = { items: [], total: 0, limit: 25, offset: 10, hasMore: false }
    const fetchMock = mockFetch(jsonResponse(payload))
    const client = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test/base/',
      token: 'secret-token',
    })

    await expect(
      client.forWorkspace('workspace-1').applications.list({
        status: 'needs_user_info',
        minScore: 6,
        hasApplied: false,
        source: 'linkedin',
        sort: 'company_asc',
        limit: 25,
        offset: 10,
      }),
    ).resolves.toEqual(payload)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://valedictorian.test/v1/workspaces/workspace-1/applications?status=needs_user_info&hasApplied=false&minScore=6&source=linkedin&sort=company_asc&limit=25&offset=10',
      {
        headers: {
          accept: 'application/json',
          authorization: 'Bearer secret-token',
        },
        method: 'GET',
      },
    )
  })

  it('lists registered workspaces from the root client', async () => {
    const payload = {
      items: [
        {
          id: 'workspace-1',
          name: 'Search',
          open: true,
          path: '/Users/keni/Search',
          source: 'local',
        },
      ],
    }
    const fetchMock = mockFetch(jsonResponse(payload))
    const client = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test/base/',
    })

    await expect(client.workspaces.list()).resolves.toEqual(payload)

    expect(fetchMock).toHaveBeenCalledWith('https://valedictorian.test/v1/workspaces', {
      headers: {
        accept: 'application/json',
      },
      method: 'GET',
    })
  })

  it('keeps domain APIs off the root client', () => {
    const client = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test/base/',
    })

    expect(client).not.toHaveProperty('applications')
    expect(client).not.toHaveProperty('actionQueue')
    expect(client).not.toHaveProperty('connectors')
    expect(client).not.toHaveProperty('profile')
    expect(client).not.toHaveProperty('secrets')
  })

  it('rejects malformed connector retry advice returned by the server', async () => {
    mockFetch(
      jsonResponse({
        id: 'run-1',
        connectorInstanceId: 'connector-1',
        mode: 'manual',
        status: 'skipped',
        coverage: { start: null, end: null },
        filterSignature: 'all',
        observationCount: 0,
        warningCount: 0,
        stats: null,
        warnings: [],
        retryHints: {
          state: 'not_due',
          reason: 'auth',
          attempt: 1,
          maxAttempts: 4,
          lastAttemptAt: '2026-07-11T14:00:00.000Z',
          computedDelayMs: 30_000,
          nextAttemptAt: '2026-07-11T14:00:30.000Z',
          horizonAt: '2026-07-11T15:00:00.000Z',
        },
        startedAt: '2026-07-11T14:00:01.000Z',
        completedAt: '2026-07-11T14:00:01.000Z',
      }),
    )
    const client = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    })

    await expect(
      client.forWorkspace('workspace-1').connectors.runs.trigger({
        connectorInstanceId: 'connector-1',
        mode: 'manual',
      }),
    ).rejects.toThrow()
  })

  it('round-trips a workspace-scoped skipped not-due connector run', async () => {
    const payload = {
      id: 'run-2',
      connectorInstanceId: 'connector-1',
      mode: 'manual',
      status: 'skipped',
      coverage: { start: null, end: null },
      filterSignature: 'all',
      observationCount: 0,
      warningCount: 0,
      stats: null,
      warnings: [],
      retryHints: {
        state: 'not_due',
        reason: 'server_failure',
        attempt: 2,
        maxAttempts: 4,
        lastAttemptAt: '2026-07-11T14:00:00.000Z',
        computedDelayMs: 30_000,
        nextAttemptAt: '2026-07-11T14:00:30.000Z',
        horizonAt: '2026-07-11T15:00:00.000Z',
      },
      startedAt: '2026-07-11T14:00:01.000Z',
      completedAt: '2026-07-11T14:00:01.000Z',
    }
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(jsonResponse(payload))
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...payload, status: 'completed' }))
    vi.stubGlobal('fetch', fetchMock)
    const client = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    })
    const workspace = client.forWorkspace('workspace 1')

    await expect(
      workspace.connectors.runs.trigger({
        connectorInstanceId: 'connector/1',
        mode: 'manual',
      }),
    ).resolves.toEqual(payload)
    await expect(
      workspace.connectors.runs.trigger({
        connectorInstanceId: 'connector/1',
        mode: 'manual',
      }),
    ).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledWith(
      'https://valedictorian.test/v1/workspaces/workspace%201/connectors/connector%2F1/runs',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('validates retry advice in connector run list responses', async () => {
    mockFetch(
      jsonResponse({
        items: [
          {
            id: 'run-1',
            connectorInstanceId: 'connector-1',
            mode: 'scheduled',
            status: 'failed',
            coverage: { start: null, end: null },
            filterSignature: 'all',
            observationCount: 0,
            warningCount: 0,
            stats: null,
            warnings: [],
            retryHints: {
              state: 'scheduled',
              reason: 'network_interruption',
              attempt: 4,
              maxAttempts: 4,
              lastAttemptAt: '2026-07-11T14:00:00.000Z',
              computedDelayMs: 30_000,
              nextAttemptAt: '2026-07-11T14:00:30.000Z',
              horizonAt: '2026-07-11T15:00:00.000Z',
            },
            startedAt: '2026-07-11T14:00:00.000Z',
            completedAt: '2026-07-11T14:00:01.000Z',
          },
        ],
        total: 1,
        limit: 25,
        offset: 0,
        hasMore: false,
      }),
    )
    const client = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    })

    await expect(
      client.forWorkspace('workspace-1').connectors.runs.list({
        connectorInstanceId: 'connector-1',
      }),
    ).rejects.toThrow()
  })

  it('maps connector methods to workspace-scoped HTTP endpoints', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    const run = {
      id: 'run-1',
      connectorInstanceId: 'jobright/session 1',
      mode: 'manual',
      status: 'completed',
      coverage: { start: null, end: null },
      filterSignature: 'internships',
      observationCount: 0,
      warningCount: 0,
      stats: null,
      warnings: [],
      retryHints: null,
      startedAt: '2026-07-11T14:00:00.000Z',
      completedAt: '2026-07-11T14:00:01.000Z',
    }
    const summary = connectorInstanceSummaryPayload()
    for (const response of [
      { items: [summary] },
      summary,
      summary,
      { ok: true },
      run,
      { items: [run], total: 1, limit: 25, offset: 5, hasMore: false },
      { ok: true },
    ]) {
      fetchMock.mockResolvedValueOnce(jsonResponse(response))
    }
    vi.stubGlobal('fetch', fetchMock)
    const client = createHttpValedictorianClient({ baseUrl: 'http://127.0.0.1:4317' })
    const workspace = client.forWorkspace('workspace 1')

    await workspace.connectors.list()
    await workspace.connectors.create({
      id: 'jobright/session 1',
      connectorId: 'jobright.resolver',
      connectorVersion: '0.1.0',
      displayName: 'Jobright',
      enabled: true,
      auth: [
        {
          id: 'jobright-session',
          label: 'Jobright session',
          mode: 'browser_session',
          sessionKey: 'workspace-session',
        },
      ],
      config: {
        publicFeedUrl: 'https://jobright.test/feed.json',
      },
      filters: {
        roleKeywords: ['intern'],
      },
    })
    await workspace.connectors.update({
      connectorInstanceId: 'jobright/session 1',
      displayName: 'Jobright Internships',
      enabled: false,
      filters: {
        roleKeywords: ['new grad'],
      },
    })
    await workspace.connectors.inspect('jobright/session 1')
    await workspace.connectors.runs.trigger({
      connectorInstanceId: 'jobright/session 1',
      coverageStartedAt: '2026-07-01T00:00:00.000Z',
      coverageEndedAt: '2026-07-08T00:00:00.000Z',
      filterSignature: 'internships',
      mode: 'manual',
    })
    await workspace.connectors.runs.list({
      connectorInstanceId: 'jobright/session 1',
      limit: 25,
      mode: 'manual',
      offset: 5,
      status: 'completed',
    })
    await workspace.connectors.observations.list({
      connectorInstanceId: 'jobright/session 1',
      connectorRunId: 'run-1',
      limit: 50,
    })

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:4317/v1/workspaces/workspace%201/connectors',
      expect.objectContaining({ method: 'GET' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:4317/v1/workspaces/workspace%201/connectors',
      expect.objectContaining({
        body: JSON.stringify({
          id: 'jobright/session 1',
          connectorId: 'jobright.resolver',
          connectorVersion: '0.1.0',
          displayName: 'Jobright',
          enabled: true,
          auth: [
            {
              id: 'jobright-session',
              label: 'Jobright session',
              mode: 'browser_session',
              sessionKey: 'workspace-session',
            },
          ],
          config: {
            publicFeedUrl: 'https://jobright.test/feed.json',
          },
          filters: {
            roleKeywords: ['intern'],
          },
        }),
        method: 'POST',
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'http://127.0.0.1:4317/v1/workspaces/workspace%201/connectors/jobright%2Fsession%201',
      expect.objectContaining({
        body: JSON.stringify({
          displayName: 'Jobright Internships',
          enabled: false,
          filters: {
            roleKeywords: ['new grad'],
          },
        }),
        method: 'PATCH',
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      'http://127.0.0.1:4317/v1/workspaces/workspace%201/connectors/jobright%2Fsession%201/status',
      expect.objectContaining({ method: 'GET' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      'http://127.0.0.1:4317/v1/workspaces/workspace%201/connectors/jobright%2Fsession%201/runs',
      expect.objectContaining({
        body: JSON.stringify({
          coverageStartedAt: '2026-07-01T00:00:00.000Z',
          coverageEndedAt: '2026-07-08T00:00:00.000Z',
          filterSignature: 'internships',
          mode: 'manual',
        }),
        method: 'POST',
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      'http://127.0.0.1:4317/v1/workspaces/workspace%201/connectors/jobright%2Fsession%201/runs?status=completed&mode=manual&limit=25&offset=5',
      expect.objectContaining({ method: 'GET' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      7,
      'http://127.0.0.1:4317/v1/workspaces/workspace%201/connectors/jobright%2Fsession%201/observations?connectorRunId=run-1&limit=50',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('serializes username_password connector auth references with secretKey only', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    const summary = connectorInstanceSummaryPayload({
      connectorVersion: '0.4.1',
      auth: [
        {
          id: 'jobright-login',
          mode: 'username_password',
          label: 'Jobright login',
          configured: true,
        },
      ],
    })
    fetchMock.mockResolvedValueOnce(jsonResponse(summary))
    fetchMock.mockResolvedValueOnce(jsonResponse(summary))
    vi.stubGlobal('fetch', fetchMock)
    const client = createHttpValedictorianClient({ baseUrl: 'http://127.0.0.1:4317' })
    const workspace = client.forWorkspace('workspace 1')

    await workspace.connectors.create({
      id: 'jobright/session 1',
      connectorId: 'jobright.resolver',
      connectorVersion: '0.4.1',
      displayName: 'Jobright',
      enabled: true,
      auth: [
        {
          id: 'jobright-login',
          label: 'Jobright login',
          mode: 'username_password',
          secretKey: 'jobright_credentials',
        },
      ],
    })
    await workspace.connectors.update({
      connectorInstanceId: 'jobright/session 1',
      auth: [
        {
          id: 'jobright-login',
          mode: 'username_password',
          secretKey: 'jobright_credentials',
        },
      ],
    })

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:4317/v1/workspaces/workspace%201/connectors',
      expect.objectContaining({
        body: JSON.stringify({
          id: 'jobright/session 1',
          connectorId: 'jobright.resolver',
          connectorVersion: '0.4.1',
          displayName: 'Jobright',
          enabled: true,
          auth: [
            {
              id: 'jobright-login',
              label: 'Jobright login',
              mode: 'username_password',
              secretKey: 'jobright_credentials',
            },
          ],
        }),
        method: 'POST',
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:4317/v1/workspaces/workspace%201/connectors/jobright%2Fsession%201',
      expect.objectContaining({
        body: JSON.stringify({
          auth: [
            {
              id: 'jobright-login',
              mode: 'username_password',
              secretKey: 'jobright_credentials',
            },
          ],
        }),
        method: 'PATCH',
      }),
    )

    const createBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      auth: Array<Record<string, unknown>>
    }
    const updateBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)) as {
      auth: Array<Record<string, unknown>>
    }
    for (const auth of [...createBody.auth, ...updateBody.auth]) {
      expect(auth).not.toHaveProperty('password')
      expect(auth).not.toHaveProperty('username')
      expect(auth).not.toHaveProperty('email')
      expect(auth).not.toHaveProperty('value')
      expect(auth).not.toHaveProperty('cookie')
      expect(auth).not.toHaveProperty('sessionId')
    }
  })

  it('transports optional earliestBackfillDate and parses connector instance responses', async () => {
    const summary = {
      id: 'jobright/session-1',
      connectorId: 'jobright.resolver',
      connectorVersion: '0.1.0',
      displayName: 'Jobright',
      enabled: true,
      auth: [
        {
          id: 'jobright-session',
          mode: 'browser_session',
          label: 'Jobright session',
          configured: true,
        },
      ],
      config: {},
      filters: {},
      earliestBackfillDate: '2026-07-04',
      createdAt: '2026-07-11T14:00:00.000Z',
      updatedAt: '2026-07-11T14:00:00.000Z',
    }
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [summary] }))
    fetchMock.mockResolvedValueOnce(jsonResponse(summary))
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ ...summary, earliestBackfillDate: '2026-06-01' }),
    )
    fetchMock.mockResolvedValueOnce(jsonResponse(summary))
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        items: [{ ...summary, earliestBackfillDate: '2023-02-29' }],
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const client = createHttpValedictorianClient({ baseUrl: 'http://127.0.0.1:4317' })
    const workspace = client.forWorkspace('workspace-1')

    await expect(workspace.connectors.list()).resolves.toEqual({ items: [summary] })
    await expect(
      workspace.connectors.create({
        id: 'jobright/session-1',
        connectorId: 'jobright.resolver',
        connectorVersion: '0.1.0',
        displayName: 'Jobright',
        enabled: true,
      }),
    ).resolves.toEqual(summary)
    await expect(
      workspace.connectors.update({
        connectorInstanceId: 'jobright/session-1',
        earliestBackfillDate: '2026-06-01',
      }),
    ).resolves.toEqual({ ...summary, earliestBackfillDate: '2026-06-01' })
    await expect(
      workspace.connectors.create({
        id: 'jobright/session-1',
        connectorId: 'jobright.resolver',
        connectorVersion: '0.1.0',
        displayName: 'Jobright',
        enabled: true,
        earliestBackfillDate: '2026-07-04',
      }),
    ).resolves.toEqual(summary)
    await expect(workspace.connectors.list()).rejects.toThrow()

    const omitCreateBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)) as Record<
      string,
      unknown
    >
    const updateBody = JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body)) as Record<
      string,
      unknown
    >
    const includeCreateBody = JSON.parse(String(fetchMock.mock.calls[3]?.[1]?.body)) as Record<
      string,
      unknown
    >
    expect(omitCreateBody).not.toHaveProperty('earliestBackfillDate')
    expect(updateBody).toEqual({ earliestBackfillDate: '2026-06-01' })
    expect(includeCreateBody.earliestBackfillDate).toBe('2026-07-04')
  })

  it('maps root health and capabilities endpoints', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ multiWorkspace: true }))
    vi.stubGlobal('fetch', fetchMock)
    const client = createHttpValedictorianClient({ baseUrl: 'http://127.0.0.1:4317' })

    await client.health.get()
    await client.capabilities.get()

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:4317/v1/health',
      expect.objectContaining({ method: 'GET' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:4317/v1/capabilities',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('gets an application and returns null for 404', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'application 1' }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'not found' }, { status: 404 }))
    vi.stubGlobal('fetch', fetchMock)
    const client = createHttpValedictorianClient({ baseUrl: 'http://127.0.0.1:4317' })
    const workspace = client.forWorkspace('workspace-1')

    await expect(workspace.applications.get('application 1')).resolves.toEqual({
      id: 'application 1',
    })
    await expect(workspace.applications.get('missing')).resolves.toBeNull()

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:4317/v1/workspaces/workspace-1/applications/application%201',
      {
        headers: {
          accept: 'application/json',
        },
        method: 'GET',
      },
    )
  })

  it('lists action queue rows with query params and bearer auth', async () => {
    const payload = {
      items: [],
      total: 0,
      limit: 25,
      offset: 5,
      hasMore: false,
      actionBucketCounts: { apply_now: 0 },
    }
    const fetchMock = mockFetch(jsonResponse(payload))
    const client = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test/base/',
      token: 'secret-token',
    })
    const workspace = client.forWorkspace('workspace-1')

    await expect(
      workspace.actionQueue.list({
        actionBucket: 'apply_now',
        limit: 25,
        offset: 5,
      }),
    ).resolves.toEqual(payload)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://valedictorian.test/v1/workspaces/workspace-1/action-queue?actionBucket=apply_now&limit=25&offset=5',
      {
        headers: {
          accept: 'application/json',
          authorization: 'Bearer secret-token',
        },
        method: 'GET',
      },
    )
  })

  it('maps profile methods to non-secret HTTP endpoints', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(jsonResponse({ fullName: 'Kenny Lin', answers: [] }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ fullName: 'Kenny Lin', answers: [] }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ basics: { fullName: 'Kenny Lin' }, answers: [] }))
    vi.stubGlobal('fetch', fetchMock)
    const client = createHttpValedictorianClient({ baseUrl: 'http://127.0.0.1:4317' })
    const workspace = client.forWorkspace('workspace-1')

    await workspace.profile.get()
    await workspace.profile.update({ fullName: 'Kenny Lin', answers: [] })
    await workspace.profile.agentContext.get()

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:4317/v1/workspaces/workspace-1/profile',
      expect.objectContaining({ method: 'GET' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:4317/v1/workspaces/workspace-1/profile',
      expect.objectContaining({
        body: '{"fullName":"Kenny Lin","answers":[]}',
        method: 'PATCH',
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'http://127.0.0.1:4317/v1/workspaces/workspace-1/profile/agent-context',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('maps workspace secrets and sensitive profile methods without plaintext reveal', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [] }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ key: 'greenhouse_password' }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ disabilityStatus: 'No' }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ disabilityStatus: 'No', ssnLast4: '5125' }))
    vi.stubGlobal('fetch', fetchMock)
    const client = createHttpValedictorianClient({ baseUrl: 'http://127.0.0.1:4317' })
    const workspace = client.forWorkspace('workspace-1')

    await workspace.secrets.list()
    await workspace.secrets.upsert({
      key: 'greenhouse_password',
      kind: 'password',
      label: 'Greenhouse',
      value: 'secret',
    })
    await workspace.secrets.delete('greenhouse_password')
    await workspace.profile.sensitive.get()
    await workspace.profile.sensitive.update({ disabilityStatus: 'No', ssnLast4: '5125' })

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:4317/v1/workspaces/workspace-1/secrets',
      expect.objectContaining({ method: 'GET' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:4317/v1/workspaces/workspace-1/secrets/greenhouse_password',
      expect.objectContaining({
        body: JSON.stringify({
          kind: 'password',
          label: 'Greenhouse',
          value: 'secret',
        }),
        method: 'PUT',
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'http://127.0.0.1:4317/v1/workspaces/workspace-1/secrets/greenhouse_password',
      expect.objectContaining({ method: 'DELETE' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      'http://127.0.0.1:4317/v1/workspaces/workspace-1/profile/sensitive',
      expect.objectContaining({ method: 'GET' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      'http://127.0.0.1:4317/v1/workspaces/workspace-1/profile/sensitive',
      expect.objectContaining({ method: 'PATCH' }),
    )
    expect(workspace.secrets).not.toHaveProperty('reveal')
  })

  it('maps policy config, evidence, and evaluation methods to HTTP endpoints', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    for (let index = 0; index < 8; index += 1) {
      fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }))
    }
    vi.stubGlobal('fetch', fetchMock)
    const client = createHttpValedictorianClient({ baseUrl: 'http://127.0.0.1:4317' })
    const workspace = client.forWorkspace('workspace-1')

    await workspace.policy.config.get()
    await workspace.policy.config.update({ scoring: { applyCutoff: 7 } })
    await workspace.policy.config.reset()
    await workspace.policy.evidence.list({
      subjectType: 'application',
      subjectId: 'application-1',
    })
    await workspace.policy.evidence.record({
      subjectType: 'application',
      subjectId: 'application-1',
      tag: 'explicit_user_approval',
      source: 'user',
      note: 'Approved.',
    })
    await workspace.policy.evaluate.application({
      applicationId: 'application-1',
      attemptId: 'attempt-1',
      outcome: 'submitted',
    })
    await workspace.policy.evaluate.sourcingCandidate({
      companyName: 'Acme',
      roleTitle: 'Software Engineer Intern',
      priorityScore: 6,
      officialUrl: 'https://jobs.example.com/acme',
    })
    await workspace.policy.evaluate.runWindow({
      sourceName: 'LinkedIn',
      now: '2026-06-08T18:00:00.000Z',
    })

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:4317/v1/workspaces/workspace-1/policy/config',
      expect.objectContaining({ method: 'GET' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:4317/v1/workspaces/workspace-1/policy/config',
      expect.objectContaining({
        body: JSON.stringify({ scoring: { applyCutoff: 7 } }),
        method: 'PATCH',
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'http://127.0.0.1:4317/v1/workspaces/workspace-1/policy/config/reset',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      'http://127.0.0.1:4317/v1/workspaces/workspace-1/policy/evidence?subjectType=application&subjectId=application-1',
      expect.objectContaining({ method: 'GET' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      'http://127.0.0.1:4317/v1/workspaces/workspace-1/policy/evidence',
      expect.objectContaining({
        body: JSON.stringify({
          subjectType: 'application',
          subjectId: 'application-1',
          tag: 'explicit_user_approval',
          source: 'user',
          note: 'Approved.',
        }),
        method: 'POST',
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      'http://127.0.0.1:4317/v1/workspaces/workspace-1/policy/evaluate/application',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      7,
      'http://127.0.0.1:4317/v1/workspaces/workspace-1/policy/evaluate/sourcing-candidate',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      8,
      'http://127.0.0.1:4317/v1/workspaces/workspace-1/policy/evaluate/run-window',
      expect.objectContaining({ method: 'POST' }),
    )
  })
})
