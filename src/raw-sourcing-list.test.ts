import { describe, expect, it } from 'vitest'
import {
  RAW_SOURCE_RECORDS_LIST_ID_TIE_BREAK,
  RAW_SOURCE_RECORDS_LIST_KEYSET_ORDER,
  compareIsoInstants,
  compareUtf8Bytewise,
  rawSourceRecordSummarySchema,
  rawSourceRecordsListQuerySchema,
  rawSourceRecordsListQueryToSearchParams,
  rawSourceRecordsListResultSchema,
} from './raw-sourcing-list.js'
import { rawSourceRecordInputSchema } from './raw-sourcing.js'

const sparseRawOnlySummary = {
  id: 'raw-1',
  sourceEntityId: null,
  adapter: { id: 'valedictorian-cli', kind: 'cli', version: '0.12.0' },
  reportedOrigin: null,
  connectorInstanceId: null,
  latestConnectorRunId: null,
  providerRecordId: null,
  companyName: null,
  roleTitle: null,
  createdAt: '2026-07-10T14:00:00.000Z',
  firstObservedAt: '2026-07-10T14:00:00.000Z',
  lastObservedAt: '2026-07-10T14:00:00.000Z',
  firstReceivedAt: '2026-07-10T14:00:01.000Z',
  lastReceivedAt: '2026-07-10T14:00:01.000Z',
  occurrenceCount: 1,
  revisionCount: 1,
  latestRevision: {
    id: 'revision-1',
    revision: 1,
    observedAt: '2026-07-10T14:00:00.000Z',
    createdAt: '2026-07-10T14:00:01.000Z',
  },
  normalizationStatus: 'raw_only',
  normalizationUpdatedAt: null,
  normalizationRawRevisionId: null,
  gateStatus: null,
  canonicalCandidateId: null,
  projectionStatus: 'not_eligible',
  findingId: null,
} as const

const completedProjectedSummary = {
  id: 'raw-2',
  sourceEntityId: 'entity-2',
  adapter: { id: 'jobright', kind: 'connector', version: '2.1.0' },
  reportedOrigin: { kind: 'job_board', name: 'Jobright', providerId: 'jr' },
  connectorInstanceId: 'connector-instance-1',
  latestConnectorRunId: 'connector-run-9',
  providerRecordId: 'provider-job-42',
  companyName: 'Acme',
  roleTitle: 'Engineer',
  createdAt: '2026-07-10T12:00:00.000Z',
  firstObservedAt: '2026-07-10T12:00:00.000Z',
  lastObservedAt: '2026-07-11T09:00:00.000Z',
  firstReceivedAt: '2026-07-10T12:00:01.000Z',
  lastReceivedAt: '2026-07-11T09:00:02.000Z',
  occurrenceCount: 3,
  revisionCount: 2,
  latestRevision: {
    id: 'revision-2',
    revision: 2,
    observedAt: '2026-07-11T09:00:00.000Z',
    createdAt: '2026-07-11T09:00:02.000Z',
  },
  normalizationStatus: 'completed',
  normalizationUpdatedAt: '2026-07-11T09:05:00.000Z',
  normalizationRawRevisionId: 'revision-2',
  gateStatus: 'passed',
  canonicalCandidateId: 'candidate-2',
  projectionStatus: 'projected',
  findingId: 'finding-2',
} as const

