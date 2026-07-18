import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHttpValedictorianClient, ValedictorianHttpError } from './index'
import {
  applicationAttemptPayload,
  applicationAttemptStepPayload,
  applicationDetailPayload,
  applicationLinkRecordPayload,
  jsonResponse,
  mockFetch,
} from './http-client.test-support.js'

describe('HTTP Valedictorian client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
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
    fetchMock.mockResolvedValueOnce(
      jsonResponse(applicationDetailPayload({ status: 'submitted' })),
    )
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
    const detail = applicationDetailPayload()
    const link = applicationLinkRecordPayload()
    const attempt = applicationAttemptPayload()
    const step = applicationAttemptStepPayload()
    const attemptList = { items: [attempt], total: 1, limit: 25, offset: 5, hasMore: false }
    for (const response of [
      detail,
      detail,
      detail,
      {},
      detail,
      detail,
      link,
      link,
      { items: [link], total: 1, limit: 25, offset: 5, hasMore: false },
      {
        items: [
          {
            id: 'event-1',
            applicationId: 'application-1',
            type: 'note',
            message: 'Noted.',
            payloadJson: '{}',
            actor: 'user',
            createdAt: '2026-07-11T14:00:00.000Z',
          },
        ],
        total: 1,
        limit: 50,
        offset: 10,
        hasMore: false,
      },
      attempt,
      step,
      attempt,
      attemptList,
    ]) {
      fetchMock.mockResolvedValueOnce(jsonResponse(response))
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

  it('throws scrubbed errors for non-2xx responses', async () => {
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
      message: 'Request failed',
      body: null,
    })
    expect(thrown).toBeInstanceOf(ValedictorianHttpError)
    expect(JSON.stringify(thrown)).not.toContain('bad status')
    expect(String(thrown)).not.toContain('bad status')
  })
})
