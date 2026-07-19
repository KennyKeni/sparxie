import { z } from 'zod'
import {
  sourceExecutionScopeIdSchema,
  type SourceExecutionScopeId,
} from './source-execution.js'

export const CONNECTOR_RUN_LIFECYCLE_COUNTS_VERSION =
  'connector-run-lifecycle-counts/v1' as const

export const connectorRunLifecycleSources = [
  'live_current',
  'frozen_terminal',
] as const

export const connectorRunProviderGapCodes = [
  'missing_provider_returned',
  'missing_provider_valid',
  'missing_provider_invalid',
  'missing_source_duplicates',
  'invalid_provider_returned',
  'invalid_provider_valid',
  'invalid_provider_invalid',
  'invalid_source_duplicates',
  'provider_equation_mismatch',
  'source_duplicates_exceed_valid',
] as const

export type ConnectorRunLifecycleSource =
  (typeof connectorRunLifecycleSources)[number]
export type ConnectorRunProviderGapCode =
  (typeof connectorRunProviderGapCodes)[number]

export interface ConnectorRunLifecycleCounts {
  version: typeof CONNECTOR_RUN_LIFECYCLE_COUNTS_VERSION
  source: ConnectorRunLifecycleSource
  scope: {
    kind: 'connector_run'
    connectorRunId: string
    executionScopeId: SourceExecutionScopeId
  }
  provider: {
    returnedRows: number
    validRecords: number
    invalidRecords: number
    sourceDuplicates: number
    capturedRecords: number
    occurrenceCount: number
    captureShortfall: number
    unclassifiedRows: number
    invariant:
      | 'reconciled'
      | 'reported_stats_missing'
      | 'reported_stats_invalid'
      | 'reported_totals_inconsistent'
    gaps: ConnectorRunProviderGapCode[]
  }
  destination: {
    normalized: number
    resolvedEmployerOrAts: number
    resolvedThirdParty: number
    unresolved: number
    pending: number
    gateRejected: number
    unclassified: number
    invariant: 'reconciled' | 'lineage_incomplete'
  }
  opportunity: {
    opportunitiesCreated: number
    existingJobMatches: number
    notFit: number
    rejected: number
    actionableReview: number
    unclassified: number
    invariant: 'reconciled' | 'lineage_incomplete'
  }
}

const countSchema = z.number().int().nonnegative()

