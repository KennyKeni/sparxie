import type {
  CancelledRetryAdvice,
  ExhaustedRetryAdvice,
  NotDueRetryAdvice,
  ScheduledRetryAdvice,
} from './retry.js'
type JsonPrimitive = boolean | number | string | null
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

type NormalizationField =
  | 'canonicalIdentity'
  | 'companyName'
  | 'roleTitle'
  | 'employmentType'
  | 'seniority'
  | 'workMode'
  | 'location'
  | 'destinationUrl'
  | 'sourceUrl'
  | 'providerJobId'
  | 'postedAt'
  | 'compensation'

interface ResolutionEvidence {
  kind: string
  value: JsonValue
  path?: string
  sourceUrl?: string
}

interface FieldResolutionOutcomeBase {
  resolverId: string
  resolverVersion: string
  field: NormalizationField
  inputHash: string
  evidence?: ResolutionEvidence[]
}

export type FieldResolutionOutcome =
  | (FieldResolutionOutcomeBase & {
      status: 'resolved'
      value: JsonValue
      confidence: number
      authoritative?: boolean
    })
  | (FieldResolutionOutcomeBase & {
      status: 'not_applicable' | 'abstained' | 'blocked' | 'rejected' | 'failed'
      reason: string
    })
  | (FieldResolutionOutcomeBase & {
      status: 'retry'
      retry: ScheduledRetryAdvice | NotDueRetryAdvice
    })
  | (FieldResolutionOutcomeBase & {
      status: 'exhausted'
      retry: ExhaustedRetryAdvice
    })
  | (FieldResolutionOutcomeBase & {
      status: 'cancelled'
      retry: CancelledRetryAdvice
    })
  | (FieldResolutionOutcomeBase & {
      status: 'conflict'
      reason: string
      values: JsonValue[]
    })
  | (FieldResolutionOutcomeBase & {
      status: 'suppressed'
      reason: string
      policyVersion: string
    })
  | (FieldResolutionOutcomeBase & {
      status: 'locked'
      value: JsonValue
      reason: string
      policyVersion: string
    })
