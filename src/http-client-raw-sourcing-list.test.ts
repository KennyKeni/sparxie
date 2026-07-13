import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHttpValedictorianClient } from './index.js'
import { jsonResponse } from './http-client.test-support.js'

const sparseRawOnlySummary = {
  id: 'raw-1',
  sourceEntityId: null,
  adapter: { id: 'valedictorian-cli', kind: 'cli', version: '0.12.0' },
  reportedOrigin: null,
  connectorInstanceId: null,
  latestConnectorRunId: null,
  providerRecordId: null,
  companyName: null,
  roleTitle: null,
  createdAt: '2026-07-10T14:00:00.000Z',
  firstObservedAt: '2026-07-10T14:00:00.000Z',
  lastObservedAt: '2026-07-10T14:00:00.000Z',
  firstReceivedAt: '2026-07-10T14:00:01.000Z',
  lastReceivedAt: '2026-07-10T14:00:01.000Z',
  occurrenceCount: 1,
  revisionCount: 1,
  latestRevision: {
    id: 'revision-1',
    revision: 1,
    observedAt: '2026-07-10T14:00:00.000Z',
    createdAt: '2026-07-10T14:00:01.000Z',
  },
  normalizationStatus: 'raw_only',
  normalizationUpdatedAt: null,
  normalizationRawRevisionId: null,
  gateStatus: null,
  canonicalCandidateId: null,
  projectionStatus: 'not_eligible',
  findingId: null,
} as const

const historicalRunMatch = {
  ...sparseRawOnlySummary,
  adapter: { id: 'jobright', kind: 'connector', version: '2.1.0' },
  connectorInstanceId: 'connector-instance-1',
  latestConnectorRunId: 'connector-run-later',
  normalizationStatus: 'failed',
  normalizationUpdatedAt: '2026-07-10T14:00:02.000Z',
  normalizationRawRevisionId: 'revision-1',
  gateStatus: 'failed',
} as const

const olderHistoricalRunMatch = {
  ...historicalRunMatch,
  id: 'raw-0',
} as const

describe('HTTP raw sourcing list client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('lists summaries through the encoded workspace path with parsed query encoding', async () => {
    const result = {
      // connectorRunId matches any occurrence, not only latestConnectorRunId.
      items: [historicalRunMatch],
      nextCursor: 'cursor-next',
    }
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(jsonResponse(result))
    vi.stubGlobal('fetch', fetchMock)

    const workspace = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    }).forWorkspace('workspace/one')

    await expect(
      workspace.sourcing.rawRecords.list({
        limit: 10,
        adapterId: 'jobright',
        adapterKind: 'connector',
        connectorInstanceId: 'connector-instance-1',
        connectorRunId: 'connector-run/earlier',
        receivedFrom: '2026-07-10T00:00:00.000Z',
        receivedTo: '2026-07-11T00:00:00.000Z',
        gateStatus: 'failed',
        projectionStatus: 'not_eligible',
        cursor: 'cursor-prev',
        normalizationStatus: 'failed',
      }),
    ).resolves.toEqual(result)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://valedictorian.test/v1/workspaces/workspace%2Fone/sourcing/raw-records?cursor=cursor-prev&limit=10&adapterId=jobright&adapterKind=connector&connectorInstanceId=connector-instance-1&connectorRunId=connector-run%2Fearlier&receivedFrom=2026-07-10T00%3A00%3A00.000Z&receivedTo=2026-07-11T00%3A00%3A00.000Z&normalizationStatus=failed&gateStatus=failed&projectionStatus=not_eligible',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('keeps the connector run filter on opaque cursor continuation requests', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ items: [historicalRunMatch], nextCursor: 'cursor-next' }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ items: [olderHistoricalRunMatch], nextCursor: null }),
      )
    vi.stubGlobal('fetch', fetchMock)

    const rawRecords = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    }).forWorkspace('workspace-1').sourcing.rawRecords

    const firstPage = await rawRecords.list({
      connectorRunId: 'connector-run-earlier',
      limit: 1,
    })
    const secondPage = await rawRecords.list({
      connectorRunId: 'connector-run-earlier',
      cursor: firstPage.nextCursor!,
      limit: 1,
    })

    expect([...firstPage.items, ...secondPage.items].map(({ id }) => id)).toEqual([
      'raw-1',
      'raw-0',
    ])

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://valedictorian.test/v1/workspaces/workspace-1/sourcing/raw-records?limit=1&connectorRunId=connector-run-earlier',
      expect.objectContaining({ method: 'GET' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://valedictorian.test/v1/workspaces/workspace-1/sourcing/raw-records?cursor=cursor-next&limit=1&connectorRunId=connector-run-earlier',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('rejects invalid queries before fetch and sanitizes forbidden response fields', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        items: [
          {
            ...sparseRawOnlySummary,
            payload: { secret: 'nope' },
            contentHash: 'abc',
            evidence: [],
          },
        ],
        nextCursor: null,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const rawRecords = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    }).forWorkspace('workspace-1').sourcing.rawRecords

    await expect(
      rawRecords.list({
        limit: 0,
      } as Parameters<typeof rawRecords.list>[0]),
    ).rejects.toThrow()
    expect(fetchMock).not.toHaveBeenCalled()

    await expect(rawRecords.list({ connectorRunId: '' })).rejects.toThrow()
    await expect(
      rawRecords.list({ connectorRunId: 'r'.repeat(257) }),
    ).rejects.toThrow()
    expect(fetchMock).not.toHaveBeenCalled()

    await expect(
      rawRecords.list({ connectorRunId: 'connector-run-earlier' }),
    ).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('accepts a nullable nextCursor page without offset pagination fields', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        items: [],
        nextCursor: null,
      }),
    )
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        items: [],
        nextCursor: null,
        total: 0,
        offset: 0,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const rawRecords = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    }).forWorkspace('workspace-1').sourcing.rawRecords

    await expect(rawRecords.list()).resolves.toEqual({
      items: [],
      nextCursor: null,
    })
    await expect(rawRecords.list()).rejects.toThrow()
  })
})
