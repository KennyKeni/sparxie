import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  LocalSecretResolutionHttpError,
  ValedictorianHttpError,
  ValedictorianProtocolError,
  createHttpValedictorianClient,
  createSecretReference,
  localSecretResolutionErrorBodies,
  valedictorianSafeRequestFailedMessage,
} from '../index.js'
import { jsonResponse } from './http-client.test-support.js'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('declared Retry-After classification flow', () => {
  it('attaches validated Retry-After on declared local-secret failures via request→mapper flow', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify(localSecretResolutionErrorBodies.secure_storage_unavailable),
        {
          headers: {
            'content-type': 'application/json',
            'retry-after': '45',
          },
          status: 503,
        },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const error = await createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    })
      .forWorkspace('workspace-1')
      .secrets.local.resolve({
        reference: createSecretReference('greenhouse_password'),
        purpose: { kind: 'subprocess_injection' },
      })
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(LocalSecretResolutionHttpError)
    expect(error).toMatchObject({
      status: 503,
      kind: 'unavailable',
      code: 'secure_storage_unavailable',
      retryAfter: { kind: 'delta-seconds', seconds: 45 },
      message: localSecretResolutionErrorBodies.secure_storage_unavailable.message,
    })
    expect(error).not.toHaveProperty('requestId')
  })

  it('maps invalid declared Retry-After headers to ValedictorianProtocolError', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify(localSecretResolutionErrorBodies.secure_storage_unavailable),
        {
          headers: {
            'content-type': 'application/json',
            'retry-after': 'not-a-retry-after',
          },
          status: 503,
        },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const error = await createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    })
      .forWorkspace('workspace-1')
      .secrets.local.resolve({
        reference: createSecretReference('greenhouse_password'),
        purpose: { kind: 'subprocess_injection' },
      })
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ValedictorianProtocolError)
    expect(error).toMatchObject({ message: valedictorianSafeRequestFailedMessage })
    expect(error).not.toBeInstanceOf(LocalSecretResolutionHttpError)
  })

  it('still omits Retry-After on undeclared generic failures that carry the header', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { code: 'rate_limited', message: 'canary-rate-secret' },
        {
          status: 429,
          headers: {
            'content-type': 'application/json',
            'retry-after': '45',
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
    expect(error).not.toBeInstanceOf(LocalSecretResolutionHttpError)
    expect(error).toMatchObject({ status: 429, body: null })
    expect(error).not.toHaveProperty('retryAfter')
    expect(error).not.toHaveProperty('requestId')
  })
})
