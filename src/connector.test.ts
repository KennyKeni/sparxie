import { describe, expect, it } from 'vitest'
import {
  connectorCreateErrorBodies,
  connectorCreateErrorBodySchema,
  connectorCreateErrorCodes,
  connectorCreateErrorKindByCode,
  connectorCreateErrorPayloadSchema,
  connectorCreateErrorStatusByCode,
  connectorInstanceSummarySchema,
  connectorInstancesListResultSchema,
  connectorRunSummarySchema,
  createConnectorInstanceInputSchema,
  triggerConnectorRunInputSchema,
  updateConnectorInstanceInputSchema,
} from './index'

const skippedNotDueRun = {
  id: 'run-1',
  connectorInstanceId: 'connector-1',
  mode: 'manual',
  status: 'skipped',
  executionScopeId: 'scope_connector_1',
  filterSignature: 'all',
  observationCount: 0,
  warningCount: 0,
  warnings: [],
  newestFrontier: { state: 'advancing' },
  historicalBackfill: { state: 'advancing', boundary: { earliestDate: '2026-01-01' } },
  pendingResolutionCount: 1,
  outcome: { kind: 'yielded', reason: 'invocation_budget' },
  startedAt: '2026-07-11T14:00:30.000Z',
  completedAt: '2026-07-11T14:00:30.000Z',
  scheduleOccurrence: null,
}

const lifecycleCounts = {
  version: 'connector-run-lifecycle-counts/v1',
  source: 'frozen_terminal',
  scope: {
    kind: 'connector_run',
    connectorRunId: 'run-1',
    executionScopeId: 'scope_connector_1',
  },
  provider: {
    returnedRows: 5,
    validRecords: 3,
    invalidRecords: 1,
    sourceDuplicates: 1,
    capturedRecords: 4,
    occurrenceCount: 4,
    captureShortfall: 1,
    unclassifiedRows: 0,
    invariant: 'reconciled',
    gaps: [],
  },
  destination: {
    normalized: 3,
    resolvedEmployerOrAts: 2,
    resolvedThirdParty: 1,
    unresolved: 0,
    pending: 0,
    gateRejected: 1,
    unclassified: 0,
    invariant: 'reconciled',
  },
  sourcing: {
    findingsAdded: 1,
    canonicalDuplicates: 1,
    notFit: 1,
    rejected: 0,
    actionableReview: 0,
    unclassified: 0,
    invariant: 'reconciled',
  },
} as const

