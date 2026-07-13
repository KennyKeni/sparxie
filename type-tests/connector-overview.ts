import type {
  ConnectorOverviewListQuery,
  ConnectorOverviewListResult,
  ConnectorOverviewLatestRun,
  ConnectorOverviewRecord,
  ConnectorOverviewRunOutcome,
  ValedictorianClient,
  ValedictorianWorkspaceClient,
} from '../src/index.js'
import {
  connectorOverviewListQuerySchema,
  connectorOverviewListResultSchema,
  connectorOverviewRecordSchema,
} from '../src/index.js'

type IsExact<Actual, Expected> =
  (<Value>() => Value extends Actual ? 1 : 2) extends <Value>() =>
    Value extends Expected ? 1 : 2
    ? true
    : false

const listReturnsContract: IsExact<
  ReturnType<ValedictorianWorkspaceClient['connectors']['overview']['list']>,
  Promise<ConnectorOverviewListResult>
> = true

const rootClientHasNoConnectors: IsExact<keyof ValedictorianClient & 'connectors', never> =
  true

const queryOmitsOffset: IsExact<
  keyof ConnectorOverviewListQuery & ('offset' | 'total' | 'hasMore'),
  never
> = true

const resultOmitsCounts: IsExact<
  keyof ConnectorOverviewListResult & ('offset' | 'total' | 'hasMore' | 'limit'),
  never
> = true

const overviewOmitsInternals: IsExact<
  keyof ConnectorOverviewRecord &
    (
      | 'auth'
      | 'config'
      | 'filters'
      | 'credentials'
      | 'session'
      | 'executionScopeId'
      | 'filterSignature'
      | 'retry'
      | 'serverMinimumDelayMs'
      | 'runnerPid'
    ),
  never
> = true

const runOutcomesStayClosed: IsExact<
  ConnectorOverviewRunOutcome,
  | 'in_progress'
  | 'failed'
  | 'cancelled'
  | 'yielded'
  | 'caught_up'
  | 'cooling_down'
  | 'action_required'
  | 'boundary_exhausted'
  | 'source_exhausted'
> = true

const cancellationKindStaysBounded: IsExact<
  ConnectorOverviewLatestRun['cancellationKind'],
  'user_skipped' | null
> = true

const compactRunOmitsCancellationInternals: IsExact<
  keyof ConnectorOverviewLatestRun & ('reason' | 'cancellationReason' | 'internalCode'),
  never
> = true

connectorOverviewListQuerySchema satisfies {
  parse(value: unknown): ConnectorOverviewListQuery
}
connectorOverviewRecordSchema satisfies {
  parse(value: unknown): ConnectorOverviewRecord
}
connectorOverviewListResultSchema satisfies {
  parse(value: unknown): ConnectorOverviewListResult
}

void listReturnsContract
void rootClientHasNoConnectors
void queryOmitsOffset
void resultOmitsCounts
void overviewOmitsInternals
void runOutcomesStayClosed
void cancellationKindStaysBounded
void compactRunOmitsCancellationInternals
