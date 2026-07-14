import {
  ConnectorOptionQueryHttpError,
  type ConnectorOptionQueryBody,
  type ConnectorOptionQueryErrorBody,
  type ConnectorOptionQueryErrorCode,
  type ConnectorOptionQueryResult,
  type InstalledConnectorDescriptor,
  type InstalledConnectorDescriptorsListResult,
  type ValedictorianClient,
  type ValedictorianWorkspaceClient,
} from '../src/index.js'

type IsExact<Actual, Expected> =
  (<Value>() => Value extends Actual ? 1 : 2) extends <Value>() =>
    Value extends Expected ? 1 : 2
    ? true
    : false

interface ExpectedDescriptorMethods {
  list(): Promise<InstalledConnectorDescriptorsListResult>
  get(connectorId: string, connectorVersion: string): Promise<InstalledConnectorDescriptor>
}

interface ExpectedOptionQueryInput {
  connectorInstanceId: string
  body: ConnectorOptionQueryBody
  expectedIdentity: {
    connectorId: string
    connectorVersion: string
    filterSchemaVersion: string
    catalogVersion: string
    sourceVersion: string
  }
}

interface ExpectedOptionMethods {
  query(
    input: ExpectedOptionQueryInput,
    options?: { signal?: AbortSignal },
  ): Promise<ConnectorOptionQueryResult>
}

const descriptorMethodsAreExact: IsExact<
  ValedictorianWorkspaceClient['connectors']['descriptors'],
  ExpectedDescriptorMethods
> = true

const optionMethodsAreExact: IsExact<
  ValedictorianWorkspaceClient['connectors']['options'],
  ExpectedOptionMethods
> = true

async function capabilitiesStayWorkspaceScoped(client: ValedictorianClient) {
  const descriptor: InstalledConnectorDescriptor = await client
    .forWorkspace('workspace-1')
    .connectors.descriptors.get('jobright.resolver', '0.13.0')
  const result: ConnectorOptionQueryResult = await client
    .forWorkspace('workspace-1')
    .connectors.options.query({
      connectorInstanceId: 'jobright/session-1',
      body: {
        sourceId: 'jobright.locations',
        operation: { kind: 'search', search: 'new york' },
        dependencies: {},
      },
      expectedIdentity: {
        connectorId: 'jobright.resolver',
        connectorVersion: '0.13.0',
        filterSchemaVersion: 'filters@3',
        catalogVersion: 'options@2',
        sourceVersion: 'locations@4',
      },
    }, { signal: new AbortController().signal })
  await client.forWorkspace('workspace-1').connectors.options.query({
    connectorInstanceId: 'connector-1',
    body: {
      sourceId: 'locations',
      operation: { kind: 'search', search: '' },
      dependencies: {},
    },
    expectedIdentity: {
      connectorId: 'jobright.resolver',
      connectorVersion: '0.13.0',
      filterSchemaVersion: 'filters@3',
      catalogVersion: 'options@2',
      sourceVersion: 'locations@4',
      // @ts-expect-error Expected identity has exactly five client-local keys.
      connectorInstanceId: 'attacker-instance',
    },
  })

  void descriptor
  void result

  // @ts-expect-error Installed connector descriptors are not root-client APIs.
  await client.connectors.descriptors.list()
  // @ts-expect-error Dynamic option queries are not root-client APIs.
  await client.connectors.options.query({})
}

declare const typedError: ConnectorOptionQueryHttpError
const typedErrorCode: ConnectorOptionQueryErrorCode = typedError.code
const typedErrorBody: ConnectorOptionQueryErrorBody = typedError.body

const signalInsideInput: ExpectedOptionQueryInput = {
  connectorInstanceId: 'connector-1',
  body: {
    sourceId: 'locations',
    operation: { kind: 'search', search: '' },
    dependencies: {},
  },
  expectedIdentity: {
    connectorId: 'jobright.resolver',
    connectorVersion: '0.13.0',
    filterSchemaVersion: 'filters@3',
    catalogVersion: 'options@2',
    sourceVersion: 'locations@4',
  },
  // @ts-expect-error AbortSignal is operation-local metadata, separate from query input.
  signal: new AbortController().signal,
}

const spoofedBody: ConnectorOptionQueryBody = {
  sourceId: 'locations',
  operation: { kind: 'search', search: '' },
  dependencies: {},
  // @ts-expect-error Backend-derived identities cannot be serialized in the query body.
  connectorVersion: '0.13.0',
}

void descriptorMethodsAreExact
void optionMethodsAreExact
void capabilitiesStayWorkspaceScoped
void typedErrorCode
void typedErrorBody
void signalInsideInput
void spoofedBody
