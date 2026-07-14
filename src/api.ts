export const defaultValedictorianApiBaseUrl = 'http://127.0.0.1:4317'

export const valedictorianApiPaths = {
  health: '/v1/health',
  capabilities: '/v1/capabilities',
  workspaces: '/v1/workspaces',
  workspaceOpen: '/v1/workspaces/open',
  workspaceCreate: '/v1/workspaces/create',
  applications: '/v1/applications',
  profile: '/v1/profile',
  profileAgentContext: '/v1/profile/agent-context',
  profileSensitive: '/v1/profile/sensitive',
  secrets: '/v1/secrets',
  secret(secretKey: string) {
    return `/v1/secrets/${encodeURIComponent(secretKey)}`
  },
  policyConfig: '/v1/policy/config',
  policyConfigReset: '/v1/policy/config/reset',
  policyEvidence: '/v1/policy/evidence',
  policyEvaluateApplication: '/v1/policy/evaluate/application',
  policyEvaluateSourcingCandidate: '/v1/policy/evaluate/sourcing-candidate',
  policyEvaluateRunWindow: '/v1/policy/evaluate/run-window',
  actionQueue: '/v1/action-queue',
  runs: '/v1/runs',
  connectors: '/v1/connectors',
  connectorDescriptors: '/v1/connector-descriptors',
  connectorOverview: '/v1/connectors/overview',
  application(applicationId: string) {
    return `/v1/applications/${encodeURIComponent(applicationId)}`
  },
  applicationArchive(applicationId: string) {
    return `/v1/applications/${encodeURIComponent(applicationId)}/archive`
  },
  applicationEvents(applicationId: string) {
    return `/v1/applications/${encodeURIComponent(applicationId)}/events`
  },
  applicationAttempts(applicationId: string) {
    return `/v1/applications/${encodeURIComponent(applicationId)}/attempts`
  },
  applicationAttemptSteps(applicationId: string, attemptId: string) {
    return `/v1/applications/${encodeURIComponent(applicationId)}/attempts/${encodeURIComponent(attemptId)}/steps`
  },
  applicationAttemptComplete(applicationId: string, attemptId: string) {
    return `/v1/applications/${encodeURIComponent(applicationId)}/attempts/${encodeURIComponent(attemptId)}/complete`
  },
  applicationLinks(applicationId: string) {
    return `/v1/applications/${encodeURIComponent(applicationId)}/links`
  },
  applicationLink(applicationId: string, linkId: string) {
    return `/v1/applications/${encodeURIComponent(applicationId)}/links/${encodeURIComponent(linkId)}`
  },
  applicationNotes(applicationId: string) {
    return `/v1/applications/${encodeURIComponent(applicationId)}/notes`
  },
  applicationStatus(applicationId: string) {
    return `/v1/applications/${encodeURIComponent(applicationId)}/status`
  },
  applicationWorkflow(applicationId: string) {
    return `/v1/applications/${encodeURIComponent(applicationId)}/workflow`
  },
  runSteps(workflowRunId: string) {
    return `/v1/runs/${encodeURIComponent(workflowRunId)}/steps`
  },
  runComplete(workflowRunId: string) {
    return `/v1/runs/${encodeURIComponent(workflowRunId)}/complete`
  },
  connectorStatus(connectorInstanceId: string) {
    return `/v1/connectors/${encodeURIComponent(connectorInstanceId)}/status`
  },
  connector(connectorInstanceId: string) {
    return `/v1/connectors/${encodeURIComponent(connectorInstanceId)}`
  },
  connectorRuns(connectorInstanceId: string) {
    return `/v1/connectors/${encodeURIComponent(connectorInstanceId)}/runs`
  },
  connectorCheckpoints(connectorInstanceId: string) {
    return `/v1/connectors/${encodeURIComponent(connectorInstanceId)}/checkpoints`
  },
  connectorObservations(connectorInstanceId: string) {
    return `/v1/connectors/${encodeURIComponent(connectorInstanceId)}/observations`
  },
  connectorDescriptor(connectorId: string, connectorVersion: string) {
    return `/v1/connector-descriptors/${encodeURIComponent(connectorId)}/versions/${encodeURIComponent(connectorVersion)}`
  },
  connectorOptionQuery(connectorInstanceId: string) {
    return `/v1/connectors/${encodeURIComponent(connectorInstanceId)}/options/query`
  },
  connectorSchedule(connectorInstanceId: string) {
    return `/v1/connectors/${encodeURIComponent(connectorInstanceId)}/schedule`
  },
  connectorSchedulePause(connectorInstanceId: string) {
    return `/v1/connectors/${encodeURIComponent(connectorInstanceId)}/schedule/pause`
  },
  connectorScheduleResume(connectorInstanceId: string) {
    return `/v1/connectors/${encodeURIComponent(connectorInstanceId)}/schedule/resume`
  },
  connectorScheduleAudit(connectorInstanceId: string) {
    return `/v1/connectors/${encodeURIComponent(connectorInstanceId)}/schedule/audit`
  },
  connectorScheduleOccurrences(connectorInstanceId: string) {
    return `/v1/connectors/${encodeURIComponent(connectorInstanceId)}/schedule/occurrences`
  },
  connectorScheduleDispatchDue(connectorInstanceId: string) {
    return `/v1/connectors/${encodeURIComponent(connectorInstanceId)}/schedule/dispatch-due`
  },
  sourcingCandidatesProcess: '/v1/sourcing/candidates/process',
  sourcingRawRecords: '/v1/sourcing/raw-records',
  sourcingRawRecordsBatch: '/v1/sourcing/raw-records/batch',
  sourcingRawRecordsReplay: '/v1/sourcing/raw-records/replay',
  sourcingRawRecord(rawRecordId: string) {
    return `/v1/sourcing/raw-records/${encodeURIComponent(rawRecordId)}`
  },
  sourcingRawRecordNormalization(rawRecordId: string) {
    return `/v1/sourcing/raw-records/${encodeURIComponent(rawRecordId)}/normalization`
  },
  sourcingRawRevisionProjection(rawRevisionId: string) {
    return `/v1/sourcing/raw-revisions/${encodeURIComponent(rawRevisionId)}/projection`
  },
  sourcingFindings: '/v1/sourcing/findings',
  sourcingFinding(findingId: string) {
    return `/v1/sourcing/findings/${encodeURIComponent(findingId)}`
  },
  sourcingFindingDecide(findingId: string) {
    return `/v1/sourcing/findings/${encodeURIComponent(findingId)}/decide`
  },
  sourcingFindingPromote(findingId: string) {
    return `/v1/sourcing/findings/${encodeURIComponent(findingId)}/promote`
  },
  scores: '/v1/scores',
} as const