export const connectorRunLifecycleCountsSchema: z.ZodType<ConnectorRunLifecycleCounts> =
  z.object({
    version: z.literal(CONNECTOR_RUN_LIFECYCLE_COUNTS_VERSION),
    source: z.enum(connectorRunLifecycleSources),
    scope: z.object({
      kind: z.literal('connector_run'),
      connectorRunId: z.string().min(1),
      executionScopeId: sourceExecutionScopeIdSchema,
    }).strict(),
    provider: z.object({
      returnedRows: countSchema,
      validRecords: countSchema,
      invalidRecords: countSchema,
      sourceDuplicates: countSchema,
      capturedRecords: countSchema,
      occurrenceCount: countSchema,
      captureShortfall: countSchema,
      unclassifiedRows: countSchema,
      invariant: z.enum([
        'reconciled',
        'reported_stats_missing',
        'reported_stats_invalid',
        'reported_totals_inconsistent',
      ]),
      gaps: z.array(z.enum(connectorRunProviderGapCodes))
        .max(connectorRunProviderGapCodes.length),
    }).strict(),
    destination: z.object({
      normalized: countSchema,
      resolvedEmployerOrAts: countSchema,
      resolvedThirdParty: countSchema,
      unresolved: countSchema,
      pending: countSchema,
      gateRejected: countSchema,
      unclassified: countSchema,
      invariant: z.enum(['reconciled', 'lineage_incomplete']),
    }).strict(),
    opportunity: z.object({
      opportunitiesCreated: countSchema,
      existingJobMatches: countSchema,
      notFit: countSchema,
      rejected: countSchema,
      actionableReview: countSchema,
      unclassified: countSchema,
      invariant: z.enum(['reconciled', 'lineage_incomplete']),
    }).strict(),
  }).strict().superRefine((counts, context) => {
    const providerClassified = counts.provider.validRecords
      + counts.provider.invalidRecords
      + counts.provider.sourceDuplicates
    const expectedCaptureShortfall = Math.max(
      0,
      counts.provider.returnedRows - counts.provider.occurrenceCount,
    )
    if (counts.provider.captureShortfall !== expectedCaptureShortfall) {
      context.addIssue({
        code: 'custom',
        message: 'capture shortfall must reconcile returned rows and occurrences',
        path: ['provider', 'captureShortfall'],
      })
    }
    if (counts.provider.capturedRecords > counts.provider.occurrenceCount) {
      context.addIssue({
        code: 'custom',
        message: 'captured records cannot exceed occurrences',
        path: ['provider', 'capturedRecords'],
      })
    }
    if (new Set(counts.provider.gaps).size !== counts.provider.gaps.length) {
      context.addIssue({
        code: 'custom',
        message: 'provider gap codes must be unique',
        path: ['provider', 'gaps'],
      })
    }
    const expectedUnclassifiedRows = Math.max(
      0,
      counts.provider.returnedRows - providerClassified,
    )
    if (counts.provider.unclassifiedRows !== expectedUnclassifiedRows) {
      context.addIssue({
        code: 'custom',
        message: 'unclassified rows must reconcile returned and classified rows',
        path: ['provider', 'unclassifiedRows'],
      })
    }
    if (counts.provider.invariant === 'reconciled') {
      if (counts.provider.gaps.length !== 0) {
        context.addIssue({
          code: 'custom',
          message: 'reconciled provider counts cannot report gaps',
          path: ['provider', 'gaps'],
        })
      }
      if (providerClassified !== counts.provider.returnedRows) {
        context.addIssue({
          code: 'custom',
          message: 'reconciled provider counts must classify every returned row',
          path: ['provider', 'returnedRows'],
        })
      }
    } else if (counts.provider.gaps.length === 0) {
      context.addIssue({
        code: 'custom',
        message: 'unreconciled provider counts require a bounded gap code',
        path: ['provider', 'gaps'],
      })
    } else {
      const hasMissingGap = counts.provider.gaps.some((gap) => gap.startsWith('missing_'))
      const hasInvalidGap = counts.provider.gaps.some((gap) => gap.startsWith('invalid_'))
      const invariantMatchesGaps =
        (counts.provider.invariant === 'reported_stats_missing' && hasMissingGap)
        || (counts.provider.invariant === 'reported_stats_invalid'
          && !hasMissingGap && hasInvalidGap)
        || (counts.provider.invariant === 'reported_totals_inconsistent'
          && !hasMissingGap && !hasInvalidGap)
      if (!invariantMatchesGaps) {
        context.addIssue({
          code: 'custom',
          message: 'provider invariant must match its bounded gap codes',
          path: ['provider', 'invariant'],
        })
      }
    }

    const destination = counts.destination
    if (
      destination.normalized
      !== destination.resolvedEmployerOrAts + destination.resolvedThirdParty
    ) {
      context.addIssue({
        code: 'custom',
        message: 'normalized destinations must equal resolved destination classes',
        path: ['destination', 'normalized'],
      })
    }
    const destinationClassified = destination.normalized
      + destination.unresolved
      + destination.pending
      + destination.gateRejected
      + destination.unclassified
    const destinationReconciled =
      destinationClassified === counts.provider.capturedRecords
    if (destinationClassified > counts.provider.capturedRecords) {
      context.addIssue({
        code: 'custom',
        message: 'destination outcomes cannot exceed captured records',
        path: ['destination', 'invariant'],
      })
    }
    if ((destination.invariant === 'reconciled') !== destinationReconciled) {
      context.addIssue({
        code: 'custom',
        message: 'destination invariant must reflect whether lineage reconciles',
        path: ['destination', 'invariant'],
      })
    }

    const opportunity = counts.opportunity
    const opportunityClassified = opportunity.opportunitiesCreated
      + opportunity.existingJobMatches
      + opportunity.notFit
      + opportunity.rejected
      + opportunity.actionableReview
      + opportunity.unclassified
    const opportunityReconciled = opportunityClassified === destination.normalized
    if (opportunityClassified > destination.normalized) {
      context.addIssue({
        code: 'custom',
        message: 'opportunity outcomes cannot exceed normalized jobs',
        path: ['opportunity', 'invariant'],
      })
    }
    if ((opportunity.invariant === 'reconciled') !== opportunityReconciled) {
      context.addIssue({
        code: 'custom',
        message: 'opportunity invariant must reflect whether lineage reconciles',
        path: ['opportunity', 'invariant'],
      })
    }
  })
