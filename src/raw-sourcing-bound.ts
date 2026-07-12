import type { SourceExecutionScopeId } from './source-execution.js'
import { rawSourceNormalizationResultSchema } from './raw-sourcing.js'
import {
  batchRawSourceRecordsResultSchema,
  type BatchRawSourceRecordsInput,
} from './raw-sourcing.js'

export function createBoundBatchRawSourceRecordsResultSchema(
  input: BatchRawSourceRecordsInput,
) {
  return batchRawSourceRecordsResultSchema.superRefine((result, context) => {
    const requested = new Map(input.records.map((record) => [record.intakeItemId, record]))
    const returnedIds = result.receipts.map((receipt) => receipt.intakeItemId)
    if (result.receipts.length !== requested.size || new Set(returnedIds).size !== returnedIds.length ||
        returnedIds.some((id) => !requested.has(id))) {
      context.addIssue({ code: 'custom', message: 'receipts must match requested intake item ids exactly' })
    }
    result.receipts.forEach((receipt, index) => {
      const expected = requested.get(receipt.intakeItemId)?.capture
      const actual = receipt.occurrence.capture ?? undefined
      const matches = expected === undefined ? actual === undefined :
        actual !== undefined &&
        actual.connectorInstanceId === expected.connectorInstanceId &&
        actual.connectorRunId === expected.connectorRunId &&
        actual.executionScopeId === expected.executionScopeId
      if (!matches) {
        context.addIssue({
          code: 'custom', message: 'receipt capture must match its requested record',
          path: ['receipts', index, 'occurrence', 'capture'],
        })
      }
    })
  })
}

export interface BoundRawSourceNormalizationResult {
  rawRevisionId: string
  executionScopeId: SourceExecutionScopeId
}

/** Adds trusted raw-revision and connector-scope correlation to normalization reads. */
export function createBoundRawSourceNormalizationResultSchema(
  binding: BoundRawSourceNormalizationResult,
) {
  return rawSourceNormalizationResultSchema.superRefine((result, context) => {
    if (result.rawRevisionId !== binding.rawRevisionId) {
      context.addIssue({
        code: 'custom', message: 'normalization result must match the bound raw revision',
        path: ['rawRevisionId'],
      })
    }
    for (const [index, attempt] of result.attempts.entries()) {
      if (attempt.resolver.scopeRequirement === 'source' &&
          attempt.executionScopeId !== binding.executionScopeId) {
        context.addIssue({
          code: 'custom', message: 'source-scoped attempt must match the bound execution scope',
          path: ['attempts', index, 'executionScopeId'],
        })
      }
    }
  })
}
