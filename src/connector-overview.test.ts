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

function runBackedOverviewCases() {
  const running = {
    ...overviewRecord.latestRun,
    status: 'running',
    outcome: 'in_progress',
    completedAt: null,
  } as const

  return [
    { status: 'never_run', latestRun: null, cooldown: null },
    {
      status: 'queued',
      latestRun: {
        ...running,
        status: 'queued',
        newestFrontier: { state: 'advancing' },
        historicalBackfill: {
          state: 'advancing',
          boundary: { earliestDate: '2026-06-01' },
        },
      },
      cooldown: null,
    },
    {
      status: 'checking_newest',
      latestRun: {
        ...running,
        newestFrontier: { state: 'advancing' },
        historicalBackfill: {
          state: 'advancing',
          boundary: { earliestDate: '2026-06-01' },
        },
      },
      cooldown: null,
    },
    {
      status: 'checking_newest',
      latestRun: {
        ...running,
        newestFrontier: { state: 'not_started' },
      },
      cooldown: null,
    },
    {
      status: 'backfilling',
      latestRun: {
        ...running,
        historicalBackfill: {
          state: 'advancing',
          boundary: { earliestDate: '2026-06-01' },
        },
        pendingResolutionCount: 2,
      },
      cooldown: null,
    },
    {
      status: 'resolving',
      latestRun: { ...running, pendingResolutionCount: 2 },
      cooldown: null,
    },
    {
      status: 'caught_up',
      latestRun: overviewRecord.latestRun,
      cooldown: null,
    },
    {
      status: 'boundary_exhausted',
      latestRun: {
        ...overviewRecord.latestRun,
        outcome: 'boundary_exhausted',
        newestFrontier: { state: 'advancing' },
        historicalBackfill: {
          state: 'boundary_reached',
          boundary: { earliestDate: '2026-06-01' },
        },
      },
      cooldown: null,
    },
    {
      status: 'source_exhausted',
      latestRun: {
        ...overviewRecord.latestRun,
        outcome: 'source_exhausted',
        newestFrontier: { state: 'advancing' },
        historicalBackfill: {
          state: 'source_exhausted',
          boundary: { earliestDate: '2026-06-01' },
        },
      },
      cooldown: null,
    },
    {
      status: 'cooling_down',
      latestRun: {
        ...overviewRecord.latestRun,
        status: 'skipped',
        outcome: 'cooling_down',
        newestFrontier: { state: 'advancing' },
      },
      cooldown: { retryAt: '2026-07-13T14:05:00.000Z' },
    },
    {
      status: 'cancelled',
      latestRun: {
        ...overviewRecord.latestRun,
        status: 'cancelled',
        outcome: 'cancelled',
        newestFrontier: { state: 'advancing' },
      },
      cooldown: null,
    },
    {
      status: 'failed',
      latestRun: {
        ...overviewRecord.latestRun,
        status: 'failed',
        outcome: 'failed',
        newestFrontier: { state: 'advancing' },
      },
      cooldown: null,
    },
  ] as const
}

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
    expect(connectorOverviewRecordSchema.safeParse({
      ...coolingDown,
      latestRun: overviewRecord.latestRun,
      cooldown: null,
    }).success).toBe(false)
    expect(connectorOverviewRecordSchema.safeParse({
      ...coolingDown,
      latestRun: null,
      cooldown: null,
    }).success).toBe(false)
    expect(connectorOverviewRecordSchema.safeParse({
      ...overviewRecord,
      cooldown: coolingDown.cooldown,
    }).success).toBe(false)
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

  it('accepts checking-newest health only while the newest frontier advances', () => {
    const checkingNewest = {
      ...overviewRecord,
      health: {
        ...overviewRecord.health,
        severity: 'warning',
        status: 'checking_newest',
        statusLabel: 'Checking newest',
        summary: 'Checking the newest provider jobs.',
      },
      latestRun: {
        ...overviewRecord.latestRun,
        status: 'running',
        outcome: 'in_progress',
        newestFrontier: { state: 'advancing' },
        historicalBackfill: {
          state: 'advancing',
          boundary: { earliestDate: '2026-06-01' },
        },
        completedAt: null,
      },
    } as const

    expect(connectorOverviewRecordSchema.parse(checkingNewest)).toEqual(
      checkingNewest,
    )
    expect(connectorOverviewRecordSchema.safeParse({
      ...checkingNewest,
      latestRun: {
        ...checkingNewest.latestRun,
        newestFrontier: { state: 'caught_up' },
      },
    }).success).toBe(false)
    expect(connectorOverviewRecordSchema.safeParse({
      ...checkingNewest,
      latestRun: null,
    }).success).toBe(false)
  })

  it('accepts backfilling health only after newest checks and during backfill advancement', () => {
    const backfilling = {
      ...overviewRecord,
      health: {
        ...overviewRecord.health,
        severity: 'warning',
        status: 'backfilling',
        statusLabel: 'Backfilling',
        summary: 'Synchronizing historical provider jobs.',
      },
      latestRun: {
        ...overviewRecord.latestRun,
        status: 'running',
        outcome: 'in_progress',
        historicalBackfill: {
          state: 'advancing',
          boundary: { earliestDate: '2026-06-01' },
        },
        pendingResolutionCount: 2,
        completedAt: null,
      },
    } as const

    expect(connectorOverviewRecordSchema.parse(backfilling)).toEqual(backfilling)
    expect(connectorOverviewRecordSchema.safeParse({
      ...backfilling,
      latestRun: {
        ...backfilling.latestRun,
        newestFrontier: { state: 'advancing' },
      },
    }).success).toBe(false)
    expect(connectorOverviewRecordSchema.safeParse({
      ...backfilling,
      latestRun: {
        ...backfilling.latestRun,
        historicalBackfill: {
          state: 'caught_up',
          boundary: { earliestDate: '2026-06-01' },
        },
      },
    }).success).toBe(false)
    expect(connectorOverviewRecordSchema.safeParse({
      ...backfilling,
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

  it('accepts cancelled health only with a cancelled current run', () => {
    const cancelled = {
      ...overviewRecord,
      health: {
        ...overviewRecord.health,
        severity: 'warning',
        status: 'cancelled',
        statusLabel: 'Cancelled',
        summary: 'Synchronization was cancelled.',
      },
      latestRun: {
        ...overviewRecord.latestRun,
        status: 'cancelled',
        outcome: 'cancelled',
        newestFrontier: { state: 'advancing' },
      },
    } as const

    expect(connectorOverviewRecordSchema.parse(cancelled)).toEqual(cancelled)
    expect(connectorOverviewRecordSchema.safeParse({
      ...cancelled,
      latestRun: overviewRecord.latestRun,
    }).success).toBe(false)
    expect(connectorOverviewRecordSchema.safeParse({
      ...cancelled,
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

  it('rejects unrelated skipped health for every unambiguous run-backed state', () => {
    for (const item of runBackedOverviewCases()) {
      expect(connectorOverviewRecordSchema.safeParse({
        ...overviewRecord,
        health: {
          ...overviewRecord.health,
          severity: 'warning',
          status: 'skipped',
          statusLabel: 'Skipped',
          summary: 'Synchronization was skipped.',
        },
        latestRun: item.latestRun,
        cooldown: null,
      }).success).toBe(false)
    }
  })

  it('accepts the complete table of derived run-backed health states', () => {
    for (const item of runBackedOverviewCases()) {
      const severity = item.status === 'caught_up'
        ? 'healthy'
        : item.status === 'failed'
          ? 'blocked'
          : 'warning'
      const record = {
        ...overviewRecord,
        health: {
          ...overviewRecord.health,
          severity,
          status: item.status,
          statusLabel: item.status,
          summary: `Derived ${item.status} health.`,
        },
        latestRun: item.latestRun,
        cooldown: item.cooldown,
      }

      expect(connectorOverviewRecordSchema.parse(record)).toEqual(record)
    }
  })

  it('allows explicit auth and configuration overlays over every derived state', () => {
    for (const item of runBackedOverviewCases()) {
      const base = {
        ...overviewRecord,
        latestRun: item.latestRun,
        cooldown: null,
      }
      const authenticationRequired = {
        ...base,
        health: {
          ...overviewRecord.health,
          severity: 'blocked',
          status: 'authentication_required',
        },
        actionRequired: [{
          id: 'auth-overlay',
          kind: 'auth',
          label: 'Reconnect',
          message: 'Reconnect the provider session.',
          severity: 'blocked',
        }],
      } as const
      const configurationBlocked = {
        ...base,
        health: {
          ...overviewRecord.health,
          severity: 'blocked',
          status: 'blocked',
        },
        actionRequired: [{
          id: 'configuration-overlay',
          kind: 'configuration',
          label: 'Configure',
          message: 'Update connector configuration.',
          severity: 'blocked',
        }],
      } as const

      expect(connectorOverviewRecordSchema.parse(authenticationRequired)).toEqual(
        authenticationRequired,
      )
      expect(connectorOverviewRecordSchema.parse(configurationBlocked)).toEqual(
        configurationBlocked,
      )
    }
  })

  it('keeps yielded skipped runs intentionally ambiguous', () => {
    const yielded = {
      ...overviewRecord,
      health: {
        ...overviewRecord.health,
        severity: 'warning',
        status: 'skipped',
        statusLabel: 'Yielded',
        summary: 'Synchronization yielded for a later invocation.',
      },
      latestRun: {
        ...overviewRecord.latestRun,
        status: 'skipped',
        outcome: 'yielded',
        newestFrontier: { state: 'advancing' },
      },
    } as const

    expect(connectorOverviewRecordSchema.parse(yielded)).toEqual(yielded)
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
    expect(connectorOverviewRecordSchema.safeParse({
      ...sourceExhausted,
      latestRun: overviewRecord.latestRun,
    }).success).toBe(false)
    expect(connectorOverviewRecordSchema.safeParse({
      ...sourceExhausted,
      latestRun: null,
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
