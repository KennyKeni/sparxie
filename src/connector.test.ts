import { describe, expect, it } from 'vitest'
import { connectorRunSummarySchema } from './index'

const skippedNotDueRun = {
  id: 'run-1',
  connectorInstanceId: 'connector-1',
  mode: 'manual',
  status: 'skipped',
  coverage: { start: null, end: null },
  filterSignature: 'all',
  observationCount: 0,
  warningCount: 0,
  stats: null,
  warnings: [],
  retryHints: {
    state: 'not_due',
    reason: 'rate_limit',
    attempt: 2,
    maxAttempts: 5,
    lastAttemptAt: '2026-07-11T14:00:00.000Z',
    computedDelayMs: 60_000,
    serverMinimumDelayMs: 45_000,
    nextAttemptAt: '2026-07-11T14:01:00.000Z',
    horizonAt: '2026-07-11T15:00:00.000Z',
  },
  startedAt: '2026-07-11T14:00:30.000Z',
  completedAt: '2026-07-11T14:00:30.000Z',
}

describe('connector retry contract', () => {
  it('accepts a skipped not-due run with typed retry advice', () => {
    expect(connectorRunSummarySchema.parse(skippedNotDueRun)).toEqual(
      skippedNotDueRun,
    )
  })

  it('rejects malformed or impossible schedulable retry advice', () => {
    const retryHints = skippedNotDueRun.retryHints

    for (const invalidRetryHints of [
      { ...retryHints, reason: 'auth' },
      { ...retryHints, reason: 'captcha' },
      { ...retryHints, reason: 'schema_change' },
      { ...retryHints, reason: 'permanent_failure' },
      { ...retryHints, providerWorkId: 'private-work-1' },
      { ...retryHints, attempt: 0 },
      { ...retryHints, attempt: 6 },
      { ...retryHints, computedDelayMs: -1 },
      { ...retryHints, serverMinimumDelayMs: 60_001 },
      { ...retryHints, nextAttemptAt: retryHints.lastAttemptAt },
      { ...retryHints, nextAttemptAt: '2026-07-11T14:00:59.999Z' },
      { ...retryHints, nextAttemptAt: '2026-07-11T15:00:00.001Z' },
      { ...retryHints, nextAttemptAt: 'not-a-timestamp' },
    ]) {
      expect(
        connectorRunSummarySchema.safeParse({
          ...skippedNotDueRun,
          retryHints: invalidRetryHints,
        }).success,
        JSON.stringify(invalidRetryHints),
      ).toBe(false)
    }
  })

  it('accepts terminal retry advice without schedulable work and rejects terminal schedules', () => {
    for (const state of ['exhausted', 'cancelled'] as const) {
      const retryHints = {
        state,
        reason: 'operation_timeout',
        attempt: 5,
        maxAttempts: 5,
        lastAttemptAt: '2026-07-11T14:59:00.000Z',
        computedDelayMs: 120_000,
        serverMinimumDelayMs: null,
        nextAttemptAt: null,
        horizonAt: '2026-07-11T15:00:00.000Z',
      }

      expect(
        connectorRunSummarySchema.safeParse({
          ...skippedNotDueRun,
          status: state === 'cancelled' ? 'cancelled' : 'failed',
          retryHints,
        }).success,
      ).toBe(true)
      expect(
        connectorRunSummarySchema.safeParse({
          ...skippedNotDueRun,
          retryHints: {
            ...retryHints,
            nextAttemptAt: '2026-07-11T15:01:00.000Z',
          },
        }).success,
      ).toBe(false)
    }
  })

  it('rejects sub-millisecond timestamps that can bypass timing invariants', () => {
    expect(
      connectorRunSummarySchema.safeParse({
        ...skippedNotDueRun,
        retryHints: {
          ...skippedNotDueRun.retryHints,
          state: 'scheduled',
          lastAttemptAt: '2026-07-11T14:00:00.0009Z',
          computedDelayMs: 1,
          nextAttemptAt: '2026-07-11T14:00:00.0011Z',
          horizonAt: '2026-07-11T14:00:00.100Z',
        },
      }).success,
    ).toBe(false)

    expect(
      connectorRunSummarySchema.safeParse({
        ...skippedNotDueRun,
        status: 'failed',
        retryHints: {
          ...skippedNotDueRun.retryHints,
          state: 'exhausted',
          attempt: 5,
          maxAttempts: 5,
          lastAttemptAt: '2026-07-11T14:00:00.0009Z',
          computedDelayMs: null,
          serverMinimumDelayMs: null,
          nextAttemptAt: null,
          horizonAt: '2026-07-11T14:00:00.0001Z',
        },
      }).success,
    ).toBe(false)
  })
})