describe('raw source record list summary contract', () => {
  it('parses a sparse raw-only summary without payload or sensitive fields', () => {
    expect(rawSourceRecordSummarySchema.parse(sparseRawOnlySummary)).toEqual(sparseRawOnlySummary)
    expect(
      rawSourceRecordSummarySchema.safeParse({
        ...sparseRawOnlySummary,
        payload: { title: 'hidden' },
      }).success,
    ).toBe(false)
    expect(
      rawSourceRecordSummarySchema.safeParse({
        ...sparseRawOnlySummary,
        reportedOrigin: {
          kind: 'job_board',
          name: 'LinkedIn',
          url: 'https://linkedin.com/jobs/1',
        },
      }).success,
    ).toBe(false)
  })

  it('parses a reconciled completed and projected summary and rejects impossible lineages', () => {
    expect(rawSourceRecordSummarySchema.parse(completedProjectedSummary)).toEqual(
      completedProjectedSummary,
    )

    const impossible = [
      {
        ...completedProjectedSummary,
        normalizationStatus: 'completed',
        gateStatus: 'passed',
        canonicalCandidateId: null,
      },
      {
        ...completedProjectedSummary,
        normalizationStatus: 'completed',
        gateStatus: 'needs_enrichment',
        canonicalCandidateId: 'candidate-2',
        projectionStatus: 'not_eligible',
        findingId: null,
      },
      {
        ...completedProjectedSummary,
        normalizationStatus: 'pending',
        gateStatus: 'passed',
        canonicalCandidateId: 'candidate-2',
        projectionStatus: 'not_eligible',
        findingId: null,
      },
      {
        ...completedProjectedSummary,
        normalizationStatus: 'raw_only',
        normalizationUpdatedAt: null,
        gateStatus: null,
        canonicalCandidateId: null,
        projectionStatus: 'projected',
        findingId: 'finding-2',
      },
      {
        ...completedProjectedSummary,
        projectionStatus: 'pending',
        findingId: 'finding-2',
      },
      {
        ...completedProjectedSummary,
        occurrenceCount: 0,
      },
      {
        ...completedProjectedSummary,
        firstReceivedAt: '2026-07-12T00:00:00.000Z',
        lastReceivedAt: '2026-07-11T09:00:02.000Z',
      },
    ]

    for (const row of impossible) {
      expect(rawSourceRecordSummarySchema.safeParse(row).success).toBe(false)
    }
  })

  it('enforces adapter capture, projection eligibility, lineage, origin, and revision identity', () => {
    const pendingPassed = {
      ...completedProjectedSummary,
      projectionStatus: 'pending',
      findingId: null,
    }
    const failedProjection = {
      ...completedProjectedSummary,
      projectionStatus: 'failed',
      findingId: null,
    }
    const needsEnrichment = {
      ...completedProjectedSummary,
      gateStatus: 'needs_enrichment',
      canonicalCandidateId: null,
      projectionStatus: 'not_eligible',
      findingId: null,
    }
    const unfinished = {
      ...sparseRawOnlySummary,
      normalizationStatus: 'pending',
      normalizationUpdatedAt: '2026-07-10T14:01:00.000Z',
      normalizationRawRevisionId: 'revision-1',
    }
    const originWithoutProviderId = {
      ...sparseRawOnlySummary,
      reportedOrigin: { kind: 'job_board', name: 'LinkedIn' },
    }
    const originWithNullProviderId = {
      ...sparseRawOnlySummary,
      reportedOrigin: { kind: 'job_board', name: 'LinkedIn', providerId: null },
    }

    expect(rawSourceRecordSummarySchema.parse(pendingPassed)).toEqual(pendingPassed)
    expect(rawSourceRecordSummarySchema.parse(failedProjection)).toEqual(failedProjection)
    expect(rawSourceRecordSummarySchema.parse(needsEnrichment)).toEqual(needsEnrichment)
    expect(rawSourceRecordSummarySchema.parse(unfinished)).toEqual(unfinished)
    expect(rawSourceRecordSummarySchema.parse(originWithNullProviderId)).toEqual(
      originWithNullProviderId,
    )

    const rejected = [
      {
        ...completedProjectedSummary,
        projectionStatus: 'not_eligible',
        findingId: null,
      },
      {
        ...completedProjectedSummary,
        connectorInstanceId: null,
        latestConnectorRunId: null,
      },
      {
        ...sparseRawOnlySummary,
        connectorInstanceId: 'connector-instance-1',
        latestConnectorRunId: 'connector-run-1',
      },
      {
        ...sparseRawOnlySummary,
        adapter: { id: 'jobright', kind: 'connector', version: '2.1.0' },
      },
      {
        ...completedProjectedSummary,
        latestRevision: { ...completedProjectedSummary.latestRevision, revision: 1 },
      },
      {
        ...completedProjectedSummary,
        revisionCount: 4,
        latestRevision: { ...completedProjectedSummary.latestRevision, revision: 4 },
      },
      {
        ...completedProjectedSummary,
        latestRevision: {
          ...completedProjectedSummary.latestRevision,
          observedAt: '2026-07-09T00:00:00.000Z',
        },
      },
      {
        ...completedProjectedSummary,
        latestRevision: {
          ...completedProjectedSummary.latestRevision,
          createdAt: '2026-07-09T00:00:00.000Z',
        },
      },
      {
        ...completedProjectedSummary,
        latestRevision: {
          ...completedProjectedSummary.latestRevision,
          createdAt: '2026-07-12T00:00:00.000Z',
        },
      },
      originWithoutProviderId,
      {
        ...completedProjectedSummary,
        normalizationRawRevisionId: null,
      },
      {
        ...completedProjectedSummary,
        normalizationRawRevisionId: 'revision-other',
      },
      {
        ...sparseRawOnlySummary,
        normalizationRawRevisionId: 'revision-1',
      },
    ]

    for (const row of rejected) {
      expect(rawSourceRecordSummarySchema.safeParse(row).success).toBe(false)
    }
  })

  it('rejects normalizationUpdatedAt that precedes latestRevision.createdAt', () => {
    const inverted = {
      ...completedProjectedSummary,
      latestRevision: {
        ...completedProjectedSummary.latestRevision,
        createdAt: '2026-07-11T09:00:02.000Z',
      },
      normalizationUpdatedAt: '2026-07-11T09:00:01.999Z',
    }

    expect(rawSourceRecordSummarySchema.safeParse(inverted).success).toBe(false)

    const equalAllowed = {
      ...completedProjectedSummary,
      lastReceivedAt: '2026-07-11T09:00:02.0001Z',
      latestRevision: {
        ...completedProjectedSummary.latestRevision,
        createdAt: '2026-07-11T09:00:02.0001Z',
      },
      normalizationUpdatedAt: '2026-07-11T05:00:02.0001-04:00',
    }
    expect(rawSourceRecordSummarySchema.parse(equalAllowed)).toEqual(equalAllowed)

    expect(
      rawSourceRecordSummarySchema.parse({
        ...sparseRawOnlySummary,
        normalizationStatus: 'raw_only',
        normalizationUpdatedAt: null,
        normalizationRawRevisionId: null,
      }),
    ).toEqual(sparseRawOnlySummary)
  })

  it('rejects each forbidden response class on summary rows', () => {
    const forbidden = [
      { payload: { title: 'hidden' } },
      { evidence: [{ kind: 'raw', label: 'body', value: '{}' }] },
      { contentHash: 'abc123' },
      { destinationUrl: 'https://example.com/apply' },
      { sourceUrl: 'https://example.com/job' },
      { url: 'https://example.com' },
      { headers: { authorization: 'Bearer secret' } },
      { cookies: 'session=abc' },
      { auth: { token: 'secret' } },
      { session: { id: 'sess-1' } },
      { credentials: { password: 'secret' } },
      { attempts: [] },
      { fieldOutcomes: [] },
      { providerData: { arbitrary: true } },
      { extraProviderField: 'nope' },
    ]

    for (const fields of forbidden) {
      expect(
        rawSourceRecordSummarySchema.safeParse({
          ...sparseRawOnlySummary,
          ...fields,
        }).success,
      ).toBe(false)
    }
  })

  it('represents intake-accepted identity scalars without new summary output caps', () => {
    const longIdentity = 'i'.repeat(257)
    const longDisplay = 'd'.repeat(513)

    expect(
      rawSourceRecordInputSchema.safeParse({
        intakeItemId: 'item-1',
        observedAt: '2026-07-10T14:00:00.000Z',
        adapter: { id: longIdentity, kind: 'cli', version: longIdentity },
        providerRecordId: longIdentity,
        reportedOrigin: {
          kind: 'job_board',
          name: longDisplay,
          providerId: longIdentity,
        },
      }).success,
    ).toBe(true)

    const truthfulSparseSummary = {
      ...sparseRawOnlySummary,
      id: longIdentity,
      sourceEntityId: longIdentity,
      adapter: { id: longIdentity, kind: 'cli' as const, version: longIdentity },
      reportedOrigin: {
        kind: 'job_board' as const,
        name: longDisplay,
        providerId: longIdentity,
      },
      providerRecordId: longIdentity,
      companyName: longDisplay,
      roleTitle: longDisplay,
      latestRevision: {
        ...sparseRawOnlySummary.latestRevision,
        id: longIdentity,
      },
    }

    expect(rawSourceRecordSummarySchema.parse(truthfulSparseSummary)).toEqual(
      truthfulSparseSummary,
    )

    const connectorProjectedLong = {
      ...completedProjectedSummary,
      id: longIdentity,
      sourceEntityId: longIdentity,
      adapter: { id: longIdentity, kind: 'connector' as const, version: longIdentity },
      reportedOrigin: {
        kind: 'job_board' as const,
        name: longDisplay,
        providerId: longIdentity,
      },
      connectorInstanceId: longIdentity,
      latestConnectorRunId: longIdentity,
      providerRecordId: longIdentity,
      companyName: longDisplay,
      roleTitle: longDisplay,
      latestRevision: {
        ...completedProjectedSummary.latestRevision,
        id: longIdentity,
      },
      normalizationRawRevisionId: longIdentity,
      canonicalCandidateId: longIdentity,
      findingId: longIdentity,
    }

    expect(rawSourceRecordSummarySchema.parse(connectorProjectedLong)).toEqual(
      connectorProjectedLong,
    )
  })

  it('lists intake-accepted empty-string provider identity scalars losslessly', () => {
    expect(
      rawSourceRecordInputSchema.safeParse({
        intakeItemId: 'item-1',
        observedAt: '2026-07-10T14:00:00.000Z',
        adapter: { id: 'valedictorian-cli', kind: 'cli', version: '0.12.0' },
        providerRecordId: '',
        reportedOrigin: {
          kind: 'job_board',
          name: 'LinkedIn',
          providerId: '',
        },
      }).success,
    ).toBe(true)

    const emptyProviderSummary = {
      ...sparseRawOnlySummary,
      reportedOrigin: {
        kind: 'job_board' as const,
        name: 'LinkedIn',
        providerId: '',
      },
      providerRecordId: '',
    }

    expect(rawSourceRecordSummarySchema.parse(emptyProviderSummary)).toEqual(
      emptyProviderSummary,
    )
  })
})

