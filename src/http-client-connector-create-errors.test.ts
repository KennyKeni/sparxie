import { afterEach, describe, expect, it, vi } from 'vitest'
import * as Sparxie from './index.js'
import {
  ConnectorCreateHttpError,
  connectorCreateErrorBodies,
  connectorCreateErrorCodes,
  connectorCreateErrorKindByCode,
  connectorCreateErrorStatusByCode,
  createHttpValedictorianClient,
  ValedictorianHttpError,
  ValedictorianProtocolError,
} from './index.js'
import { jsonResponse } from './http-client.test-support.js'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const createInput = {
  id: 'jobright-a',
  connectorId: 'jobright.resolver',
  connectorVersion: '0.16.0',
  displayName: 'Jobright',
  enabled: true,
}

describe('HTTP connector create already_configured errors', () => {
  it('does not export the create-error rethrow helper from the package root', () => {
    expect(Sparxie).not.toHaveProperty('rethrowConnectorCreateError')
    expect(Sparxie).toHaveProperty('ConnectorCreateHttpError')
    expect(Sparxie).toHaveProperty('connectorCreateErrorBodies')
    expect(Sparxie).toHaveProperty('connectorCreateErrorStatusByCode')
    expect(Sparxie).toHaveProperty('connectorCreateErrorKindByCode')
  })

  it('preserves the validated already_configured body on connector create', async () => {
    const code = 'already_configured'
    const canonicalBody = connectorCreateErrorBodies[code]
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(
      jsonResponse(canonicalBody, {
        status: connectorCreateErrorStatusByCode[code],
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const error = await createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    })
      .forWorkspace('workspace-1')
      .connectors.create(createInput)
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ConnectorCreateHttpError)
    expect(error).toMatchObject({
      body: canonicalBody,
      code,
      kind: connectorCreateErrorKindByCode[code],
      message: canonicalBody.message,
      status: 409,
    })
    expect(connectorCreateErrorCodes).toEqual(['already_configured'])
  })

  it('maps noncanonical messages and status mismatches to ValedictorianProtocolError', async () => {
    const code = 'already_configured'
    const canonicalBody = connectorCreateErrorBodies[code]
    const malformedBodies = [
      { ...canonicalBody, message: 'connector database key canary' },
      ...['secret', 'detail', 'stack', 'connectorId'].map((field) => ({
        ...canonicalBody,
        [field]: `canary-${field}`,
      })),
      { code },
    ]
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    for (const body of malformedBodies) {
      fetchMock.mockResolvedValueOnce(jsonResponse(body, { status: 409 }))
    }
    fetchMock.mockResolvedValueOnce(jsonResponse(canonicalBody, { status: 418 }))
    vi.stubGlobal('fetch', fetchMock)
    const create = () =>
      createHttpValedictorianClient({
        baseUrl: 'https://valedictorian.test',
      })
        .forWorkspace('workspace-1')
        .connectors.create(createInput)

    for (const _body of [...malformedBodies, canonicalBody]) {
      const error = await create().catch((caught: unknown) => caught)
      expect(error).toBeInstanceOf(ValedictorianProtocolError)
      expect(error).not.toBeInstanceOf(ConnectorCreateHttpError)
      expect(error).not.toBeInstanceOf(ValedictorianHttpError)
      expect(JSON.stringify(error)).not.toContain('canary-')
      expect(String(error)).not.toContain('database key')
    }
  })

  it('scrubs unrecognized create HTTP failures to a safe generic client error', async () => {
    const body = {
      code: 'database_unavailable',
      message: 'create canary-plaintext leaked',
      detail: 'SELECT password FROM connectors',
    }
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(jsonResponse(body, { status: 503 }))
    vi.stubGlobal('fetch', fetchMock)

    const error = await createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    })
      .forWorkspace('workspace-1')
      .connectors.create(createInput)
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ValedictorianHttpError)
    expect(error).not.toBeInstanceOf(ConnectorCreateHttpError)
    expect(error).toMatchObject({ body: null, message: 'Request failed', status: 503 })
    expect(error).not.toHaveProperty('code')
    expect(JSON.stringify(error)).not.toContain('canary-')
    expect(String(error)).not.toContain('canary-')
    expect(JSON.stringify(error)).not.toContain('password')
  })
})
