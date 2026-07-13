import type { ConnectorStatusState } from './connector.js'
import type { ConnectorOverviewLatestRun } from './connector-overview.js'

export type ConnectorOverviewHealthClassification =
  | 'run_backed'
  | 'overlay'
  | 'ambiguous'

/**
 * Exhaustive ownership model for overview health presentation.
 *
 * Run-backed states must equal the state derived from `latestRun`. Overlays may
 * replace a derived state because auth/configuration can change independently
 * after a run. `skipped` remains ambiguous for yielded/skipped run outcomes.
 */
export const connectorOverviewHealthClassifications = {
  authentication_required: 'overlay',
  backfilling: 'run_backed',
  blocked: 'overlay',
  boundary_exhausted: 'run_backed',
  cancelled: 'run_backed',
  caught_up: 'run_backed',
  checking_newest: 'run_backed',
  cooling_down: 'run_backed',
  failed: 'run_backed',
  never_run: 'run_backed',
  queued: 'run_backed',
  resolving: 'run_backed',
  skipped: 'ambiguous',
  source_exhausted: 'run_backed',
} as const satisfies Record<
  ConnectorStatusState,
  ConnectorOverviewHealthClassification
>

export type ConnectorOverviewRunBackedHealth = {
  [State in ConnectorStatusState]:
    (typeof connectorOverviewHealthClassifications)[State] extends 'run_backed'
      ? State
      : never
}[ConnectorStatusState]

/**
 * Derive only unambiguous run-backed health.
 *
 * Active-run presentation precedence is newest advancement, historical
 * advancement, then pending resolution. A running invocation with none of
 * those signals falls back to checking newest because that is the public
 * active state before another progress signal is visible.
 */
export function deriveRunBackedOverviewHealth(
  run: ConnectorOverviewLatestRun | null,
): ConnectorOverviewRunBackedHealth | null {
  if (run === null) return 'never_run'

  if (run.status === 'queued' && run.outcome === 'in_progress') return 'queued'

  if (run.status === 'running' && run.outcome === 'in_progress') {
    if (run.newestFrontier.state === 'advancing') return 'checking_newest'
    if (run.historicalBackfill.state === 'advancing') return 'backfilling'
    if (run.pendingResolutionCount > 0) return 'resolving'
    return 'checking_newest'
  }

  if (run.status === 'failed' && run.outcome === 'failed') return 'failed'
  if (run.status === 'cancelled' && run.outcome === 'cancelled') return 'cancelled'

  if (run.outcome === 'caught_up') return 'caught_up'
  if (run.outcome === 'boundary_exhausted') return 'boundary_exhausted'
  if (run.outcome === 'source_exhausted') return 'source_exhausted'
  if (run.outcome === 'cooling_down') return 'cooling_down'

  return null
}
