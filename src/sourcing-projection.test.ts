import { describe, expect, it } from 'vitest'
import { rawSourceProjectionResultSchema } from './index.js'

const receiptBase = {
  rawRecordId: 'raw-1',
  rawRevisionId: 'revision-1',
  updatedAt: '2026-07-12T12:00:00.000Z',
} as const

describe('raw source projection receipt contract', () => {
  it('accepts an unstarted revision as not eligible', () => {
    expect(
      rawSourceProjectionResultSchema.parse({
        ...receiptBase,
        status: 'not_eligible',
        normalizationStatus: null,
        gateStatus: null,
        canonicalCandidateId: null,
      }),
    ).toEqual({
      ...receiptBase,
      status: 'not_eligible',
      normalizationStatus: null,
      gateStatus: null,
      canonicalCandidateId: null,
    })
  })

  it('accepts a passed candidate while projection is pending', () => {
    expect(
      rawSourceProjectionResultSchema.safeParse({
        ...receiptBase,
        status: 'pending',
        normalizationStatus: 'completed',
        gateStatus: 'passed',
        canonicalCandidateId: 'candidate-1',
      }).success,
    ).toBe(true)
  })

  it('accepts a projected candidate with a stable narrow finding reference', () => {
    expect(
      rawSourceProjectionResultSchema.safeParse({
        ...receiptBase,
        status: 'projected',
        normalizationStatus: 'completed',
        gateStatus: 'passed',
        canonicalCandidateId: 'candidate-1',
        projectedAt: '2026-07-12T11:59:59.000Z',
        finding: {
          id: 'finding-1',
          mergeStatus: 'duplicate',
          mergedApplicationId: 'application-1',
        },
      }).success,
    ).toBe(true)
  })

  it('accepts only safe projection failure metadata', () => {
    expect(
      rawSourceProjectionResultSchema.safeParse({
        ...receiptBase,
        status: 'failed',
        normalizationStatus: 'completed',
        gateStatus: 'passed',
        canonicalCandidateId: 'candidate-1',
        failedAt: '2026-07-12T11:59:59.000Z',
        failure: { code: 'persistence_failed', retryable: true },
      }).success,
    ).toBe(true)
  })

  it('rejects impossible normalization, gate, candidate, and terminal combinations', () => {
    const impossible = [
      {
        status: 'not_eligible',
        normalizationStatus: 'completed',
        gateStatus: null,
        canonicalCandidateId: null,
      },
      {
        status: 'not_eligible',
        normalizationStatus: 'pending',
        gateStatus: 'rejected',
        canonicalCandidateId: null,
      },
      {
        status: 'not_eligible',
        normalizationStatus: 'completed',
        gateStatus: 'rejected',
        canonicalCandidateId: 'candidate-1',
      },
      {
        status: 'pending',
        normalizationStatus: 'completed',
        gateStatus: 'rejected',
        canonicalCandidateId: 'candidate-1',
      },
      {
        status: 'projected',
        normalizationStatus: 'completed',
        gateStatus: 'passed',
        canonicalCandidateId: 'candidate-1',
        projectedAt: '2026-07-12T11:59:59.000Z',
      },
    ]

    for (const receipt of impossible) {
      expect(
        rawSourceProjectionResultSchema.safeParse({ ...receiptBase, ...receipt }).success,
      ).toBe(false)
    }
  })

  it('rejects raw exception text and unsupported failure codes', () => {
    const failureBase = {
      ...receiptBase,
      status: 'failed',
      normalizationStatus: 'completed',
      gateStatus: 'passed',
      canonicalCandidateId: 'candidate-1',
      failedAt: '2026-07-12T11:59:59.000Z',
    }

    expect(
      rawSourceProjectionResultSchema.safeParse({
        ...failureBase,
        failure: {
          code: 'projection_failed',
          retryable: false,
          message: 'database password appeared in exception',
        },
      }).success,
    ).toBe(false)
    expect(
      rawSourceProjectionResultSchema.safeParse({
        ...failureBase,
        failure: { code: 'database_exception', retryable: false },
      }).success,
    ).toBe(false)
  })
})
