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
import type { ActionQueueListQuery, ActionQueueListResult } from './action-queue.js'
import type {
  ConnectorCheckpointsListInput,
  ConnectorCheckpointsListResult,
  ConnectorInstanceSummary,
  ConnectorInstancesListResult,
  ConnectorObservationsListInput,
  ConnectorObservationsListResult,
  ConnectorRunsListInput,
  ConnectorRunsListResult,
  ConnectorRunSummary,
  ConnectorStatusSummary,
  CreateConnectorInstanceInput,
  TriggerConnectorRunInput,
  UpdateConnectorInstanceInput,
} from './connector.js'
import type {
  ConnectorRetirementResult,
  RemoveConnectorInstanceInput,
} from './connector-retirement.js'
import type {
  ConnectorOverviewListQuery,
  ConnectorOverviewListResult,
} from './connector-overview.js'
import type {
  ConnectorScheduleAuditListResult,
  ConnectorScheduleHistoryListInput,
  ConnectorScheduleOccurrenceListResult,
  ConnectorScheduleSummary,
  DeleteConnectorScheduleInput,
  DispatchConnectorScheduleDueInput,
  DispatchConnectorScheduleDueResult,
  PauseConnectorScheduleInput,
  ResumeConnectorScheduleInput,
  UpsertConnectorScheduleInput,
} from './connector-schedule.js'
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
import type { ScoreInput, ScoreRecord } from './scoring.js'
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
  BatchRawSourceRecordsInput,
  BatchRawSourceRecordsResult,
  RawSourceNormalizationResult,
  RawSourceRecord,
  RawSourceReplayReceipt,
  ReplayRawSourceRecordsInput,
} from './raw-sourcing.js'
import type {
  RawSourceRecordsListQuery,
  RawSourceRecordsListResult,
} from './raw-sourcing-list.js'
import type { RawSourceProjectionResult } from './sourcing-projection.js'
import type {
  CompleteWorkflowRunInput,
  CreateWorkflowRunStepInput,
  StartWorkflowRunInput,
  WorkflowRun,
  WorkflowRunsListInput,
  WorkflowRunsListResult,
  WorkflowRunStep,
} from './workflow-run.js'
import type {
  WorkspaceCreateInput,
  WorkspaceListItem,
  WorkspaceListResult,
  WorkspaceOpenInput,
} from './workspace.js'
import type { ValedictorianCapabilities } from './capabilities.js'
import type {
  InstalledConnectorDescriptor,
  InstalledConnectorDescriptorsListResult,
} from './connector-capabilities.js'
import type {
  ConnectorOptionQueryBody,
  ConnectorOptionQueryResult,
} from './connector-option-query.js'
import type {
  ProfileAgentContext,
  ProfileSecretSummary,
  ProfileSecretsListResult,
  ProfileSensitiveDetails,
  ProfileSensitiveDetailsInput,
  ProfileUpdateInput,
  UpsertProfileSecretInput,
  UserProfile,
} from './profile.js'
import type {
  ProfileDocument,
  ProfileDocumentFormatInput,
  ProfileDocumentRestoreInput,
  ProfileDocumentUpdateInput,
  ProfileDocumentValidateResult,
} from './profile-document.js'
import type {
  LocalSecretResolutionInput,
  LocalSecretResolutionResult,
} from './secret-use.js'
import type { ValedictorianHealth } from './health.js'

export type { ValedictorianHealth } from './health.js'

export interface ValedictorianClient {
  capabilities: {
    get(): Promise<ValedictorianCapabilities>
  }
  forWorkspace(workspaceId: string): ValedictorianWorkspaceClient
  health: {
    get(): Promise<ValedictorianHealth>
  }
  workspaces: {
    create(input: WorkspaceCreateInput): Promise<WorkspaceListItem>
    list(): Promise<WorkspaceListResult>
    open(input: WorkspaceOpenInput): Promise<WorkspaceListItem>
  }
}

