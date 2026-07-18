import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ConnectorRetirementConflictError,
  createHttpValedictorianClient,
  ValedictorianProtocolError,
} from './index.js'
import { jsonResponse, mockFetch } from './http-client.test-support.js'

const retirementReceipt = {
  connectorInstanceId: 'jobright/session 1',
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
} as const

describe('connector retirement HTTP client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('retires an instance through a bodyless workspace-scoped DELETE', async () => {
    const fetchMock = mockFetch(jsonResponse(retirementReceipt))
    const connectors = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test/base/',
    }).forWorkspace('workspace 1').connectors

    await expect(connectors.remove({
      connectorInstanceId: 'jobright/session 1',
    })).resolves.toEqual(retirementReceipt)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://valedictorian.test/v1/workspaces/workspace%201/connectors/jobright%2Fsession%201',
      {
        headers: { accept: 'application/json' },
        method: 'DELETE',
      },
    )
  })

  it('rejects a retirement receipt for a different connector instance', async () => {
    mockFetch(jsonResponse({
      ...retirementReceipt,
      connectorInstanceId: 'different-instance',
    }))
    const connectors = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    }).forWorkspace('workspace-1').connectors

    await expect(connectors.remove({
      connectorInstanceId: 'jobright/session 1',
    })).rejects.toBeInstanceOf(ValedictorianProtocolError)
  })

  it('rejects an empty connector identity before calling fetch', async () => {
    const fetchMock = mockFetch(jsonResponse(retirementReceipt))
    const connectors = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    }).forWorkspace('workspace-1').connectors

    await expect(connectors.remove({ connectorInstanceId: '  ' })).rejects.toThrow()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('surfaces queued or running work as a typed cancellation-required conflict', async () => {
    const conflict = {
      code: 'connector_retirement_active_work_conflict',
      connectorInstanceId: 'jobright/session 1',
      message: 'Cancel active connector runs before retirement.',
      cancellationRequired: true,
      activeRuns: [
        { connectorRunId: 'run-queued', status: 'queued' },
        { connectorRunId: 'run-running', status: 'running' },
      ],
    } as const
    mockFetch(jsonResponse(conflict, { status: 409 }))
    const connectors = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    }).forWorkspace('workspace-1').connectors

    const result = connectors.remove({ connectorInstanceId: 'jobright/session 1' })

    await expect(result).rejects.toBeInstanceOf(ConnectorRetirementConflictError)
    await expect(result).rejects.toMatchObject({ conflict, status: 409 })
  })

  it('does not retain secret values from a malformed retirement conflict', async () => {
    mockFetch(jsonResponse({
      code: 'connector_retirement_active_work_conflict',
      connectorInstanceId: 'jobright/session 1',
      message: 'Cancel active connector runs before retirement.',
      cancellationRequired: true,
      activeRuns: [{ connectorRunId: 'run-running', status: 'running' }],
      secretValue: 'must-not-cross-the-contract',
    }, { status: 409 }))
    const connectors = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    }).forWorkspace('workspace-1').connectors

    const result = connectors.remove({ connectorInstanceId: 'jobright/session 1' })

    await expect(result).rejects.not.toBeInstanceOf(ConnectorRetirementConflictError)
    await expect(result.catch((error: unknown) => JSON.stringify(error)))
      .resolves.not.toContain('must-not-cross-the-contract')
  })
})
