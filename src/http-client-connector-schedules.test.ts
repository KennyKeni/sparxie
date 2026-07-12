import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHttpValedictorianClient } from './index'
import { jsonResponse } from './http-client.test-support'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const scheduleSummary = {
  id: 'schedule-1',
  connectorInstanceId: 'jobright/session 1',
  revision: 'rev-1',
  state: 'enabled' as const,
  cadence: { kind: 'interval' as const, everyMinutes: 60 },
  timezone: 'America/New_York',
  nextEligibleAt: '2026-07-12T14:00:00.000Z',
  createdAt: '2026-07-11T14:00:00.000Z',
  updatedAt: '2026-07-11T14:00:00.000Z',
  lastOccurrence: null,
  lastRun: null,
}

describe('HTTP connector schedule client', () => {
  it('gets a workspace connector schedule and returns null on 404', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(jsonResponse(scheduleSummary))
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ message: 'Not found' }, { status: 404 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const workspace = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    }).forWorkspace('workspace 1')

    await expect(
      workspace.connectors.schedules.get('jobright/session 1'),
    ).resolves.toEqual(scheduleSummary)
    await expect(
      workspace.connectors.schedules.get('jobright/session 1'),
    ).resolves.toBeNull()

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://valedictorian.test/v1/workspaces/workspace%201/connectors/jobright%2Fsession%201/schedule',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('rejects empty connector identity on schedule get before calling fetch', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    vi.stubGlobal('fetch', fetchMock)
    const workspace = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    }).forWorkspace('workspace 1')

    await expect(workspace.connectors.schedules.get('')).rejects.toThrow()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('upserts a workspace connector schedule with only user-owned fields', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(jsonResponse(scheduleSummary))
    vi.stubGlobal('fetch', fetchMock)
    const workspace = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    }).forWorkspace('workspace 1')

    await expect(
      workspace.connectors.schedules.upsert({
        connectorInstanceId: 'jobright/session 1',
        expectedRevision: null,
        state: 'enabled',
        cadence: { kind: 'interval', everyMinutes: 60 },
        timezone: 'America/New_York',
      }),
    ).resolves.toEqual(scheduleSummary)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://valedictorian.test/v1/workspaces/workspace%201/connectors/jobright%2Fsession%201/schedule',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          expectedRevision: null,
          state: 'enabled',
          cadence: { kind: 'interval', everyMinutes: 60 },
          timezone: 'America/New_York',
        }),
      }),
    )
  })

  it('rejects upsert input with server-owned fields before calling fetch', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    vi.stubGlobal('fetch', fetchMock)
    const workspace = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    }).forWorkspace('workspace 1')

    await expect(
      workspace.connectors.schedules.upsert({
        connectorInstanceId: 'jobright/session 1',
        expectedRevision: null,
        state: 'enabled',
        cadence: { kind: 'interval', everyMinutes: 60 },
        timezone: 'America/New_York',
        nextEligibleAt: '2026-07-12T14:00:00.000Z',
      } as never),
    ).rejects.toThrow()

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects pause, resume, delete, and dispatch inputs with extra server-owned fields before fetch', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    vi.stubGlobal('fetch', fetchMock)
    const workspace = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    }).forWorkspace('workspace 1')

    await expect(
      workspace.connectors.schedules.pause({
        connectorInstanceId: 'jobright/session 1',
        expectedRevision: 'rev-1',
        nextEligibleAt: '2026-07-12T14:00:00.000Z',
      } as never),
    ).rejects.toThrow()
    await expect(
      workspace.connectors.schedules.resume({
        connectorInstanceId: 'jobright/session 1',
        expectedRevision: 'rev-1',
        actor: 'user',
      } as never),
    ).rejects.toThrow()
    await expect(
      workspace.connectors.schedules.delete({
        connectorInstanceId: 'jobright/session 1',
        expectedRevision: 'rev-1',
        revision: 'spoofed',
      } as never),
    ).rejects.toThrow()
    await expect(
      workspace.connectors.schedules.dispatchDue({
        connectorInstanceId: 'jobright/session 1',
        expectedRevision: 'rev-1',
        idempotencyKey: 'spoofed',
      } as never),
    ).rejects.toThrow()

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('pauses a workspace connector schedule with expectedRevision', async () => {
    const paused = { ...scheduleSummary, state: 'paused' as const }
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(jsonResponse(paused))
    vi.stubGlobal('fetch', fetchMock)
    const workspace = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    }).forWorkspace('workspace 1')

    await expect(
      workspace.connectors.schedules.pause({
        connectorInstanceId: 'jobright/session 1',
        expectedRevision: 'rev-1',
      }),
    ).resolves.toEqual(paused)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://valedictorian.test/v1/workspaces/workspace%201/connectors/jobright%2Fsession%201/schedule/pause',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ expectedRevision: 'rev-1' }),
      }),
    )
  })

  it('resumes a workspace connector schedule with expectedRevision', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(jsonResponse(scheduleSummary))
    vi.stubGlobal('fetch', fetchMock)
    const workspace = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    }).forWorkspace('workspace 1')

    await expect(
      workspace.connectors.schedules.resume({
        connectorInstanceId: 'jobright/session 1',
        expectedRevision: 'rev-1',
      }),
    ).resolves.toEqual(scheduleSummary)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://valedictorian.test/v1/workspaces/workspace%201/connectors/jobright%2Fsession%201/schedule/resume',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ expectedRevision: 'rev-1' }),
      }),
    )
  })

  it('deletes a workspace connector schedule with expectedRevision', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    const workspace = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    }).forWorkspace('workspace 1')

    await expect(
      workspace.connectors.schedules.delete({
        connectorInstanceId: 'jobright/session 1',
        expectedRevision: 'rev-1',
      }),
    ).resolves.toBeUndefined()

    expect(fetchMock).toHaveBeenCalledWith(
      'https://valedictorian.test/v1/workspaces/workspace%201/connectors/jobright%2Fsession%201/schedule',
      expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({ expectedRevision: 'rev-1' }),
      }),
    )
  })

  it('lists workspace connector schedule audit events', async () => {
    const auditResult = {
      items: [
        {
          id: 'audit-1',
          scheduleId: 'schedule-1',
          actorClass: 'user' as const,
          action: 'upserted' as const,
          revision: 'rev-1',
          at: '2026-07-11T14:00:00.000Z',
        },
      ],
      total: 1,
      limit: 25,
      offset: 0,
      hasMore: false,
    }
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(jsonResponse(auditResult))
    vi.stubGlobal('fetch', fetchMock)
    const workspace = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    }).forWorkspace('workspace 1')

    await expect(
      workspace.connectors.schedules.listAudit({
        connectorInstanceId: 'jobright/session 1',
        limit: 25,
        offset: 0,
      }),
    ).resolves.toEqual(auditResult)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://valedictorian.test/v1/workspaces/workspace%201/connectors/jobright%2Fsession%201/schedule/audit?limit=25&offset=0',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('lists workspace connector schedule occurrences', async () => {
    const occurrenceResult = {
      items: [
        {
          id: 'occ-1',
          scheduleId: 'schedule-1',
          scheduleRevision: 'rev-1',
          nominalAt: '2026-07-12T13:00:00.000Z',
          idempotencyKey: 'rev-1:2026-07-12T13:00:00.000Z',
          admittedMode: 'scheduled' as const,
          outcome: 'completed' as const,
          connectorRunId: 'run-1',
          createdAt: '2026-07-12T13:00:01.000Z',
        },
      ],
      total: 1,
      limit: 10,
      offset: 0,
      hasMore: false,
    }
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(jsonResponse(occurrenceResult))
    vi.stubGlobal('fetch', fetchMock)
    const workspace = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    }).forWorkspace('workspace 1')

    await expect(
      workspace.connectors.schedules.listOccurrences({
        connectorInstanceId: 'jobright/session 1',
        limit: 10,
        offset: 0,
      }),
    ).resolves.toEqual(occurrenceResult)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://valedictorian.test/v1/workspaces/workspace%201/connectors/jobright%2Fsession%201/schedule/occurrences?limit=10&offset=0',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('rejects over-limit schedule history queries before calling fetch', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    vi.stubGlobal('fetch', fetchMock)
    const workspace = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    }).forWorkspace('workspace 1')

    await expect(
      workspace.connectors.schedules.listAudit({
        connectorInstanceId: 'jobright/session 1',
        limit: 201,
        offset: 0,
      }),
    ).rejects.toThrow()
    await expect(
      workspace.connectors.schedules.listOccurrences({
        connectorInstanceId: 'jobright/session 1',
        limit: 0,
        offset: 0,
      }),
    ).rejects.toThrow()

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('dispatches one due schedule occurrence without client-supplied clock fields', async () => {
    const admitted = {
      status: 'admitted' as const,
      occurrence: {
        id: 'occ-2',
        scheduleId: 'schedule-1',
        scheduleRevision: 'rev-1',
        nominalAt: '2026-07-12T12:00:00.000Z',
        idempotencyKey: 'rev-1:2026-07-12T12:00:00.000Z',
        admittedMode: 'catch_up' as const,
        outcome: 'admitted' as const,
        connectorRunId: 'run-2',
        createdAt: '2026-07-12T13:00:00.000Z',
      },
      run: {
        id: 'run-2',
        status: 'queued',
        mode: 'catch_up',
        startedAt: '2026-07-12T13:00:00.000Z',
        completedAt: null,
      },
    }
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(jsonResponse(admitted))
    vi.stubGlobal('fetch', fetchMock)
    const workspace = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    }).forWorkspace('workspace 1')

    await expect(
      workspace.connectors.schedules.dispatchDue({
        connectorInstanceId: 'jobright/session 1',
        expectedRevision: 'rev-1',
      }),
    ).resolves.toEqual(admitted)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://valedictorian.test/v1/workspaces/workspace%201/connectors/jobright%2Fsession%201/schedule/dispatch-due',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          expectedRevision: 'rev-1',
        }),
      }),
    )
  })
})

describe('HTTP connector run trigger anti-spoof', () => {
  it('rejects scheduleOccurrence on ordinary trigger input before calling fetch', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    vi.stubGlobal('fetch', fetchMock)
    const workspace = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    }).forWorkspace('workspace 1')

    await expect(
      workspace.connectors.runs.trigger({
        connectorInstanceId: 'jobright/session 1',
        mode: 'manual',
        scheduleOccurrence: {
          scheduleId: 'schedule-1',
          scheduleRevision: 'rev-1',
          occurrenceId: 'occ-1',
          nominalAt: '2026-07-11T14:00:00.000Z',
          admittedMode: 'scheduled',
          idempotencyKey: 'spoofed',
        },
      } as never),
    ).rejects.toThrow()

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects ordinary scheduled trigger mode before calling fetch', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    vi.stubGlobal('fetch', fetchMock)
    const workspace = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    }).forWorkspace('workspace 1')

    await expect(
      workspace.connectors.runs.trigger({
        connectorInstanceId: 'jobright/session 1',
        mode: 'scheduled',
      }),
    ).rejects.toThrow()

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
