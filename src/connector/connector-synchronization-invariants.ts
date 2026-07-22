import type { z } from 'zod'
import type {
  ConnectorHistoricalBackfillState,
  ConnectorNewestFrontierState,
  ConnectorRunStatus,
  ConnectorSynchronizationOutcome,
} from './connector.js'

export interface ConnectorSynchronizationInvariantProjection {
  status: ConnectorRunStatus
  outcome: ConnectorSynchronizationOutcome['kind']
  newestFrontier: ConnectorNewestFrontierState
  historicalBackfill: ConnectorHistoricalBackfillState
  pendingResolutionCount: number
}

/** Shared public synchronization-state invariants for full and compact run DTOs. */
export function refineConnectorSynchronizationInvariants(
  run: ConnectorSynchronizationInvariantProjection,
  context: z.RefinementCtx,
) {
  if (
    (run.outcome === 'caught_up'
      || run.outcome === 'boundary_exhausted'
      || run.outcome === 'source_exhausted')
    && run.status !== 'completed'
  ) {
    context.addIssue({
      code: 'custom',
      message: 'successful synchronization outcomes require completed status',
      path: ['status'],
    })
  }

  const progressCaughtUp = run.newestFrontier.state === 'caught_up'
    && run.historicalBackfill.state === 'caught_up'
    && run.pendingResolutionCount === 0
  if (progressCaughtUp !== (run.outcome === 'caught_up')) {
    context.addIssue({
      code: 'custom',
      message: 'caught-up runs require caught-up frontiers and no pending resolutions',
      path: ['outcome'],
    })
  }

  if (
    run.outcome === 'boundary_exhausted'
    && run.historicalBackfill.state !== 'boundary_reached'
  ) {
    context.addIssue({
      code: 'custom',
      message: 'boundary exhaustion requires a reached backfill boundary',
      path: ['outcome'],
    })
  }

  if (
    run.outcome === 'source_exhausted'
    && run.historicalBackfill.state !== 'source_exhausted'
  ) {
    context.addIssue({
      code: 'custom',
      message: 'source exhaustion requires exhausted backfill source state',
      path: ['outcome'],
    })
  }
}
