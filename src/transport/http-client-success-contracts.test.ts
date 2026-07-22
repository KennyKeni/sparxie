import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createHttpValedictorianClient,
  ValedictorianProtocolError,
  ValedictorianSourceHttpClient,
  valedictorianSafeRequestFailedMessage,
} from '../index.js'
import { jsonResponse } from './http-client.test-support.js'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('declared successful response contract validation', () => {
  it('maps malformed health 2xx payloads to ValedictorianProtocolError', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ ok: 'canary-health-secret' }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const error = await createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    })
      .health.get()
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ValedictorianProtocolError)
    expect(error).toMatchObject({ message: valedictorianSafeRequestFailedMessage })
    expect(JSON.stringify(error)).not.toContain('canary-health-secret')
    expect(String(error)).not.toContain('canary-health-secret')
  })

  it('maps malformed source listJobs 2xx payloads to ValedictorianProtocolError', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ jobs: 'canary-source-secret', pagination: null }),
    )

    const error = await new ValedictorianSourceHttpClient({
      baseUrl: 'https://source.test/',
      fetch: fetchMock,
      token: 'reader-token',
    })
      .listJobs()
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ValedictorianProtocolError)
    expect(error).toMatchObject({ message: valedictorianSafeRequestFailedMessage })
    expect(JSON.stringify(error)).not.toContain('canary-source-secret')
    expect(String(error)).not.toContain('canary-source-secret')
  })

  it('maps malformed workspace list 2xx payloads to ValedictorianProtocolError', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ items: 'canary-workspace-secret' }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const error = await createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    })
      .workspaces.list()
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ValedictorianProtocolError)
    expect(error).toMatchObject({ message: valedictorianSafeRequestFailedMessage })
    expect(JSON.stringify(error)).not.toContain('canary-workspace-secret')
    expect(String(error)).not.toContain('canary-workspace-secret')
  })
})
