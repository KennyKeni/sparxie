import { afterEach, describe, expect, it, vi } from 'vitest'
import * as Sparxie from './index.js'
import {
  connectorOptionQueryErrorBodies,
  connectorOptionQueryErrorCodes,
  connectorOptionQueryErrorStatusByCode,
  createHttpValedictorianClient,
  ValedictorianHttpError,
} from './index.js'
import { jsonResponse, mockFetch } from './http-client.test-support.js'

const descriptor = {
  connectorId: 'jobright.resolver',
  connectorVersion: '0.13.0',
  displayName: 'Jobright',
} as const

const queryBody = {
  sourceId: 'jobright.locations',
  operation: { kind: 'search', search: 'new york', limit: 20 },
  dependencies: { country: 'US' },
} as const

const expectedIdentity = {
  connectorId: descriptor.connectorId,
  connectorVersion: descriptor.connectorVersion,
  filterSchemaVersion: 'filters@3',
  catalogVersion: 'options@2',
  sourceVersion: 'locations@4',
} as const

const queryResult = {
  connectorInstanceId: 'jobright/session 1',
  ...expectedIdentity,
  sourceId: queryBody.sourceId,
  status: 'search_ready',
  options: [{ key: 'new-york-ny', label: 'New York, NY', value: 'New York, NY' }],
  truncated: false,
} as const

function workspaceConnectors(workspaceId = 'workspace 1') {
  return createHttpValedictorianClient({
    baseUrl: 'https://valedictorian.test/base/',
  }).forWorkspace(workspaceId).connectors
}

function optionQueryInput() {
  return {
    connectorInstanceId: queryResult.connectorInstanceId,
    body: queryBody,
    expectedIdentity,
  }
}

describe('installed connector descriptor HTTP client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('lists strictly validated descriptors through an explicit workspace path', async () => {
    const payload = { items: [descriptor] }
    const fetchMock = mockFetch(jsonResponse(payload))

    await expect(workspaceConnectors().descriptors.list()).resolves.toEqual(payload)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://valedictorian.test/v1/workspaces/workspace%201/connector-descriptors',
      { headers: { accept: 'application/json' }, method: 'GET' },
    )
  })

  it('fails closed on duplicate descriptor identities and unknown response fields', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [descriptor, descriptor] }))
    fetchMock.mockResolvedValueOnce(jsonResponse({
      items: [{ ...descriptor, providerRoute: 'https://provider.test/private' }],
    }))
    vi.stubGlobal('fetch', fetchMock)
    const descriptors = workspaceConnectors('workspace-1').descriptors

    await expect(descriptors.list()).rejects.toThrow()
    await expect(descriptors.list()).rejects.toThrow()
  })

  it('gets an encoded versioned descriptor and enforces both response identities', async () => {
    const encodedDescriptor = {
      ...descriptor,
      connectorId: 'jobright.resolver',
      connectorVersion: '0.13+beta',
    }
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(jsonResponse(encodedDescriptor))
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...descriptor, connectorId: 'other' }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...descriptor, connectorVersion: '9.9.9' }))
    vi.stubGlobal('fetch', fetchMock)
    const descriptors = workspaceConnectors().descriptors

    await expect(
      descriptors.get('jobright.resolver', '0.13+beta'),
    ).resolves.toEqual(encodedDescriptor)
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://valedictorian.test/v1/workspaces/workspace%201/connector-descriptors/jobright.resolver/versions/0.13%2Bbeta',
      { headers: { accept: 'application/json' }, method: 'GET' },
    )
    await expect(descriptors.get(descriptor.connectorId, descriptor.connectorVersion))
      .rejects.toThrow('response identity other does not match jobright.resolver')
    await expect(descriptors.get(descriptor.connectorId, descriptor.connectorVersion))
      .rejects.toThrow('response identity 9.9.9 does not match 0.13.0')
  })
})

