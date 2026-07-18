import { describe, expect, it } from 'vitest'
import {
  careerSourceErrorBodies,
  careerSourceErrorBodySchema,
  careerSourceErrorKindByCode,
  careerSourceErrorStatusByCode,
  sourceAccessErrorBodies,
  sourceAccessErrorBodySchema,
  sourceAccessErrorKindByCode,
  sourceAccessErrorStatusByCode,
  sourceBrowseErrorBodies,
  sourceBrowseErrorBodySchema,
  sourceBrowseErrorKindByCode,
  sourceBrowseErrorStatusByCode,
  sourceInfrastructureErrorBodies,
  sourceInfrastructureErrorBodySchema,
  sourceInfrastructureErrorKindByCode,
  sourceInfrastructureErrorStatusByCode,
  sourceProbeErrorBodies,
  sourceProbeErrorBodySchema,
  sourceProbeErrorKindByCode,
  sourceProbeErrorStatusByCode,
  sourceRuleErrorBodies,
  sourceRuleErrorBodySchema,
  sourceRuleErrorKindByCode,
  sourceRuleErrorStatusByCode,
  sourceRunErrorBodies,
  sourceRunErrorBodySchema,
  sourceRunErrorKindByCode,
  sourceRunErrorStatusByCode,
  sourceScheduleErrorBodies,
  sourceScheduleErrorBodySchema,
  sourceScheduleErrorKindByCode,
  sourceScheduleErrorStatusByCode,
  validateSourceIngestionEndpointError,
  valedictorianFailureKindMessages,
} from './index.js'

const groups = [
  [sourceAccessErrorBodies, sourceAccessErrorStatusByCode, sourceAccessErrorKindByCode],
  [sourceBrowseErrorBodies, sourceBrowseErrorStatusByCode, sourceBrowseErrorKindByCode],
  [careerSourceErrorBodies, careerSourceErrorStatusByCode, careerSourceErrorKindByCode],
  [sourceScheduleErrorBodies, sourceScheduleErrorStatusByCode, sourceScheduleErrorKindByCode],
  [sourceRunErrorBodies, sourceRunErrorStatusByCode, sourceRunErrorKindByCode],
  [sourceProbeErrorBodies, sourceProbeErrorStatusByCode, sourceProbeErrorKindByCode],
  [sourceRuleErrorBodies, sourceRuleErrorStatusByCode, sourceRuleErrorKindByCode],
  [
    sourceInfrastructureErrorBodies,
    sourceInfrastructureErrorStatusByCode,
    sourceInfrastructureErrorKindByCode,
  ],
] as const

const groupSchemas = [
  sourceAccessErrorBodySchema,
  sourceBrowseErrorBodySchema,
  careerSourceErrorBodySchema,
  sourceScheduleErrorBodySchema,
  sourceRunErrorBodySchema,
  sourceProbeErrorBodySchema,
  sourceRuleErrorBodySchema,
  sourceInfrastructureErrorBodySchema,
] as const

