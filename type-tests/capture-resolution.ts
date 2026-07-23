import type {
  CapturePrimaryIntent,
  CaptureProcessingStartResult,
  CaptureResolutionCommandResult,
  CaptureResolutionCursor,
  CaptureResolutionProjection,
  CaptureResolutionWorkspaceClient,
  CompleteCaptureManuallyResult,
  CompleteCaptureBlockedFailure,
  CompletionStaleGuard,
  CompletionStaleRecovery,
  CorrectCaptureResolutionResult,
  DestinationResolutionStatus,
  JobInformationResolutionStatus,
  ManualCompanyResolution,
  ManualJobDuplicateResolutionDecision,
  ProcessingActionCode,
  ProcessingIssue,
  ProcessingReasonCode,
  ProcessingStage,
  ProcessingSummary,
  PromotionStatus,
  ValedictorianWorkspaceClient,
} from '../src/index.js'

type Assert<T extends true> = T
type IsExactly<A, B> = (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false
type PublicSdk = typeof import('../src/index.js')
type ContractVersionIsOne = Assert<IsExactly<
  PublicSdk['captureResolutionContractVersion'],
  1
>>

type FiltersAreClosed = Assert<IsExactly<
  PublicSdk['captureResolutionFilters'][number],
  'all' | 'needs_attention' | 'removed'
>>
type SortsAreClosed = Assert<IsExactly<
  PublicSdk['captureResolutionSorts'][number],
  'observed_desc'
>>
type GenerationStatusesAreClosed = Assert<IsExactly<
  PublicSdk['captureResolutionGenerationStatuses'][number],
  'active' | 'promoted' | 'superseded' | 'cancelled'
>>
type GenerationTriggersAreClosed = Assert<IsExactly<
  PublicSdk['captureResolutionGenerationTriggers'][number],
  'intake' | 'correction' | 'restore' | 'retry_destination' | 'replay' |
  'manual_completion' | 'legacy_promotion'
>>
type ListDestinationStatesAreClosed = Assert<IsExactly<
  PublicSdk['captureListDestinationStates'][number],
  'not_required' | 'resolving' | 'resolved' | 'unavailable' | 'blocked'
>>
type ListReadinessStatesAreClosed = Assert<IsExactly<
  PublicSdk['captureReadinessStates'][number],
  'materialization_pending' | 'materialization_blocked' | 'ready' | 'removed'
>>

type StagesAreClosed = Assert<IsExactly<
  ProcessingStage,
  'destination' | 'information' | 'promotion'
>>
type ReasonsAreClosed = Assert<IsExactly<
  ProcessingReasonCode,
  'capture_removed' | 'superseded_by_revision' | 'operation_cancelled' |
  'dependency_unavailable' | 'rate_limited' | 'request_timed_out' |
  'transport_failed' | 'attempt_budget_exhausted' |
  'provider_authentication_required' | 'provider_identity_invalid' |
  'destination_not_found' | 'destination_unsupported' |
  'destination_security_rejected' | 'insufficient_job_information' |
  'company_resolution_required' | 'duplicate_job_conflict' |
  'company_assignment_conflict' | 'promotion_validation_failed' |
  'job_identity_conflict' | 'integrity_constraint_violated'
>>
type ActionsAreClosed = Assert<IsExactly<
  ProcessingActionCode,
  'authenticate_provider' | 'correct_capture' | 'complete_job_information' |
  'resolve_company' | 'resolve_company_assignment' | 'resolve_duplicate_job' |
  'retry_now'
>>
type SummariesAreClosed = Assert<IsExactly<
  ProcessingSummary,
  'promoted' | 'blocked' | 'needs_action' | 'retrying' | 'processing' |
  'awaiting_destination' | 'awaiting_information' | 'stopped'
>>
type DestinationStatusesAreClosed = Assert<IsExactly<
  DestinationResolutionStatus,
  'not_required' | 'queued' | 'running' | 'retry_wait' | 'resolved' |
  'action_required' | 'exhausted' | 'blocked' | 'superseded' | 'cancelled'
>>
type InformationStatusesAreClosed = Assert<IsExactly<
  JobInformationResolutionStatus,
  'awaiting_manual' | 'resolved' | 'superseded' | 'cancelled'
>>
type PromotionStatusesAreClosed = Assert<IsExactly<
  PromotionStatus,
  'not_ready' | 'blocked' | 'promoted' | 'superseded' | 'cancelled'
>>
type ReadinessIsClosed = Assert<IsExactly<
  CaptureResolutionProjection['readiness'],
  'materialization_pending' | 'materialization_blocked' | 'removed' | 'ready'
>>
type PrimaryIntentIsClosed = Assert<IsExactly<
  CapturePrimaryIntent['kind'],
  'complete_job_information' | 'authenticate_provider' | 'correct_capture' |
  'retry_now' | 'resolve_company' | 'resolve_company_assignment' |
  'resolve_duplicate_job' | 'view_job'
>>
type CompanyResolutionIsClosed = Assert<IsExactly<
  ManualCompanyResolution['action'],
  'use_local' | 'create_local'
>>
type DuplicateResolutionIsClosed = Assert<IsExactly<
  ManualJobDuplicateResolutionDecision['action'],
  'attach' | 'merge'
>>
type CommandResultsAreClosed = Assert<IsExactly<
  CaptureResolutionCommandResult['status'],
  'started' | 'corrected' | 'blocked'
>>
type ProcessingStartResultsAreClosed = Assert<IsExactly<
  CaptureProcessingStartResult['status'],
  'started' | 'blocked'
>>
type CorrectionResultsAreClosed = Assert<IsExactly<
  CorrectCaptureResolutionResult['status'],
  'corrected' | 'blocked'
>>
type CompletionResultsAreClosed = Assert<IsExactly<
  CompleteCaptureManuallyResult['status'],
  'created' | 'duplicate_blocked' | 'company_assignment_blocked' | 'blocked'
>>
type BlockedFailureKindsAreClosed = Assert<IsExactly<
  CompleteCaptureBlockedFailure['kind'],
  'stale_guard' | 'lifecycle_failure'
>>
type StaleGuardKindsAreClosed = Assert<IsExactly<
  CompletionStaleGuard['kind'],
  'capture_revision' | 'generation' | 'company_revision' | 'assignment_revision'
>>
type StaleRecoveryActionIsClosed = Assert<IsExactly<
  CompletionStaleRecovery['action'],
  'refresh_and_resubmit'
>>
type CreatedComparisonIsClosed = Assert<IsExactly<
  Extract<CompleteCaptureManuallyResult, { status: 'created' }>['existingJobComparison'],
  'equivalent' | 'different' | 'not_compared'
>>
type DuplicateBlockersAreClosed = Assert<IsExactly<
  Extract<CompleteCaptureManuallyResult, { status: 'duplicate_blocked' }>['blockerCode'],
  'deterministic_duplicate' | 'strong_identity_conflict'
>>
type DuplicateDecisionsAreClosed = Assert<IsExactly<
  Extract<CompleteCaptureManuallyResult, { status: 'duplicate_blocked' }>['allowedDecisions'][number],
  'attach' | 'merge'
>>
type AssignmentRecoveryIsClosed = Assert<IsExactly<
  Extract<CompleteCaptureManuallyResult, { status: 'company_assignment_blocked' }>['allowedRecovery'][number],
  'use_existing_company' | 'reassign_company'
>>
type ClientMethodsAreComplete = Assert<IsExactly<
  keyof CaptureResolutionWorkspaceClient,
  'list' | 'get' | 'retry' | 'replay' | 'correct' | 'complete'
>>
type WorkspacePublishesClient = Assert<IsExactly<
  ValedictorianWorkspaceClient['captureResolution'],
  CaptureResolutionWorkspaceClient
>>

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`)
}

function handleIssue(issue: ProcessingIssue): string {
  switch (issue.code) {
    case 'capture_removed':
    case 'superseded_by_revision':
    case 'operation_cancelled':
    case 'dependency_unavailable':
    case 'rate_limited':
    case 'request_timed_out':
    case 'transport_failed':
    case 'attempt_budget_exhausted':
    case 'provider_authentication_required':
    case 'provider_identity_invalid':
    case 'destination_not_found':
    case 'destination_unsupported':
    case 'destination_security_rejected':
    case 'insufficient_job_information':
    case 'company_resolution_required':
    case 'duplicate_job_conflict':
    case 'company_assignment_conflict':
    case 'promotion_validation_failed':
    case 'job_identity_conflict':
    case 'integrity_constraint_violated':
      return issue.message
    default:
      return assertNever(issue)
  }
}

function handleProjection(projection: CaptureResolutionProjection): string {
  switch (projection.readiness) {
    case 'materialization_pending': return projection.captureId
    case 'materialization_blocked': return projection.issue.message
    case 'removed': return projection.captureId
    case 'ready': return projection.generation.id
    default: return assertNever(projection)
  }
}

function handleIntent(intent: CapturePrimaryIntent): string {
  switch (intent.kind) {
    case 'complete_job_information':
    case 'correct_capture':
    case 'retry_now':
    case 'resolve_company':
      return intent.kind
    case 'authenticate_provider':
      return intent.connectorInstanceId
    case 'resolve_company_assignment':
      return intent.currentCompanyId
    case 'resolve_duplicate_job':
      return intent.conflictingJobIds[0] ?? intent.kind
    case 'view_job':
      return intent.jobId
    default:
      return assertNever(intent)
  }
}

function handleCompany(resolution: ManualCompanyResolution): string {
  switch (resolution.action) {
    case 'use_local': return resolution.companyId
    case 'create_local': return resolution.displayName
    default: return assertNever(resolution)
  }
}

function handleDuplicate(resolution: ManualJobDuplicateResolutionDecision): string {
  switch (resolution.action) {
    case 'attach': return resolution.targetJobId
    case 'merge': return resolution.targetJobId
    default: return assertNever(resolution)
  }
}

function handleCommand(result: CaptureResolutionCommandResult): string {
  switch (result.status) {
    case 'started': return result.generationId
    case 'corrected': return result.generationId
    case 'blocked': return result.blocker.message
    default: return assertNever(result)
  }
}

function handleStaleGuard(guard: CompletionStaleGuard): string {
  switch (guard.kind) {
    case 'capture_revision': return String(guard.currentRevision)
    case 'generation': return guard.currentGenerationId ?? 'none'
    case 'company_revision': return guard.companyId
    case 'assignment_revision': return guard.jobId
    default: return assertNever(guard)
  }
}

function handleCompletion(result: CompleteCaptureManuallyResult): string {
  switch (result.status) {
    case 'created': return result.jobId
    case 'duplicate_blocked': return result.conflictingJobs[0]?.jobId ?? result.status
    case 'company_assignment_blocked': return result.currentCompanyId
    case 'blocked': return result.failure.blocker.message
    default: return assertNever(result)
  }
}

function handleBlockedFailure(failure: CompleteCaptureBlockedFailure): string {
  switch (failure.kind) {
    case 'stale_guard': return failure.recovery.action
    case 'lifecycle_failure': return failure.blocker.message
    default: return assertNever(failure)
  }
}

declare const client: CaptureResolutionWorkspaceClient
declare const cursor: CaptureResolutionCursor
client.list({ filter: 'removed', before: cursor })
// @ts-expect-error Paging directions are mutually exclusive.
client.list({ before: cursor, after: cursor })
// @ts-expect-error Only the stable observed sort is public.
client.list({ sort: 'updated_desc' })

void handleIssue
void handleProjection
void handleIntent
void handleCompany
void handleDuplicate
void handleCommand
void handleCompletion
void handleBlockedFailure
void handleStaleGuard
void (null as unknown as ContractVersionIsOne)
void (null as unknown as FiltersAreClosed)
void (null as unknown as SortsAreClosed)
void (null as unknown as GenerationStatusesAreClosed)
void (null as unknown as GenerationTriggersAreClosed)
void (null as unknown as ListDestinationStatesAreClosed)
void (null as unknown as ListReadinessStatesAreClosed)
void (null as unknown as StagesAreClosed)
void (null as unknown as ReasonsAreClosed)
void (null as unknown as ActionsAreClosed)
void (null as unknown as SummariesAreClosed)
void (null as unknown as DestinationStatusesAreClosed)
void (null as unknown as InformationStatusesAreClosed)
void (null as unknown as PromotionStatusesAreClosed)
void (null as unknown as ReadinessIsClosed)
void (null as unknown as PrimaryIntentIsClosed)
void (null as unknown as CompanyResolutionIsClosed)
void (null as unknown as DuplicateResolutionIsClosed)
void (null as unknown as CommandResultsAreClosed)
void (null as unknown as ProcessingStartResultsAreClosed)
void (null as unknown as CorrectionResultsAreClosed)
void (null as unknown as CompletionResultsAreClosed)
void (null as unknown as BlockedFailureKindsAreClosed)
void (null as unknown as StaleGuardKindsAreClosed)
void (null as unknown as StaleRecoveryActionIsClosed)
void (null as unknown as CreatedComparisonIsClosed)
void (null as unknown as DuplicateBlockersAreClosed)
void (null as unknown as DuplicateDecisionsAreClosed)
void (null as unknown as AssignmentRecoveryIsClosed)
void (null as unknown as ClientMethodsAreComplete)
void (null as unknown as WorkspacePublishesClient)
