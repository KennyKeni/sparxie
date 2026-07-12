import type {
  ConnectorRunSummary,
  ConnectorSchedulingCapability,
  DispatchConnectorScheduleDueResult,
  TriggerConnectorRunInput,
  UpsertConnectorScheduleInput,
  ValedictorianCapabilities,
  ValedictorianClient,
} from '../src/index.js'
import {
  connectorScheduleDstPolicy,
  defaultLocalCapabilities,
  dispatchConnectorScheduleDueResultSchema,
  unavailableConnectorSchedulingCapability,
  upsertConnectorScheduleInputSchema,
  valedictorianCapabilitiesSchema,
} from '../src/index.js'

type IsExact<Actual, Expected> =
  (<Value>() => Value extends Actual ? 1 : 2) extends <Value>() =>
    Value extends Expected ? 1 : 2
    ? true
    : false

const unavailableCapabilityLiteral: IsExact<
  typeof unavailableConnectorSchedulingCapability,
  { readonly available: false }
> = true

const capabilityRequiresScheduling: IsExact<
  ValedictorianCapabilities['connectorScheduling'],
  ConnectorSchedulingCapability
> = true

const runProvenanceRequired: IsExact<
  Extract<ConnectorRunSummary, { mode: 'manual' }>['scheduleOccurrence'],
  null
> = true

const scheduledRunRequiresScheduledLink: IsExact<
  Extract<ConnectorRunSummary, { mode: 'scheduled' }>['scheduleOccurrence']['admittedMode'],
  'scheduled'
> = true

const catchUpRunRequiresCatchUpLink: IsExact<
  Extract<ConnectorRunSummary, { mode: 'catch_up' }>['scheduleOccurrence']['admittedMode'],
  'catch_up'
> = true

const upsertWithNextEligibleAt: UpsertConnectorScheduleInput = {
  connectorInstanceId: 'connector-1',
  expectedRevision: null,
  state: 'enabled',
  cadence: { kind: 'daily', localTime: '09:00' },
  timezone: 'America/New_York',
  // @ts-expect-error Mutation input cannot set nextEligibleAt.
  nextEligibleAt: '2026-07-12T13:00:00.000Z',
}

// @ts-expect-error Upsert requires expectedRevision null for create or a revision for update.
const upsertOmitsExpectedRevision: UpsertConnectorScheduleInput = {
  connectorInstanceId: 'connector-1',
  state: 'enabled',
  cadence: { kind: 'daily', localTime: '09:00' },
  timezone: 'America/New_York',
}

const triggerWithScheduleOccurrence: TriggerConnectorRunInput = {
  connectorInstanceId: 'connector-1',
  mode: 'manual',
  // @ts-expect-error Ordinary trigger input cannot set scheduleOccurrence.
  scheduleOccurrence: null,
}

type AdmittedDispatch = Extract<DispatchConnectorScheduleDueResult, { status: 'admitted' }>
const admittedHasSingleOccurrence: IsExact<
  AdmittedDispatch['occurrence'] extends Array<unknown> ? true : false,
  false
> = true

type AdmittedScheduledDispatch = Extract<
  AdmittedDispatch,
  { occurrence: { admittedMode: 'scheduled' } }
>
const admittedScheduledMode: IsExact<
  AdmittedScheduledDispatch['occurrence']['admittedMode'],
  'scheduled'
> = true
const admittedScheduledRunMode: IsExact<AdmittedScheduledDispatch['run']['mode'], 'scheduled'> =
  true

type AdmittedCatchUpDispatch = Extract<
  AdmittedDispatch,
  { occurrence: { admittedMode: 'catch_up' } }
>
const admittedCatchUpMode: IsExact<
  AdmittedCatchUpDispatch['occurrence']['admittedMode'],
  'catch_up'
> = true
const admittedCatchUpRunMode: IsExact<AdmittedCatchUpDispatch['run']['mode'], 'catch_up'> = true

const mismatchedAdmittedDispatch: AdmittedScheduledDispatch = {
  status: 'admitted',
  occurrence: {
    id: 'occ-1',
    scheduleId: 'schedule-1',
    scheduleRevision: 'rev-1',
    nominalAt: '2026-07-12T12:00:00.000Z',
    idempotencyKey: 'rev-1:2026-07-12T12:00:00.000Z',
    admittedMode: 'scheduled',
    outcome: 'admitted',
    connectorRunId: 'run-1',
    createdAt: '2026-07-12T13:00:00.000Z',
  },
  run: {
    id: 'run-1',
    status: 'queued',
    // @ts-expect-error Admitted scheduled occurrence cannot pair with a catch_up run.
    mode: 'catch_up',
    startedAt: '2026-07-12T13:00:00.000Z',
    completedAt: null,
  },
}

async function scheduleApisStayWorkspaceScoped(client: ValedictorianClient) {
  await client.forWorkspace('workspace-1').connectors.schedules.get('connector-1')
  await client.forWorkspace('workspace-1').connectors.schedules.dispatchDue({
    connectorInstanceId: 'connector-1',
    expectedRevision: 'rev-1',
  })

  // @ts-expect-error Schedule operations are not available on the root client.
  await client.connectors.schedules.get('connector-1')
}

const localDefaultsUseUnavailable = defaultLocalCapabilities.connectorScheduling

void unavailableCapabilityLiteral
void capabilityRequiresScheduling
void runProvenanceRequired
void scheduledRunRequiresScheduledLink
void catchUpRunRequiresCatchUpLink
void upsertWithNextEligibleAt
void upsertOmitsExpectedRevision
void triggerWithScheduleOccurrence
void admittedHasSingleOccurrence
void admittedScheduledMode
void admittedScheduledRunMode
void admittedCatchUpMode
void admittedCatchUpRunMode
void mismatchedAdmittedDispatch
void scheduleApisStayWorkspaceScoped
void localDefaultsUseUnavailable
void connectorScheduleDstPolicy
void dispatchConnectorScheduleDueResultSchema
void upsertConnectorScheduleInputSchema
void valedictorianCapabilitiesSchema