describe('trusted connector option-query HTTP client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts only the query body, preserves the AbortSignal, and encodes route identities', async () => {
    const fetchMock = mockFetch(jsonResponse(queryResult))
    const signal = new AbortController().signal

    await expect(
      workspaceConnectors().options.query(optionQueryInput(), { signal }),
    ).resolves.toEqual(queryResult)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://valedictorian.test/v1/workspaces/workspace%201/connectors/jobright%2Fsession%201/options/query',
      {
        body: JSON.stringify(queryBody),
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        method: 'POST',
        signal,
      },
    )
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual(queryBody)
  })

  it('validates every route, body, and expected response identity', async () => {
    const identityCases = [
      ['connectorInstanceId', 'another/instance'],
      ['connectorId', 'another.connector'],
      ['connectorVersion', '9.9.9'],
      ['filterSchemaVersion', 'filters@99'],
      ['catalogVersion', 'options@99'],
      ['sourceId', 'another.source'],
      ['sourceVersion', 'locations@99'],
    ] as const
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    for (const [field, value] of identityCases) {
      fetchMock.mockResolvedValueOnce(jsonResponse({ ...queryResult, [field]: value }))
    }
    vi.stubGlobal('fetch', fetchMock)
    const options = workspaceConnectors('workspace-1').options

    for (const [field, value] of identityCases) {
      await expect(options.query(optionQueryInput())).rejects.toThrow(
        `response identity ${value} does not match ${queryResult[field]}`,
      )
    }
  })

  it('rejects unknown expected identities before fetch and cannot spoof the instance route', async () => {
    const attackerInstanceId = 'attacker/instance'
    const fetchMock = mockFetch(jsonResponse({
      ...queryResult,
      connectorInstanceId: attackerInstanceId,
    }))
    const candidates = [
      {
        ...optionQueryInput(),
        expectedIdentity: { ...expectedIdentity, connectorInstanceId: attackerInstanceId },
      },
      {
        ...optionQueryInput(),
        expectedIdentity: { ...expectedIdentity, detail: 'unknown-local-metadata' },
      },
    ]
    const outcomes = []
    for (const candidate of candidates) {
      outcomes.push(await workspaceConnectors('workspace-1').options
        .query(candidate)
        .then(() => 'resolved', () => 'rejected'))
    }

    expect({ fetchCalls: fetchMock.mock.calls.length, outcomes }).toEqual({
      fetchCalls: 0,
      outcomes: ['rejected', 'rejected'],
    })
  })

  it('fails closed on unknown secret fields and malformed settled results', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(jsonResponse({
      ...queryResult,
      providerSecret: 'must-not-cross-the-contract',
    }))
    fetchMock.mockResolvedValueOnce(jsonResponse({
      ...queryResult,
      status: 'search_empty',
    }))
    fetchMock.mockResolvedValueOnce(jsonResponse({
      ...queryResult,
      status: 'cancelled',
      options: undefined,
      truncated: undefined,
      detail: 'provider stack trace',
    }))
    vi.stubGlobal('fetch', fetchMock)
    const options = workspaceConnectors('workspace-1').options

    await expect(options.query(optionQueryInput())).rejects.toThrow()
    await expect(options.query(optionQueryInput())).rejects.toThrow()
    await expect(options.query(optionQueryInput())).rejects.toThrow()
  })

  it('passes a caller AbortError through unchanged', async () => {
    const abortError = new DOMException('The operation was aborted.', 'AbortError')
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockRejectedValueOnce(abortError)
    vi.stubGlobal('fetch', fetchMock)

    const caught = await workspaceConnectors('workspace-1').options
      .query(optionQueryInput(), { signal: new AbortController().signal })
      .catch((error: unknown) => error)

    expect(caught).toBe(abortError)
    expect(caught).not.toBeInstanceOf(ValedictorianHttpError)
  })

  it('returns a server-settled cancelled outcome normally', async () => {
    const cancelled = {
      connectorInstanceId: queryResult.connectorInstanceId,
      ...expectedIdentity,
      sourceId: queryBody.sourceId,
      status: 'cancelled',
    } as const
    mockFetch(jsonResponse(cancelled))

    await expect(workspaceConnectors('workspace-1').options.query(optionQueryInput()))
      .resolves.toEqual(cancelled)
  })
})

describe('connector option-query HTTP errors', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('maps every exact compatibility response to the exported typed error', async () => {
    const errorConstructor = Reflect.get(Sparxie, 'ConnectorOptionQueryHttpError')
    expect(errorConstructor).toBeTypeOf('function')

    for (const code of connectorOptionQueryErrorCodes) {
      const canonicalBody = connectorOptionQueryErrorBodies[code]
      mockFetch(jsonResponse(canonicalBody, {
        status: connectorOptionQueryErrorStatusByCode[code],
      }))

      const error = await workspaceConnectors('workspace-1').options
        .query(optionQueryInput())
        .catch((caught: unknown) => caught)

      expect(error).toBeInstanceOf(errorConstructor)
      expect(error).toMatchObject({
        body: canonicalBody,
        code,
        message: canonicalBody.message,
        status: connectorOptionQueryErrorStatusByCode[code],
      })
    }
  })

  it('scrubs malformed recognized bodies and status mismatches to a generic error', async () => {
    const code = 'unsupported_descriptor'
    const canonicalBody = connectorOptionQueryErrorBodies[code]
    const malformedBodies = [
      { ...canonicalBody, message: 'provider password was rejected' },
      ...['secret', 'provider', 'auth', 'url', 'route', 'module', 'function', 'detail'].map(
        (field) => ({ ...canonicalBody, [field]: `canary-${field}` }),
      ),
      { code },
    ]
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    for (const body of malformedBodies) {
      fetchMock.mockResolvedValueOnce(jsonResponse(body, { status: 409 }))
    }
    fetchMock.mockResolvedValueOnce(jsonResponse(canonicalBody, { status: 422 }))
    vi.stubGlobal('fetch', fetchMock)
    const options = workspaceConnectors('workspace-1').options

    for (const _body of [...malformedBodies, canonicalBody]) {
      const error = await options.query(optionQueryInput()).catch((caught: unknown) => caught)
      expect(error).toBeInstanceOf(ValedictorianHttpError)
      expect(error).toMatchObject({ body: null, message: 'Request failed' })
      expect(error).not.toHaveProperty('code')
      expect(JSON.stringify(error)).not.toContain('canary-')
      expect(String(error)).not.toContain('password')
    }
  })

  it('retains existing generic semantics for unrelated HTTP failures', async () => {
    const body = { code: 'database_unavailable', message: 'Database unavailable.' }
    mockFetch(jsonResponse(body, { status: 503 }))

    const error = await workspaceConnectors('workspace-1').options
      .query(optionQueryInput())
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ValedictorianHttpError)
    expect(error).toMatchObject({ body, message: body.message, status: 503 })
  })
})

describe('connector capability client scope', () => {
  it('does not add connector capabilities or workspace state to the root client', () => {
    const client = createHttpValedictorianClient()

    expect(client).not.toHaveProperty('connectors')
    expect(client).not.toHaveProperty('currentWorkspace')
    expect(client).not.toHaveProperty('setWorkspace')
  })
})
