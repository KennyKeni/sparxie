import { describe, expect, it } from 'vitest'
import {
  connectorOverviewListQuerySchema,
  connectorOverviewListResultSchema,
  CONNECTOR_OVERVIEW_LIST_KEYSET_ORDER,
  connectorOverviewErrorPayloadSchema,
  connectorOverviewRecordSchema,
  MAX_CONNECTOR_OVERVIEW_LIST_LIMIT,
  valedictorianApiPaths,
} from './index.js'

const overviewRecord = {
  id: 'jobright/session-1',
  connectorId: 'jobright.resolver',
  connectorVersion: '0.1.0',
  displayName: 'Jobright',
  enabled: true,
  health: {
    severity: 'healthy',
    status: 'caught_up',
    statusLabel: 'Caught up',
    summary: 'Synchronized through the newest available job.',
    warningCount: 0,
    warnings: [],
  },
  actionRequired: [],
  actions: [],
  latestRun: {
    id: 'run-9',
    mode: 'manual',
    status: 'completed',
    outcome: 'caught_up',
    observationCount: 12,
    warningCount: 0,
    newestFrontier: { state: 'caught_up' },
    historicalBackfill: {
      state: 'caught_up',
      boundary: { earliestDate: '2026-06-01' },
    },
    pendingResolutionCount: 0,
    startedAt: '2026-07-13T14:00:00.000Z',
    completedAt: '2026-07-13T14:01:00.000Z',
  },
  cooldown: null,
} as const

