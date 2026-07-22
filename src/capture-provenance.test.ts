import { describe, expect, it } from 'vitest'
import {
  captureConnectorProvenanceSchema,
  captureListInputSchema,
  captureReportedOriginKinds,
  captureReportedOriginSchema,
  captureRevisionSchema,
  type CaptureConnectorProvenance,
  type CaptureReportedOrigin,
} from './index.js'

const capture = {
  id: '018f6f88-4c35-7a62-9f2e-318dd8e164c4',
  workspaceId: 'workspace-north',
  evidenceMode: 'reported',
  adapter: { id: 'manual-entry', kind: 'manual', version: '1.0.0' },
  observedAt: '2026-07-17T15:30:00.000Z',
  receivedAt: '2026-07-17T15:31:00.000Z',
  providerRecordId: null,
  providerSchema: null,
  payload: { title: 'Controls Intern' },
  evidence: [],
  revision: 1,
  createdAt: '2026-07-17T15:31:00.000Z',
  updatedAt: '2026-07-17T15:31:00.000Z',
  removedAt: null,
} as const

const audit = {
  actor: { id: 'user-7', type: 'user' as const },
  timestamp: '2026-07-17T15:31:00.000Z',
}

function baseRevision() {
  return {
    captureId: capture.id,
    revision: 1,
    kind: 'created' as const,
    snapshot: capture,
    audit,
  }
}

const validProvenance: CaptureConnectorProvenance = {
  connectorInstanceId: 'jobright-session',
  connectorRunId: '018f6f88-4c35-7a62-9f2e-318dd8e164c9',
  executionScopeId: 'scope.north-1',
  reportedOrigin: {
    kind: 'employer',
    name: 'Northstar Robotics',
    providerId: 'northstar-employer-id',
    url: 'https://northstar.example/jobs/448',
  },
}

describe('capture list connector run filter', () => {
  it('accepts a valid opaque connector run id and rejects only empty and unknown keys', () => {
    expect(captureListInputSchema.parse({ connectorRunId: 'connector-run/one' })).toEqual({
      connectorRunId: 'connector-run/one',
    })

    expect(captureListInputSchema.parse({ connectorRunId: '  spaced-identity  ' })).toEqual({
      connectorRunId: '  spaced-identity  ',
    })
    expect(
      captureListInputSchema.parse({ connectorRunId: 'r'.repeat(257) }).connectorRunId,
    ).toHaveLength(257)

    expect(captureListInputSchema.safeParse({ connectorRunId: '' }).success).toBe(false)

    expect(
      captureListInputSchema.parse({
        evidenceMode: 'reported',
        adapterId: 'manual-entry',
        connectorRunId: 'run-1',
        includeRemoved: true,
        limit: 20,
        cursor: 'capture-cursor',
      }),
    ).toEqual({
      evidenceMode: 'reported',
      adapterId: 'manual-entry',
      connectorRunId: 'run-1',
      includeRemoved: true,
      limit: 20,
      cursor: 'capture-cursor',
    })

    expect(captureListInputSchema.safeParse({ connectorRun: 'run-1' }).success).toBe(false)
    expect(captureListInputSchema.safeParse({ unknownFilter: true }).success).toBe(false)
  })
})

describe('capture reported origin contract', () => {
  it('exposes the closed reported-origin kind set', () => {
    expect(captureReportedOriginKinds).toEqual([
      'employer',
      'ats',
      'job_board',
      'aggregator',
      'referral',
      'other',
    ])
  })

  it.each(captureReportedOriginKinds.map((kind) => [kind]))(
    'accepts every allowed reported-origin kind (%s)',
    (kind) => {
      const origin: CaptureReportedOrigin = { kind, name: 'Northstar Robotics' }
      expect(captureReportedOriginSchema.parse(origin)).toEqual(origin)
    },
  )

  it('accepts optional nullable providerId and url compatible with ReportedSourceOrigin', () => {
    const withBoth: CaptureReportedOrigin = {
      kind: 'ats',
      name: 'Greenhouse',
      providerId: 'greenhouse-ats-id',
      url: 'https://greenhouse.example/job/448',
    }
    expect(captureReportedOriginSchema.parse(withBoth)).toEqual(withBoth)

    expect(
      captureReportedOriginSchema.parse({ kind: 'job_board', name: 'LinkedIn', providerId: null }),
    ).toEqual({ kind: 'job_board', name: 'LinkedIn', providerId: null })

    expect(
      captureReportedOriginSchema.parse({ kind: 'aggregator', name: 'Indeed', url: null }),
    ).toEqual({ kind: 'aggregator', name: 'Indeed', url: null })

    expect(captureReportedOriginSchema.parse({ kind: 'referral', name: 'Referral' })).toEqual({
      kind: 'referral',
      name: 'Referral',
    })

    expect(
      captureReportedOriginSchema.parse({ kind: 'employer', name: 'n'.repeat(513) }).name,
    ).toHaveLength(513)

    expect(
      captureReportedOriginSchema.parse({ kind: 'employer', name: '  Northstar Robotics  ' }).name,
    ).toBe('  Northstar Robotics  ')

    expect(
      captureReportedOriginSchema.parse({ kind: 'employer', name: 'x', providerId: '' }).providerId,
    ).toBe('')

    expect(
      captureReportedOriginSchema.parse({ kind: 'employer', name: 'x', url: '' }).url,
    ).toBe('')

    expect(
      captureReportedOriginSchema.parse({
        kind: 'job_board',
        name: 'Internal Board',
        url: ' employer-portal://internal/448 ',
      }).url,
    ).toBe(' employer-portal://internal/448 ')
  })

  it('rejects empty name, unknown kind, and extra fields only', () => {
    expect(captureReportedOriginSchema.safeParse({ kind: 'recruiter', name: 'x' }).success).toBe(false)
    expect(captureReportedOriginSchema.safeParse({ kind: 'employer', name: '' }).success).toBe(false)
    expect(
      captureReportedOriginSchema.safeParse({ kind: 'employer', name: 'x', extra: true }).success,
    ).toBe(false)
  })
})