describe('connector continuous synchronization contract', () => {
  it('accepts a yielded invocation without claiming synchronization completion', () => {
    expect(connectorRunSummarySchema.parse(skippedNotDueRun)).toEqual(
      skippedNotDueRun,
    )
  })

  it('rejects obsolete run-wide retry advice', () => {
    expect(
      connectorRunSummarySchema.safeParse({
        ...skippedNotDueRun,
        retryHints: null,
      }).success,
    ).toBe(false)
  })

  it('rejects obsolete partial-success status and untyped stats', () => {
    expect(connectorRunSummarySchema.safeParse({
      ...skippedNotDueRun, status: 'partial_success',
    }).success).toBe(false)
    expect(connectorRunSummarySchema.safeParse({
      ...skippedNotDueRun, stats: {},
    }).success).toBe(false)
  })

  it('preserves a reconciled lifecycle summary on a connector run', () => {
    const run = { ...skippedNotDueRun, lifecycleCounts }

    expect(connectorRunSummarySchema.parse(run)).toEqual(run)
  })

  it('rejects lifecycle summaries scoped to another run or execution', () => {
    expect(connectorRunSummarySchema.safeParse({
      ...skippedNotDueRun,
      lifecycleCounts: {
        ...lifecycleCounts,
        scope: { ...lifecycleCounts.scope, connectorRunId: 'run-other' },
      },
    }).success).toBe(false)
    expect(connectorRunSummarySchema.safeParse({
      ...skippedNotDueRun,
      lifecycleCounts: {
        ...lifecycleCounts,
        scope: { ...lifecycleCounts.scope, executionScopeId: 'scope_other' },
      },
    }).success).toBe(false)
  })

  it('rejects lifecycle summaries that claim reconciliation with inconsistent totals', () => {
    expect(connectorRunSummarySchema.safeParse({
      ...skippedNotDueRun,
      lifecycleCounts: {
        ...lifecycleCounts,
        provider: { ...lifecycleCounts.provider, returnedRows: 6 },
      },
    }).success).toBe(false)
    expect(connectorRunSummarySchema.safeParse({
      ...skippedNotDueRun,
      lifecycleCounts: {
        ...lifecycleCounts,
        destination: { ...lifecycleCounts.destination, normalized: 2 },
      },
    }).success).toBe(false)
    expect(connectorRunSummarySchema.safeParse({
      ...skippedNotDueRun,
      lifecycleCounts: {
        ...lifecycleCounts,
        sourcing: { ...lifecycleCounts.sourcing, findingsAdded: 2 },
      },
    }).success).toBe(false)
  })

  it('requires provider unclassified rows and invariant gaps to explain each other', () => {
    expect(connectorRunSummarySchema.safeParse({
      ...skippedNotDueRun,
      lifecycleCounts: {
        ...lifecycleCounts,
        provider: {
          ...lifecycleCounts.provider,
          invariant: 'reported_stats_missing',
          gaps: ['missing_provider_returned'],
          returnedRows: 6,
          captureShortfall: 2,
          unclassifiedRows: 0,
        },
      },
    }).success).toBe(false)
    expect(connectorRunSummarySchema.safeParse({
      ...skippedNotDueRun,
      lifecycleCounts: {
        ...lifecycleCounts,
        provider: {
          ...lifecycleCounts.provider,
          invariant: 'reported_stats_missing',
          gaps: ['invalid_provider_returned'],
        },
      },
    }).success).toBe(false)
  })

  it('allows lineage shortfalls but rejects totals that exceed the upstream stage', () => {
    expect(connectorRunSummarySchema.safeParse({
      ...skippedNotDueRun,
      lifecycleCounts: {
        ...lifecycleCounts,
        destination: {
          ...lifecycleCounts.destination,
          unresolved: 100,
          invariant: 'lineage_incomplete',
        },
      },
    }).success).toBe(false)
    expect(connectorRunSummarySchema.safeParse({
      ...skippedNotDueRun,
      lifecycleCounts: {
        ...lifecycleCounts,
        sourcing: {
          ...lifecycleCounts.sourcing,
          findingsAdded: 100,
          invariant: 'lineage_incomplete',
        },
      },
    }).success).toBe(false)
    expect(connectorRunSummarySchema.safeParse({
      ...skippedNotDueRun,
      lifecycleCounts: {
        ...lifecycleCounts,
        destination: {
          ...lifecycleCounts.destination,
          gateRejected: 0,
          invariant: 'lineage_incomplete',
        },
        sourcing: {
          ...lifecycleCounts.sourcing,
          canonicalDuplicates: 0,
          invariant: 'lineage_incomplete',
        },
      },
    }).success).toBe(true)
  })

  it('requires lifecycle provenance to match whether the invocation is active', () => {
    expect(connectorRunSummarySchema.safeParse({
      ...skippedNotDueRun,
      lifecycleCounts: { ...lifecycleCounts, source: 'live_current' },
    }).success).toBe(false)
    expect(connectorRunSummarySchema.safeParse({
      ...skippedNotDueRun,
      status: 'running',
      outcome: { kind: 'in_progress' },
      completedAt: null,
      lifecycleCounts: { ...lifecycleCounts, source: 'frozen_terminal' },
    }).success).toBe(false)
  })

  it('rejects stale pre-feature lifecycle provenance', () => {
    expect(connectorRunSummarySchema.safeParse({
      ...skippedNotDueRun,
      lifecycleCounts: { ...lifecycleCounts, source: 'derived_pre_feature' },
    }).success).toBe(false)
  })

  it('rejects opaque or secret-bearing lifecycle fields while allowing absence', () => {
    expect(connectorRunSummarySchema.parse(skippedNotDueRun)).toEqual(skippedNotDueRun)
    expect(connectorRunSummarySchema.safeParse({
      ...skippedNotDueRun,
      lifecycleCounts: {
        ...lifecycleCounts,
        session: { cookie: 'must-not-cross-the-contract' },
      },
    }).success).toBe(false)
    expect(connectorRunSummarySchema.safeParse({
      ...skippedNotDueRun,
      lifecycleCounts: {
        ...lifecycleCounts,
        provider: {
          ...lifecycleCounts.provider,
          headers: { authorization: 'must-not-cross-the-contract' },
        },
      },
    }).success).toBe(false)
  })
})

