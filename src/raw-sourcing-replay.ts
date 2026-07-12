import { z } from 'zod'
import type { CanonicalCandidateField, JsonValue } from './raw-sourcing.js'

export interface ResolverVersionRef {
  resolverId: string
  version: string
}

export type RawSourceReplaySelector =
  | {
      rawRecordIds: string[]
      rawRevisionIds?: string[]
      inputHashes?: string[]
    }
  | {
      rawRecordIds?: string[]
      rawRevisionIds: string[]
      inputHashes?: string[]
    }
  | {
      rawRecordIds?: string[]
      rawRevisionIds?: string[]
      inputHashes: string[]
    }

export interface RawSourceReplayInvalidation {
  resolverVersions?: ResolverVersionRef[]
  canonicalSchemaVersions?: string[]
  gatePolicyVersions?: string[]
}

export interface RawSourceReplayTargetVersions {
  resolvers?: ResolverVersionRef[]
  canonicalSchemaVersion?: string
  gatePolicyVersion?: string
}

export type RawSourceFieldDirective =
  | {
      action: 'lock'
      field: CanonicalCandidateField
      value: JsonValue
      reason: string
      inputHash: string
      policyVersion: string
    }
  | {
      action: 'suppress'
      field: CanonicalCandidateField
      reason: string
      inputHash: string
      policyVersion: string
    }

export interface ReplayRawSourceRecordsInput {
  selector: RawSourceReplaySelector
  invalidate: RawSourceReplayInvalidation
  targetVersions?: RawSourceReplayTargetVersions
  fieldDirectives?: RawSourceFieldDirective[]
}

const replayIdentifierSchema = z.string().min(1)
const replayTimestampSchema = z.iso.datetime({ offset: true })

export const completedRawSourceReplayItemSchema = z
  .object({
    status: z.literal('completed'),
    rawRecordId: replayIdentifierSchema,
    rawRevisionId: replayIdentifierSchema,
    normalizationRunId: replayIdentifierSchema.optional(),
  })
  .strict()

export type CompletedRawSourceReplayItem = z.infer<
  typeof completedRawSourceReplayItemSchema
>

export const rawSourceReplayFailureCodes = [
  'normalization_failed',
  'persistence_failed',
  'internal_error',
] as const

export type RawSourceReplayFailureCode =
  (typeof rawSourceReplayFailureCodes)[number]

/**
 * Closed replay failure data. Implementations must map thrown values to this
 * shape rather than exposing messages, causes, URLs, or provider data.
 */
export const rawSourceReplayFailureSchema = z
  .object({
    code: z.enum(rawSourceReplayFailureCodes),
    retryable: z.boolean(),
  })
  .strict()

export type RawSourceReplayFailure = z.infer<typeof rawSourceReplayFailureSchema>

export const failedRawSourceReplayItemSchema = z
  .object({
    status: z.literal('failed'),
    rawRecordId: replayIdentifierSchema,
    rawRevisionId: replayIdentifierSchema,
    normalizationRunId: replayIdentifierSchema.optional(),
    failure: rawSourceReplayFailureSchema,
  })
  .strict()

export type FailedRawSourceReplayItem = z.infer<
  typeof failedRawSourceReplayItemSchema
>

export const rawSourceReplayItemSchema = z.discriminatedUnion('status', [
  completedRawSourceReplayItemSchema,
  failedRawSourceReplayItemSchema,
])

export type RawSourceReplayItem = z.infer<typeof rawSourceReplayItemSchema>

const rawSourceReplayReceiptBaseShape = {
  replayId: replayIdentifierSchema,
  acceptedAt: replayTimestampSchema,
  completedAt: replayTimestampSchema,
  matchedRawRevisionIds: z.array(replayIdentifierSchema),
} as const

const completedRawSourceReplayReceiptSchema = z
  .object({
    ...rawSourceReplayReceiptBaseShape,
    status: z.literal('completed'),
    items: z.array(completedRawSourceReplayItemSchema),
  })
  .strict()

const completedWithFailuresRawSourceReplayReceiptSchema = z
  .object({
    ...rawSourceReplayReceiptBaseShape,
    status: z.literal('completed_with_failures'),
    items: z.array(rawSourceReplayItemSchema).min(1),
  })
  .strict()
  .refine((receipt) => receipt.items.some((item) => item.status === 'failed'), {
    message: 'completed_with_failures requires at least one failed item',
    path: ['items'],
  })

export const rawSourceReplayReceiptSchema = z
  .union([
    completedRawSourceReplayReceiptSchema,
    completedWithFailuresRawSourceReplayReceiptSchema,
  ])
  .superRefine((receipt, context) => {
    if (Date.parse(receipt.completedAt) < Date.parse(receipt.acceptedAt)) {
      context.addIssue({
        code: 'custom',
        message: 'completedAt must not precede acceptedAt',
        path: ['completedAt'],
      })
    }

    const matchedIds = new Set(receipt.matchedRawRevisionIds)
    const itemIds = new Set(receipt.items.map((item) => item.rawRevisionId))

    if (
      matchedIds.size !== receipt.matchedRawRevisionIds.length ||
      itemIds.size !== receipt.items.length ||
      matchedIds.size !== itemIds.size ||
      [...matchedIds].some((id) => !itemIds.has(id))
    ) {
      context.addIssue({
        code: 'custom',
        message: 'items must identify every matched raw revision exactly once',
        path: ['items'],
      })
    }
  })

export type RawSourceReplayReceipt = z.infer<typeof rawSourceReplayReceiptSchema>