describe('connector overview record contract', () => {
  it('accepts one sanitized current connector synchronization projection', () => {
    expect(connectorOverviewRecordSchema.parse(overviewRecord)).toEqual(overviewRecord)
  })

  it('rejects credential, session, retry, run-scope, and deployment internals', () => {
    const forbiddenProjections = [
      { ...overviewRecord, auth: [{ id: 'auth-1', configured: true }] },
      { ...overviewRecord, config: { apiToken: 'secret' } },
      { ...overviewRecord, session: { cookieJar: 'secret' } },
      { ...overviewRecord, runnerPid: 1234 },
      {
        ...overviewRecord,
        latestRun: { ...overviewRecord.latestRun, executionScopeId: 'scope_internal' },
      },
      {
        ...overviewRecord,
        latestRun: { ...overviewRecord.latestRun, filterSignature: 'private-filter' },
      },
      {
        ...overviewRecord,
        cooldown: {
          retryAt: '2026-07-13T14:05:00.000Z',
          serverMinimumDelayMs: 300_000,
        },
      },
    ]

    for (const projection of forbiddenProjections) {
      expect(connectorOverviewRecordSchema.safeParse(projection).success).toBe(false)
    }
  })

  it('exposes only the public retry instant for a cooling-down connector', () => {
    const coolingDown = {
      ...overviewRecord,
      health: {
        ...overviewRecord.health,
        severity: 'warning',
        status: 'cooling_down',
        statusLabel: 'Cooling down',
        summary: 'Synchronization can resume after the provider cooldown.',
      },
      actions: [{ id: 'wait', label: 'Wait' }],
      latestRun: {
        ...overviewRecord.latestRun,
        status: 'skipped',
        outcome: 'cooling_down',
        newestFrontier: { state: 'advancing' },
      },
      cooldown: { retryAt: '2026-07-13T14:05:00.000Z' },
    } as const

    expect(connectorOverviewRecordSchema.parse(coolingDown)).toEqual(coolingDown)
  })

  it('rejects caught-up outcomes without caught-up progress and zero pending resolutions', () => {
    const invalidRuns = [
      {
        ...overviewRecord.latestRun,
        newestFrontier: { state: 'advancing' },
      },
      {
        ...overviewRecord.latestRun,
        historicalBackfill: {
          state: 'advancing',
          boundary: { earliestDate: '2026-06-01' },
        },
      },
      {
        ...overviewRecord.latestRun,
        pendingResolutionCount: 1,
      },
    ]

    for (const latestRun of invalidRuns) {
      expect(connectorOverviewRecordSchema.safeParse({
        ...overviewRecord,
        latestRun,
      }).success).toBe(false)
    }
  })

  it('accepts boundary exhaustion only at a reached historical boundary', () => {
    const boundaryExhausted = {
      ...overviewRecord,
      health: {
        ...overviewRecord.health,
        severity: 'warning',
        status: 'boundary_exhausted',
        statusLabel: 'Boundary exhausted',
        summary: 'The configured historical boundary was reached.',
      },
      latestRun: {
        ...overviewRecord.latestRun,
        outcome: 'boundary_exhausted',
        newestFrontier: { state: 'advancing' },
        historicalBackfill: {
          state: 'boundary_reached',
          boundary: { earliestDate: '2026-06-01' },
        },
      },
    } as const

    expect(connectorOverviewRecordSchema.parse(boundaryExhausted)).toEqual(
      boundaryExhausted,
    )
    expect(connectorOverviewRecordSchema.safeParse({
      ...boundaryExhausted,
      latestRun: {
        ...boundaryExhausted.latestRun,
        historicalBackfill: {
          state: 'advancing',
          boundary: { earliestDate: '2026-06-01' },
        },
      },
    }).success).toBe(false)
  })

  it('rejects boundary-exhausted health without a matching current run', () => {
    const health = {
      ...overviewRecord.health,
      severity: 'warning',
      status: 'boundary_exhausted',
      statusLabel: 'Boundary exhausted',
      summary: 'The configured historical boundary was reached.',
    } as const

    expect(connectorOverviewRecordSchema.safeParse({
      ...overviewRecord,
      health,
    }).success).toBe(false)
    expect(connectorOverviewRecordSchema.safeParse({
      ...overviewRecord,
      health,
      latestRun: null,
    }).success).toBe(false)
  })

  it('accepts queued health only with a queued in-progress current run', () => {
    const queued = {
      ...overviewRecord,
      health: {
        ...overviewRecord.health,
        severity: 'warning',
        status: 'queued',
        statusLabel: 'Queued',
        summary: 'Synchronization is queued.',
      },
      latestRun: {
        ...overviewRecord.latestRun,
        status: 'queued',
        outcome: 'in_progress',
        newestFrontier: { state: 'advancing' },
        historicalBackfill: {
          state: 'advancing',
          boundary: { earliestDate: '2026-06-01' },
        },
        completedAt: null,
      },
    } as const

    expect(connectorOverviewRecordSchema.parse(queued)).toEqual(queued)
    expect(connectorOverviewRecordSchema.safeParse({
      ...queued,
      latestRun: { ...queued.latestRun, status: 'running' },
    }).success).toBe(false)
    expect(connectorOverviewRecordSchema.safeParse({
      ...queued,
      latestRun: null,
    }).success).toBe(false)
  })

  it('accepts resolving health only for pending work after frontier advancement', () => {
    const resolving = {
      ...overviewRecord,
      health: {
        ...overviewRecord.health,
        severity: 'warning',
        status: 'resolving',
        statusLabel: 'Resolving',
        summary: 'Resolving synchronized jobs.',
      },
      latestRun: {
        ...overviewRecord.latestRun,
        status: 'running',
        outcome: 'in_progress',
        pendingResolutionCount: 2,
        completedAt: null,
      },
    } as const

    expect(connectorOverviewRecordSchema.parse(resolving)).toEqual(resolving)

    const invalidRuns = [
      { ...resolving.latestRun, status: 'queued' },
      { ...resolving.latestRun, pendingResolutionCount: 0 },
      { ...resolving.latestRun, newestFrontier: { state: 'advancing' } },
      {
        ...resolving.latestRun,
        historicalBackfill: {
          state: 'advancing',
          boundary: { earliestDate: '2026-06-01' },
        },
      },
    ]

    for (const latestRun of invalidRuns) {
      expect(connectorOverviewRecordSchema.safeParse({
        ...resolving,
        latestRun,
      }).success).toBe(false)
    }
    expect(connectorOverviewRecordSchema.safeParse({
      ...resolving,
      latestRun: null,
    }).success).toBe(false)
  })

  it('accepts failed health only with a failed current run', () => {
    const failed = {
      ...overviewRecord,
      health: {
        ...overviewRecord.health,
        severity: 'blocked',
        status: 'failed',
        statusLabel: 'Failed',
        summary: 'Synchronization failed.',
      },
      latestRun: {
        ...overviewRecord.latestRun,
        status: 'failed',
        outcome: 'failed',
        newestFrontier: { state: 'advancing' },
      },
    } as const

    expect(connectorOverviewRecordSchema.parse(failed)).toEqual(failed)
    expect(connectorOverviewRecordSchema.safeParse({
      ...failed,
      latestRun: overviewRecord.latestRun,
    }).success).toBe(false)
    expect(connectorOverviewRecordSchema.safeParse({
      ...failed,
      latestRun: null,
    }).success).toBe(false)
  })

  it('allows authentication-required health over a prior caught-up run', () => {
    const authenticationRequired = {
      ...overviewRecord,
      health: {
        ...overviewRecord.health,
        severity: 'blocked',
        status: 'authentication_required',
        statusLabel: 'Authentication required',
        summary: 'Reconnect the connector to synchronize again.',
      },
      actionRequired: [{
        id: 'auth-1',
        kind: 'auth',
        label: 'Reconnect',
        message: 'The provider session expired.',
        severity: 'blocked',
      }],
      actions: [{ id: 'reconnect', label: 'Reconnect' }],
    } as const

    expect(connectorOverviewRecordSchema.parse(authenticationRequired)).toEqual(
      authenticationRequired,
    )
  })

  it('allows a generic configuration block over a prior caught-up run', () => {
    const configurationBlocked = {
      ...overviewRecord,
      health: {
        ...overviewRecord.health,
        severity: 'blocked',
        status: 'blocked',
        statusLabel: 'Configuration required',
        summary: 'Update the connector configuration.',
      },
      actionRequired: [{
        id: 'configuration-1',
        kind: 'configuration',
        label: 'Configure',
        message: 'A required provider setting is missing.',
        severity: 'blocked',
      }],
      actions: [{ id: 'configure', label: 'Configure' }],
    } as const

    expect(connectorOverviewRecordSchema.parse(configurationBlocked)).toEqual(
      configurationBlocked,
    )
  })

  it('accepts source exhaustion only with exhausted historical source state', () => {
    const sourceExhausted = {
      ...overviewRecord,
      health: {
        ...overviewRecord.health,
        severity: 'warning',
        status: 'source_exhausted',
        statusLabel: 'Source exhausted',
        summary: 'The provider has no more historical jobs.',
      },
      latestRun: {
        ...overviewRecord.latestRun,
        outcome: 'source_exhausted',
        newestFrontier: { state: 'advancing' },
        historicalBackfill: {
          state: 'source_exhausted',
          boundary: { earliestDate: '2026-06-01' },
        },
      },
    } as const

    expect(connectorOverviewRecordSchema.parse(sourceExhausted)).toEqual(
      sourceExhausted,
    )
    expect(connectorOverviewRecordSchema.safeParse({
      ...sourceExhausted,
      latestRun: {
        ...sourceExhausted.latestRun,
        historicalBackfill: {
          state: 'advancing',
          boundary: { earliestDate: '2026-06-01' },
        },
      },
    }).success).toBe(false)
  })

  it('requires completed status for successful synchronization outcomes', () => {
    const successfulRuns = [
      overviewRecord.latestRun,
      {
        ...overviewRecord.latestRun,
        outcome: 'boundary_exhausted',
        newestFrontier: { state: 'advancing' },
        historicalBackfill: {
          state: 'boundary_reached',
          boundary: { earliestDate: '2026-06-01' },
        },
      },
      {
        ...overviewRecord.latestRun,
        outcome: 'source_exhausted',
        newestFrontier: { state: 'advancing' },
        historicalBackfill: {
          state: 'source_exhausted',
          boundary: { earliestDate: '2026-06-01' },
        },
      },
    ]

    for (const latestRun of successfulRuns) {
      expect(connectorOverviewRecordSchema.safeParse({
        ...overviewRecord,
        health: {
          ...overviewRecord.health,
          severity: 'warning',
          status: 'blocked',
        },
        latestRun: { ...latestRun, status: 'skipped' },
      }).success).toBe(false)
    }
  })

  it('rejects internally inconsistent health, latest-run, and cooldown projections', () => {
    expect(connectorOverviewRecordSchema.safeParse({
      ...overviewRecord,
      health: { ...overviewRecord.health, warningCount: 1 },
    }).success).toBe(false)
    expect(connectorOverviewRecordSchema.safeParse({
      ...overviewRecord,
      latestRun: { ...overviewRecord.latestRun, status: 'running' },
    }).success).toBe(false)
    expect(connectorOverviewRecordSchema.safeParse({
      ...overviewRecord,
      cooldown: { retryAt: '2026-07-13T14:05:00.000Z' },
    }).success).toBe(false)
    expect(connectorOverviewRecordSchema.safeParse({
      ...overviewRecord,
      latestRun: null,
    }).success).toBe(false)
    expect(connectorOverviewRecordSchema.safeParse({
      ...overviewRecord,
      health: {
        ...overviewRecord.health,
        severity: 'blocked',
        status: 'authentication_required',
      },
    }).success).toBe(false)
  })
})

