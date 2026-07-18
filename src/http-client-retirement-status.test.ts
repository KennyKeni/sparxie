import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ConnectorRetirementConflictError,
  ValedictorianHttpError,
  ValedictorianProtocolError,
  connectorRetirementActiveWorkConflictBody,
  createHttpValedictorianClient,
  valedictorianSafeRequestFailedMessage,
} from './index.js'
import { jsonResponse } from './http-client.test-support.js'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('retirement conflict status cohesion', () => {
  it('maps canonical retirement conflict bodies on non-409 statuses to ValedictorianProtocolError', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          ...connectorRetirementActiveWorkConflictBody,
          connectorInstanceId: 'connector-1',
        },
        { status: 422 },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const error = await createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    })
      .forWorkspace('workspace-1')
      .connectors.remove({ connectorInstanceId: 'connector-1' })
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ValedictorianProtocolError)
    expect(error).not.toBeInstanceOf(ConnectorRetirementConflictError)
    expect(error).toMatchObject({ message: valedictorianSafeRequestFailedMessage })
  })

  it('keeps unknown non-retirement codes fail-closed as generic HTTP errors', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { code: 'something_else', message: 'canary-unknown-secret' },
        { status: 422 },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const error = await createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    })
      .forWorkspace('workspace-1')
      .connectors.remove({ connectorInstanceId: 'connector-1' })
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ValedictorianHttpError)
    expect(error).not.toBeInstanceOf(ValedictorianProtocolError)
    expect(error).not.toBeInstanceOf(ConnectorRetirementConflictError)
    expect(error).toMatchObject({
      status: 422,
      body: null,
      message: valedictorianSafeRequestFailedMessage,
    })
  })
})