const connectorInstanceSummary = {
  id: 'jobright/session-1',
  connectorId: 'jobright.resolver',
  connectorVersion: '0.1.0',
  displayName: 'Jobright',
  enabled: true,
  lifecycle: 'enabled' as const,
  auth: [
    {
      id: 'jobright-session',
      mode: 'browser_session' as const,
      label: 'Jobright session',
      configured: true,
    },
  ],
  config: { publicFeedUrl: 'https://jobright.test/feed.json' },
  filters: { roleKeywords: ['intern'] },
  earliestBackfillDate: '2026-07-04',
  createdAt: '2026-07-11T14:00:00.000Z',
  updatedAt: '2026-07-11T14:00:00.000Z',
}

describe('connector instance earliestBackfillDate contract', () => {
  it('requires a canonical earliestBackfillDate on connector instance summaries', () => {
    expect(connectorInstanceSummarySchema.parse(connectorInstanceSummary)).toEqual(
      connectorInstanceSummary,
    )
    expect(
      connectorInstancesListResultSchema.parse({ items: [connectorInstanceSummary] }),
    ).toEqual({ items: [connectorInstanceSummary] })
  })

  it('rejects missing or invalid earliestBackfillDate on summaries and list results', () => {
    const { earliestBackfillDate: _omitted, ...withoutDate } = connectorInstanceSummary

    expect(connectorInstanceSummarySchema.safeParse(withoutDate).success).toBe(false)
    expect(
      connectorInstanceSummarySchema.safeParse({
        ...connectorInstanceSummary,
        earliestBackfillDate: '2023-02-29',
      }).success,
    ).toBe(false)
    expect(
      connectorInstanceSummarySchema.safeParse({
        ...connectorInstanceSummary,
        earliestBackfillDate: '0000-01-01',
      }).success,
    ).toBe(false)
    expect(
      connectorInstancesListResultSchema.safeParse({
        items: [{ ...connectorInstanceSummary, earliestBackfillDate: '2024-1-01' }],
      }).success,
    ).toBe(false)
  })

  it('validates create/update input DTOs with optional canonical earliestBackfillDate', () => {
    const createBase = {
      id: 'jobright/session-1',
      connectorId: 'jobright.resolver',
      connectorVersion: '0.1.0',
      displayName: 'Jobright',
      enabled: true,
    }

    expect(createConnectorInstanceInputSchema.parse(createBase)).toEqual(createBase)
    expect(
      createConnectorInstanceInputSchema.parse({
        ...createBase,
        earliestBackfillDate: '2026-07-04',
        auth: [
          {
            id: 'jobright-session',
            mode: 'browser_session',
            label: 'Jobright session',
            sessionKey: 'workspace-session',
          },
        ],
        config: { publicFeedUrl: 'https://jobright.test/feed.json' },
        filters: { roleKeywords: ['intern'] },
      }),
    ).toMatchObject({ earliestBackfillDate: '2026-07-04' })

    expect(
      updateConnectorInstanceInputSchema.parse({
        connectorInstanceId: 'jobright/session-1',
        earliestBackfillDate: '2026-06-01',
      }),
    ).toEqual({
      connectorInstanceId: 'jobright/session-1',
      earliestBackfillDate: '2026-06-01',
    })

    for (const invalidDate of [
      '2023-02-29',
      '2024-02-30',
      '2024-1-01',
      '2024-01-1',
      '0000-01-01',
      'not-a-date',
    ]) {
      expect(
        createConnectorInstanceInputSchema.safeParse({
          ...createBase,
          earliestBackfillDate: invalidDate,
        }).success,
        `create:${invalidDate}`,
      ).toBe(false)
      expect(
        updateConnectorInstanceInputSchema.safeParse({
          connectorInstanceId: 'jobright/session-1',
          earliestBackfillDate: invalidDate,
        }).success,
        `update:${invalidDate}`,
      ).toBe(false)
    }

    expect(
      createConnectorInstanceInputSchema.safeParse({
        ...createBase,
        unknownField: true,
      }).success,
    ).toBe(false)
    expect(
      updateConnectorInstanceInputSchema.safeParse({
        connectorInstanceId: 'jobright/session-1',
        unknownField: true,
      }).success,
    ).toBe(false)
    expect(
      updateConnectorInstanceInputSchema.safeParse({
        earliestBackfillDate: '2026-06-01',
      }).success,
    ).toBe(false)
  })
})

