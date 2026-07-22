import { afterEach, describe, expect, it, vi } from 'vitest'
import * as Sparxie from '../index.js'
import {
  createHttpValedictorianClient,
  ValedictorianHttpError,
  valedictorianSafeRequestFailedMessage,
} from '../index.js'
import { jsonResponse } from './http-client.test-support.js'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('fail-closed body bridge encapsulation', () => {
  it('does not export internal response-body bridge helpers from the package root', () => {
    expect(Sparxie).not.toHaveProperty('attachHttpErrorResponseBody')
    expect(Sparxie).not.toHaveProperty('getHttpErrorResponseBody')
    expect(Sparxie).not.toHaveProperty('createFailClosedHttpError')
    expect(Sparxie).not.toHaveProperty('rethrowConnectorScheduleError')
    expect(Sparxie).not.toHaveProperty('rethrowConnectorCreateError')
    expect(Sparxie).toHaveProperty('ConnectorScheduleHttpError')
    expect(Sparxie).toHaveProperty('ConnectorCreateHttpError')
    expect(Sparxie).toHaveProperty('connectorScheduleErrorBodies')
    expect(Sparxie).toHaveProperty('connectorCreateErrorBodies')
    expect(Sparxie).toHaveProperty('connectorScheduleErrorStatusByCode')
    expect(Sparxie).toHaveProperty('connectorCreateErrorStatusByCode')
    expect(Sparxie).toHaveProperty('connectorScheduleErrorKindByCode')
    expect(Sparxie).toHaveProperty('connectorCreateErrorKindByCode')
  })

  it('does not leak unvalidated bodies through message, string, JSON, or cause', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          code: 'database_unavailable',
          message: 'canary-bridge-secret',
          requestId: 'req_CANARY',
          detail: 'SELECT password FROM secrets',
        },
        {
          status: 503,
          headers: {
            'content-type': 'application/json',
            'retry-after': '12',
          },
        },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const error = await createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    })
      .health.get()
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ValedictorianHttpError)
    expect(error).toMatchObject({
      body: null,
      message: valedictorianSafeRequestFailedMessage,
      status: 503,
    })
    expect(error).not.toHaveProperty('requestId')
    expect(error).not.toHaveProperty('retryAfter')
    expect(error).not.toHaveProperty('cause')
    expect(Object.keys(error as object)).not.toContain('cause')
    expect(JSON.stringify(error)).not.toContain('canary-bridge-secret')
    expect(String(error)).not.toContain('canary-bridge-secret')
    expect(JSON.stringify(error)).not.toContain('req_CANARY')
    expect(JSON.stringify(error)).not.toContain('password')
    expect(JSON.stringify(error)).not.toContain('SELECT')
  })
})
