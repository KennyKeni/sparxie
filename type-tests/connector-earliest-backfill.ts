import type {
  CanonicalDateOnly,
  ConnectorInstanceSummary,
  CreateConnectorInstanceInput,
  UpdateConnectorInstanceInput,
  ValedictorianClient,
} from '../src/index.js'
import {
  canonicalDateOnlySchema,
  connectorInstanceSummarySchema,
  connectorInstancesListResultSchema,
  createConnectorInstanceInputSchema,
  updateConnectorInstanceInputSchema,
} from '../src/index.js'

type IsExact<Actual, Expected> =
  (<Value>() => Value extends Actual ? 1 : 2) extends <Value>() =>
    Value extends Expected ? 1 : 2
    ? true
    : false

const summaryDateIsRequired: IsExact<
  ConnectorInstanceSummary['earliestBackfillDate'],
  CanonicalDateOnly
> = true

const createDateIsOptional: IsExact<
  CreateConnectorInstanceInput['earliestBackfillDate'],
  CanonicalDateOnly | undefined
> = true

const updateDateIsOptional: IsExact<
  UpdateConnectorInstanceInput['earliestBackfillDate'],
  CanonicalDateOnly | undefined
> = true

const canonicalDateAlias: IsExact<CanonicalDateOnly, string> = true

const validCreateOmitsDate: CreateConnectorInstanceInput = {
  id: 'connector-1',
  connectorId: 'jobright.resolver',
  connectorVersion: '0.1.0',
  displayName: 'Jobright',
  enabled: true,
}

const validCreateWithDate: CreateConnectorInstanceInput = {
  ...validCreateOmitsDate,
  earliestBackfillDate: '2026-07-04',
}

const validUpdatePatch: UpdateConnectorInstanceInput = {
  connectorInstanceId: 'connector-1',
  earliestBackfillDate: '2026-06-01',
}

const validSummary: ConnectorInstanceSummary = {
  id: 'connector-1',
  connectorId: 'jobright.resolver',
  connectorVersion: '0.1.0',
  displayName: 'Jobright',
  enabled: true,
  lifecycle: 'enabled',
  auth: [],
  config: {},
  filters: {},
  earliestBackfillDate: '2026-07-04',
  createdAt: '2026-07-11T14:00:00.000Z',
  updatedAt: '2026-07-11T14:00:00.000Z',
}

// @ts-expect-error Connector instance summaries require earliestBackfillDate.
const missingSummaryDate: ConnectorInstanceSummary = {
  id: 'connector-1',
  connectorId: 'jobright.resolver',
  connectorVersion: '0.1.0',
  displayName: 'Jobright',
  enabled: true,
  lifecycle: 'enabled',
  auth: [],
  config: {},
  filters: {},
  createdAt: '2026-07-11T14:00:00.000Z',
  updatedAt: '2026-07-11T14:00:00.000Z',
}

async function connectorInstanceApisStayWorkspaceScoped(client: ValedictorianClient) {
  await client.forWorkspace('workspace-1').connectors.list()
  await client.forWorkspace('workspace-1').connectors.create(validCreateOmitsDate)
  await client.forWorkspace('workspace-1').connectors.update(validUpdatePatch)

  // @ts-expect-error Connector operations are not available on the root client.
  await client.connectors.list()
}

void summaryDateIsRequired
void createDateIsOptional
void updateDateIsOptional
void canonicalDateAlias
void validCreateWithDate
void validSummary
void missingSummaryDate
void connectorInstanceApisStayWorkspaceScoped
void canonicalDateOnlySchema
void connectorInstanceSummarySchema
void connectorInstancesListResultSchema
void createConnectorInstanceInputSchema
void updateConnectorInstanceInputSchema
