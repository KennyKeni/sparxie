import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHttpJobAppClient, JobAppHttpError } from './index'

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

describe('HTTP job app client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('lists applications with query params and bearer auth', async () => {
    const payload = { items: [], total: 0, limit: 25, offset: 10, hasMore: false }
    const fetchMock = mockFetch(jsonResponse(payload))
    const client = createHttpJobAppClient({
      baseUrl: 'https://job-app.test/base/',
      token: 'secret-token',
    })

    await expect(
      client.applications.list({
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
      'https://job-app.test/v1/applications?status=needs_user_info&hasApplied=false&minScore=6&source=linkedin&sort=company_asc&limit=25&offset=10',
      {
        headers: {
          accept: 'application/json',
          authorization: 'Bearer secret-token',
        },
        method: 'GET',
      },
    )
  })

  it('gets an application and returns null for 404', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'application 1' }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'not found' }, { status: 404 }))
    vi.stubGlobal('fetch', fetchMock)
    const client = createHttpJobAppClient({ baseUrl: 'http://127.0.0.1:4317' })

    await expect(client.applications.get('application 1')).resolves.toEqual({
      id: 'application 1',
    })
    await expect(client.applications.get('missing')).resolves.toBeNull()

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:4317/v1/applications/application%201',
      {
        headers: {
          accept: 'application/json',
        },
        method: 'GET',
      },
    )
  })

  it('lists queue rows with query params and bearer auth', async () => {
    const payload = {
      items: [],
      total: 0,
      limit: 25,
      offset: 5,
      hasMore: false,
      bucketCounts: { apply_now: 0 },
    }
    const fetchMock = mockFetch(jsonResponse(payload))
    const client = createHttpJobAppClient({
      baseUrl: 'https://job-app.test/base/',
      token: 'secret-token',
    })

    await expect(
      client.queue.list({
        bucket: 'apply_now',
        limit: 25,
        offset: 5,
      }),
    ).resolves.toEqual(payload)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://job-app.test/v1/queue?bucket=apply_now&limit=25&offset=5',
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
    const client = createHttpJobAppClient({ baseUrl: 'http://127.0.0.1:4317' })

    await client.profile.get()
    await client.profile.update({ fullName: 'Kenny Lin', answers: [] })
    await client.profile.agentContext.get()

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:4317/v1/profile',
      expect.objectContaining({ method: 'GET' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:4317/v1/profile',
      expect.objectContaining({
        body: '{"fullName":"Kenny Lin","answers":[]}',
        method: 'PATCH',
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'http://127.0.0.1:4317/v1/profile/agent-context',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('maps policy config, evidence, and evaluation methods to HTTP endpoints', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    for (let index = 0; index < 8; index += 1) {
      fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }))
    }
    vi.stubGlobal('fetch', fetchMock)
    const client = createHttpJobAppClient({ baseUrl: 'http://127.0.0.1:4317' })

    await client.policy.config.get()
    await client.policy.config.update({ scoring: { applyCutoff: 7 } })
    await client.policy.config.reset()
    await client.policy.evidence.list({
      subjectType: 'application',
      subjectId: 'application-1',
    })
    await client.policy.evidence.record({
      subjectType: 'application',
      subjectId: 'application-1',
      tag: 'explicit_user_approval',
      source: 'user',
      note: 'Approved.',
    })
    await client.policy.evaluate.application({
      applicationId: 'application-1',
      attemptId: 'attempt-1',
      outcome: 'submitted',
    })
    await client.policy.evaluate.sourcingCandidate({
      companyName: 'Acme',
      roleTitle: 'Software Engineer Intern',
      priorityScore: 6,
      officialUrl: 'https://jobs.example.com/acme',
    })
    await client.policy.evaluate.runWindow({
      sourceName: 'LinkedIn',
      now: '2026-06-08T18:00:00.000Z',
    })

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:4317/v1/policy/config',
      expect.objectContaining({ method: 'GET' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:4317/v1/policy/config',
      expect.objectContaining({
        body: JSON.stringify({ scoring: { applyCutoff: 7 } }),
        method: 'PATCH',
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'http://127.0.0.1:4317/v1/policy/config/reset',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      'http://127.0.0.1:4317/v1/policy/evidence?subjectType=application&subjectId=application-1',
      expect.objectContaining({ method: 'GET' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      'http://127.0.0.1:4317/v1/policy/evidence',
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
      'http://127.0.0.1:4317/v1/policy/evaluate/application',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      7,
      'http://127.0.0.1:4317/v1/policy/evaluate/sourcing-candidate',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      8,
      'http://127.0.0.1:4317/v1/policy/evaluate/run-window',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('maps workflow run and sourcing finding methods to HTTP endpoints', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    for (let index = 0; index < 10; index += 1) {
      fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }))
    }
    vi.stubGlobal('fetch', fetchMock)
    const client = createHttpJobAppClient({ baseUrl: 'http://127.0.0.1:4317' })

    await client.runs.start({
      runType: 'sourcing',
      actorType: 'agent',
      actorName: 'codex',
      sourceName: 'LinkedIn',
      summary: 'Started sourcing.',
    })
    await client.runs.step({
      workflowRunId: 'run-1',
      type: 'note',
      message: 'Reached frontier.',
      payload: { inspectedCount: 12 },
      actor: 'agent:codex',
    })
    await client.runs.complete({
      workflowRunId: 'run-1',
      outcome: 'full_coverage',
      summary: 'Completed.',
    })
    await client.runs.list({ runType: 'sourcing', sourceId: 'source-linkedin', limit: 25 })
    await client.sourcing.findings.list({
      workflowRunId: 'run-1',
      sourceId: 'source-linkedin',
      mergeStatus: 'new',
      limit: 25,
    })
    await client.sourcing.findings.create({
      workflowRunId: 'run-1',
      sourceName: 'LinkedIn',
      companyName: 'Delta Labs',
      roleTitle: 'Software Engineering Intern',
      roleKind: 'internship',
      country: 'US',
      workMode: 'remote',
      officialUrl: 'https://jobs.example.com/delta',
    })
    await client.sourcing.findings.update({
      findingId: 'finding-1',
      priorityScore: 4,
      priorityBand: 'skip',
    })
    await client.sourcing.findings.decide({
      findingId: 'finding-1',
      mergeStatus: 'not_fit',
      mergeNotes: 'Requires a non-student schedule.',
    })
    await client.sourcing.findings.promote({ findingId: 'finding-1' })
    await client.sourcing.candidates.process({
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
      'http://127.0.0.1:4317/v1/runs',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:4317/v1/runs/run-1/steps',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'http://127.0.0.1:4317/v1/runs/run-1/complete',
      expect.objectContaining({ method: 'PATCH' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      'http://127.0.0.1:4317/v1/runs?runType=sourcing&sourceId=source-linkedin&limit=25',
      expect.objectContaining({ method: 'GET' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      'http://127.0.0.1:4317/v1/sourcing/findings?workflowRunId=run-1&sourceId=source-linkedin&mergeStatus=new&limit=25',
      expect.objectContaining({ method: 'GET' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      'http://127.0.0.1:4317/v1/sourcing/findings',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      7,
      'http://127.0.0.1:4317/v1/sourcing/findings/finding-1',
      expect.objectContaining({ method: 'PATCH' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      8,
      'http://127.0.0.1:4317/v1/sourcing/findings/finding-1/decide',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      9,
      'http://127.0.0.1:4317/v1/sourcing/findings/finding-1/promote',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      10,
      'http://127.0.0.1:4317/v1/sourcing/candidates/process',
      expect.objectContaining({
        body: expect.stringContaining('"sourceId":"source-linkedin"') as string,
        method: 'POST',
      }),
    )
  })

  it('updates status and records scores with JSON bodies', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'application-1', status: 'submitted' }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
    const client = createHttpJobAppClient({ baseUrl: 'http://127.0.0.1:4317' })

    await client.applications.updateStatus({
      applicationId: 'application-1',
      status: 'submitted',
      notes: 'Sent it.',
    })
    await client.scores.record({
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
    })

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:4317/v1/applications/application-1/status',
      expect.objectContaining({
        body: JSON.stringify({ status: 'submitted', notes: 'Sent it.' }),
        method: 'PATCH',
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:4317/v1/scores',
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
    const client = createHttpJobAppClient({ baseUrl: 'http://127.0.0.1:4317' })

    await client.applications.create({
      companyName: 'Versant Media',
      roleTitle: 'Software Engineer Intern',
      sourceName: 'LinkedIn',
      roleKind: 'internship',
      country: 'US',
      workMode: 'remote',
      status: 'queued',
      initialNote: 'Seeded by agent.',
    })
    await client.applications.update({
      applicationId: 'application-1',
      roleTitle: 'Software Engineer Intern II',
      hasApplied: false,
    })
    await client.applications.updateStatus({
      applicationId: 'application-1',
      status: 'submitted',
      notes: 'Submitted.',
    })
    await client.applications.archive({
      applicationId: 'application-1',
      note: 'Duplicate.',
    })
    await client.applications.workflow.update({
      applicationId: 'application-1',
      missingUserInfo: 'Start date',
      blockerReason: null,
    })
    await client.applications.notes.append({
      applicationId: 'application-1',
      message: 'Reached review page.',
    })
    await client.applications.links.create({
      applicationId: 'application-1',
      kind: 'official',
      label: 'official',
      url: 'https://jobs.example.com/1',
      isPrimary: true,
    })
    await client.applications.links.update({
      applicationId: 'application-1',
      linkId: 'link-1',
      label: 'company site',
    })
    await client.applications.links.list({
      applicationId: 'application-1',
      limit: 25,
      offset: 5,
    })
    await client.applications.events.list({
      applicationId: 'application-1',
      limit: 50,
      offset: 10,
    })
    await client.applications.attempts.start({
      applicationId: 'application-1',
      actorType: 'agent',
      actorName: 'codex',
      summary: 'Started.',
    })
    await client.applications.attempts.step({
      applicationId: 'application-1',
      attemptId: 'attempt-1',
      type: 'page_verified',
      message: 'Verified page.',
      payload: { page: 'contact' },
      actor: 'agent:codex',
    })
    await client.applications.attempts.complete({
      applicationId: 'application-1',
      attemptId: 'attempt-1',
      outcome: 'needs_user_info',
      summary: 'Needs dates.',
      missingUserInfo: 'Fall 2026 dates',
    })
    await client.applications.attempts.list({
      applicationId: 'application-1',
      limit: 25,
      offset: 5,
    })

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:4317/v1/applications',
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
      'http://127.0.0.1:4317/v1/applications/application-1',
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
      'http://127.0.0.1:4317/v1/applications/application-1/status',
      expect.objectContaining({
        body: JSON.stringify({ status: 'submitted', notes: 'Submitted.' }),
        method: 'PATCH',
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      'http://127.0.0.1:4317/v1/applications/application-1/archive',
      expect.objectContaining({
        body: JSON.stringify({ note: 'Duplicate.' }),
        method: 'PATCH',
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      'http://127.0.0.1:4317/v1/applications/application-1/workflow',
      expect.objectContaining({
        body: JSON.stringify({ missingUserInfo: 'Start date', blockerReason: null }),
        method: 'PATCH',
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      'http://127.0.0.1:4317/v1/applications/application-1/notes',
      expect.objectContaining({
        body: JSON.stringify({ message: 'Reached review page.' }),
        method: 'POST',
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      7,
      'http://127.0.0.1:4317/v1/applications/application-1/links',
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
      'http://127.0.0.1:4317/v1/applications/application-1/links/link-1',
      expect.objectContaining({
        body: JSON.stringify({ label: 'company site' }),
        method: 'PATCH',
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      9,
      'http://127.0.0.1:4317/v1/applications/application-1/links?limit=25&offset=5',
      expect.objectContaining({
        method: 'GET',
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      10,
      'http://127.0.0.1:4317/v1/applications/application-1/events?limit=50&offset=10',
      expect.objectContaining({
        method: 'GET',
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      11,
      'http://127.0.0.1:4317/v1/applications/application-1/attempts',
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
      'http://127.0.0.1:4317/v1/applications/application-1/attempts/attempt-1/steps',
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
      'http://127.0.0.1:4317/v1/applications/application-1/attempts/attempt-1/complete',
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
      'http://127.0.0.1:4317/v1/applications/application-1/attempts?limit=25&offset=5',
      expect.objectContaining({
        method: 'GET',
      }),
    )
  })

  it('throws useful errors for non-2xx responses', async () => {
    mockFetch(jsonResponse({ message: 'bad status' }, { status: 422 }))
    const client = createHttpJobAppClient({ baseUrl: 'http://127.0.0.1:4317' })

    let thrown: unknown

    try {
      await client.applications.list()
    } catch (error) {
      thrown = error
    }

    expect(thrown).toMatchObject({
      name: 'JobAppHttpError',
      status: 422,
      message: 'bad status',
    })
    expect(thrown).toBeInstanceOf(JobAppHttpError)
  })
})
