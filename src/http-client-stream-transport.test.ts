import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createHttpValedictorianClient,
  createSecretReference,
  ValedictorianHttpError,
  ValedictorianSourceHttpClient,
  ValedictorianTransportError,
  valedictorianSafeRequestFailedMessage,
} from './index.js'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function responseWithTextFailure(cause: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers({ 'content-type': 'application/json' }),
    text: async () => {
      throw cause
    },
  } as unknown as Response
}

describe('response body stream transport classification', () => {
  it('wraps main-client response.text failures as ValedictorianTransportError', async () => {
    const cause = new TypeError('Body stream failed: canary-stream-secret')
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(responseWithTextFailure(cause))
    vi.stubGlobal('fetch', fetchMock)

    const error = await createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    })
      .health.get()
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ValedictorianTransportError)
    expect(error).not.toBeInstanceOf(ValedictorianHttpError)
    expect(error).toMatchObject({ message: valedictorianSafeRequestFailedMessage })
    expect((error as ValedictorianTransportError).cause).toBe(cause)
    expect(Object.keys(error as object)).not.toContain('cause')
    expect(JSON.stringify(error)).not.toContain('canary-stream-secret')
    expect(String(error)).not.toContain('canary-stream-secret')
  })

  it('wraps an uncorrelated AbortError from response.text on the main client', async () => {
    const abortError = new DOMException('The operation was aborted.', 'AbortError')
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(responseWithTextFailure(abortError))
    vi.stubGlobal('fetch', fetchMock)

    const caught = await createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    })
      .health.get()
      .catch((error: unknown) => error)

    expect(caught).toBeInstanceOf(ValedictorianTransportError)
    expect((caught as ValedictorianTransportError).cause).toBe(abortError)
  })

  it('wraps source-client response.text failures as ValedictorianTransportError', async () => {
    const cause = new TypeError('source body failed: canary-source-stream')
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(responseWithTextFailure(cause))

    const error = await new ValedictorianSourceHttpClient({
      baseUrl: 'https://source.test/',
      fetch: fetchMock,
      token: 'reader-token',
    })
      .listJobs()
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ValedictorianTransportError)
    expect(error).toMatchObject({ message: valedictorianSafeRequestFailedMessage })
    expect(JSON.stringify(error)).not.toContain('canary-source-stream')
    expect(String(error)).not.toContain('canary-source-stream')
  })

  it('wraps source-client response.text AbortError without a caller signal', async () => {
    const abortError = new DOMException('source stream aborted: canary-source-abort', 'AbortError')
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(responseWithTextFailure(abortError))

    const error = await new ValedictorianSourceHttpClient({
      baseUrl: 'https://source.test/',
      fetch: fetchMock,
      token: 'reader-token',
    })
      .listJobs()
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ValedictorianTransportError)
    expect((error as ValedictorianTransportError).cause).toBe(abortError)
    expect(String(error)).not.toContain('canary-source-abort')
  })

  it('wraps local-secret response.text failures as ValedictorianTransportError', async () => {
    const cause = new TypeError('secret body failed: canary-secret-stream')
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 503,
      headers: new Headers({
        'cache-control': 'no-store',
        'content-type': 'application/json',
      }),
      text: async () => {
        throw cause
      },
    } as unknown as Response)
    vi.stubGlobal('fetch', fetchMock)

    const error = await createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    })
      .forWorkspace('workspace-1')
      .secrets.local.resolve({
        reference: createSecretReference('connector_jobright/password'),
        purpose: { kind: 'subprocess_injection' },
      })
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ValedictorianTransportError)
    expect(error).not.toBeInstanceOf(ValedictorianHttpError)
    expect(JSON.stringify(error)).not.toContain('canary-secret-stream')
    expect(String(error)).not.toContain('canary-secret-stream')
  })

  it('wraps local-secret fetch AbortError without a caller signal', async () => {
    const abortError = new DOMException('secret fetch aborted: canary-secret-abort', 'AbortError')
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockRejectedValueOnce(abortError)
    vi.stubGlobal('fetch', fetchMock)

    const error = await createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    })
      .forWorkspace('workspace-1')
      .secrets.local.resolve({
        reference: createSecretReference('connector_jobright/password'),
        purpose: { kind: 'subprocess_injection' },
      })
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ValedictorianTransportError)
    expect((error as ValedictorianTransportError).cause).toBe(abortError)
    expect(String(error)).not.toContain('canary-secret-abort')
  })
})
