import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHttpValedictorianClient, ValedictorianHttpError } from './index'

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status: 200,
    ...init,
  })
}

function mockFetch(response: Response) {
  const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
  fetchMock.mockResolvedValue(response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

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

  it('maps connector methods to workspace-scoped HTTP endpoints', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    for (let index = 0; index < 5; index += 1) {
      fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }))
    }
    vi.stubGlobal('fetch', fetchMock)
    const client = createHttpValedictorianClient({ baseUrl: 'http://127.0.0.1:4317' })
    const workspace = client.forWorkspace('workspace 1')

    await workspace.connectors.list()
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
      'http://127.0.0.1:4317/v1/workspaces/workspace%201/connectors/jobright%2Fsession%201/status',
      expect.objectContaining({ method: 'GET' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
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
      4,
      'http://127.0.0.1:4317/v1/workspaces/workspace%201/connectors/jobright%2Fsession%201/runs?status=completed&mode=manual&limit=25&offset=5',
      expect.objectContaining({ method: 'GET' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      'http://127.0.0.1:4317/v1/workspaces/workspace%201/connectors/jobright%2Fsession%201/observations?connectorRunId=run-1&limit=50',
      expect.objectContaining({ method: 'GET' }),
    )
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

  it('maps workflow run and sourcing finding methods to HTTP endpoints', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    for (let index = 0; index < 10; index += 1) {
      fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }))
    }
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
    })
    await workspace.sourcing.findings.update({
      findingId: 'finding-1',
      priorityScore: 4,
      priorityBand: 'skip',
    })
    await workspace.sourcing.findings.decide({
      findingId: 'finding-1',
      mergeStatus: 'not_fit',
      mergeNotes: 'Requires a non-student schedule.',
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
      'http://127.0.0.1:4317/v1/workspaces/workspace-1/sourcing/findings?workflowRunId=run-1&sourceId=source-linkedin&mergeStatus=new&limit=25',
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
  })

  it('updates status and records scores with JSON bodies', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    const scoreRecord = {
      applicationId: 'application-1',
      score: 8,
      band: 'high',
      roleRelevance: 3,
      careerSignal: 2,
      cityWorkMode: 2,
      compensationLogistics: 1,
      penalties: [],
      rationale: 'Strong fit.',
      rubricVersion: 'test',
      id: 'score-1',
      createdAt: '2026-06-30T00:00:00.000Z',
    }
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'application-1', status: 'submitted' }))
    fetchMock.mockResolvedValueOnce(jsonResponse(scoreRecord))
    vi.stubGlobal('fetch', fetchMock)
    const client = createHttpValedictorianClient({ baseUrl: 'http://127.0.0.1:4317' })
    const workspace = client.forWorkspace('workspace-1')

    await workspace.applications.updateStatus({
      applicationId: 'application-1',
      status: 'submitted',
      notes: 'Sent it.',
    })
    await expect(workspace.scores.record({
      applicationId: 'application-1',
      score: 8,
      band: 'high',
      roleRelevance: 3,
      careerSignal: 2,
      cityWorkMode: 2,
      compensationLogistics: 1,
      penalties: [],
      rationale: 'Strong fit.',
      rubricVersion: 'test',
    })).resolves.toEqual(scoreRecord)

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:4317/v1/workspaces/workspace-1/applications/application-1/status',
      expect.objectContaining({
        body: JSON.stringify({ status: 'submitted', notes: 'Sent it.' }),
        method: 'PATCH',
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:4317/v1/workspaces/workspace-1/scores',
      expect.objectContaining({
        body: JSON.stringify({
          applicationId: 'application-1',
          score: 8,
          band: 'high',
          roleRelevance: 3,
          careerSignal: 2,
          cityWorkMode: 2,
          compensationLogistics: 1,
          penalties: [],
          rationale: 'Strong fit.',
          rubricVersion: 'test',
        }),
        method: 'POST',
      }),
    )
  })

  it('maps application mutation methods to command endpoints', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    for (let index = 0; index < 14; index += 1) {
      fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }))
    }
    vi.stubGlobal('fetch', fetchMock)
    const client = createHttpValedictorianClient({ baseUrl: 'http://127.0.0.1:4317' })
    const workspace = client.forWorkspace('workspace-1')

    await workspace.applications.create({
      companyName: 'Versant Media',
      roleTitle: 'Software Engineer Intern',
      sourceName: 'LinkedIn',
      roleKind: 'internship',
      country: 'US',
      workMode: 'remote',
      status: 'queued',
      initialNote: 'Seeded by agent.',
    })
    await workspace.applications.update({
      applicationId: 'application-1',
      roleTitle: 'Software Engineer Intern II',
      hasApplied: false,
    })
    await workspace.applications.updateStatus({
      applicationId: 'application-1',
      status: 'submitted',
      notes: 'Submitted.',
    })
    await workspace.applications.archive({
      applicationId: 'application-1',
      note: 'Duplicate.',
    })
    await workspace.applications.workflow.update({
      applicationId: 'application-1',
      missingUserInfo: 'Start date',
      blockerReason: null,
    })
    await workspace.applications.notes.append({
      applicationId: 'application-1',
      message: 'Reached review page.',
    })
    await workspace.applications.links.create({
      applicationId: 'application-1',
      kind: 'official',
      label: 'official',
      url: 'https://jobs.example.com/1',
      isPrimary: true,
    })
    await workspace.applications.links.update({
      applicationId: 'application-1',
      linkId: 'link-1',
      label: 'company site',
    })
    await workspace.applications.links.list({
      applicationId: 'application-1',
      limit: 25,
      offset: 5,
    })
    await workspace.applications.events.list({
      applicationId: 'application-1',
      limit: 50,
      offset: 10,
    })
    await workspace.applications.attempts.start({
      applicationId: 'application-1',
      actorType: 'agent',
      actorName: 'codex',
      summary: 'Started.',
    })
    await workspace.applications.attempts.step({
      applicationId: 'application-1',
      attemptId: 'attempt-1',
      type: 'page_verified',
      message: 'Verified page.',
      payload: { page: 'contact' },
      actor: 'agent:codex',
    })
    await workspace.applications.attempts.complete({
      applicationId: 'application-1',
      attemptId: 'attempt-1',
      outcome: 'needs_user_info',
      summary: 'Needs dates.',
      missingUserInfo: 'Fall 2026 dates',
    })
    await workspace.applications.attempts.list({
      applicationId: 'application-1',
      limit: 25,
      offset: 5,
    })

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:4317/v1/workspaces/workspace-1/applications',
      expect.objectContaining({
        body: JSON.stringify({
          companyName: 'Versant Media',
          roleTitle: 'Software Engineer Intern',
          sourceName: 'LinkedIn',
          roleKind: 'internship',
          country: 'US',
          workMode: 'remote',
          status: 'queued',
          initialNote: 'Seeded by agent.',
        }),
        method: 'POST',
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:4317/v1/workspaces/workspace-1/applications/application-1',
      expect.objectContaining({
        body: JSON.stringify({
          roleTitle: 'Software Engineer Intern II',
          hasApplied: false,
        }),
        method: 'PATCH',
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'http://127.0.0.1:4317/v1/workspaces/workspace-1/applications/application-1/status',
      expect.objectContaining({
        body: JSON.stringify({ status: 'submitted', notes: 'Submitted.' }),
        method: 'PATCH',
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      'http://127.0.0.1:4317/v1/workspaces/workspace-1/applications/application-1/archive',
      expect.objectContaining({
        body: JSON.stringify({ note: 'Duplicate.' }),
        method: 'PATCH',
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      'http://127.0.0.1:4317/v1/workspaces/workspace-1/applications/application-1/workflow',
      expect.objectContaining({
        body: JSON.stringify({ missingUserInfo: 'Start date', blockerReason: null }),
        method: 'PATCH',
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      'http://127.0.0.1:4317/v1/workspaces/workspace-1/applications/application-1/notes',
      expect.objectContaining({
        body: JSON.stringify({ message: 'Reached review page.' }),
        method: 'POST',
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      7,
      'http://127.0.0.1:4317/v1/workspaces/workspace-1/applications/application-1/links',
      expect.objectContaining({
        body: JSON.stringify({
          kind: 'official',
          label: 'official',
          url: 'https://jobs.example.com/1',
          isPrimary: true,
        }),
        method: 'POST',
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      8,
      'http://127.0.0.1:4317/v1/workspaces/workspace-1/applications/application-1/links/link-1',
      expect.objectContaining({
        body: JSON.stringify({ label: 'company site' }),
        method: 'PATCH',
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      9,
      'http://127.0.0.1:4317/v1/workspaces/workspace-1/applications/application-1/links?limit=25&offset=5',
      expect.objectContaining({
        method: 'GET',
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      10,
      'http://127.0.0.1:4317/v1/workspaces/workspace-1/applications/application-1/events?limit=50&offset=10',
      expect.objectContaining({
        method: 'GET',
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      11,
      'http://127.0.0.1:4317/v1/workspaces/workspace-1/applications/application-1/attempts',
      expect.objectContaining({
        body: JSON.stringify({
          actorType: 'agent',
          actorName: 'codex',
          summary: 'Started.',
        }),
        method: 'POST',
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      12,
      'http://127.0.0.1:4317/v1/workspaces/workspace-1/applications/application-1/attempts/attempt-1/steps',
      expect.objectContaining({
        body: JSON.stringify({
          type: 'page_verified',
          message: 'Verified page.',
          payload: { page: 'contact' },
          actor: 'agent:codex',
        }),
        method: 'POST',
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      13,
      'http://127.0.0.1:4317/v1/workspaces/workspace-1/applications/application-1/attempts/attempt-1/complete',
      expect.objectContaining({
        body: JSON.stringify({
          outcome: 'needs_user_info',
          summary: 'Needs dates.',
          missingUserInfo: 'Fall 2026 dates',
        }),
        method: 'PATCH',
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      14,
      'http://127.0.0.1:4317/v1/workspaces/workspace-1/applications/application-1/attempts?limit=25&offset=5',
      expect.objectContaining({
        method: 'GET',
      }),
    )
  })

  it('throws useful errors for non-2xx responses', async () => {
    mockFetch(jsonResponse({ message: 'bad status' }, { status: 422 }))
    const client = createHttpValedictorianClient({ baseUrl: 'http://127.0.0.1:4317' })
    const workspace = client.forWorkspace('workspace-1')

    let thrown: unknown

    try {
      await workspace.applications.list()
    } catch (error) {
      thrown = error
    }

    expect(thrown).toMatchObject({
      name: 'ValedictorianHttpError',
      status: 422,
      message: 'bad status',
    })
    expect(thrown).toBeInstanceOf(ValedictorianHttpError)
  })
})