describe('capture connector provenance contract', () => {
  it('accepts exact valid connector instance, run, and scope data with a nullable origin', () => {
    expect(captureConnectorProvenanceSchema.parse(validProvenance)).toEqual(validProvenance)

    const nullOrigin: CaptureConnectorProvenance = {
      connectorInstanceId: 'jobright-session',
      connectorRunId: '018f6f88-4c35-7a62-9f2e-318dd8e164c9',
      executionScopeId: 'scope.north-1',
      reportedOrigin: null,
    }
    expect(captureConnectorProvenanceSchema.parse(nullOrigin)).toEqual(nullOrigin)
  })

  it('accepts a full reported origin inside provenance', () => {
    const parsed = captureConnectorProvenanceSchema.parse({
      ...validProvenance,
      reportedOrigin: { kind: 'ats', name: 'Greenhouse', url: 'https://greenhouse.example' },
    })
    expect(parsed.reportedOrigin).toEqual({
      kind: 'ats',
      name: 'Greenhouse',
      url: 'https://greenhouse.example',
    })
  })

  it('accepts opaque connector identities beyond the lifecycle bound and with whitespace', () => {
    const longInstance = 'i'.repeat(257)
    const longRun = 'r'.repeat(257)
    expect(
      captureConnectorProvenanceSchema.parse({
        ...validProvenance,
        connectorInstanceId: longInstance,
        connectorRunId: longRun,
      }),
    ).toEqual({
      ...validProvenance,
      connectorInstanceId: longInstance,
      connectorRunId: longRun,
    })
    expect(
      captureConnectorProvenanceSchema.parse({
        ...validProvenance,
        connectorInstanceId: '  spaced-instance  ',
        connectorRunId: '  spaced-run  ',
      }),
    ).toEqual({
      ...validProvenance,
      connectorInstanceId: '  spaced-instance  ',
      connectorRunId: '  spaced-run  ',
    })
  })

  it('strictly rejects malformed, extra, and invalid connector provenance fields', () => {
    expect(
      captureConnectorProvenanceSchema.safeParse({ ...validProvenance, extra: true }).success,
    ).toBe(false)
    expect(
      captureConnectorProvenanceSchema.safeParse({ ...validProvenance, connectorInstanceId: '' })
        .success,
    ).toBe(false)
    expect(
      captureConnectorProvenanceSchema.safeParse({ ...validProvenance, connectorRunId: '' })
        .success,
    ).toBe(false)
    expect(
      captureConnectorProvenanceSchema.safeParse({ ...validProvenance, executionScopeId: 'short' })
        .success,
    ).toBe(false)
    expect(
      captureConnectorProvenanceSchema.safeParse({
        ...validProvenance,
        executionScopeId: 'has space!',
      }).success,
    ).toBe(false)
    expect(
      captureConnectorProvenanceSchema.safeParse({ ...validProvenance, reportedOrigin: undefined })
        .success,
    ).toBe(false)
    expect(
      captureConnectorProvenanceSchema.safeParse({
        ...validProvenance,
        reportedOrigin: { kind: 'recruiter', name: 'x' },
      }).success,
    ).toBe(false)
  })
})

describe('capture revision connector provenance parsing', () => {
  it('parses revisions when connector provenance is absent, null, and valid', () => {
    const absent = baseRevision()
    expect(captureRevisionSchema.parse(absent)).toEqual(absent)

    const nullProvenance = { ...baseRevision(), connectorProvenance: null }
    expect(captureRevisionSchema.parse(nullProvenance)).toEqual(nullProvenance)

    const valid = { ...baseRevision(), connectorProvenance: validProvenance }
    expect(captureRevisionSchema.parse(valid)).toEqual(valid)
  })

  it('rejects malformed connector provenance on revisions and keeps strict fields', () => {
    expect(
      captureRevisionSchema.safeParse({ ...baseRevision(), connectorProvenance: 'not-an-object' })
        .success,
    ).toBe(false)
    expect(
      captureRevisionSchema.safeParse({
        ...baseRevision(),
        connectorProvenance: { ...validProvenance, unexpected: true },
      }).success,
    ).toBe(false)
    expect(
      captureRevisionSchema.safeParse({ ...baseRevision(), connectorProvenance: 0 }).success,
    ).toBe(false)
  })
})
