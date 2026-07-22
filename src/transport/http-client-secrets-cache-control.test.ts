import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ValedictorianProtocolError,
  createHttpValedictorianClient,
  createSecretReference,
  valedictorianSafeRequestFailedMessage,
} from '../index.js'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('local-secret Cache-Control response contract', () => {
  it('maps missing no-store on 2xx local-secret responses to ValedictorianProtocolError', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          value: 'canary-secret-value',
          handling: { cache: 'no-store', sensitivity: 'secret' },
        }),
        {
          headers: { 'content-type': 'application/json' },
          status: 200,
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
    expect(JSON.stringify(error)).not.toContain('canary-secret-value')
    expect(String(error)).not.toContain('canary-secret-value')
  })
})