describe('connector overview list query contract', () => {
  it('exposes the workspace-relative connector overview path', () => {
    expect(valedictorianApiPaths.connectorOverview).toBe('/v1/connectors/overview')
  })

  it('accepts bounded public filters and rejects offsets or unknown filters', () => {
    expect(MAX_CONNECTOR_OVERVIEW_LIST_LIMIT).toBe(100)
    expect(connectorOverviewListQuerySchema.parse({
      cursor: 'opaque-filter-bound-cursor',
      limit: 25,
      enabled: true,
      severity: 'warning',
      status: 'cooling_down',
    })).toEqual({
      cursor: 'opaque-filter-bound-cursor',
      limit: 25,
      enabled: true,
      severity: 'warning',
      status: 'cooling_down',
    })
    expect(connectorOverviewListQuerySchema.safeParse({ limit: 0 }).success).toBe(false)
    expect(connectorOverviewListQuerySchema.safeParse({ limit: 101 }).success).toBe(false)
    expect(connectorOverviewListQuerySchema.safeParse({ cursor: '' }).success).toBe(false)
    expect(connectorOverviewListQuerySchema.safeParse({ offset: 0 }).success).toBe(false)
    expect(connectorOverviewListQuerySchema.safeParse({ search: 'jobright' }).success).toBe(false)
  })

  it('exposes a bounded public error for invalid or filter-mismatched cursors', () => {
    expect(connectorOverviewErrorPayloadSchema.parse({
      code: 'invalid_connector_overview_cursor',
      message: 'The overview cursor is invalid for these filters.',
    })).toEqual({
      code: 'invalid_connector_overview_cursor',
      message: 'The overview cursor is invalid for these filters.',
    })
    expect(connectorOverviewErrorPayloadSchema.safeParse({
      code: 'connector_overview_query_failed',
      message: 'database unavailable',
      retryState: { attempt: 4 },
    }).success).toBe(false)
  })
})