export interface ValedictorianWorkspaceClient {
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
    record(input: ScoreInput): Promise<ScoreRecord>
  }
  actionQueue: {
    list(query?: ActionQueueListQuery): Promise<ActionQueueListResult>
  }
  connectors: {
    list(): Promise<ConnectorInstancesListResult>
    create(input: CreateConnectorInstanceInput): Promise<ConnectorInstanceSummary>
    update(input: UpdateConnectorInstanceInput): Promise<ConnectorInstanceSummary>
    remove(input: RemoveConnectorInstanceInput): Promise<ConnectorRetirementResult>
    inspect(connectorInstanceId: string): Promise<ConnectorStatusSummary>
    overview: {
      list(query?: ConnectorOverviewListQuery): Promise<ConnectorOverviewListResult>
    }
    runs: {
      list(input: ConnectorRunsListInput): Promise<ConnectorRunsListResult>
      trigger(input: TriggerConnectorRunInput): Promise<ConnectorRunSummary>
    }
    checkpoints: {
      list(input: ConnectorCheckpointsListInput): Promise<ConnectorCheckpointsListResult>
    }
    observations: {
      list(input: ConnectorObservationsListInput): Promise<ConnectorObservationsListResult>
    }
    descriptors: {
      list(): Promise<InstalledConnectorDescriptorsListResult>
      get(connectorId: string, connectorVersion: string): Promise<InstalledConnectorDescriptor>
    }
    options: {
      query(
        input: {
          connectorInstanceId: string
          body: ConnectorOptionQueryBody
          expectedIdentity: {
            connectorId: string
            connectorVersion: string
            filterSchemaVersion: string
            catalogVersion: string
            sourceVersion: string
          }
        },
        options?: { signal?: AbortSignal },
      ): Promise<ConnectorOptionQueryResult>
    }
    schedules: {
      get(connectorInstanceId: string): Promise<ConnectorScheduleSummary | null>
      upsert(input: UpsertConnectorScheduleInput): Promise<ConnectorScheduleSummary>
      pause(input: PauseConnectorScheduleInput): Promise<ConnectorScheduleSummary>
      resume(input: ResumeConnectorScheduleInput): Promise<ConnectorScheduleSummary>
      delete(input: DeleteConnectorScheduleInput): Promise<void>
      listAudit(input: ConnectorScheduleHistoryListInput): Promise<ConnectorScheduleAuditListResult>
      listOccurrences(
        input: ConnectorScheduleHistoryListInput,
      ): Promise<ConnectorScheduleOccurrenceListResult>
      dispatchDue(
        input: DispatchConnectorScheduleDueInput,
      ): Promise<DispatchConnectorScheduleDueResult>
    }
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
    document: {
      get(): Promise<ProfileDocument>
      update(input: ProfileDocumentUpdateInput): Promise<ProfileDocument>
      validate(): Promise<ProfileDocumentValidateResult>
      format(input: ProfileDocumentFormatInput): Promise<ProfileDocument>
      restore(input: ProfileDocumentRestoreInput): Promise<ProfileDocument>
    }
    /** @deprecated Compatibility sensitive-profile surface for the cutover window. */
    sensitive: {
      /** @deprecated */
      get(): Promise<ProfileSensitiveDetails>
      /** @deprecated */
      update(input: ProfileSensitiveDetailsInput): Promise<ProfileSensitiveDetails>
    }
  }
  secrets: {
    delete(key: string): Promise<void>
    list(): Promise<ProfileSecretsListResult>
    upsert(input: UpsertProfileSecretInput): Promise<ProfileSecretSummary>
    local: {
      resolve(input: LocalSecretResolutionInput): Promise<LocalSecretResolutionResult>
    }
  }
  runs: {
    list(query?: WorkflowRunsListInput): Promise<WorkflowRunsListResult>
    start(input: StartWorkflowRunInput): Promise<WorkflowRun>
    step(input: CreateWorkflowRunStepInput): Promise<WorkflowRunStep>
    complete(input: CompleteWorkflowRunInput): Promise<WorkflowRun>
  }
  sourcing: {
    rawRevisions: {
      projection: {
        get(rawRevisionId: string): Promise<RawSourceProjectionResult>
      }
    }
    rawRecords: {
      list(query?: RawSourceRecordsListQuery): Promise<RawSourceRecordsListResult>
      ingestBatch(input: BatchRawSourceRecordsInput): Promise<BatchRawSourceRecordsResult>
      get(rawRecordId: string): Promise<RawSourceRecord>
      replay(input: ReplayRawSourceRecordsInput): Promise<RawSourceReplayReceipt>
      normalization: {
        get(rawRecordId: string): Promise<RawSourceNormalizationResult>
      }
    }
    candidates: {
      /**
       * @deprecated Compatibility entry point for already-canonical producers.
       * New producers should submit source-neutral records through rawRecords.ingestBatch.
       */
      process(input: ProcessSourcingCandidateInput): Promise<SourcingFinding>
    }
    findings: {
      list(query?: SourcingFindingsListInput): Promise<SourcingFindingsListResult>
      /**
       * @deprecated Compatibility entry point for direct canonical finding creation.
       * New producers should submit source-neutral records through rawRecords.ingestBatch.
       */
      create(input: CreateSourcingFindingInput): Promise<SourcingFinding>
      update(input: UpdateSourcingFindingInput): Promise<SourcingFinding>
      decide(input: SetSourcingFindingDecisionInput): Promise<SourcingFinding>
      promote(input: PromoteSourcingFindingInput): Promise<SourcingFinding>
    }
  }
}
