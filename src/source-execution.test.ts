import { describe, expect, it } from 'vitest'
import {
  connectorRunSummarySchema,
  createBoundRawSourceRecordInputSchema,
  createBoundRawSourceNormalizationResultSchema,
  rawSourceRecordInputSchema,
  sourceOperationOutcomeSchema,
} from './index.js'

const scope = 'scope_7Qm2pK9v'

describe('source execution contract', () => {
  it('keeps scope-level and item-level operation outcomes distinct', () => {
    expect(sourceOperationOutcomeSchema.parse({
      kind: 'scope_rate_limited',
      executionScopeId: scope,
      retryAt: '2026-07-12T15:00:00.000Z',
      serverMinimumDelayMs: 30_000,
    })).toMatchObject({ kind: 'scope_rate_limited', executionScopeId: scope })

    expect(sourceOperationOutcomeSchema.parse({
      kind: 'item_transient',
      retry: {
        state: 'scheduled', reason: 'operation_timeout', attempt: 1, maxAttempts: 3,
        lastAttemptAt: '2026-07-12T14:00:00.000Z', computedDelayMs: 30_000,
        serverMinimumDelayMs: null, nextAttemptAt: '2026-07-12T14:00:30.000Z',
        horizonAt: '2026-07-12T15:00:00.000Z',
      },
    })).toMatchObject({ kind: 'item_transient' })
  })

  it('models a yielded continuous synchronization invocation as nonterminal', () => {
    const run = {
      id: 'run-1', connectorInstanceId: 'connector-1', executionScopeId: scope,
      mode: 'manual', status: 'completed', filterSignature: 'all',
      observationCount: 2, warningCount: 0, warnings: [],
      newestFrontier: { state: 'advancing' },
      historicalBackfill: {
        state: 'advancing',
        boundary: { earliestDate: '2026-01-01' },
      },
      pendingResolutionCount: 1,
      outcome: { kind: 'yielded', reason: 'invocation_budget' },
      startedAt: '2026-07-12T14:00:00.000Z', completedAt: '2026-07-12T14:01:00.000Z',
      scheduleOccurrence: null,
    }
    expect(connectorRunSummarySchema.parse(run)).toEqual(run)
    expect(connectorRunSummarySchema.safeParse({ ...run, status: 'anything' }).success).toBe(false)
  })

  it('shares an opaque scope across non-adjacent captures and rejects spoofing', () => {
    const capture = (intakeItemId: string, executionScopeId: string, connectorInstanceId = 'connector-1') => ({
      intakeItemId,
      adapter: { id: 'provider', kind: 'connector', version: '1.0.0' },
      capture: { connectorInstanceId, connectorRunId: 'run-1', executionScopeId },
      observedAt: '2026-07-12T14:00:00.000Z',
    })
    const [workA, workB, workC] = [
      capture('item-a', scope),
      capture('item-b', 'scope_other_1', 'connector-2'),
      capture('item-c', scope),
    ]
    expect([workA, workB, workC].map((work) => rawSourceRecordInputSchema.parse(work).capture.executionScopeId))
      .toEqual([scope, 'scope_other_1', scope])

    const bound = createBoundRawSourceRecordInputSchema({
      requestWorkspaceId: 'workspace-1', workspaceId: 'workspace-1',
      connectorInstanceId: 'connector-1', connectorRunId: 'run-1',
      executionScopeId: scope,
      adapter: { id: 'provider', kind: 'connector', version: '1.0.0' },
    })
    expect(bound.safeParse(workA).success).toBe(true)
    expect(bound.safeParse(workC).success).toBe(true)
    expect(bound.safeParse(capture('item-spoof', 'scope_spoofed_1')).success).toBe(false)
  })

  it('requires connector capture and forbids nonconnector capture', () => {
    const observedAt = '2026-07-12T14:00:00.000Z'
    expect(rawSourceRecordInputSchema.safeParse({
      intakeItemId: 'item-connector', adapter: { id: 'provider', kind: 'connector', version: '1.0.0' }, observedAt,
    }).success).toBe(false)
    expect(rawSourceRecordInputSchema.safeParse({
      intakeItemId: 'item-cli', adapter: { id: 'cli', kind: 'cli', version: '1.0.0' }, observedAt,
      capture: { connectorInstanceId: 'connector-1', connectorRunId: 'run-1', executionScopeId: scope },
    }).success).toBe(false)
  })

  it('keeps authentication refresh strict and free of session material', () => {
    const outcome = sourceOperationOutcomeSchema.parse({
      kind: 'authentication_expired', executionScopeId: scope, requestRefresh: true,
    })
    expect(JSON.stringify(outcome)).not.toMatch(/cookie|credential|session/i)
    expect(sourceOperationOutcomeSchema.safeParse({ ...outcome, session: 'secret' }).success).toBe(false)
  })

  it('rejects connector run outcomes whose state or scope contradicts progress', () => {
    const base = {
      id: 'run-1', connectorInstanceId: 'connector-1', executionScopeId: scope,
      mode: 'manual', status: 'completed', filterSignature: 'all',
      observationCount: 0, warningCount: 0, warnings: [],
      newestFrontier: { state: 'advancing' },
      historicalBackfill: {
        state: 'advancing', boundary: { earliestDate: '2026-01-01' },
      },
      pendingResolutionCount: 0,
      startedAt: '2026-07-12T14:00:00.000Z', completedAt: '2026-07-12T14:01:00.000Z',
      scheduleOccurrence: null,
    }
    expect(connectorRunSummarySchema.safeParse({
      ...base,
      outcome: {
        kind: 'cooling_down',
        operation: {
          kind: 'scope_rate_limited', executionScopeId: 'scope_other_1',
          retryAt: '2026-07-12T15:00:00.000Z', serverMinimumDelayMs: null,
        },
      },
    }).success).toBe(false)
    expect(connectorRunSummarySchema.safeParse({
      ...base,
      outcome: {
        kind: 'cooling_down',
        operation: {
          kind: 'scope_rate_limited', executionScopeId: scope,
          retryAt: '2026-07-12T15:00:00.000Z', serverMinimumDelayMs: null,
        },
      },
    }).success).toBe(true)
    expect(connectorRunSummarySchema.safeParse({
      ...base,
      outcome: {
        kind: 'action_required',
        operation: {
          kind: 'authentication_expired', executionScopeId: 'scope_other_1',
          requestRefresh: true,
        },
      },
    }).success).toBe(false)
    expect(connectorRunSummarySchema.safeParse({
      ...base,
      outcome: {
        kind: 'action_required',
        operation: {
          kind: 'authentication_expired', executionScopeId: scope,
          requestRefresh: true,
        },
      },
    }).success).toBe(true)
    expect(connectorRunSummarySchema.safeParse({
      ...base, outcome: { kind: 'boundary_exhausted' },
    }).success).toBe(false)
    expect(sourceOperationOutcomeSchema.safeParse({
      kind: 'item_permanent', reason: 'provider record was removed',
    }).success).toBe(true)
    expect(connectorRunSummarySchema.safeParse({
      ...base, outcome: { kind: 'source_exhausted' },
    }).success).toBe(false)

    expect(connectorRunSummarySchema.safeParse({
      ...base,
      historicalBackfill: { ...base.historicalBackfill, state: 'boundary_reached' },
      outcome: { kind: 'boundary_exhausted' },
    }).success).toBe(true)
    expect(connectorRunSummarySchema.safeParse({
      ...base,
      historicalBackfill: { ...base.historicalBackfill, state: 'source_exhausted' },
      outcome: { kind: 'source_exhausted' },
    }).success).toBe(true)
  })

  it('keeps provider cooldown authority out of item-transient retry advice', () => {
    expect(sourceOperationOutcomeSchema.safeParse({
      kind: 'item_transient',
      retry: {
        state: 'scheduled', reason: 'rate_limit', attempt: 1, maxAttempts: 3,
        lastAttemptAt: '2026-07-12T14:00:00.000Z', computedDelayMs: 30_000,
        serverMinimumDelayMs: 20_000,
        nextAttemptAt: '2026-07-12T14:00:30.000Z',
        horizonAt: '2026-07-12T15:00:00.000Z',
      },
    }).success).toBe(false)
  })

  it('binds trusted source-scoped resolver attempts to one raw revision and scope', () => {
    const result = {
      rawRecordId: 'raw-1', rawRevisionId: 'revision-1',
      canonicalSchemaVersion: 'candidate/v1', fieldOutcomes: [],
      updatedAt: '2026-07-12T14:01:00.000Z', status: 'pending',
      gate: null, canonicalCandidate: null,
      attempts: [{
        id: 'attempt-1', rawRevisionId: 'revision-1',
        resolver: {
          id: 'provider', version: '1.0.0', scopeRequirement: 'source',
          requiredInputs: [], outputFields: [], capabilities: ['network'],
          costClass: 'low', precedence: 1,
        },
        inputHash: 'sha256:input', executionScopeId: scope,
        operationOutcome: null, status: 'completed',
        startedAt: '2026-07-12T14:00:00.000Z',
        completedAt: '2026-07-12T14:00:01.000Z', outcomes: [],
      }],
    }
    const bound = createBoundRawSourceNormalizationResultSchema({
      rawRevisionId: 'revision-1', executionScopeId: scope,
    })
    expect(bound.safeParse(result).success).toBe(true)
    expect(bound.safeParse({
      ...result,
      attempts: [{ ...result.attempts[0], executionScopeId: 'scope_other_1' }],
    }).success).toBe(false)
    expect(bound.safeParse({
      ...result,
      attempts: [{ ...result.attempts[0], executionScopeId: null }],
    }).success).toBe(false)
  })

  it('rejects queued invocations that claim terminal synchronization', () => {
    const run = {
      id: 'run-1', connectorInstanceId: 'connector-1', executionScopeId: scope,
      mode: 'manual', status: 'queued', filterSignature: 'all',
      observationCount: 0, warningCount: 0, warnings: [],
      newestFrontier: { state: 'caught_up' },
      historicalBackfill: {
        state: 'caught_up', boundary: { earliestDate: '2026-01-01' },
      },
      pendingResolutionCount: 0, outcome: { kind: 'caught_up' },
      startedAt: '2026-07-12T14:00:00.000Z', completedAt: null,
      scheduleOccurrence: null,
    }
    expect(connectorRunSummarySchema.safeParse(run).success).toBe(false)
    for (const status of ['queued', 'running'] as const) {
      expect(connectorRunSummarySchema.safeParse({
        ...run, status,
        newestFrontier: { state: 'not_started' },
        historicalBackfill: {
          state: 'not_started',
          boundary: { earliestDate: '2026-01-01' },
        },
        outcome: { kind: 'in_progress' },
      }).success).toBe(true)
    }
  })

  it('rejects invalid run counts, chronology, and checkpoint payloads', () => {
    const run = {
      id: 'run-1', connectorInstanceId: 'connector-1', executionScopeId: scope,
      mode: 'manual', status: 'completed', filterSignature: 'all',
      observationCount: 1, warningCount: 0, warnings: [],
      newestFrontier: { state: 'advancing' },
      historicalBackfill: {
        state: 'advancing', boundary: { earliestDate: '2026-01-01' },
      },
      pendingResolutionCount: 0,
      outcome: { kind: 'yielded', reason: 'invocation_budget' },
      startedAt: '2026-07-12T14:01:00.000Z', completedAt: '2026-07-12T14:00:00.000Z',
      scheduleOccurrence: null,
    }
    expect(connectorRunSummarySchema.safeParse(run).success).toBe(false)
    expect(connectorRunSummarySchema.safeParse({
      ...run, completedAt: '2026-07-12T14:02:00.000Z', observationCount: -1,
    }).success).toBe(false)
    expect(connectorRunSummarySchema.safeParse({
      ...run, completedAt: '2026-07-12T14:02:00.000Z', warningCount: 0.5,
    }).success).toBe(false)
    expect(connectorRunSummarySchema.safeParse({
      ...run, completedAt: '2026-07-12T14:02:00.000Z',
      newestFrontier: { state: 'advancing', checkpoint: { cookie: 'secret' } },
    }).success).toBe(false)
    expect(connectorRunSummarySchema.safeParse({
      ...run, completedAt: '2026-07-12T14:02:00.000Z',
      newestFrontier: { state: 'caught_up' },
      historicalBackfill: { state: 'caught_up', boundary: { earliestDate: '2026-01-01' } },
    }).success).toBe(false)
    const terminal = { ...run, completedAt: '2026-07-12T14:02:00.000Z' }
    expect(connectorRunSummarySchema.safeParse({
      ...terminal, status: 'failed', outcome: { kind: 'failed', reason: 'sanitized failure' },
    }).success).toBe(true)
    expect(connectorRunSummarySchema.safeParse({
      ...terminal, status: 'cancelled', outcome: { kind: 'cancelled', reason: 'user cancelled' },
    }).success).toBe(true)
    expect(connectorRunSummarySchema.safeParse({ ...terminal, status: 'failed' }).success).toBe(false)
    expect(connectorRunSummarySchema.safeParse({
      ...terminal, warningCount: 1, warnings: [],
    }).success).toBe(false)
  })
})