describe('connector overview list result contract', () => {
  it('represents an empty bounded page without a total or history count', () => {
    expect(connectorOverviewListResultSchema.parse({
      items: [],
      nextCursor: null,
    })).toEqual({
      items: [],
      nextCursor: null,
    })
    expect(connectorOverviewListResultSchema.safeParse({
      items: [],
      nextCursor: null,
      total: 0,
    }).success).toBe(false)
  })

  it('requires stable connector id ASC keyset order within every page', () => {
    expect(CONNECTOR_OVERVIEW_LIST_KEYSET_ORDER).toEqual([
      { field: 'id', direction: 'asc', collation: 'utf8_bytewise' },
    ])

    const first = { ...overviewRecord, id: 'connector-a' }
    const second = { ...overviewRecord, id: 'connector-b' }
    expect(connectorOverviewListResultSchema.parse({
      items: [first, second],
      nextCursor: 'opaque-last-id',
    })).toEqual({ items: [first, second], nextCursor: 'opaque-last-id' })
    expect(connectorOverviewListResultSchema.safeParse({
      items: [second, first],
      nextCursor: null,
    }).success).toBe(false)
    expect(connectorOverviewListResultSchema.safeParse({
      items: [first, first],
      nextCursor: null,
    }).success).toBe(false)
  })
})
