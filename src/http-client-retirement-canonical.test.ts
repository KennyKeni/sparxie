import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ConnectorRetirementConflictError,
  connectorRetirementActiveWorkConflictBody,
  connectorRetirementActiveWorkConflictMessage,
  createHttpValedictorianClient,
  ValedictorianProtocolError,
  valedictorianSafeRequestFailedMessage,
} from './index.js'
import { jsonResponse } from './http-client.test-support.js'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('canonical connector retirement conflict copy', () => {
  it('exports a fixed canonical conflict message and body', () => {
    expect(connectorRetirementActiveWorkConflictMessage).toBe(
      'Cancel active connector runs before retirement.',
    )
    expect(connectorRetirementActiveWorkConflictBody.message).toBe(
      connectorRetirementActiveWorkConflictMessage,
    )
  })

  it('rejects an otherwise valid 409 with arbitrary message as ValedictorianProtocolError', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        code: 'connector_retirement_active_work_conflict',
        connectorInstanceId: 'jobright/session 1',
        message: 'canary-arbitrary-retirement-copy',
        cancellationRequired: true,
        activeRuns: [{ connectorRunId: 'run-1', status: 'running' }],
      }, { status: 409 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const error = await createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    })
      .forWorkspace('workspace-1')
      .connectors.remove({ connectorInstanceId: 'jobright/session 1' })
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ValedictorianProtocolError)
    expect(error).not.toBeInstanceOf(ConnectorRetirementConflictError)
    expect(error).toMatchObject({ message: valedictorianSafeRequestFailedMessage })
    expect(JSON.stringify(error)).not.toContain('canary-arbitrary-retirement-copy')
    expect(String(error)).not.toContain('canary-arbitrary-retirement-copy')
  })
})
