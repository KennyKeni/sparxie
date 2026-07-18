import { afterEach, describe, expect, it, vi } from 'vitest'
import * as Sparxie from './index.js'
import {
  createHttpValedictorianClient,
  createSecretReference,
  localSecretResolutionErrorBodies,
  localSecretResolutionErrorCodes,
  localSecretResolutionErrorStatusByCode,
  LocalSecretResolutionHttpError,
  ValedictorianHttpError,
  ValedictorianProtocolError,
  ValedictorianTransportError,
} from './index.js'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function noStoreErrorResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json',
    },
    status,
  })
}

function resolveInput() {
  return {
    reference: createSecretReference('connector_jobright/password'),
    purpose: { kind: 'subprocess_injection' as const },
  }
}

function workspaceSecrets(workspaceId = 'workspace-1') {
  return createHttpValedictorianClient({
    baseUrl: 'http://127.0.0.1:4317',
  }).forWorkspace(workspaceId).secrets
}

describe('local secret resolution HTTP errors', () => {
  it('maps every exact closed error to LocalSecretResolutionHttpError', async () => {
    const errorConstructor = Reflect.get(Sparxie, 'LocalSecretResolutionHttpError')
    expect(errorConstructor).toBeTypeOf('function')

    for (const code of localSecretResolutionErrorCodes) {
      const canonicalBody = localSecretResolutionErrorBodies[code]
      const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      fetchMock.mockResolvedValueOnce(
        noStoreErrorResponse(canonicalBody, localSecretResolutionErrorStatusByCode[code]),
      )
      vi.stubGlobal('fetch', fetchMock)

      const error = await workspaceSecrets().local
        .resolve(resolveInput())
        .catch((caught: unknown) => caught)

      expect(error).toBeInstanceOf(errorConstructor)
      expect(error).toBeInstanceOf(LocalSecretResolutionHttpError)
      expect(error).toMatchObject({
        body: canonicalBody,
        code,
        message: canonicalBody.message,
        status: localSecretResolutionErrorStatusByCode[code],
      })
      expect(JSON.stringify(error)).not.toMatch(/fixture|password=|token=/i)
    }
  })

  it('scrubs malformed recognized bodies and status mismatches to a protocol failure', async () => {
    const code = 'secret_not_found'
    const canonicalBody = localSecretResolutionErrorBodies[code]
    const malformedBodies = [
      { ...canonicalBody, message: 'missing password greenhouse_password' },
      ...['secret', 'value', 'detail', 'password', 'token'].map((field) => ({
        ...canonicalBody,
        [field]: `canary-${field}`,
      })),
      { code },
    ]
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    for (const body of malformedBodies) {
      fetchMock.mockResolvedValueOnce(noStoreErrorResponse(body, 404))
    }
    fetchMock.mockResolvedValueOnce(noStoreErrorResponse(canonicalBody, 409))
    vi.stubGlobal('fetch', fetchMock)
    const local = workspaceSecrets().local

    for (const _body of [...malformedBodies, canonicalBody]) {
      const error = await local.resolve(resolveInput()).catch((caught: unknown) => caught)
      expect(error).toBeInstanceOf(ValedictorianProtocolError)
      expect(error).not.toBeInstanceOf(LocalSecretResolutionHttpError)
      expect(error).not.toBeInstanceOf(ValedictorianHttpError)
      expect(JSON.stringify(error)).not.toContain('canary-')
      expect(String(error)).not.toContain('password')
    }
  })

  it('scrubs unrecognized resolve HTTP errors to a value-free generic failure', async () => {
    const body = {
      code: 'database_unavailable',
      message: 'resolved value canary-plaintext leaked',
      value: 'canary-resolved-secret',
      secret: 'canary-secret-field',
    }
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(noStoreErrorResponse(body, 503))
    vi.stubGlobal('fetch', fetchMock)

    const error = await workspaceSecrets().local
      .resolve(resolveInput())
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ValedictorianHttpError)
    expect(error).not.toBeInstanceOf(LocalSecretResolutionHttpError)
    expect(error).toMatchObject({ body: null, message: 'Request failed', status: 503 })
    expect(error).not.toHaveProperty('code')
    expect(JSON.stringify(error)).not.toContain('canary-')
    expect(String(error)).not.toContain('canary-')
  })

  it('preserves non-HTTP transport failures as ValedictorianTransportError without leaking causes', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed: canary-transport'))
    vi.stubGlobal('fetch', fetchMock)

    const error = await workspaceSecrets().local
      .resolve(resolveInput())
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ValedictorianTransportError)
    expect(error).not.toBeInstanceOf(ValedictorianHttpError)
    expect(JSON.stringify(error)).not.toContain('canary-transport')
    expect(String(error)).not.toContain('canary-transport')
  })

  it('scrubs a canonical closed error body returned with a 2xx status', async () => {
    const canonicalBody = localSecretResolutionErrorBodies.secret_not_found
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(noStoreErrorResponse(canonicalBody, 200))
    vi.stubGlobal('fetch', fetchMock)

    const error = await workspaceSecrets().local
      .resolve(resolveInput())
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ValedictorianProtocolError)
    expect(error).not.toBeInstanceOf(LocalSecretResolutionHttpError)
    expect(error).not.toBeInstanceOf(ValedictorianHttpError)
    expect(JSON.stringify(error)).not.toContain('secret_not_found')
    expect(String(error)).not.toContain(canonicalBody.message)
  })
})
