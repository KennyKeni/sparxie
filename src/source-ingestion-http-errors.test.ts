import { describe, expect, it, vi } from 'vitest'
import {
  SourceIngestionHttpError,
  ValedictorianHttpError,
  ValedictorianProtocolError,
  ValedictorianSourceHttpClient,
  careerSourceErrorBodies,
  sourceAccessErrorBodies,
  sourceBrowseErrorBodies,
  sourceInfrastructureErrorBodies,
  sourceProbeErrorBodies,
  sourceRunErrorBodies,
  sourceScheduleErrorBodies,
} from './index.js'
import { sourceProbePayload } from './http-client.test-support.js'

function response(body: unknown, status: number, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json', ...headers },
    status,
  })
}

function client(fetchMock: typeof fetch) {
  return new ValedictorianSourceHttpClient({
    baseUrl: 'https://source.test/',
    fetch: fetchMock,
    token: 'operator',
  })
}

describe('source ingestion HTTP error mapping', () => {
  it.each([
    [sourceAccessErrorBodies.unauthorized, 401, 'authentication', 'listCompanies'],
    [sourceAccessErrorBodies.forbidden, 403, 'authorization', 'listCompanies'],
    [sourceBrowseErrorBodies.invalid_companies_query, 400, 'validation', 'listCompanies'],
    [careerSourceErrorBodies.career_source_not_found, 404, 'not_found', 'getSchedule'],
    [careerSourceErrorBodies.duplicate_career_source, 409, 'conflict', 'createSource'],
    [careerSourceErrorBodies.source_registration_validation_failed, 422, 'validation',
      'createSource'],
    [sourceInfrastructureErrorBodies.source_rate_limited, 429, 'rate_limit', 'listCompanies'],
    [sourceInfrastructureErrorBodies.source_unavailable, 503, 'unavailable', 'listCompanies'],
  ] as const)('maps validated %s errors without a second parser', async (
    body,
    status,
    kind,
    operation,
  ) => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(response(body, status))

    const source = client(fetchMock)
    const result = operation === 'getSchedule'
      ? source.getSchedule('source-1')
      : operation === 'createSource'
        ? source.createSource({
            careerUrl: 'https://example.test/careers',
            companyName: 'Example',
          })
        : source.listCompanies()
    const error = await result.catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(SourceIngestionHttpError)
    expect(error).toBeInstanceOf(ValedictorianHttpError)
    expect(error).toMatchObject({
      body,
      code: body.code,
      kind,
      message: body.message,
      status,
    })
  })

  it('maps strict lifecycle conflict details', async () => {
    const body = {
      ...sourceScheduleErrorBodies.career_source_not_runnable,
      details: { status: 'paused' },
    }
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(response(body, 409))

    const error = await client(fetchMock).requestRun('source-1')
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(SourceIngestionHttpError)
    expect(error).toMatchObject({ body, code: body.code, kind: 'conflict', status: 409 })
  })

  it('maps a missing source-scoped rule attachment target as a canonical 404', async () => {
    const body = careerSourceErrorBodies.career_source_not_found
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(response(body, 404))

    const error = await client(fetchMock).putRuleAttachment({
      enabled: true,
      ruleKey: 'minimum_count',
      scopeKind: 'source',
      scopeRef: 'missing-source',
    }).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(SourceIngestionHttpError)
    expect(error).toMatchObject({
      body,
      code: 'career_source_not_found',
      kind: 'not_found',
      status: 404,
    })
    expect(error).not.toBeInstanceOf(ValedictorianProtocolError)
  })

  it('maps every operation group through its endpoint contract', async () => {
    const cases = [
      {
        body: sourceBrowseErrorBodies.invalid_jobs_query,
        invoke: (source: ValedictorianSourceHttpClient) => source.listJobs(),
        status: 400,
      },
      {
        body: careerSourceErrorBodies.duplicate_career_source,
        invoke: (source: ValedictorianSourceHttpClient) => source.createSource({
          careerUrl: 'https://example.test/careers',
          companyName: 'Example',
        }),
        status: 409,
      },
      {
        body: sourceScheduleErrorBodies.source_schedule_not_found,
        invoke: (source: ValedictorianSourceHttpClient) => source.disableSchedule('source-1'),
        status: 404,
      },
      {
        body: sourceRunErrorBodies.source_run_not_found,
        invoke: (source: ValedictorianSourceHttpClient) => source.getRun('run-1'),
        status: 404,
      },
      {
        body: sourceProbeErrorBodies.probe_failed,
        invoke: (source: ValedictorianSourceHttpClient) => source.probeCareerUrl({
          url: 'https://example.test/careers',
        }),
        status: 422,
      },
    ] as const

    for (const testCase of cases) {
      const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      fetchMock.mockResolvedValueOnce(response(testCase.body, testCase.status))
      const error = await testCase.invoke(client(fetchMock)).catch((caught: unknown) => caught)
      expect(error).toBeInstanceOf(SourceIngestionHttpError)
      expect(error).toMatchObject({ code: testCase.body.code, status: testCase.status })
    }
  })

  it('parses valid Retry-After and rejects invalid authoritative guidance', async () => {
    const validFetch = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    validFetch.mockResolvedValueOnce(response(
      sourceInfrastructureErrorBodies.source_rate_limited,
      429,
      { 'retry-after': '60' },
    ))
    const valid = await client(validFetch).listRuns().catch((caught: unknown) => caught)
    expect(valid).toBeInstanceOf(SourceIngestionHttpError)
    expect(valid).toMatchObject({
      retryAfter: { kind: 'delta-seconds', seconds: 60 },
      status: 429,
    })

    const invalidFetch = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    invalidFetch.mockResolvedValueOnce(response(
      sourceInfrastructureErrorBodies.source_unavailable,
      503,
      { 'retry-after': 'provider says later' },
    ))
    const invalid = await client(invalidFetch).listRuns().catch((caught: unknown) => caught)
    expect(invalid).toBeInstanceOf(ValedictorianProtocolError)
    expect(invalid).not.toBeInstanceOf(ValedictorianHttpError)
  })

  it.each([
    [{ ...sourceRunErrorBodies.source_run_not_found, message: 'SQL canary' }, 404],
    [{ ...sourceRunErrorBodies.source_run_not_found, diagnostic: 'provider canary' }, 404],
    [sourceRunErrorBodies.source_run_not_found, 409],
    [{ code: 'provider_failed', message: 'provider canary', stack: 'secret' }, 502],
  ])('fails malformed, inconsistent, and unknown bodies closed', async (body, status) => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(response(body, status))
    const error = await client(fetchMock).getRun('run-1').catch((caught: unknown) => caught)

    if ('code' in body && body.code === 'provider_failed') {
      expect(error).toBeInstanceOf(ValedictorianHttpError)
      expect(error).toMatchObject({ body: null, message: 'Request failed', status })
    } else {
      expect(error).toBeInstanceOf(ValedictorianProtocolError)
      expect(error).not.toBeInstanceOf(ValedictorianHttpError)
    }
    expect(JSON.stringify(error)).not.toContain('canary')
    expect(String(error)).not.toContain('canary')
    expect(JSON.stringify(error)).not.toContain('secret')
  })

  it('keeps expected probe, schedule, and admission outcomes as success data', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock
      .mockResolvedValueOnce(response({
        ...sourceProbePayload(),
        probe: { ...sourceProbePayload().probe, readiness: 'not-ready' },
      }, 200))
      .mockResolvedValueOnce(response({ schedule: null }, 200))
      .mockResolvedValueOnce(response({
        admission: { admitted: false, reason: 'already_running' },
        requestId: 'request-1',
      }, 202))
    const source = client(fetchMock)

    await expect(source.probeCareerUrl({ url: 'https://example.test/careers' }))
      .resolves.toMatchObject({ probe: { readiness: 'not-ready' } })
    await expect(source.getSchedule('source-1')).resolves.toEqual({ schedule: null })
    await expect(source.requestRun('source-1', { admit: true })).resolves.toEqual({
      admission: { admitted: false, reason: 'already_running' },
      requestId: 'request-1',
    })
  })
})
