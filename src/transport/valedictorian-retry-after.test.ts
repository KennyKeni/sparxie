import { describe, expect, it } from 'vitest'
import {
  ValedictorianHttpError,
  parseValedictorianRetryAfterHeader,
  valedictorianSafeRequestFailedMessage,
} from '../index.js'

describe('validated Retry-After metadata', () => {
  it('accepts bounded delta-seconds and HTTP-date forms and rejects malformed values', () => {
    expect(parseValedictorianRetryAfterHeader('120')).toEqual({
      kind: 'delta-seconds',
      seconds: 120,
    })
    expect(parseValedictorianRetryAfterHeader('0')).toEqual({
      kind: 'delta-seconds',
      seconds: 0,
    })
    expect(parseValedictorianRetryAfterHeader('86400')).toEqual({
      kind: 'delta-seconds',
      seconds: 86400,
    })
    expect(parseValedictorianRetryAfterHeader('86401')).toBeUndefined()
    expect(parseValedictorianRetryAfterHeader('-1')).toBeUndefined()
    expect(parseValedictorianRetryAfterHeader('12.5')).toBeUndefined()
    expect(parseValedictorianRetryAfterHeader('soon')).toBeUndefined()
    expect(parseValedictorianRetryAfterHeader('')).toBeUndefined()
    expect(parseValedictorianRetryAfterHeader(null)).toBeUndefined()

    const httpDate = 'Wed, 21 Oct 2015 07:28:00 GMT'
    expect(parseValedictorianRetryAfterHeader(httpDate)).toEqual({
      kind: 'http-date',
      at: new Date(httpDate).toISOString(),
    })
    expect(parseValedictorianRetryAfterHeader('July 17, 2026')).toBeUndefined()
    expect(parseValedictorianRetryAfterHeader('Fri Jul 17 2026')).toBeUndefined()
    expect(parseValedictorianRetryAfterHeader('2026 Jul 17')).toBeUndefined()
    expect(parseValedictorianRetryAfterHeader('not a date')).toBeUndefined()
  })

  it('exposes validated retry metadata on typed HTTP failures without changing body shape', () => {
    const retryAfter = parseValedictorianRetryAfterHeader('30')
    const error = new ValedictorianHttpError({
      body: null,
      message: valedictorianSafeRequestFailedMessage,
      status: 429,
      retryAfter,
      requestId: 'req_01DECLARED',
      kind: 'rate_limit',
    })

    expect(error.retryAfter).toEqual({ kind: 'delta-seconds', seconds: 30 })
    expect(error.requestId).toBe('req_01DECLARED')
    expect(error.kind).toBe('rate_limit')
    expect(error.body).toBeNull()
    expect(error.status).toBe(429)
    expect(JSON.stringify(error)).not.toContain('canary')
  })
})
