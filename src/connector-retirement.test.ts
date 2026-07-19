import { describe, expect, it } from 'vitest'
import { connectorInstanceSummarySchema } from './connector.js'
import {
  connectorRetirementActiveWorkConflictSchema,
  connectorRetirementResultSchema,
  removeConnectorInstanceInputSchema,
} from './connector-retirement.js'
import { connectorInstanceSummaryPayload } from './http-client.test-support.js'

describe('connector retirement contract', () => {
  it('keeps enabled and disabled instances in normal summaries while excluding retired ones', () => {
    expect(connectorInstanceSummarySchema.parse(connectorInstanceSummaryPayload({
      enabled: true,
      lifecycle: 'enabled',
    }))).toMatchObject({ enabled: true, lifecycle: 'enabled' })
    expect(connectorInstanceSummarySchema.parse(connectorInstanceSummaryPayload({
      enabled: false,
      lifecycle: 'disabled',
    }))).toMatchObject({ enabled: false, lifecycle: 'disabled' })
    expect(connectorInstanceSummarySchema.safeParse(connectorInstanceSummaryPayload({
      enabled: false,
      lifecycle: 'retired',
    })).success).toBe(false)
  })

  it('makes connector loading and authentication validation non-requirements', () => {
    const receipt = {
      connectorInstanceId: 'uninstalled-connector-instance',
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
        captures: true,
        normalizationAttempts: true,
        jobs: true,
        opportunities: true,
      },
    }

    expect(connectorRetirementResultSchema.parse(receipt)).toEqual(receipt)
    expect(connectorRetirementResultSchema.safeParse({
      ...receipt,
      secretValue: 'must-not-cross-the-contract',
    }).success).toBe(false)
    expect(connectorRetirementResultSchema.safeParse({
      ...receipt,
      replacementConnectorInstanceId: 'obsolete-id-alias',
    }).success).toBe(false)
    expect(connectorRetirementResultSchema.safeParse({
      ...receipt,
      disposition: { ...receipt.disposition, secretValues: 'deleted' },
    }).success).toBe(false)
    expect(removeConnectorInstanceInputSchema.safeParse({
      connectorInstanceId: 'uninstalled-connector-instance',
      auth: { secretKey: 'workspace-secret' },
    }).success).toBe(false)
  })

  it('accepts only sanitized queued or running active-work conflicts', () => {
    const conflict = {
      code: 'connector_retirement_active_work_conflict',
      connectorInstanceId: 'connector-1',
      message: 'Cancel active connector runs before retirement.',
      cancellationRequired: true,
      activeRuns: [{ connectorRunId: 'run-1', status: 'queued' }],
    }

    expect(connectorRetirementActiveWorkConflictSchema.parse(conflict)).toEqual(conflict)
    expect(connectorRetirementActiveWorkConflictSchema.safeParse({
      ...conflict,
      activeRuns: [{ connectorRunId: 'run-1', status: 'completed' }],
    }).success).toBe(false)
    expect(connectorRetirementActiveWorkConflictSchema.safeParse({
      ...conflict,
      activeRuns: [],
    }).success).toBe(false)
    expect(connectorRetirementActiveWorkConflictSchema.safeParse({
      ...conflict,
      secretKey: 'workspace-secret',
    }).success).toBe(false)
  })
})