describe('source ingestion safe error contracts', () => {
  it('declares every source body with a canonical status and semantic kind', () => {
    const seen = new Set<string>()
    for (const [groupIndex, [bodies, statuses, kinds]] of groups.entries()) {
      for (const [code, body] of Object.entries(bodies)) {
        expect(seen.has(code)).toBe(false)
        seen.add(code)
        expect(body).toMatchObject({ code })
        expect(statuses).toHaveProperty(code)
        expect(kinds).toHaveProperty(code)
        expect(groupSchemas[groupIndex]!.safeParse(body).success).toBe(true)
        expect([400, 401, 403, 404, 409, 422, 429, 503]).toContain(
          statuses[code as keyof typeof statuses],
        )
      }
    }

    expect(sourceAccessErrorStatusByCode).toEqual({
      forbidden: 403,
      unauthorized: 401,
    })
    expect(sourceAccessErrorKindByCode).toEqual({
      forbidden: 'authorization',
      unauthorized: 'authentication',
    })
    expect(sourceBrowseErrorStatusByCode.invalid_jobs_query).toBe(400)
    expect(careerSourceErrorStatusByCode.source_registration_validation_failed).toBe(422)
    expect(sourceScheduleErrorStatusByCode.source_schedule_validation_failed).toBe(422)
    expect(sourceRunErrorStatusByCode.run_override_validation_failed).toBe(422)
    expect(sourceRunErrorStatusByCode.source_run_not_found).toBe(404)
    expect(sourceRunErrorStatusByCode.run_admission_denied).toBe(409)
    expect(sourceInfrastructureErrorStatusByCode).toEqual({
      source_rate_limited: 429,
      source_unavailable: 503,
    })
  })

  it('uses fixed safe copy and no diagnostic detail for browser/extraction failures', () => {
    expect(sourceProbeErrorBodies).toEqual({
      browser_execution_unavailable: {
        code: 'browser_execution_unavailable',
        message: 'Browser execution is temporarily unavailable.',
      },
      browser_execution_validation_failed: {
        code: 'browser_execution_validation_failed',
        message: 'The browser execution request is invalid.',
      },
      invalid_source_probe_request: {
        code: 'invalid_source_probe_request',
        message: 'The source probe request is malformed.',
      },
      probe_failed: {
        code: 'probe_failed',
        message: 'The source probe could not validate the Career URL.',
      },
      source_extraction_validation_failed: {
        code: 'source_extraction_validation_failed',
        message: 'The source extraction request is invalid.',
      },
      source_extraction_unavailable: {
        code: 'source_extraction_unavailable',
        message: 'Source extraction is temporarily unavailable.',
      },
    })
    expect(JSON.stringify(sourceProbeErrorBodies)).not.toContain('provider response')
    expect(JSON.stringify(sourceProbeErrorBodies)).not.toContain('diagnostic')
  })

  it('validates lifecycle details strictly when a non-runnable source conflicts', () => {
    const endpoint = 'requestRun'
    const canonical = {
      ...sourceScheduleErrorBodies.career_source_not_runnable,
      details: { status: 'paused' },
    }
    expect(validateSourceIngestionEndpointError({
      body: canonical,
      endpoint,
      status: 409,
    })).toMatchObject({ ok: true, body: canonical, kind: 'conflict' })

    for (const malformed of [
      {
        code: canonical.code,
        message: canonical.message,
      },
      { ...canonical, details: { status: 'secret-provider-state' } },
      { ...canonical, details: { status: 'paused', diagnostic: 'canary' } },
      { ...canonical, diagnostic: 'canary' },
    ]) {
      expect(validateSourceIngestionEndpointError({
        body: malformed,
        endpoint,
        status: 409,
      })).toEqual({ ok: false, reason: 'malformed_body' })
    }
  })

  it('accepts only errors declared for the selected endpoint', () => {
    expect(validateSourceIngestionEndpointError({
      body: sourceBrowseErrorBodies.invalid_jobs_query,
      endpoint: 'listJobs',
      status: 400,
    })).toMatchObject({ ok: true, kind: 'validation' })
    expect(validateSourceIngestionEndpointError({
      body: sourceBrowseErrorBodies.invalid_jobs_query,
      endpoint: 'listCompanies',
      status: 400,
    })).toEqual({ ok: false, reason: 'unexpected_code' })
    expect(validateSourceIngestionEndpointError({
      body: careerSourceErrorBodies.career_source_not_found,
      endpoint: 'getRun',
      status: 404,
    })).toEqual({ ok: false, reason: 'unexpected_code' })
  })

  it('validates canonical message, strict keys, and status together', () => {
    const canonical = sourceRunErrorBodies.source_run_not_found
    expect(validateSourceIngestionEndpointError({
      body: canonical,
      endpoint: 'getRun',
      status: 404,
    })).toMatchObject({ ok: true, body: canonical, kind: 'not_found' })

    for (const body of [
      { ...canonical, message: 'run run_1 failed: SQL canary' },
      { ...canonical, stack: 'canary' },
      { code: canonical.code },
    ]) {
      expect(validateSourceIngestionEndpointError({
        body,
        endpoint: 'getRun',
        status: 404,
      })).toEqual({ ok: false, reason: 'malformed_body' })
    }
    expect(validateSourceIngestionEndpointError({
      body: canonical,
      endpoint: 'getRun',
      status: 409,
    })).toEqual({ ok: false, reason: 'status_mismatch' })
  })

  it('exposes Retry-After only for authoritative infrastructure failures', () => {
    for (const [body, status] of [
      [sourceInfrastructureErrorBodies.source_rate_limited, 429],
      [sourceInfrastructureErrorBodies.source_unavailable, 503],
    ] as const) {
      expect(validateSourceIngestionEndpointError({
        body,
        endpoint: 'listJobs',
        retryAfterHeader: '45',
        status,
      })).toMatchObject({
        ok: true,
        retryAfter: { kind: 'delta-seconds', seconds: 45 },
      })
      expect(validateSourceIngestionEndpointError({
        body,
        endpoint: 'listJobs',
        retryAfterHeader: 'soon',
        status,
      })).toEqual({ ok: false, reason: 'invalid_retry_after' })
    }

    const nonAuthoritative = validateSourceIngestionEndpointError({
      body: sourceBrowseErrorBodies.invalid_jobs_query,
      endpoint: 'listJobs',
      retryAfterHeader: '45',
      status: 400,
    })
    expect(nonAuthoritative).toMatchObject({ ok: true })
    expect(nonAuthoritative).not.toHaveProperty('retryAfter')

    const browserUnavailable = validateSourceIngestionEndpointError({
      body: sourceProbeErrorBodies.browser_execution_unavailable,
      endpoint: 'probeCareerUrl',
      retryAfterHeader: '45',
      status: 503,
    })
    expect(browserUnavailable).toMatchObject({ ok: true, kind: 'unavailable' })
    expect(browserUnavailable).not.toHaveProperty('retryAfter')
  })

  it('shares canonical safe kind messages for authentication, authorization, and service state', () => {
    expect(sourceAccessErrorBodies.unauthorized.message)
      .toBe(valedictorianFailureKindMessages.authentication)
    expect(sourceAccessErrorBodies.forbidden.message)
      .toBe(valedictorianFailureKindMessages.authorization)
    expect(sourceInfrastructureErrorBodies.source_rate_limited.message)
      .toBe(valedictorianFailureKindMessages.rate_limit)
    expect(sourceInfrastructureErrorBodies.source_unavailable.message)
      .toBe(valedictorianFailureKindMessages.unavailable)
  })
})
