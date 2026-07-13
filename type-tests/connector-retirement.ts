import {
  ConnectorRetirementConflictError,
  type ConnectorRetirementActiveWorkConflict,
  type ConnectorRetirementResult,
  type RemoveConnectorInstanceInput,
  type ValedictorianClient,
  connectorRetirementActiveWorkConflictSchema,
  connectorRetirementResultSchema,
  removeConnectorInstanceInputSchema,
} from '../src/index.js'

const removeInput: RemoveConnectorInstanceInput = {
  connectorInstanceId: 'connector-1',
}

const retirementResult: ConnectorRetirementResult = {
  connectorInstanceId: 'connector-1',
  lifecycle: 'retired',
  retiredAt: '2026-07-13T14:00:00.000Z',
  requirements: {
    connectorImplementation: 'not_required',
    authenticationValidation: 'not_required',
  },
  disposition: {
    configuration: 'removed',
    schedule: 'removed',
    checkpoints: 'preserved',
    executionScopes: 'preserved',
    futureExecution: 'blocked',
    authReferences: 'removed',
    secretValues: 'preserved_for_workspace_secret_administration',
  },
  preservedLineage: {
    connectorRuns: true,
    rawSourceRecords: true,
    normalizationAttempts: true,
    canonicalCandidates: true,
    sourcingFindings: true,
  },
}

const activeWorkConflict: ConnectorRetirementActiveWorkConflict = {
  code: 'connector_retirement_active_work_conflict',
  connectorInstanceId: 'connector-1',
  message: 'Cancel active connector runs before retirement.',
  cancellationRequired: true,
  activeRuns: [{ connectorRunId: 'run-1', status: 'running' }],
}

async function retirementStaysWorkspaceScoped(client: ValedictorianClient) {
  const result: ConnectorRetirementResult = await client
    .forWorkspace('workspace-1')
    .connectors.remove(removeInput)
  void result

  // @ts-expect-error Connector retirement is not available on the workspace-neutral root.
  await client.connectors.remove(removeInput)
}

const aliasedRetirement: ConnectorRetirementResult = {
  ...retirementResult,
  // @ts-expect-error Retirement never accepts an obsolete-id replacement alias.
  replacementConnectorInstanceId: 'connector-2',
}

void aliasedRetirement
void activeWorkConflict
void ConnectorRetirementConflictError
void connectorRetirementActiveWorkConflictSchema
void connectorRetirementResultSchema
void removeConnectorInstanceInputSchema
void retirementStaysWorkspaceScoped
