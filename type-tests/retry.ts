import type {
  ConnectorRunSummary,
  CancelledRetryAdvice,
  ExhaustedRetryAdvice,
  FieldResolutionOutcome,
  NotDueRetryAdvice,
  RetryAdvice,
  RetryAdviceState,
  ScheduledRetryAdvice,
  TransientRetryReason,
  ValedictorianClient,
} from '../src/index.js'
import {
  connectorRunSummarySchema,
  connectorRunsListResultSchema,
  retryAdviceStates,
  retryAdviceSchema,
  transientRetryReasons,
} from '../src/index.js'

type IsExact<Actual, Expected> =
  (<Value>() => Value extends Actual ? 1 : 2) extends <Value>() =>
    Value extends Expected ? 1 : 2
    ? true
    : false

const reasonsAreClosed: IsExact<
  TransientRetryReason,
  'rate_limit' | 'server_failure' | 'network_interruption' | 'operation_timeout'
> = true
const statesAreClosed: IsExact<
  RetryAdviceState,
  'scheduled' | 'not_due' | 'exhausted' | 'cancelled'
> = true
const connectorRetryIsTypedAndNullable: IsExact<
  ConnectorRunSummary['retryHints'],
  RetryAdvice | null
> = true

const scheduledRetry: RetryAdvice = {
  state: 'scheduled',
  reason: 'rate_limit',
  attempt: 1,
  maxAttempts: 4,
  lastAttemptAt: '2026-07-11T14:00:00.000Z',
  computedDelayMs: 30_000,
  serverMinimumDelayMs: 20_000,
  nextAttemptAt: '2026-07-11T14:00:30.000Z',
  horizonAt: '2026-07-11T15:00:00.000Z',
}

const exhaustedRetry: RetryAdvice = {
  state: 'exhausted',
  reason: 'operation_timeout',
  attempt: 4,
  maxAttempts: 4,
  lastAttemptAt: '2026-07-11T14:59:00.000Z',
  computedDelayMs: 120_000,
  nextAttemptAt: null,
  horizonAt: '2026-07-11T15:00:00.000Z',
}

declare const scheduledBranch: ScheduledRetryAdvice
declare const notDueBranch: NotDueRetryAdvice
declare const exhaustedBranch: ExhaustedRetryAdvice
declare const cancelledBranch: CancelledRetryAdvice

const normalizationRetry: FieldResolutionOutcome = {
  status: 'retry',
  resolverId: 'resolver-1',
  resolverVersion: '1.0.0',
  field: 'companyName',
  inputHash: 'sha256:input',
  retry: scheduledRetry,
}

const cancelledRetry: CancelledRetryAdvice = {
  state: 'cancelled',
  reason: 'operation_timeout',
  attempt: 2,
  maxAttempts: 4,
  lastAttemptAt: '2026-07-11T14:59:00.000Z',
  computedDelayMs: null,
  nextAttemptAt: null,
  horizonAt: '2026-07-11T15:00:00.000Z',
}

const normalizationExhausted: FieldResolutionOutcome = {
  status: 'exhausted',
  resolverId: 'resolver-1',
  resolverVersion: '1.0.0',
  field: 'companyName',
  inputHash: 'sha256:input',
  retry: exhaustedRetry,
}

const normalizationCancelled: FieldResolutionOutcome = {
  status: 'cancelled',
  resolverId: 'resolver-1',
  resolverVersion: '1.0.0',
  field: 'companyName',
  inputHash: 'sha256:input',
  retry: cancelledRetry,
}

const impossibleNormalizationRetry: FieldResolutionOutcome = {
  status: 'retry',
  resolverId: 'resolver-1',
  resolverVersion: '1.0.0',
  field: 'companyName',
  inputHash: 'sha256:input',
  // @ts-expect-error Terminal exhausted advice cannot be exposed as schedulable retry work.
  retry: exhaustedRetry,
}

const impossibleExhaustedCancellation: FieldResolutionOutcome = {
  status: 'exhausted',
  resolverId: 'resolver-1',
  resolverVersion: '1.0.0',
  field: 'companyName',
  inputHash: 'sha256:input',
  // @ts-expect-error Exhausted outcomes require exhausted advice.
  retry: cancelledRetry,
}

const invalidReason: RetryAdvice = {
  ...scheduledRetry,
  // @ts-expect-error Authentication is not a transient retry reason.
  reason: 'auth',
}

const publicAdviceWithPrivateIdentity: RetryAdvice = {
  ...scheduledRetry,
  // @ts-expect-error Provider-private work identity is not public retry advice.
  providerWorkId: 'private-work-1',
}

// @ts-expect-error Terminal advice cannot expose schedulable work.
const impossibleTerminalSchedule: RetryAdvice = {
  ...exhaustedRetry,
  nextAttemptAt: '2026-07-11T15:01:00.000Z',
}

const legacyNormalizationRetry: FieldResolutionOutcome = {
  status: 'retry',
  resolverId: 'resolver-1',
  resolverVersion: '1.0.0',
  field: 'companyName',
  inputHash: 'sha256:input',
  // @ts-expect-error Legacy ad hoc retry reasons are not accepted.
  reason: 'try_again',
  retryAfter: '2026-07-11T15:01:00.000Z',
}

async function connectorRunsStayWorkspaceScoped(client: ValedictorianClient) {
  await client.forWorkspace('workspace-1').connectors.runs.trigger({
    connectorInstanceId: 'connector-1',
  })

  // @ts-expect-error Connector operations are not available on the root client.
  await client.connectors.runs.trigger({ connectorInstanceId: 'connector-1' })
}

void connectorRunSummarySchema
void connectorRunsListResultSchema
void connectorRunsStayWorkspaceScoped
void exhaustedRetry
void impossibleTerminalSchedule
void invalidReason
void publicAdviceWithPrivateIdentity
void legacyNormalizationRetry
void normalizationRetry
void normalizationExhausted
void normalizationCancelled
void impossibleNormalizationRetry
void impossibleExhaustedCancellation
void reasonsAreClosed
void retryAdviceSchema
void transientRetryReasons
void connectorRetryIsTypedAndNullable
void scheduledBranch
void notDueBranch
void exhaustedBranch
void cancelledBranch
void retryAdviceStates
void statesAreClosed
