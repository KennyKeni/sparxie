import { describe, expect, it } from 'vitest'
import {
  canonicalCompensationIntervals,
  canonicalCandidateFields,
  canonicalIdentityKinds,
  canonicalPostedAtPrecisions,
  canonicalSeniorities,
  createBoundRawSourceRecordInputSchema,
  fieldResolutionStatuses,
  isFieldResolutionStatus,
  isNormalizationGateStatus,
  isNormalizationStatus,
  normalizationGateStatuses,
  normalizationStatuses,
  rawSourceRecordInputSchema,
  rawSourceNormalizationResultSchema,
  rawSourceReplayFailureCodes,
  rawSourceReplayReceiptSchema,
} from './index'

const completeCanonicalCandidate = {
  id: 'candidate-1',
  sourceEntityId: 'source-entity-1',
  rawRecordId: 'raw-1',
  rawRevisionId: 'revision-1',
  schemaVersion: 'candidate/v1',
  canonicalIdentity: { kind: 'provider_job', value: 'job-1' },
  companyName: 'Example Corp',
  roleTitle: 'Software Engineer',
  employmentType: 'full_time',
  seniority: 'entry_level',
  workMode: 'remote',
  location: null,
  compensation: null,
  postedAt: {
    value: '2026-07-11T14:00:00.000Z',
    precision: 'instant',
    raw: '2026-07-11T14:00:00Z',
  },
  destination: null,
  sourceUrl: null,
  providerJobId: 'job-1',
  observedAt: '2026-07-11T14:00:00.000Z',
} as const

