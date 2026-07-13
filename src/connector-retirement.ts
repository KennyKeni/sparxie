import { z } from 'zod'

export interface RemoveConnectorInstanceInput {
  connectorInstanceId: string
}

/**
 * Sanitized receipt for forward-only retirement. Historical evidence remains
 * addressable by its original connector instance id; no replacement id or
 * compatibility alias is created.
 */
export interface ConnectorRetirementResult {
  connectorInstanceId: string
  lifecycle: 'retired'
  retiredAt: string
  requirements: {
    connectorImplementation: 'not_required'
    authenticationValidation: 'not_required'
  }
  disposition: {
    configuration: 'removed'
    schedule: 'removed'
    checkpoints: 'preserved'
    executionScopes: 'preserved'
    futureExecution: 'blocked'
    authReferences: 'removed'
    /** Plaintext is never retrieved or returned by connector retirement. */
    secretValues: 'preserved_for_workspace_secret_administration'
  }
  preservedLineage: {
    connectorRuns: true
    rawSourceRecords: true
    normalizationAttempts: true
    canonicalCandidates: true
    sourcingFindings: true
  }
}

export interface ConnectorRetirementActiveWorkConflict {
  code: 'connector_retirement_active_work_conflict'
  connectorInstanceId: string
  message: string
  cancellationRequired: true
  activeRuns: Array<{
    connectorRunId: string
    status: 'queued' | 'running'
  }>
}

export const removeConnectorInstanceInputSchema: z.ZodType<RemoveConnectorInstanceInput> = z
  .object({ connectorInstanceId: z.string().trim().min(1) })
  .strict()

export const connectorRetirementResultSchema: z.ZodType<ConnectorRetirementResult> = z
  .object({
    connectorInstanceId: z.string().min(1),
    lifecycle: z.literal('retired'),
    retiredAt: z.iso.datetime({ offset: true }),
    requirements: z
      .object({
        connectorImplementation: z.literal('not_required'),
        authenticationValidation: z.literal('not_required'),
      })
      .strict(),
    disposition: z
      .object({
        configuration: z.literal('removed'),
        schedule: z.literal('removed'),
        checkpoints: z.literal('preserved'),
        executionScopes: z.literal('preserved'),
        futureExecution: z.literal('blocked'),
        authReferences: z.literal('removed'),
        secretValues: z.literal('preserved_for_workspace_secret_administration'),
      })
      .strict(),
    preservedLineage: z
      .object({
        connectorRuns: z.literal(true),
        rawSourceRecords: z.literal(true),
        normalizationAttempts: z.literal(true),
        canonicalCandidates: z.literal(true),
        sourcingFindings: z.literal(true),
      })
      .strict(),
  })
  .strict()

export const connectorRetirementActiveWorkConflictSchema:
  z.ZodType<ConnectorRetirementActiveWorkConflict> = z
  .object({
    code: z.literal('connector_retirement_active_work_conflict'),
    connectorInstanceId: z.string().min(1),
    message: z.string().min(1).max(512),
    cancellationRequired: z.literal(true),
    activeRuns: z
      .array(z
        .object({
          connectorRunId: z.string().min(1),
          status: z.enum(['queued', 'running']),
        })
        .strict())
      .min(1),
  })
  .strict()
