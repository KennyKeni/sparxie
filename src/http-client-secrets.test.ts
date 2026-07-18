import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ValedictorianProtocolError,
  createHttpValedictorianClient,
  createSecretReference,
  valedictorianApiPaths,
  valedictorianSafeRequestFailedMessage,
} from './index.js'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function noStoreJsonResponse(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers)
  if (!headers.has('content-type')) headers.set('content-type', 'application/json')
  if (!headers.has('cache-control')) headers.set('cache-control', 'no-store')
  return new Response(JSON.stringify(body), {
    ...init,
    headers,
    status: init.status ?? 200,
  })
}

describe('local secret resolution HTTP success contract', () => {
  it('exposes secretsLocalResolve and posts authenticated workspace local resolve with no-store', async () => {
    expect(valedictorianApiPaths.secretsLocalResolve).toBe('/v1/secrets/local/resolve')

    const resultBody = {
      value: 'fixture-resolved-value',
      handling: { cache: 'no-store', sensitivity: 'secret' },
    }
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(noStoreJsonResponse(resultBody))
    vi.stubGlobal('fetch', fetchMock)

    const client = createHttpValedictorianClient({
      baseUrl: 'http://127.0.0.1:4317',
      token: 'workspace-token',
    })
    const workspace = client.forWorkspace('workspace-1')
    const input = {
      reference: createSecretReference('connector_jobright/password'),
      purpose: { kind: 'subprocess_injection' as const },
    }

    await expect(workspace.secrets.local.resolve(input)).resolves.toEqual(resultBody)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:4317/v1/workspaces/workspace-1/secrets/local/resolve',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          accept: 'application/json',
          authorization: 'Bearer workspace-token',
          'cache-control': 'no-store',
          'content-type': 'application/json',
        }) as Record<string, string>,
        body: JSON.stringify(input),
      }),
    )
    expect(client).not.toHaveProperty('secrets')
    expect(workspace.secrets).toHaveProperty('list')
    expect(workspace.secrets).toHaveProperty('upsert')
    expect(workspace.secrets).toHaveProperty('delete')
    expect(workspace.secrets).not.toHaveProperty('get')
    expect(workspace.secrets).not.toHaveProperty('reveal')
    expect(workspace.secrets).not.toHaveProperty('query')
    expect(workspace.secrets.local).not.toHaveProperty('get')
    expect(workspace.secrets.local).not.toHaveProperty('query')
  })

  it('rejects invalid input before fetch and rejects success bodies missing response no-store without reading them', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    const bodyText = JSON.stringify({
      value: 'must-not-be-read',
      handling: { cache: 'no-store', sensitivity: 'secret' },
    })
    let bodyRead = false
    const missingNoStore = new Response(bodyText, {
      headers: { 'content-type': 'application/json', 'cache-control': 'private' },
      status: 200,
    })
    const originalText = missingNoStore.text.bind(missingNoStore)
    missingNoStore.text = async () => {
      bodyRead = true
      return originalText()
    }
    const originalJson = missingNoStore.json.bind(missingNoStore)
    missingNoStore.json = async () => {
      bodyRead = true
      return originalJson()
    }
    fetchMock.mockResolvedValueOnce(missingNoStore)
    vi.stubGlobal('fetch', fetchMock)
    const workspace = createHttpValedictorianClient({
      baseUrl: 'http://127.0.0.1:4317',
    }).forWorkspace('workspace-1')

    await expect(
      workspace.secrets.local.resolve({
        reference: createSecretReference('ok'),
        purpose: { kind: 'browser_fill' as never },
      }),
    ).rejects.toThrow()
    expect(fetchMock).not.toHaveBeenCalled()

    await expect(
      workspace.secrets.local.resolve({
        reference: createSecretReference('ok'),
        purpose: { kind: 'subprocess_injection' },
      }),
    ).rejects.toThrow('Request failed')
    expect(bodyRead).toBe(false)

    fetchMock.mockResolvedValueOnce(
      noStoreJsonResponse({
        value: 'fixture-resolved-value',
        handling: { cache: 'private', sensitivity: 'secret' },
      }),
    )
    await expect(
      workspace.secrets.local.resolve({
        reference: createSecretReference('ok'),
        purpose: { kind: 'subprocess_injection' },
      }),
    ).rejects.toThrow()
  })

  it('accepts case-insensitive Cache-Control directives that include no-store', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(
      noStoreJsonResponse(
        {
          value: 'fixture-resolved-value',
          handling: { cache: 'no-store', sensitivity: 'secret' },
        },
        { headers: { 'cache-control': 'Private, No-Store, max-age=0' } },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)
    const workspace = createHttpValedictorianClient({
      baseUrl: 'http://127.0.0.1:4317',
    }).forWorkspace('workspace-1')

    await expect(
      workspace.secrets.local.resolve({
        reference: createSecretReference('ok'),
        purpose: { kind: 'subprocess_injection' },
      }),
    ).resolves.toEqual({
      value: 'fixture-resolved-value',
      handling: { cache: 'no-store', sensitivity: 'secret' },
    })
  })

  it('rejects fail-closed Cache-Control forms that are not a bare top-level no-store', async () => {
    const canaryBody = {
      value: 'canary-must-not-be-read',
      handling: { cache: 'no-store', sensitivity: 'secret' },
    }
    const rejectedHeaders = [
      'foo="x, no-store, y"',
      'no-store=false',
      'no-store; foo',
      'private, no-store="false"',
      'foo="unclosed',
    ]

    for (const cacheControl of rejectedHeaders) {
      const bodyText = JSON.stringify(canaryBody)
      let bodyRead = false
      const response = new Response(bodyText, {
        headers: {
          'cache-control': cacheControl,
          'content-type': 'application/json',
        },
        status: 200,
      })
      const originalText = response.text.bind(response)
      response.text = async () => {
        bodyRead = true
        return originalText()
      }
      const originalJson = response.json.bind(response)
      response.json = async () => {
        bodyRead = true
        return originalJson()
      }

      const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      fetchMock.mockResolvedValueOnce(response)
      vi.stubGlobal('fetch', fetchMock)
      const workspace = createHttpValedictorianClient({
        baseUrl: 'http://127.0.0.1:4317',
      }).forWorkspace('workspace-1')

      const error = await workspace.secrets.local
        .resolve({
          reference: createSecretReference('ok'),
          purpose: { kind: 'subprocess_injection' },
        })
        .catch((caught: unknown) => caught)

      expect(error).toBeInstanceOf(ValedictorianProtocolError)
      expect(error).toMatchObject({ message: valedictorianSafeRequestFailedMessage })
      expect(bodyRead).toBe(false)
      expect(String(error)).not.toContain('canary-')
      expect(JSON.stringify(error)).not.toContain('canary-')
    }
  })

  it('scrubs malformed success results without leaking response-derived canaries', async () => {
    const canaryKey = 'canary-unknown-field-name'
    const canaryValue = 'canary-resolved-plaintext'
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(
      noStoreJsonResponse({
        value: canaryValue,
        handling: { cache: 'no-store', sensitivity: 'secret' },
        [canaryKey]: 'canary-extra-property-value',
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const workspace = createHttpValedictorianClient({
      baseUrl: 'http://127.0.0.1:4317',
    }).forWorkspace('workspace-1')

    const error = await workspace.secrets.local
      .resolve({
        reference: createSecretReference('ok'),
        purpose: { kind: 'subprocess_injection' },
      })
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(Error)
    expect(error).not.toHaveProperty('issues')
    expect(error).not.toHaveProperty('body')
    for (const surface of [
      String(error),
      error instanceof Error ? error.message : '',
      JSON.stringify(error),
      'issues' in (error as object) ? JSON.stringify((error as { issues: unknown }).issues) : '',
    ]) {
      expect(surface).not.toContain('canary-')
    }
  })
})