describe('raw source records list keyset pagination', () => {
  it('exports lastReceivedAt DESC then id DESC and validates equal-timestamp pages', () => {
    expect(RAW_SOURCE_RECORDS_LIST_KEYSET_ORDER).toEqual([
      { field: 'lastReceivedAt', direction: 'desc' },
      { field: 'id', direction: 'desc' },
    ])
    expect(RAW_SOURCE_RECORDS_LIST_ID_TIE_BREAK).toEqual({
      field: 'id',
      direction: 'desc',
      collation: 'utf8_bytewise',
      encoding: 'utf8',
      backends: {
        sqlite: 'BINARY',
        postgres: 'COLLATE "C"',
      },
    })

    const earlier = {
      ...sparseRawOnlySummary,
      id: 'raw-b',
      lastReceivedAt: '2026-07-10T14:00:01.000Z',
    }
    const laterSameInstant = {
      ...sparseRawOnlySummary,
      id: 'raw-a',
      lastReceivedAt: '2026-07-10T14:00:01.000Z',
    }
    const older = {
      ...sparseRawOnlySummary,
      id: 'raw-c',
      createdAt: '2026-07-10T13:00:00.000Z',
      firstObservedAt: '2026-07-10T13:00:00.000Z',
      lastObservedAt: '2026-07-10T13:00:00.000Z',
      firstReceivedAt: '2026-07-10T13:00:01.000Z',
      lastReceivedAt: '2026-07-10T13:00:01.000Z',
      latestRevision: {
        ...sparseRawOnlySummary.latestRevision,
        id: 'revision-c',
        observedAt: '2026-07-10T13:00:00.000Z',
        createdAt: '2026-07-10T13:00:01.000Z',
      },
    }

    expect(
      rawSourceRecordsListResultSchema.parse({
        items: [earlier, laterSameInstant, older],
        nextCursor: 'opaque-lastReceivedAt+id',
      }),
    ).toEqual({
      items: [earlier, laterSameInstant, older],
      nextCursor: 'opaque-lastReceivedAt+id',
    })

    expect(
      rawSourceRecordsListResultSchema.safeParse({
        items: [laterSameInstant, earlier],
        nextCursor: null,
      }).success,
    ).toBe(false)
    expect(
      rawSourceRecordsListResultSchema.safeParse({
        items: [older, earlier],
        nextCursor: null,
      }).success,
    ).toBe(false)
  })

  it('tie-breaks equal timestamps by UTF-8 bytewise id DESC, not JS UTF-16', () => {
    // U+10000 encodes as F0 90 80 80; U+E000 encodes as EE 80 80.
    // UTF-8 / SQLite BINARY / PostgreSQL COLLATE "C" DESC: U+10000 before U+E000.
    // JS UTF-16 code-unit DESC would reverse that pair.
    const idSupplementary = `raw-\u{10000}`
    const idPrivateUse = `raw-\u{E000}`
    expect(idSupplementary < idPrivateUse).toBe(true)

    const higherUtf8Id = {
      ...sparseRawOnlySummary,
      id: idSupplementary,
    }
    const lowerUtf8Id = {
      ...sparseRawOnlySummary,
      id: idPrivateUse,
    }

    expect(
      rawSourceRecordsListResultSchema.parse({
        items: [higherUtf8Id, lowerUtf8Id],
        nextCursor: null,
      }),
    ).toEqual({
      items: [higherUtf8Id, lowerUtf8Id],
      nextCursor: null,
    })
    expect(
      rawSourceRecordsListResultSchema.safeParse({
        items: [lowerUtf8Id, higherUtf8Id],
        nextCursor: null,
      }).success,
    ).toBe(false)
    expect(compareUtf8Bytewise(idSupplementary, idPrivateUse)).toBeGreaterThan(0)
  })

  it('rejects lone-surrogate summary ids that collapse under UTF-8 encoding', () => {
    const loneHigh = '\uD800'
    const loneLow = '\uD801'
    expect(loneHigh).not.toBe(loneLow)
    expect(compareUtf8Bytewise(loneHigh, loneLow)).toBe(0)

    expect(
      rawSourceRecordSummarySchema.safeParse({
        ...sparseRawOnlySummary,
        id: loneHigh,
      }).success,
    ).toBe(false)
    expect(
      rawSourceRecordSummarySchema.safeParse({
        ...sparseRawOnlySummary,
        id: loneLow,
      }).success,
    ).toBe(false)

    expect(
      rawSourceRecordsListResultSchema.safeParse({
        items: [
          { ...sparseRawOnlySummary, id: loneHigh },
          { ...sparseRawOnlySummary, id: loneLow },
        ],
        nextCursor: null,
      }).success,
    ).toBe(false)

    expect(RAW_SOURCE_RECORDS_LIST_ID_TIE_BREAK).toMatchObject({
      encoding: 'utf8',
      collation: 'utf8_bytewise',
      backends: {
        sqlite: 'BINARY',
        postgres: 'COLLATE "C"',
      },
    })
  })

  it('rejects pages larger than MAX_RAW_SOURCE_LIST_LIMIT', () => {
    const items = Array.from({ length: 101 }, (_, index) => ({
      ...sparseRawOnlySummary,
      id: `raw-${String(101 - index).padStart(3, '0')}`,
    }))

    expect(
      rawSourceRecordsListResultSchema.safeParse({
        items,
        nextCursor: null,
      }).success,
    ).toBe(false)
    expect(
      rawSourceRecordsListResultSchema.safeParse({
        items: items.slice(0, 100),
        nextCursor: null,
      }).success,
    ).toBe(true)
  })

  it('orders and validates instants by exact ISO timeline, not Date.parse milliseconds', () => {
    expect(Date.parse('2026-07-10T14:00:00.0002Z')).toBe(
      Date.parse('2026-07-10T14:00:00.0001Z'),
    )

    expect(
      rawSourceRecordsListQuerySchema.safeParse({
        receivedFrom: '2026-07-10T14:00:00.0002Z',
        receivedTo: '2026-07-10T14:00:00.0001Z',
      }).success,
    ).toBe(false)
    expect(
      rawSourceRecordsListQuerySchema.safeParse({
        receivedFrom: '2026-07-10T10:00:00.000-04:00',
        receivedTo: '2026-07-10T14:00:00.000Z',
      }).success,
    ).toBe(true)
    expect(
      rawSourceRecordsListQuerySchema.safeParse({
        receivedFrom: '2026-07-10T14:00:00.0001Z',
        receivedTo: '2026-07-10T10:00:00.0002-04:00',
      }).success,
    ).toBe(true)

    const laterSubMs = {
      ...sparseRawOnlySummary,
      id: 'raw-later',
      lastReceivedAt: '2026-07-10T14:00:01.0002Z',
      firstReceivedAt: '2026-07-10T14:00:01.0002Z',
      latestRevision: {
        ...sparseRawOnlySummary.latestRevision,
        createdAt: '2026-07-10T14:00:01.0002Z',
      },
    }
    const earlierSubMs = {
      ...sparseRawOnlySummary,
      id: 'raw-earlier',
      lastReceivedAt: '2026-07-10T14:00:01.0001Z',
      firstReceivedAt: '2026-07-10T14:00:01.0001Z',
      latestRevision: {
        ...sparseRawOnlySummary.latestRevision,
        id: 'revision-earlier',
        createdAt: '2026-07-10T14:00:01.0001Z',
      },
    }

    expect(
      rawSourceRecordsListResultSchema.parse({
        items: [laterSubMs, earlierSubMs],
        nextCursor: null,
      }),
    ).toEqual({
      items: [laterSubMs, earlierSubMs],
      nextCursor: null,
    })
    expect(
      rawSourceRecordsListResultSchema.safeParse({
        items: [earlierSubMs, laterSubMs],
        nextCursor: null,
      }).success,
    ).toBe(false)

    const offsetTwinHigherId = {
      ...sparseRawOnlySummary,
      id: 'raw-b',
      lastReceivedAt: '2026-07-10T10:00:01.000-04:00',
      firstReceivedAt: '2026-07-10T10:00:01.000-04:00',
      latestRevision: {
        ...sparseRawOnlySummary.latestRevision,
        createdAt: '2026-07-10T10:00:01.000-04:00',
      },
    }
    const utcTwinLowerId = {
      ...sparseRawOnlySummary,
      id: 'raw-a',
      lastReceivedAt: '2026-07-10T14:00:01.000Z',
    }

    expect(
      rawSourceRecordsListResultSchema.parse({
        items: [offsetTwinHigherId, utcTwinLowerId],
        nextCursor: null,
      }),
    ).toEqual({
      items: [offsetTwinHigherId, utcTwinLowerId],
      nextCursor: null,
    })

    expect(
      rawSourceRecordSummarySchema.safeParse({
        ...sparseRawOnlySummary,
        firstReceivedAt: '2026-07-10T14:00:01.0002Z',
        lastReceivedAt: '2026-07-10T14:00:01.0001Z',
        latestRevision: {
          ...sparseRawOnlySummary.latestRevision,
          createdAt: '2026-07-10T14:00:01.0002Z',
        },
      }).success,
    ).toBe(false)

    expect(compareIsoInstants('2026-07-10T14:00:00.0002Z', '2026-07-10T14:00:00.0001Z')).toBeGreaterThan(
      0,
    )
    expect(compareIsoInstants('2026-07-10T10:00:00.000-04:00', '2026-07-10T14:00:00.000Z')).toBe(0)
    expect(
      compareIsoInstants('2026-07-10T14:00:00.0001Z', '2026-07-10T10:00:00.0002-04:00'),
    ).toBeLessThan(0)
  })

  it('accepts minute-precision offset-equivalent instants without throwing', () => {
    expect(
      rawSourceRecordsListQuerySchema.safeParse({
        receivedFrom: '2026-07-10T10:00-04:00',
        receivedTo: '2026-07-10T14:00Z',
      }),
    ).toEqual({
      success: true,
      data: {
        receivedFrom: '2026-07-10T10:00-04:00',
        receivedTo: '2026-07-10T14:00Z',
      },
    })

    const minutePrecisionSummary = {
      ...sparseRawOnlySummary,
      createdAt: '2026-07-10T14:00Z',
      firstObservedAt: '2026-07-10T10:00-04:00',
      lastObservedAt: '2026-07-10T14:00Z',
      firstReceivedAt: '2026-07-10T10:00-04:00',
      lastReceivedAt: '2026-07-10T14:00Z',
      latestRevision: {
        ...sparseRawOnlySummary.latestRevision,
        observedAt: '2026-07-10T10:00-04:00',
        createdAt: '2026-07-10T14:00Z',
      },
    }

    expect(rawSourceRecordSummarySchema.safeParse(minutePrecisionSummary)).toEqual({
      success: true,
      data: minutePrecisionSummary,
    })

    expect(
      rawSourceRecordsListResultSchema.safeParse({
        items: [minutePrecisionSummary],
        nextCursor: null,
      }),
    ).toEqual({
      success: true,
      data: {
        items: [minutePrecisionSummary],
        nextCursor: null,
      },
    })

    expect(compareIsoInstants('2026-07-10T10:00-04:00', '2026-07-10T14:00Z')).toBe(0)
    expect(compareIsoInstants('2026-07-10T14:00Z', '2026-07-10T14:00:00Z')).toBe(0)
  })
})

