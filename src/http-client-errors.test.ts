import { describe, expect, it, vi } from 'vitest'
import {
  createHttpValedictorianClient,
  InvalidPersistedRawDetailHttpError,
  invalidPersistedRawDetailErrorBody,
  ValedictorianHttpError,
  ValedictorianProtocolError,
  ValedictorianTransportError,
} from './index.js'
import { jsonResponse } from './http-client.test-support.js'

describe('typed HTTP error handling', () => {
  it('preserves a persisted raw-detail integrity status and canonical body', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(
      jsonResponse(invalidPersistedRawDetailErrorBody, { status: 503 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const rawRecords = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    }).forWorkspace('workspace-1').sourcing.rawRecords

    const error = await rawRecords.get('raw-1').catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(InvalidPersistedRawDetailHttpError)
    expect(error).toMatchObject({
      status: 503,
      body: invalidPersistedRawDetailErrorBody,
      message: invalidPersistedRawDetailErrorBody.message,
    })
  })

  it('safely rejects a malformed integrity body as a protocol failure', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        code: invalidPersistedRawDetailErrorBody.code,
        message: 'payload.password: expected string',
        validation: { rawPayload: 'secret' },
      }, { status: 500 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const rawRecords = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    }).forWorkspace('workspace-1').sourcing.rawRecords

    const error = await rawRecords.get('raw-1').catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ValedictorianProtocolError)
    expect(error).not.toBeInstanceOf(InvalidPersistedRawDetailHttpError)
    expect(error).not.toBeInstanceOf(ValedictorianHttpError)
    expect(JSON.stringify(error)).not.toContain('password')
    expect(String(error)).not.toContain('password')
    expect(JSON.stringify(error)).not.toContain('secret')
  })

  it('keeps an unrelated server failure generic and scrubbed', async () => {
    const body = { code: 'database_unavailable', message: 'Database unavailable.' }
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(jsonResponse(body, { status: 502 }))
    vi.stubGlobal('fetch', fetchMock)
    const rawRecords = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    }).forWorkspace('workspace-1').sourcing.rawRecords

    const error = await rawRecords.get('raw-1').catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ValedictorianHttpError)
    expect(error).not.toBeInstanceOf(InvalidPersistedRawDetailHttpError)
    expect(error).toMatchObject({ status: 502, body: null, message: 'Request failed' })
    expect(JSON.stringify(error)).not.toContain('database_unavailable')
    expect(String(error)).not.toContain('Database unavailable')
  })

  it('does not classify a client error as persisted-data corruption', async () => {
    const body = { code: 'invalid_request', message: 'Invalid request.' }
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(jsonResponse(body, { status: 400 }))
    vi.stubGlobal('fetch', fetchMock)
    const rawRecords = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    }).forWorkspace('workspace-1').sourcing.rawRecords

    const error = await rawRecords.get('raw-1').catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ValedictorianHttpError)
    expect(error).not.toBeInstanceOf(InvalidPersistedRawDetailHttpError)
    expect(error).toMatchObject({ status: 400, body: null, message: 'Request failed' })
  })

  it('wraps transport failures as ValedictorianTransportError', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'))
    vi.stubGlobal('fetch', fetchMock)
    const rawRecords = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    }).forWorkspace('workspace-1').sourcing.rawRecords

    const error = await rawRecords.get('raw-1').catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ValedictorianTransportError)
    expect(error).not.toBeInstanceOf(ValedictorianHttpError)
    expect(error).not.toBeInstanceOf(InvalidPersistedRawDetailHttpError)
  })
})