describe('raw sourcing public contract', () => {
  it('rejects an incomplete failed normalization result', () => {
    expect(
      rawSourceNormalizationResultSchema.safeParse({
        status: 'failed',
        gate: null,
        canonicalCandidate: null,
      }).success,
    ).toBe(false)
  })

  it('rejects an unfinished normalization result with an incomplete attempt', () => {
    expect(
      rawSourceNormalizationResultSchema.safeParse({
        rawRecordId: 'raw-1',
        rawRevisionId: 'revision-1',
        canonicalSchemaVersion: 'candidate/v1',
        attempts: [{}],
        fieldOutcomes: [],
        updatedAt: '2026-07-11T14:00:00.000Z',
        status: 'pending',
        gate: null,
        canonicalCandidate: null,
      }).success,
    ).toBe(false)
  })

  it('rejects a completed non-passing result with an incomplete gate', () => {
    expect(
      rawSourceNormalizationResultSchema.safeParse({
        rawRecordId: 'raw-1',
        rawRevisionId: 'revision-1',
        canonicalSchemaVersion: 'candidate/v1',
        attempts: [],
        fieldOutcomes: [],
        updatedAt: '2026-07-11T14:00:00.000Z',
        status: 'completed',
        gate: { status: 'needs_enrichment', candidate: null },
        canonicalCandidate: null,
      }).success,
    ).toBe(false)
  })

  it('rejects a passed result whose canonical candidate has lineage but no facts', () => {
    const candidate = {
      id: 'candidate-1',
      sourceEntityId: 'source-entity-1',
      rawRecordId: 'raw-1',
      rawRevisionId: 'revision-1',
      schemaVersion: 'candidate/v1',
    }

    expect(
      rawSourceNormalizationResultSchema.safeParse({
        rawRecordId: 'raw-1',
        rawRevisionId: 'revision-1',
        canonicalSchemaVersion: 'candidate/v1',
        attempts: [],
        fieldOutcomes: [],
        updatedAt: '2026-07-11T14:00:00.000Z',
        status: 'completed',
        gate: {
          status: 'passed',
          policyVersion: 'gate/v1',
          requiredFields: [],
          missingFields: [],
          conflictingFields: [],
          evaluatedAt: '2026-07-11T14:00:00.000Z',
          candidate,
        },
        canonicalCandidate: candidate,
      }).success,
    ).toBe(false)
  })

  it('accepts a structurally complete passed result with exact lineage', () => {
    const candidateReference = {
      id: completeCanonicalCandidate.id,
      sourceEntityId: completeCanonicalCandidate.sourceEntityId,
      rawRecordId: completeCanonicalCandidate.rawRecordId,
      rawRevisionId: completeCanonicalCandidate.rawRevisionId,
      schemaVersion: completeCanonicalCandidate.schemaVersion,
    }

    expect(
      rawSourceNormalizationResultSchema.safeParse({
        rawRecordId: 'raw-1',
        rawRevisionId: 'revision-1',
        canonicalSchemaVersion: 'candidate/v1',
        attempts: [],
        fieldOutcomes: [],
        updatedAt: '2026-07-11T14:00:00.000Z',
        status: 'completed',
        gate: {
          status: 'passed',
          policyVersion: 'gate/v1',
          requiredFields: [],
          missingFields: [],
          conflictingFields: [],
          evaluatedAt: '2026-07-11T14:00:00.000Z',
          candidate: candidateReference,
        },
        canonicalCandidate: completeCanonicalCandidate,
      }).success,
    ).toBe(true)
  })

  it('accepts complete unfinished, failed, and non-passing result branches', () => {
    const base = {
      rawRecordId: 'raw-1',
      rawRevisionId: 'revision-1',
      canonicalSchemaVersion: 'candidate/v1',
      attempts: [],
      fieldOutcomes: [],
      updatedAt: '2026-07-11T14:00:00.000Z',
    }

    for (const branch of [
      { status: 'pending', gate: null, canonicalCandidate: null },
      { status: 'failed', gate: null, canonicalCandidate: null },
      {
        status: 'completed',
        gate: {
          status: 'needs_enrichment',
          policyVersion: 'gate/v1',
          requiredFields: ['companyName'],
          missingFields: ['companyName'],
          conflictingFields: [],
          candidate: null,
          evaluatedAt: '2026-07-11T14:00:00.000Z',
        },
        canonicalCandidate: null,
      },
    ]) {
      expect(
        rawSourceNormalizationResultSchema.safeParse({ ...base, ...branch }).success,
      ).toBe(true)
    }
  })

  it('validates complete attempt and field-outcome structures', () => {
    const outcome = {
      resolverId: 'resolver-1',
      resolverVersion: '1.0.0',
      field: 'companyName',
      inputHash: 'sha256:input',
      status: 'resolved',
      value: 'Example Corp',
      confidence: 1,
    }
    const result = {
      rawRecordId: 'raw-1',
      rawRevisionId: 'revision-1',
      canonicalSchemaVersion: 'candidate/v1',
      attempts: [
        {
          id: 'attempt-1',
          rawRevisionId: 'revision-1',
          resolver: {
            id: 'resolver-1',
            version: '1.0.0',
            requiredInputs: [],
            outputFields: ['companyName'],
            capabilities: ['pure'],
            costClass: 'none',
            precedence: 1,
          },
          inputHash: 'sha256:input',
          status: 'completed',
          startedAt: '2026-07-11T14:00:00.000Z',
          completedAt: '2026-07-11T14:00:01.000Z',
          outcomes: [outcome],
        },
      ],
      fieldOutcomes: [outcome],
      updatedAt: '2026-07-11T14:00:01.000Z',
      status: 'pending',
      gate: null,
      canonicalCandidate: null,
    }

    expect(rawSourceNormalizationResultSchema.safeParse(result).success).toBe(true)
    expect(
      rawSourceNormalizationResultSchema.safeParse({
        ...result,
        fieldOutcomes: [{ status: 'resolved' }],
      }).success,
    ).toBe(false)
  })

  it('rejects a passed candidate with facts but no canonical identity', () => {
    const { canonicalIdentity: _, ...candidateWithoutIdentity } =
      completeCanonicalCandidate

    expect(
      rawSourceNormalizationResultSchema.safeParse({
        rawRecordId: 'raw-1',
        rawRevisionId: 'revision-1',
        canonicalSchemaVersion: 'candidate/v1',
        attempts: [],
        fieldOutcomes: [],
        updatedAt: '2026-07-11T14:00:00.000Z',
        status: 'completed',
        gate: {
          status: 'passed',
          policyVersion: 'gate/v1',
          requiredFields: [],
          missingFields: [],
          conflictingFields: [],
          evaluatedAt: '2026-07-11T14:00:00.000Z',
          candidate: {
            id: completeCanonicalCandidate.id,
            sourceEntityId: completeCanonicalCandidate.sourceEntityId,
            rawRecordId: completeCanonicalCandidate.rawRecordId,
            rawRevisionId: completeCanonicalCandidate.rawRevisionId,
            schemaVersion: completeCanonicalCandidate.schemaVersion,
          },
        },
        canonicalCandidate: candidateWithoutIdentity,
      }).success,
    ).toBe(false)

    void _
  })

  it('accepts connector capture references without producer-owned binding data', () => {
    const record = {
      adapter: { id: 'jobright', kind: 'connector', version: '2.1.0' },
      capture: {
        connectorInstanceId: 'connector-instance-1',
        connectorRunId: 'connector-run-1',
      },
      observedAt: '2026-07-11T14:00:00.000Z',
    }

    expect(rawSourceRecordInputSchema.parse(record)).toEqual(record)
  })

  it('rejects connector capture references claimed by another adapter kind', () => {
    expect(
      rawSourceRecordInputSchema.safeParse({
        adapter: { id: 'manual-entry', kind: 'manual', version: '1.0.0' },
        capture: {
          connectorInstanceId: 'connector-instance-1',
          connectorRunId: 'connector-run-1',
        },
        observedAt: '2026-07-11T14:00:00.000Z',
      }).success,
    ).toBe(false)
  })

  it('rejects a passed gate whose candidate contradicts raw lineage', () => {
    expect(
      rawSourceNormalizationResultSchema.safeParse({
        rawRecordId: 'raw-1',
        rawRevisionId: 'revision-1',
        canonicalSchemaVersion: 'candidate/v1',
        attempts: [],
        fieldOutcomes: [],
        updatedAt: '2026-07-11T14:00:00.000Z',
        status: 'completed',
        gate: {
          status: 'passed',
          policyVersion: 'gate/v1',
          requiredFields: [],
          missingFields: [],
          conflictingFields: [],
          evaluatedAt: '2026-07-11T14:00:00.000Z',
          candidate: {
            id: 'candidate-1',
            sourceEntityId: 'source-entity-1',
            rawRecordId: 'raw-1',
            rawRevisionId: 'revision-2',
            schemaVersion: 'candidate/v1',
          },
        },
        canonicalCandidate: {
          id: 'candidate-1',
          sourceEntityId: 'source-entity-1',
          rawRecordId: 'raw-1',
          rawRevisionId: 'revision-2',
          schemaVersion: 'candidate/v1',
        },
      }).success,
    ).toBe(false)
  })

  it('rejects a passed gate that still reports missing candidate facts', () => {
    const candidate = {
      id: 'candidate-1',
      sourceEntityId: 'source-entity-1',
      rawRecordId: 'raw-1',
      rawRevisionId: 'revision-1',
      schemaVersion: 'candidate/v1',
    }

    expect(
      rawSourceNormalizationResultSchema.safeParse({
        rawRecordId: 'raw-1',
        rawRevisionId: 'revision-1',
        canonicalSchemaVersion: 'candidate/v1',
        attempts: [],
        fieldOutcomes: [],
        updatedAt: '2026-07-11T14:00:00.000Z',
        status: 'completed',
        gate: {
          status: 'passed',
          policyVersion: 'gate/v1',
          requiredFields: ['companyName'],
          missingFields: ['companyName'],
          conflictingFields: [],
          evaluatedAt: '2026-07-11T14:00:00.000Z',
          candidate,
        },
        canonicalCandidate: candidate,
      }).success,
    ).toBe(false)
  })

  it('rejects connector capture references resolved from another workspace', () => {
    const schema = createBoundRawSourceRecordInputSchema({
      requestWorkspaceId: 'workspace-1',
      workspaceId: 'workspace-2',
      connectorInstanceId: 'connector-instance-1',
      connectorRunId: 'connector-run-1',
      adapter: { id: 'jobright', kind: 'connector', version: '2.1.0' },
    })

    expect(
      schema.safeParse({
        adapter: { id: 'jobright', kind: 'connector', version: '2.1.0' },
        capture: {
          connectorInstanceId: 'connector-instance-1',
          connectorRunId: 'connector-run-1',
        },
        observedAt: '2026-07-11T14:00:00.000Z',
      }).success,
    ).toBe(false)
  })

  it('rejects a producer adapter that differs from the registered connector', () => {
    const schema = createBoundRawSourceRecordInputSchema({
      requestWorkspaceId: 'workspace-1',
      workspaceId: 'workspace-1',
      connectorInstanceId: 'connector-instance-1',
      connectorRunId: 'connector-run-1',
      adapter: { id: 'jobright', kind: 'connector', version: '2.1.0' },
    })

    expect(
      schema.safeParse({
        adapter: { id: 'another-connector', kind: 'connector', version: '9.0.0' },
        capture: {
          connectorInstanceId: 'connector-instance-1',
          connectorRunId: 'connector-run-1',
        },
        observedAt: '2026-07-11T14:00:00.000Z',
      }).success,
    ).toBe(false)
  })

  it('accepts connector capture that exactly matches its trusted binding', () => {
    const schema = createBoundRawSourceRecordInputSchema({
      requestWorkspaceId: 'workspace-1',
      workspaceId: 'workspace-1',
      connectorInstanceId: 'connector-instance-1',
      connectorRunId: 'connector-run-1',
      adapter: { id: 'jobright', kind: 'connector', version: '2.1.0' },
    })

    expect(
      schema.safeParse({
        adapter: { id: 'jobright', kind: 'connector', version: '2.1.0' },
        capture: {
          connectorInstanceId: 'connector-instance-1',
          connectorRunId: 'connector-run-1',
        },
        observedAt: '2026-07-11T14:00:00.000Z',
      }).success,
    ).toBe(true)
  })

  it('rejects connector instance and run references that differ from the binding', () => {
    const schema = createBoundRawSourceRecordInputSchema({
      requestWorkspaceId: 'workspace-1',
      workspaceId: 'workspace-1',
      connectorInstanceId: 'connector-instance-1',
      connectorRunId: 'connector-run-1',
      adapter: { id: 'jobright', kind: 'connector', version: '2.1.0' },
    })
    const record = {
      adapter: { id: 'jobright', kind: 'connector', version: '2.1.0' },
      observedAt: '2026-07-11T14:00:00.000Z',
    } as const

    expect(
      schema.safeParse({
        ...record,
        capture: {
          connectorInstanceId: 'connector-instance-2',
          connectorRunId: 'connector-run-1',
        },
      }).success,
    ).toBe(false)
    expect(
      schema.safeParse({
        ...record,
        capture: {
          connectorInstanceId: 'connector-instance-1',
          connectorRunId: 'connector-run-2',
        },
      }).success,
    ).toBe(false)
  })

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
