import type {
  ApplicationDetail,
  ApplicationAttempt,
  ApplicationAttemptsListInput,
  ApplicationAttemptsListResult,
  ApplicationAttemptStep,
  ApplicationEventsListInput,
  ApplicationEventsListResult,
  ApplicationLinkRecord,
  ApplicationLinksListInput,
  ApplicationLinksListResult,
  ApplicationListQuery,
  ApplicationListResult,
  AppendApplicationNoteInput,
  ArchiveApplicationInput,
  CompleteApplicationAttemptInput,
  CreateApplicationAttemptStepInput,
  CreateApplicationInput,
  CreateApplicationLinkInput,
  StartApplicationAttemptInput,
  StatusUpdateInput,
  UpdateApplicationInput,
  UpdateApplicationLinkInput,
  UpdateApplicationWorkflowInput,
} from './application.js'
import type { QueueListQuery, QueueListResult } from './queue.js'
import type {
  EvaluateApplicationPolicyInput,
  EvaluateRunWindowPolicyInput,
  EvaluateSourcingCandidatePolicyInput,
  PolicyConfig,
  PolicyConfigPatch,
  PolicyDecision,
  PolicyEvidenceInput,
  PolicyEvidenceListInput,
  PolicyEvidenceRecord,
  PolicyRunWindowDecision,
} from './policy.js'
import type { ScoreInput } from './scoring.js'
import type {
  CreateSourcingFindingInput,
  ProcessSourcingCandidateInput,
  PromoteSourcingFindingInput,
  SetSourcingFindingDecisionInput,
  SourcingFinding,
  SourcingFindingsListInput,
  SourcingFindingsListResult,
  UpdateSourcingFindingInput,
} from './sourcing.js'
import type {
  CompleteWorkflowRunInput,
  CreateWorkflowRunStepInput,
  StartWorkflowRunInput,
  WorkflowRun,
  WorkflowRunsListInput,
  WorkflowRunsListResult,
  WorkflowRunStep,
} from './workflow-run.js'
import type { ProfileAgentContext, ProfileUpdateInput, UserProfile } from './profile.js'

export interface JobAppClient {
  applications: {
    list(query?: ApplicationListQuery): Promise<ApplicationListResult>
    get(id: string): Promise<ApplicationDetail | null>
    create(input: CreateApplicationInput): Promise<ApplicationDetail>
    update(input: UpdateApplicationInput): Promise<ApplicationDetail>
    updateStatus(input: StatusUpdateInput): Promise<ApplicationDetail>
    archive(input: ArchiveApplicationInput): Promise<void>
    workflow: {
      update(input: UpdateApplicationWorkflowInput): Promise<ApplicationDetail>
    }
    notes: {
      append(input: AppendApplicationNoteInput): Promise<ApplicationDetail>
    }
    links: {
      list(input: ApplicationLinksListInput): Promise<ApplicationLinksListResult>
      create(input: CreateApplicationLinkInput): Promise<ApplicationLinkRecord>
      update(input: UpdateApplicationLinkInput): Promise<ApplicationLinkRecord>
    }
    events: {
      list(input: ApplicationEventsListInput): Promise<ApplicationEventsListResult>
    }
    attempts: {
      list(input: ApplicationAttemptsListInput): Promise<ApplicationAttemptsListResult>
      start(input: StartApplicationAttemptInput): Promise<ApplicationAttempt>
      step(input: CreateApplicationAttemptStepInput): Promise<ApplicationAttemptStep>
      complete(input: CompleteApplicationAttemptInput): Promise<ApplicationAttempt>
    }
  }
  scores: {
    record(input: ScoreInput): Promise<void>
  }
  queue: {
    list(query?: QueueListQuery): Promise<QueueListResult>
  }
  policy: {
    config: {
      get(): Promise<PolicyConfig>
      reset(): Promise<PolicyConfig>
      update(patch: PolicyConfigPatch): Promise<PolicyConfig>
    }
    evidence: {
      list(query?: PolicyEvidenceListInput): Promise<PolicyEvidenceRecord[]>
      record(input: PolicyEvidenceInput): Promise<PolicyEvidenceRecord>
    }
    evaluate: {
      application(input: EvaluateApplicationPolicyInput): Promise<PolicyDecision>
      sourcingCandidate(input: EvaluateSourcingCandidatePolicyInput): Promise<PolicyDecision>
      runWindow(input: EvaluateRunWindowPolicyInput): Promise<PolicyRunWindowDecision>
    }
  }
  profile: {
    get(): Promise<UserProfile>
    update(input: ProfileUpdateInput): Promise<UserProfile>
    agentContext: {
      get(): Promise<ProfileAgentContext>
    }
  }
  runs: {
    list(query?: WorkflowRunsListInput): Promise<WorkflowRunsListResult>
    start(input: StartWorkflowRunInput): Promise<WorkflowRun>
    step(input: CreateWorkflowRunStepInput): Promise<WorkflowRunStep>
    complete(input: CompleteWorkflowRunInput): Promise<WorkflowRun>
  }
  sourcing: {
    candidates: {
      process(input: ProcessSourcingCandidateInput): Promise<SourcingFinding>
    }
    findings: {
      list(query?: SourcingFindingsListInput): Promise<SourcingFindingsListResult>
      create(input: CreateSourcingFindingInput): Promise<SourcingFinding>
      update(input: UpdateSourcingFindingInput): Promise<SourcingFinding>
      decide(input: SetSourcingFindingDecisionInput): Promise<SourcingFinding>
      promote(input: PromoteSourcingFindingInput): Promise<SourcingFinding>
    }
  }
}
