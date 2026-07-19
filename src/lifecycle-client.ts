import type {
  Capture, CaptureHistoryResult, CaptureListInput, CaptureListResult, CaptureMutationResult,
  CorrectCaptureInput, CreateCaptureInput,
} from './capture.js'
import type {
  Application, ApplicationMutationResult, CreatePursuitLinkInput, LifecycleApplicationHistoryResult,
  LifecycleApplicationListInput, LifecycleApplicationListResult, RefreshApplicationSnapshotInput,
  RemovePursuitLinkInput, UpdateApplicationCompanyInput, UpdateApplicationSourceInput,
  UpdatePursuitApplicationStatusInput, UpdatePursuitLinkInput,
} from './lifecycle-application.js'
import type {
  PromoteCaptureToJobInput, PromoteCaptureToJobResult, PromoteJobToOpportunityInput,
  PromoteJobToOpportunityResult, PromoteOpportunityToApplicationInput,
  PromoteOpportunityToApplicationResult,
} from './lifecycle-promotions.js'
import type {
  AddJobExternalIdentityInput, CorrectJobFactsInput, Job, JobHistoryResult, JobListInput,
  JobListResult, JobMutationResult, RemoveJobExternalIdentityInput, UpdateJobAvailabilityInput,
} from './job.js'
import type {
  HistoryListInput, RemovalInput, RemovalResult, RestoreInput, RestoreResult,
} from './lifecycle-shared.js'
import type {
  Opportunity, OpportunityHistoryResult, OpportunityListInput, OpportunityListResult,
  OpportunityMutationResult, UpdateOpportunityDispositionInput, UpdateOpportunityEvaluationInput,
} from './opportunity.js'

export interface LifecycleWorkspaceClient {
  captures: {
    list(input?: CaptureListInput): Promise<CaptureListResult>
    get(captureId: string): Promise<Capture | null>
    create(input: CreateCaptureInput): Promise<CaptureMutationResult>
    correct(input: CorrectCaptureInput): Promise<CaptureMutationResult>
    remove(input: RemovalInput): Promise<RemovalResult>
    restore(input: RestoreInput): Promise<RestoreResult>
    history(input: HistoryListInput): Promise<CaptureHistoryResult>
    promoteToJob(input: PromoteCaptureToJobInput): Promise<PromoteCaptureToJobResult>
  }
  jobs: {
    list(input?: JobListInput): Promise<JobListResult>
    get(jobId: string): Promise<Job | null>
    correctFacts(input: CorrectJobFactsInput): Promise<JobMutationResult>
    updateAvailability(input: UpdateJobAvailabilityInput): Promise<JobMutationResult>
    externalIdentities: {
      add(input: AddJobExternalIdentityInput): Promise<JobMutationResult>
      remove(input: RemoveJobExternalIdentityInput): Promise<JobMutationResult>
    }
    remove(input: RemovalInput): Promise<RemovalResult>
    restore(input: RestoreInput): Promise<RestoreResult>
    history(input: HistoryListInput): Promise<JobHistoryResult>
    promoteToOpportunity(input: PromoteJobToOpportunityInput): Promise<PromoteJobToOpportunityResult>
  }
  opportunities: {
    list(input?: OpportunityListInput): Promise<OpportunityListResult>
    get(opportunityId: string): Promise<Opportunity | null>
    updateEvaluation(input: UpdateOpportunityEvaluationInput): Promise<OpportunityMutationResult>
    updateDisposition(input: UpdateOpportunityDispositionInput): Promise<OpportunityMutationResult>
    remove(input: RemovalInput): Promise<RemovalResult>
    restore(input: RestoreInput): Promise<RestoreResult>
    history(input: HistoryListInput): Promise<OpportunityHistoryResult>
    promoteToApplication(input: PromoteOpportunityToApplicationInput): Promise<PromoteOpportunityToApplicationResult>
  }
  applications: {
    list(input?: LifecycleApplicationListInput): Promise<LifecycleApplicationListResult>
    get(applicationId: string): Promise<Application | null>
    updateStatus(input: UpdatePursuitApplicationStatusInput): Promise<ApplicationMutationResult>
    updateCompany(input: UpdateApplicationCompanyInput): Promise<ApplicationMutationResult>
    updateSource(input: UpdateApplicationSourceInput): Promise<ApplicationMutationResult>
    links: {
      create(input: CreatePursuitLinkInput): Promise<ApplicationMutationResult>
      update(input: UpdatePursuitLinkInput): Promise<ApplicationMutationResult>
      remove(input: RemovePursuitLinkInput): Promise<ApplicationMutationResult>
    }
    refreshSnapshot(input: RefreshApplicationSnapshotInput): Promise<ApplicationMutationResult>
    remove(input: RemovalInput): Promise<RemovalResult>
    restore(input: RestoreInput): Promise<RestoreResult>
    history(input: HistoryListInput): Promise<LifecycleApplicationHistoryResult>
  }
}
