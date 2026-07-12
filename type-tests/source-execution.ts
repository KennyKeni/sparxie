import type {
  ConnectorRunStatus,
  ConnectorNewestFrontierState,
  ConnectorHistoricalBackfillState,
  ConnectorRunsListInput,
  ConnectorSynchronizationOutcome,
  NormalizationAttempt,
  SourceOperationOutcome,
} from '../src/index.js'

const closedStatus: ConnectorRunStatus = 'running'
// @ts-expect-error Invocation statuses are closed.
const openStatus: ConnectorRunStatus = 'provider_paused'
const openListStatus: ConnectorRunsListInput = {
  // @ts-expect-error Run-list status filters are closed.
  connectorInstanceId: 'connector-1', status: 'partial_success',
}
const openListMode: ConnectorRunsListInput = {
  // @ts-expect-error Run-list mode filters are closed.
  connectorInstanceId: 'connector-1', mode: 'provider_mode',
}

const scopeAuth = { kind: 'authentication_expired', executionScopeId: 'scope_connector_1', requestRefresh: true } satisfies SourceOperationOutcome
const yielded: ConnectorSynchronizationOutcome = { kind: 'yielded', reason: 'invocation_budget' }
const coolingDown: ConnectorSynchronizationOutcome = { kind: 'cooling_down', operation: { kind: 'scope_rate_limited', executionScopeId: 'scope_connector_1', retryAt: '2026-07-12T15:00:00.000Z', serverMinimumDelayMs: null } }
const permanentItem: SourceOperationOutcome = { kind: 'item_permanent', reason: 'record removed' }
const transientItem: SourceOperationOutcome = {
  kind: 'item_transient',
  retry: {
    state: 'scheduled', reason: 'operation_timeout', attempt: 1, maxAttempts: 3,
    lastAttemptAt: '2026-07-12T14:00:00.000Z', computedDelayMs: 30_000,
    serverMinimumDelayMs: null, nextAttemptAt: '2026-07-12T14:00:30.000Z',
    horizonAt: '2026-07-12T15:00:00.000Z',
  },
}
const synchronizationBranches = [
  { kind: 'in_progress' }, { kind: 'caught_up' }, { kind: 'boundary_exhausted' },
  { kind: 'source_exhausted' }, { kind: 'action_required', operation: scopeAuth },
  { kind: 'failed', reason: 'sanitized failure' },
  { kind: 'cancelled', reason: 'user cancelled' },
] satisfies ConnectorSynchronizationOutcome[]
const frontierBranches = [
  { state: 'not_started' }, { state: 'advancing' }, { state: 'caught_up' },
] satisfies ConnectorNewestFrontierState[]
const backfillBranches = [
  { state: 'not_started', boundary: { earliestDate: '2026-01-01' } },
  { state: 'advancing', boundary: { earliestDate: '2026-01-01' } },
  { state: 'caught_up', boundary: { earliestDate: '2026-01-01' } },
  { state: 'boundary_reached', boundary: { earliestDate: '2026-01-01' } },
  { state: 'source_exhausted', boundary: { earliestDate: '2026-01-01' } },
] satisfies ConnectorHistoricalBackfillState[]
declare const attempt: NormalizationAttempt
const scopeOrGeneric: string | null = attempt.executionScopeId

void [closedStatus, openStatus, openListStatus, openListMode, scopeAuth, yielded,
  coolingDown, permanentItem, transientItem, synchronizationBranches, scopeOrGeneric]
void [frontierBranches, backfillBranches]
