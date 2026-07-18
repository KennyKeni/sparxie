import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createHttpValedictorianClient,
  ValedictorianHttpError,
  ValedictorianProtocolError,
  ValedictorianTransportError,
  valedictorianSafeRequestFailedMessage,
} from './index.js'
import { jsonResponse } from './http-client.test-support.js'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('generic HTTP client fail-closed failures', () => {
  it('scrubs unknown non-2xx bodies to a safe HTTP failure without raw content', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          code: 'database_unavailable',
          message: 'canary-raw-db-secret leaked',
          detail: 'SELECT * FROM secrets',
        },
        { status: 503 },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const error = await createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    })
      .health.get()
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ValedictorianHttpError)
    expect(error).not.toBeInstanceOf(ValedictorianTransportError)
    expect(error).not.toBeInstanceOf(ValedictorianProtocolError)
    expect(error).toMatchObject({
      status: 503,
      body: null,
      message: valedictorianSafeRequestFailedMessage,
    })
    expect(JSON.stringify(error)).not.toContain('canary-raw-db-secret')
    expect(String(error)).not.toContain('canary-raw-db-secret')
    expect(JSON.stringify(error)).not.toContain('SELECT')
  })

  it('wraps no-response fetch failures as transport errors without leaking causes', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed: canary-transport-secret'))
    vi.stubGlobal('fetch', fetchMock)

    const error = await createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    })
      .health.get()
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ValedictorianTransportError)
    expect(error).not.toBeInstanceOf(ValedictorianHttpError)
    expect(error).toMatchObject({ message: valedictorianSafeRequestFailedMessage })
    expect(JSON.stringify(error)).not.toContain('canary-transport-secret')
    expect(String(error)).not.toContain('canary-transport-secret')
  })

  it('wraps an uncorrelated fetch AbortError as a transport failure', async () => {
    const abortError = new DOMException('The operation was aborted.', 'AbortError')
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockRejectedValueOnce(abortError)
    vi.stubGlobal('fetch', fetchMock)

    const caught = await createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    })
      .health.get()
      .catch((error: unknown) => error)

    expect(caught).toBeInstanceOf(ValedictorianTransportError)
    expect((caught as ValedictorianTransportError).cause).toBe(abortError)
    expect(caught).not.toBeInstanceOf(ValedictorianHttpError)
  })

  it('does not retain request identity or Retry-After from unknown unvalidated responses', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 'rate_limited',
          message: 'canary-rate-secret',
          requestId: 'req_01SAFE',
        }),
        {
          headers: {
            'content-type': 'application/json',
            'retry-after': '45',
          },
          status: 429,
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
      status: 429,
      body: null,
      message: valedictorianSafeRequestFailedMessage,
    })
    expect(error).not.toHaveProperty('requestId')
    expect(error).not.toHaveProperty('retryAfter')
    expect(JSON.stringify(error)).not.toContain('canary-rate-secret')
    expect(String(error)).not.toContain('canary-rate-secret')
    expect(JSON.stringify(error)).not.toContain('req_01SAFE')
  })

  it('ignores invalid request identity and malformed Retry-After values on unknown responses', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 'rate_limited',
          message: 'slow down',
          requestId: 'has space',
        }),
        {
          headers: {
            'content-type': 'application/json',
            'retry-after': 'soon',
          },
          status: 429,
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
    expect(error).toMatchObject({ status: 429, body: null })
    expect(error).not.toHaveProperty('requestId')
    expect(error).not.toHaveProperty('retryAfter')
  })
})
