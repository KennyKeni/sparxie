import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createHttpValedictorianClient,
  ValedictorianHttpError,
  ValedictorianProtocolError,
  valedictorianSafeRequestFailedMessage,
} from '../index.js'
import { jsonResponse } from './http-client.test-support.js'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('HTTP client contracted response parsing', () => {
  it('maps malformed main-client success payloads to ValedictorianProtocolError', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        capabilities: 'canary-protocol-secret',
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const error = await createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    })
      .capabilities.get()
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ValedictorianProtocolError)
    expect(error).not.toBeInstanceOf(ValedictorianHttpError)
    expect(error).toMatchObject({ message: valedictorianSafeRequestFailedMessage })
    expect(JSON.stringify(error)).not.toContain('canary-protocol-secret')
    expect(String(error)).not.toContain('canary-protocol-secret')
    expect(JSON.stringify(error)).not.toContain('Zod')
  })

  it('maps malformed delegated profile success payloads to ValedictorianProtocolError', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        fullName: 12,
        canary: 'profile-protocol-secret',
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const error = await createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    })
      .forWorkspace('workspace-1')
      .profile.get()
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ValedictorianProtocolError)
    expect(error).toMatchObject({ message: valedictorianSafeRequestFailedMessage })
    expect(JSON.stringify(error)).not.toContain('profile-protocol-secret')
    expect(String(error)).not.toContain('profile-protocol-secret')
  })

  it('maps response identity mismatches to ValedictorianProtocolError', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: 'other-connector',
        connectorId: 'jobright.resolver',
        connectorVersion: '0.1.0',
        displayName: 'Jobright',
        enabled: true,
        lifecycle: 'enabled',
        auth: [],
        config: {},
        filters: {},
        earliestBackfillDate: '2026-07-04',
        createdAt: '2026-07-11T14:00:00.000Z',
        updatedAt: '2026-07-11T14:00:00.000Z',
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const error = await createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    })
      .forWorkspace('workspace-1')
      .connectors.create({
        id: 'requested-id',
        connectorId: 'jobright.resolver',
        connectorVersion: '0.1.0',
        displayName: 'Jobright',
        enabled: true,
        auth: [],
        config: {},
        filters: {},
        earliestBackfillDate: '2026-07-04',
      })
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ValedictorianProtocolError)
    expect(error).toMatchObject({ message: valedictorianSafeRequestFailedMessage })
    expect(JSON.stringify(error)).not.toContain('other-connector')
    expect(String(error)).not.toContain('other-connector')
    expect(JSON.stringify(error)).not.toContain('requested-id')
  })

  it('maps malformed retirement conflict bodies to ValedictorianProtocolError', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        code: 'connector_retirement_active_work_conflict',
        connectorInstanceId: 'jobright/session 1',
        message: 'canary-retirement-secret',
        cancellationRequired: true,
        activeRuns: [],
      }, { status: 409 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const error = await createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    })
      .forWorkspace('workspace-1')
      .connectors.remove({ connectorInstanceId: 'jobright/session 1' })
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ValedictorianProtocolError)
    expect(error).toMatchObject({ message: valedictorianSafeRequestFailedMessage })
    expect(JSON.stringify(error)).not.toContain('canary-retirement-secret')
    expect(String(error)).not.toContain('canary-retirement-secret')
  })
})