describe('raw source records list query contract', () => {
  it('rejects invalid filters and encodes allowlisted keys in deterministic order', () => {
    expect(rawSourceRecordsListQuerySchema.parse({})).toEqual({})
    expect(
      rawSourceRecordsListQuerySchema.parse({
        cursor: 'opaque-cursor',
        limit: 25,
        adapterId: 'jobright',
        adapterKind: 'connector',
        connectorInstanceId: 'connector-instance-1',
        receivedFrom: '2026-07-10T00:00:00.000Z',
        receivedTo: '2026-07-11T00:00:00.000Z',
        normalizationStatus: 'raw_only',
        gateStatus: 'passed',
        projectionStatus: 'projected',
      }),
    ).toEqual({
      cursor: 'opaque-cursor',
      limit: 25,
      adapterId: 'jobright',
      adapterKind: 'connector',
      connectorInstanceId: 'connector-instance-1',
      receivedFrom: '2026-07-10T00:00:00.000Z',
      receivedTo: '2026-07-11T00:00:00.000Z',
      normalizationStatus: 'raw_only',
      gateStatus: 'passed',
      projectionStatus: 'projected',
    })

    expect(rawSourceRecordsListQuerySchema.safeParse({ limit: 0 }).success).toBe(false)
    expect(rawSourceRecordsListQuerySchema.safeParse({ limit: 101 }).success).toBe(false)
    expect(rawSourceRecordsListQuerySchema.safeParse({ cursor: '' }).success).toBe(false)
    expect(
      rawSourceRecordsListQuerySchema.safeParse({
        receivedFrom: '2026-07-12T00:00:00.000Z',
        receivedTo: '2026-07-11T00:00:00.000Z',
      }).success,
    ).toBe(false)
    expect(
      rawSourceRecordsListQuerySchema.safeParse({
        normalizationStatus: 'admitted',
      }).success,
    ).toBe(false)
    expect(
      rawSourceRecordsListQuerySchema.safeParse({
        projectionStatus: 'partial_success',
      }).success,
    ).toBe(false)
    expect(
      rawSourceRecordsListQuerySchema.safeParse({
        offset: 10,
      }).success,
    ).toBe(false)

    const params = rawSourceRecordsListQueryToSearchParams({
      projectionStatus: 'projected',
      limit: 10,
      cursor: 'next',
      adapterKind: 'cli',
      receivedTo: '2026-07-11T00:00:00.000Z',
      adapterId: 'valedictorian-cli',
      gateStatus: 'needs_enrichment',
      connectorInstanceId: 'ignored-for-order',
      receivedFrom: '2026-07-10T00:00:00.000Z',
      normalizationStatus: 'completed',
      unknown: 'drop-me',
    } as Parameters<typeof rawSourceRecordsListQueryToSearchParams>[0] & {
      unknown: string
    })

    expect([...params.keys()]).toEqual([
      'cursor',
      'limit',
      'adapterId',
      'adapterKind',
      'connectorInstanceId',
      'receivedFrom',
      'receivedTo',
      'normalizationStatus',
      'gateStatus',
      'projectionStatus',
    ])
    expect(params.toString()).toBe(
      [
        'cursor=next',
        'limit=10',
        'adapterId=valedictorian-cli',
        'adapterKind=cli',
        'connectorInstanceId=ignored-for-order',
        'receivedFrom=2026-07-10T00%3A00%3A00.000Z',
        'receivedTo=2026-07-11T00%3A00%3A00.000Z',
        'normalizationStatus=completed',
        'gateStatus=needs_enrichment',
        'projectionStatus=projected',
      ].join('&'),
    )
  })
})
