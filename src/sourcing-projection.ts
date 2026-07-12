import { z } from 'zod'
import type { NormalizationGateStatus, NormalizationStatus } from './raw-sourcing.js'
import { sourcingMergeStatuses, type SourcingMergeStatus } from './sourcing.js'

export interface SourcingProjectionFindingReference {
  id: string
  mergeStatus: SourcingMergeStatus
  mergedApplicationId: string | null
}

interface RawSourceProjectionResultBase {
  rawRecordId: string
  rawRevisionId: string
  updatedAt: string
}

export type RawSourceProjectionResult = RawSourceProjectionResultBase &
  (
    | {
        status: 'not_eligible'
        normalizationStatus: null
        canonicalCandidateId: null
        gateStatus: null
      }
    | {
        status: 'not_eligible'
        normalizationStatus: Exclude<NormalizationStatus, 'completed' | 'failed'>
        canonicalCandidateId: null
        gateStatus: null
      }
    | {
        status: 'not_eligible'
        normalizationStatus: 'completed'
        canonicalCandidateId: null
        gateStatus: Exclude<NormalizationGateStatus, 'passed' | 'failed'>
      }
    | {
        status: 'not_eligible'
        normalizationStatus: 'failed'
        canonicalCandidateId: null
        gateStatus: 'failed' | null
      }
    | {
        status: 'pending'
        normalizationStatus: 'completed'
        gateStatus: 'passed'
        canonicalCandidateId: string
      }
    | {
        status: 'projected'
        normalizationStatus: 'completed'
        gateStatus: 'passed'
        canonicalCandidateId: string
        projectedAt: string
        finding: SourcingProjectionFindingReference
      }
    | {
        status: 'failed'
        normalizationStatus: 'completed'
        gateStatus: 'passed'
        canonicalCandidateId: string
        failedAt: string
        failure: {
          code: 'projection_failed' | 'persistence_failed' | 'internal_error'
          retryable: boolean
        }
      }
  )

const identifierSchema = z.string().min(1)

const notEligibleBaseShape = {
  rawRecordId: identifierSchema,
  rawRevisionId: identifierSchema,
  updatedAt: z.iso.datetime({ offset: true }),
  status: z.literal('not_eligible'),
  canonicalCandidateId: z.null(),
} as const

const notEligibleRawSourceProjectionResultSchema = z.union([
  z
  .object({
    ...notEligibleBaseShape,
    normalizationStatus: z.null(),
    gateStatus: z.null(),
  })
    .strict(),
  z
    .object({
      ...notEligibleBaseShape,
      normalizationStatus: z.enum(['pending', 'in_progress', 'blocked']),
      gateStatus: z.null(),
    })
    .strict(),
  z
    .object({
      ...notEligibleBaseShape,
      normalizationStatus: z.literal('completed'),
      gateStatus: z.enum(['needs_enrichment', 'rejected']),
    })
    .strict(),
  z
    .object({
      ...notEligibleBaseShape,
      normalizationStatus: z.literal('failed'),
      gateStatus: z.literal('failed').nullable(),
    })
    .strict(),
])

const candidateProjectionBaseShape = {
  rawRecordId: identifierSchema,
  rawRevisionId: identifierSchema,
  updatedAt: z.iso.datetime({ offset: true }),
  normalizationStatus: z.literal('completed'),
  gateStatus: z.literal('passed'),
  canonicalCandidateId: identifierSchema,
} as const

const pendingRawSourceProjectionResultSchema = z
  .object({
    ...candidateProjectionBaseShape,
    status: z.literal('pending'),
  })
  .strict()

const projectedRawSourceProjectionResultSchema = z
  .object({
    ...candidateProjectionBaseShape,
    status: z.literal('projected'),
    projectedAt: z.iso.datetime({ offset: true }),
    finding: z
      .object({
        id: identifierSchema,
        mergeStatus: z.enum(sourcingMergeStatuses),
        mergedApplicationId: z.string().min(1).nullable(),
      })
      .strict(),
  })
  .strict()

const failedRawSourceProjectionResultSchema = z
  .object({
    ...candidateProjectionBaseShape,
    status: z.literal('failed'),
    failedAt: z.iso.datetime({ offset: true }),
    failure: z
      .object({
        code: z.enum(['projection_failed', 'persistence_failed', 'internal_error']),
        retryable: z.boolean(),
      })
      .strict(),
  })
  .strict()

export const rawSourceProjectionResultSchema: z.ZodType<RawSourceProjectionResult> =
  z.union([
    notEligibleRawSourceProjectionResultSchema,
    pendingRawSourceProjectionResultSchema,
    projectedRawSourceProjectionResultSchema,
    failedRawSourceProjectionResultSchema,
  ])