describe('connector run schedule provenance contract', () => {
  it('requires nullable scheduleOccurrence on run summaries and rejects spoofing via trigger input', () => {
    expect(
      connectorRunSummarySchema.parse({
        ...skippedNotDueRun,
        scheduleOccurrence: null,
      }),
    ).toEqual({
      ...skippedNotDueRun,
      scheduleOccurrence: null,
    })

    const linked = {
      ...skippedNotDueRun,
      mode: 'scheduled',
      status: 'completed',
      scheduleOccurrence: {
        scheduleId: 'schedule-1',
        scheduleRevision: 'rev-1',
        occurrenceId: 'occ-1',
        nominalAt: '2026-07-11T14:00:00.000Z',
        admittedMode: 'scheduled',
        idempotencyKey: 'rev-1:2026-07-11T14:00:00.000Z',
      },
    }

    expect(connectorRunSummarySchema.parse(linked)).toEqual(linked)

    const { scheduleOccurrence: _omitted, ...withoutLink } = skippedNotDueRun
    expect(connectorRunSummarySchema.safeParse(withoutLink).success).toBe(false)

    expect(
      triggerConnectorRunInputSchema.parse({
        connectorInstanceId: 'connector-1',
        mode: 'manual',
      }),
    ).toEqual({
      connectorInstanceId: 'connector-1',
      mode: 'manual',
    })
    expect(
      triggerConnectorRunInputSchema.safeParse({
        connectorInstanceId: 'connector-1',
        mode: 'manual',
        scheduleOccurrence: linked.scheduleOccurrence,
      }).success,
    ).toBe(false)
  })

  it('requires scheduleOccurrence linkage to match manual, scheduled, or catch_up run mode', () => {
    const base = {
      ...skippedNotDueRun,
      status: 'completed',
      completedAt: '2026-07-11T14:05:00.000Z',
    }
    const scheduledLink = {
      scheduleId: 'schedule-1',
      scheduleRevision: 'rev-1',
      occurrenceId: 'occ-1',
      nominalAt: '2026-07-11T14:00:00.000Z',
      admittedMode: 'scheduled' as const,
      idempotencyKey: 'rev-1:2026-07-11T14:00:00.000Z',
    }
    const catchUpLink = {
      ...scheduledLink,
      admittedMode: 'catch_up' as const,
      occurrenceId: 'occ-2',
    }

    expect(
      connectorRunSummarySchema.parse({
        ...base,
        mode: 'manual',
        scheduleOccurrence: null,
      }),
    ).toMatchObject({ mode: 'manual', scheduleOccurrence: null })
    expect(
      connectorRunSummarySchema.parse({
        ...base,
        mode: 'scheduled',
        scheduleOccurrence: scheduledLink,
      }),
    ).toMatchObject({ mode: 'scheduled', scheduleOccurrence: scheduledLink })
    expect(
      connectorRunSummarySchema.parse({
        ...base,
        mode: 'catch_up',
        scheduleOccurrence: catchUpLink,
      }),
    ).toMatchObject({ mode: 'catch_up', scheduleOccurrence: catchUpLink })

    expect(
      connectorRunSummarySchema.safeParse({
        ...base,
        mode: 'scheduled',
        scheduleOccurrence: null,
      }).success,
    ).toBe(false)
    expect(
      connectorRunSummarySchema.safeParse({
        ...base,
        mode: 'catch_up',
        scheduleOccurrence: null,
      }).success,
    ).toBe(false)
    expect(
      connectorRunSummarySchema.safeParse({
        ...base,
        mode: 'manual',
        scheduleOccurrence: scheduledLink,
      }).success,
    ).toBe(false)
    expect(
      connectorRunSummarySchema.safeParse({
        ...base,
        mode: 'scheduled',
        scheduleOccurrence: catchUpLink,
      }).success,
    ).toBe(false)
  })

  it('rejects scheduled run links whose idempotencyKey is not the canonical revision:nominalAt key', () => {
    const base = {
      ...skippedNotDueRun,
      status: 'completed',
      completedAt: '2026-07-11T14:05:00.000Z',
      mode: 'scheduled' as const,
    }
    const truthfulLink = {
      scheduleId: 'schedule-1',
      scheduleRevision: 'rev-1',
      occurrenceId: 'occ-1',
      nominalAt: '2026-07-11T14:00:00.000Z',
      admittedMode: 'scheduled' as const,
      idempotencyKey: 'rev-1:2026-07-11T14:00:00.000Z',
    }

    expect(
      connectorRunSummarySchema.parse({
        ...base,
        scheduleOccurrence: truthfulLink,
      }),
    ).toMatchObject({ scheduleOccurrence: truthfulLink })
    expect(
      connectorRunSummarySchema.safeParse({
        ...base,
        scheduleOccurrence: {
          ...truthfulLink,
          idempotencyKey: 'arbitrary-client-key',
        },
      }).success,
    ).toBe(false)
  })
})

