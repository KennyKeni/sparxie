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
} from './connector/connector.js'
import type {
  ConnectorRetirementResult,
  RemoveConnectorInstanceInput,
} from './connector/connector-retirement.js'
import type {
  ConnectorOverviewListQuery,
  ConnectorOverviewListResult,
} from './connector/connector-overview.js'
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
} from './connector/connector-schedule.js'
import type {
  EvaluateApplicationPolicyInput,
  EvaluateRunWindowPolicyInput,
  EvaluateOpportunityPolicyInput,
  PolicyConfig,
  PolicyConfigPatch,
  PolicyDecision,
  PolicyEvidenceInput,
  PolicyEvidenceListInput,
  PolicyEvidenceRecord,
  PolicyRunWindowDecision,
} from './policy.js'
import type { ScoreInput, ScoreRecord } from './scoring.js'
import type { LifecycleWorkspaceClient } from './lifecycle-client.js'
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
} from './connector/connector-capabilities.js'
import type {
  ConnectorOptionQueryBody,
  ConnectorOptionQueryResult,
} from './connector/connector-option-query.js'
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
import type { CaptureResolutionWorkspaceClient } from './capture-resolution-client.js'

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

export interface ValedictorianWorkspaceClient extends LifecycleWorkspaceClient {
  captureResolution: CaptureResolutionWorkspaceClient
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
      opportunity(input: EvaluateOpportunityPolicyInput): Promise<PolicyDecision>
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
}
