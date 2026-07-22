import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHttpValedictorianClient } from '../index.js'
import { jsonResponse } from './http-client.test-support.js'

describe('HTTP connector overview client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('lists a filtered bounded page through the encoded workspace path', async () => {
    const result = { items: [], nextCursor: null }
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(jsonResponse(result))
    vi.stubGlobal('fetch', fetchMock)

    const overview = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    }).forWorkspace('workspace/one').connectors.overview

    await expect(overview.list({
      cursor: 'cursor-prev',
      limit: 25,
      enabled: true,
      severity: 'warning',
      status: 'cooling_down',
    })).resolves.toEqual(result)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://valedictorian.test/v1/workspaces/workspace%2Fone/connectors/overview?cursor=cursor-prev&limit=25&enabled=true&severity=warning&status=cooling_down',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('validates requests before fetch and rejects unsanitized overview responses', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(jsonResponse({
      items: [{
        id: 'connector-1',
        connectorId: 'jobright.resolver',
        connectorVersion: '0.1.0',
        displayName: 'Jobright',
        enabled: true,
        health: {
          severity: 'warning',
          status: 'never_run',
          statusLabel: 'Never run',
          summary: 'Synchronization has not run yet.',
          warningCount: 0,
          warnings: [],
        },
        actionRequired: [],
        actions: [],
        latestRun: null,
        cooldown: null,
        session: { cookieJar: 'must-not-cross-contract' },
      }],
      nextCursor: null,
    }))
    vi.stubGlobal('fetch', fetchMock)

    const overview = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    }).forWorkspace('workspace-1').connectors.overview

    await expect(overview.list({ limit: 0 })).rejects.toThrow()
    expect(fetchMock).not.toHaveBeenCalled()
    await expect(overview.list()).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('accepts a sanitized user-skipped cancellation response', async () => {
    const result = {
      items: [{
        id: 'connector-1', connectorId: 'jobright.resolver', connectorVersion: '0.1.0',
        displayName: 'Jobright', enabled: true,
        health: {
          severity: 'warning', status: 'skipped', statusLabel: 'Skipped',
          summary: 'Synchronization was skipped by the user.', warningCount: 0, warnings: [],
        },
        actionRequired: [], actions: [], cooldown: null,
        latestRun: {
          id: 'run-1', mode: 'manual', status: 'cancelled', outcome: 'cancelled',
          cancellationKind: 'user_skipped', observationCount: 0, warningCount: 0,
          newestFrontier: { state: 'not_started' },
          historicalBackfill: {
            state: 'not_started', boundary: { earliestDate: '2026-06-01' },
          },
          pendingResolutionCount: 0,
          startedAt: '2026-07-13T14:00:00.000Z',
          completedAt: '2026-07-13T14:00:01.000Z',
        },
      }],
      nextCursor: null,
    } as const
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(jsonResponse(result))
    vi.stubGlobal('fetch', fetchMock)

    const overview = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    }).forWorkspace('workspace-1').connectors.overview

    await expect(overview.list()).resolves.toEqual(result)
  })
})
