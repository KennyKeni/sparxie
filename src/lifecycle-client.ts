import type {
  Capture, CaptureHistoryResult, CaptureListInput, CaptureListResult, CaptureMutationResult,
  CorrectCaptureInput, CreateCaptureInput,
} from './capture.js'
import type {
  Application, ApplicationAttemptsListResult, ApplicationEventsListResult,
  ApplicationMutationResult, ApplicationTechnicalListInput, CreateApplicationInput,
  CreatePursuitLinkInput, LifecycleApplicationHistoryResult,
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
  AddJobExternalIdentityInput, CorrectJobFactsInput, CreateJobInput, Job, JobHistoryInput,
  JobHistoryResult, JobId, JobListInput, JobListResult, JobMutationResult,
  RemoveJobExternalIdentityInput, RemoveJobInput, RestoreJobInput,
  UpdateJobAvailabilityInput,
} from './job.js'
import type {
  HistoryListInput, RemovalInput, RemovalResult, RestoreInput, RestoreResult,
} from './lifecycle-shared.js'
import type {
  CreateOpportunityInput, Opportunity, OpportunityHistoryResult, OpportunityListInput, OpportunityListResult,
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
    get(jobId: JobId): Promise<Job | null>
    create(input: CreateJobInput): Promise<JobMutationResult>
    correctFacts(input: CorrectJobFactsInput): Promise<JobMutationResult>
    updateAvailability(input: UpdateJobAvailabilityInput): Promise<JobMutationResult>
    externalIdentities: {
      add(input: AddJobExternalIdentityInput): Promise<JobMutationResult>
      remove(input: RemoveJobExternalIdentityInput): Promise<JobMutationResult>
    }
    remove(input: RemoveJobInput): Promise<RemovalResult>
    restore(input: RestoreJobInput): Promise<RestoreResult>
    history(input: JobHistoryInput): Promise<JobHistoryResult>
    promoteToOpportunity(input: PromoteJobToOpportunityInput): Promise<PromoteJobToOpportunityResult>
  }
  opportunities: {
    list(input?: OpportunityListInput): Promise<OpportunityListResult>
    get(opportunityId: string): Promise<Opportunity | null>
    create(input: CreateOpportunityInput): Promise<OpportunityMutationResult>
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
    create(input: CreateApplicationInput): Promise<ApplicationMutationResult>
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
    attempts: {
      list(input: ApplicationTechnicalListInput): Promise<ApplicationAttemptsListResult>
    }
    events: {
      list(input: ApplicationTechnicalListInput): Promise<ApplicationEventsListResult>
    }
  }
}
