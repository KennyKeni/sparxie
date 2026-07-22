import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ConnectorCreateHttpError,
  ConnectorScheduleHttpError,
  SourceIngestionHttpError,
  ValedictorianHttpError,
  ValedictorianProtocolError,
  ValedictorianSourceHttpClient,
  createHttpValedictorianClient,
  valedictorianFailureKindMessages,
  valedictorianInternalErrorBodySchema,
  valedictorianInternalErrorCode,
  valedictorianInternalErrorKind,
  valedictorianInternalErrorStatus,
} from './index.js'
import { jsonResponse } from './transport/http-client.test-support.js'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const body = {
  code: 'internal_error',
  message: valedictorianFailureKindMessages.internal,
  requestId: 'req_internal_01',
} as const

describe('shared internal failure contract', () => {
  it('exports the fixed strict contract', () => {
    expect(valedictorianInternalErrorCode).toBe('internal_error')
    expect(valedictorianInternalErrorStatus).toBe(500)
    expect(valedictorianInternalErrorKind).toBe('internal')
    expect(valedictorianInternalErrorBodySchema.parse(body)).toEqual(body)

    for (const malformed of [
      { ...body, message: 'database password leaked' },
      { ...body, requestId: 'has space' },
      { ...body, diagnostic: 'SELECT secret' },
      { code: body.code, message: body.message },
    ]) {
      expect(valedictorianInternalErrorBodySchema.safeParse(malformed).success).toBe(false)
    }
  })

  it('preserves a canonical internal failure through the generic workspace client', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(jsonResponse(body, { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)

    const error = await createHttpValedictorianClient({ baseUrl: 'https://api.test/' })
      .health.get()
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ValedictorianHttpError)
    expect(error).toMatchObject({
      body,
      kind: 'internal',
      message: body.message,
      requestId: body.requestId,
      status: 500,
    })
  })

  it('preserves a canonical internal failure through the source client', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(jsonResponse(body, { status: 500 }))
    const client = new ValedictorianSourceHttpClient({
      baseUrl: 'https://source.test/',
      fetch: fetchMock,
      token: 'reader',
    })

    const error = await client.listCompanies().catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ValedictorianHttpError)
    expect(error).toBeInstanceOf(SourceIngestionHttpError)
    expect(error).toMatchObject({
      body,
      kind: 'internal',
      requestId: body.requestId,
      status: 500,
    })
  })

  it('does not discard a validated internal failure in a capability rethrow path', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(jsonResponse(body, { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)
    const schedules = createHttpValedictorianClient({ baseUrl: 'https://api.test/' })
      .forWorkspace('workspace-1').connectors.schedules

    const error = await schedules.upsert({
      cadence: { everyMinutes: 60, kind: 'interval' },
      connectorInstanceId: 'connector-1',
      expectedRevision: null,
      state: 'enabled',
      timezone: 'UTC',
    }).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ValedictorianHttpError)
    expect(error).not.toBeInstanceOf(ConnectorScheduleHttpError)
    expect(error).toMatchObject({ body, kind: 'internal', requestId: body.requestId })
  })

  it('does not discard a validated internal failure in the connector create rethrow path', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(jsonResponse(body, { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)

    const error = await createHttpValedictorianClient({ baseUrl: 'https://api.test/' })
      .forWorkspace('workspace-1')
      .connectors.create({
        id: 'jobright-a',
        connectorId: 'jobright.resolver',
        connectorVersion: '0.16.0',
        displayName: 'Jobright',
        enabled: true,
      })
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ValedictorianHttpError)
    expect(error).not.toBeInstanceOf(ConnectorCreateHttpError)
    expect(error).toMatchObject({ body, kind: 'internal', requestId: body.requestId })
  })

  it.each([
    [{ ...body, message: 'canary provider diagnostics' }, 500],
    [{ ...body, requestId: 'bad request id' }, 500],
    [{ ...body, stack: 'canary stack' }, 500],
    [body, 503],
  ])('maps malformed or status-inconsistent internal bodies to protocol failures', async (
    responseBody,
    status,
  ) => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(jsonResponse(responseBody, { status }))
    vi.stubGlobal('fetch', fetchMock)

    const error = await createHttpValedictorianClient({ baseUrl: 'https://api.test/' })
      .health.get()
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ValedictorianProtocolError)
    expect(error).not.toBeInstanceOf(ValedictorianHttpError)
    expect(JSON.stringify(error)).not.toContain('canary')
    expect(String(error)).not.toContain('canary')
  })

  it('rejects a malformed internal body through the source client too', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(jsonResponse({
      ...body,
      requestId: 'bad request id',
      diagnostic: 'source provider canary',
    }, { status: 500 }))
    const client = new ValedictorianSourceHttpClient({
      baseUrl: 'https://source.test/',
      fetch: fetchMock,
      token: 'reader',
    })

    const error = await client.listCompanies().catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ValedictorianProtocolError)
    expect(error).not.toBeInstanceOf(ValedictorianHttpError)
    expect(JSON.stringify(error)).not.toContain('provider canary')
    expect(String(error)).not.toContain('provider canary')
  })

  it('keeps an unknown error code fail closed', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(jsonResponse({
      code: 'provider_internal_error',
      message: 'canary upstream trace',
      requestId: body.requestId,
    }, { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)

    const error = await createHttpValedictorianClient({ baseUrl: 'https://api.test/' })
      .health.get()
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ValedictorianHttpError)
    expect(error).toMatchObject({ body: null, message: 'Request failed', status: 500 })
    expect(error).not.toHaveProperty('requestId')
    expect(JSON.stringify(error)).not.toContain('canary')
  })
})
