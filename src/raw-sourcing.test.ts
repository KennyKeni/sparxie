import { describe, expect, it } from 'vitest'
import {
  canonicalCompensationIntervals,
  canonicalCandidateFields,
  canonicalIdentityKinds,
  canonicalPostedAtPrecisions,
  canonicalSeniorities,
  fieldResolutionStatuses,
  isFieldResolutionStatus,
  isNormalizationGateStatus,
  isNormalizationStatus,
  normalizationGateStatuses,
  normalizationStatuses,
  rawSourceReplayFailureCodes,
  rawSourceReplayReceiptSchema,
} from './index'

describe('raw sourcing public contract', () => {
  it('accepts a truthful completed replay receipt with exact persisted outcomes', () => {
    const receipt = {
      replayId: 'replay-1',
      status: 'completed',
      acceptedAt: '2026-07-11T14:00:00.000Z',
      completedAt: '2026-07-11T14:00:01.000Z',
      matchedRawRevisionIds: ['revision-1'],
      items: [
        {
          status: 'completed',
          rawRecordId: 'raw-1',
          rawRevisionId: 'revision-1',
          normalizationRunId: 'normalization-run-1',
        },
      ],
    }

    expect(rawSourceReplayReceiptSchema.parse(receipt)).toEqual(receipt)
  })

  it('accepts completed-with-failures receipts with bounded value-safe failures', () => {
    const receipt = {
      replayId: 'replay-2',
      status: 'completed_with_failures',
      acceptedAt: '2026-07-11T14:00:00.000Z',
      completedAt: '2026-07-11T14:00:01.000Z',
      matchedRawRevisionIds: ['revision-1', 'revision-2'],
      items: [
        {
          status: 'completed',
          rawRecordId: 'raw-1',
          rawRevisionId: 'revision-1',
          normalizationRunId: 'normalization-run-1',
        },
        {
          status: 'failed',
          rawRecordId: 'raw-2',
          rawRevisionId: 'revision-2',
          failure: {
            code: 'normalization_failed',
            retryable: false,
          },
        },
      ],
    }

    expect(rawSourceReplayFailureCodes).toEqual([
      'normalization_failed',
      'persistence_failed',
      'internal_error',
    ])
    expect(rawSourceReplayReceiptSchema.parse(receipt)).toEqual(receipt)
  })

  it('accepts an unmatched replay as a completed no-op without an invented run', () => {
    const receipt = {
      replayId: 'replay-no-op',
      status: 'completed',
      acceptedAt: '2026-07-11T14:00:00.000Z',
      completedAt: '2026-07-11T14:00:00.000Z',
      matchedRawRevisionIds: [],
      items: [],
    }

    expect(rawSourceReplayReceiptSchema.parse(receipt)).toEqual(receipt)
  })

  it('rejects matched revisions without exactly one corresponding item', () => {
    const base = {
      replayId: 'replay-mismatch',
      status: 'completed' as const,
      acceptedAt: '2026-07-11T14:00:00.000Z',
      completedAt: '2026-07-11T14:00:01.000Z',
    }

    expect(
      rawSourceReplayReceiptSchema.safeParse({
        ...base,
        matchedRawRevisionIds: ['revision-1'],
        items: [],
      }).success,
    ).toBe(false)
    expect(
      rawSourceReplayReceiptSchema.safeParse({
        ...base,
        matchedRawRevisionIds: ['revision-1', 'revision-1'],
        items: [
          {
            status: 'completed',
            rawRecordId: 'raw-1',
            rawRevisionId: 'revision-1',
          },
          {
            status: 'completed',
            rawRecordId: 'raw-1',
            rawRevisionId: 'revision-1',
          },
        ],
      }).success,
    ).toBe(false)
  })

  it('rejects timestamps that claim completion before acceptance', () => {
    expect(
      rawSourceReplayReceiptSchema.safeParse({
        replayId: 'replay-time-travel',
        status: 'completed',
        acceptedAt: '2026-07-11T14:00:01.000Z',
        completedAt: '2026-07-11T14:00:00.000Z',
        matchedRawRevisionIds: [],
        items: [],
      }).success,
    ).toBe(false)
  })

  it('rejects free-form or secret-bearing failure values', () => {
    const receipt = {
      replayId: 'replay-secret',
      status: 'completed_with_failures',
      acceptedAt: '2026-07-11T14:00:00.000Z',
      completedAt: '2026-07-11T14:00:01.000Z',
      matchedRawRevisionIds: ['revision-1'],
      items: [
        {
          status: 'failed',
          rawRecordId: 'raw-1',
          rawRevisionId: 'revision-1',
          failure: {
            code: 'normalization_failed',
            retryable: false,
            message: 'request failed with token=secret-value',
            thrown: { password: 'secret-value' },
          },
        },
      ],
    }

    expect(rawSourceReplayReceiptSchema.safeParse(receipt).success).toBe(false)
  })

  it('rejects item payloads that contradict their discriminant', () => {
    const base = {
      replayId: 'replay-contradiction',
      acceptedAt: '2026-07-11T14:00:00.000Z',
      completedAt: '2026-07-11T14:00:01.000Z',
      matchedRawRevisionIds: ['revision-1'],
    }

    expect(
      rawSourceReplayReceiptSchema.safeParse({
        ...base,
        status: 'completed',
        items: [
          {
            status: 'completed',
            rawRecordId: 'raw-1',
            rawRevisionId: 'revision-1',
            failure: { code: 'internal_error', retryable: false },
          },
        ],
      }).success,
    ).toBe(false)
    expect(
      rawSourceReplayReceiptSchema.safeParse({
        ...base,
        status: 'completed_with_failures',
        items: [
          {
            status: 'failed',
            rawRecordId: 'raw-1',
            rawRevisionId: 'revision-1',
          },
        ],
      }).success,
    ).toBe(false)
  })

  it('exports distinct resolver, normalization, and gate outcome vocabularies', () => {
    expect(fieldResolutionStatuses).toEqual([
      'resolved',
      'not_applicable',
      'abstained',
      'blocked',
      'retry',
      'rejected',
      'conflict',
      'failed',
      'suppressed',
      'locked',
    ])
    expect(normalizationStatuses).toEqual([
      'pending',
      'in_progress',
      'completed',
      'blocked',
      'failed',
    ])
    expect(normalizationGateStatuses).toEqual([
      'passed',
      'needs_enrichment',
      'rejected',
      'failed',
    ])

    expect(isFieldResolutionStatus('not_applicable')).toBe(true)
    expect(isFieldResolutionStatus('unknown')).toBe(false)
    expect(isNormalizationStatus('in_progress')).toBe(true)
    expect(isNormalizationStatus('running')).toBe(false)
    expect(isNormalizationGateStatus('passed')).toBe(true)
    expect(isNormalizationGateStatus('needs_enrichment')).toBe(true)
    expect(isNormalizationGateStatus('failed')).toBe(true)
    expect(isNormalizationGateStatus('blocked')).toBe(false)
    expect(isNormalizationGateStatus('conflict')).toBe(false)
    expect(isNormalizationGateStatus('admitted')).toBe(false)
  })

  it('exports bounded canonical identity and job-fact vocabularies', () => {
    expect(canonicalCandidateFields).toEqual([
      'canonicalIdentity',
      'companyName',
      'roleTitle',
      'employmentType',
      'seniority',
      'workMode',
      'location',
      'destinationUrl',
      'sourceUrl',
      'providerJobId',
      'postedAt',
      'compensation',
    ])
    expect(canonicalIdentityKinds).toEqual([
      'provider_job',
      'destination_url',
      'source_alias',
    ])
    expect(canonicalSeniorities).toEqual([
      'internship',
      'entry_level',
      'associate',
      'mid_level',
      'senior',
      'staff',
      'principal',
      'manager',
      'director',
      'executive',
      'unknown',
    ])
    expect(canonicalCompensationIntervals).toEqual([
      'hour',
      'day',
      'week',
      'month',
      'year',
      'one_time',
      'unknown',
    ])
    expect(canonicalPostedAtPrecisions).toEqual([
      'instant',
      'date',
      'relative',
      'unknown',
    ])
  })
})