describe('connector create error payload', () => {
  it('exports canonical bodies, status, and kind maps for every closed code', () => {
    expect([...connectorCreateErrorCodes]).toEqual(['already_configured'])
    expect(connectorCreateErrorBodies).toEqual({
      already_configured: {
        code: 'already_configured',
        message: 'This connector is already configured. Manage the existing instance.',
      },
    })
    expect(connectorCreateErrorStatusByCode).toEqual({
      already_configured: 409,
    })
    expect(connectorCreateErrorKindByCode).toEqual({
      already_configured: 'conflict',
    })
    expect(Object.keys(connectorCreateErrorStatusByCode).sort()).toEqual(
      [...connectorCreateErrorCodes].sort(),
    )
    expect(Object.keys(connectorCreateErrorKindByCode).sort()).toEqual(
      [...connectorCreateErrorCodes].sort(),
    )
  })

  it('accepts only canonical closed create error bodies and rejects free messages', () => {
    for (const code of connectorCreateErrorCodes) {
      const body = connectorCreateErrorBodies[code]
      expect(connectorCreateErrorBodySchema.parse(body)).toEqual(body)
      expect(connectorCreateErrorPayloadSchema.parse(body)).toEqual(body)
      expect(
        connectorCreateErrorPayloadSchema.safeParse({
          code,
          message: `error:${code}`,
        }).success,
      ).toBe(false)
      expect(
        connectorCreateErrorBodySchema.safeParse({
          ...body,
          message: `${body.message} with detail`,
        }).success,
      ).toBe(false)
      expect(
        connectorCreateErrorBodySchema.safeParse({
          ...body,
          detail: 'canary',
        }).success,
      ).toBe(false)
    }

    expect(
      connectorCreateErrorPayloadSchema.safeParse({
        code: 'not_found',
        message: 'missing',
      }).success,
    ).toBe(false)
    expect(
      connectorCreateErrorPayloadSchema.safeParse({
        code: 'already_configured',
        message: 'already there',
        stack: 'secret',
      }).success,
    ).toBe(false)
  })
})
