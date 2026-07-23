export const defaultValedictorianApiBaseUrl = 'http://127.0.0.1:4317'

export const valedictorianApiPaths = {
  health: '/v1/health',
  capabilities: '/v1/capabilities',
  workspaces: '/v1/workspaces',
  workspaceOpen: '/v1/workspaces/open',
  workspaceCreate: '/v1/workspaces/create',
  applications: '/v1/applications',
  captures: '/v1/captures',
  captureResolution: '/v1/capture-resolution/captures',
  jobs: '/v1/jobs',
  opportunities: '/v1/opportunities',
  profile: '/v1/profile',
  profileAgentContext: '/v1/profile/agent-context',
  /** @deprecated Compatibility sensitive-profile path for the cutover window. */
  profileSensitive: '/v1/profile/sensitive',
  profileDocument: '/v1/profile/document',
  profileDocumentValidate: '/v1/profile/document/validate',
  profileDocumentFormat: '/v1/profile/document/format',
  profileDocumentRestore: '/v1/profile/document/restore',
  secrets: '/v1/secrets',
  secretsLocalResolve: '/v1/secrets/local/resolve',
  secret(secretKey: string) {
    return `/v1/secrets/${encodeURIComponent(secretKey)}`
  },
  policyConfig: '/v1/policy/config',
  policyConfigReset: '/v1/policy/config/reset',
  policyEvidence: '/v1/policy/evidence',
  policyEvaluateApplication: '/v1/policy/evaluate/application',
  policyEvaluateOpportunity: '/v1/policy/evaluate/opportunity',
  policyEvaluateRunWindow: '/v1/policy/evaluate/run-window',
  actionQueue: '/v1/action-queue',
  runs: '/v1/runs',
  connectors: '/v1/connectors',
  connectorDescriptors: '/v1/connector-descriptors',
  connectorOverview: '/v1/connectors/overview',
  application(applicationId: string) {
    return `/v1/applications/${encodeURIComponent(applicationId)}`
  },
  applicationAttempts(applicationId: string) {
    return `/v1/applications/${encodeURIComponent(applicationId)}/attempts`
  },
  applicationEvents(applicationId: string) {
    return `/v1/applications/${encodeURIComponent(applicationId)}/events`
  },
  applicationCompany(applicationId: string) {
    return `/v1/applications/${encodeURIComponent(applicationId)}/company`
  },
  applicationSource(applicationId: string) {
    return `/v1/applications/${encodeURIComponent(applicationId)}/source`
  },
  applicationRefreshSnapshot(applicationId: string) {
    return `/v1/applications/${encodeURIComponent(applicationId)}/snapshot/refresh`
  },
  applicationRemove(applicationId: string) {
    return `/v1/applications/${encodeURIComponent(applicationId)}/remove`
  },
  applicationRestore(applicationId: string) {
    return `/v1/applications/${encodeURIComponent(applicationId)}/restore`
  },
  applicationHistory(applicationId: string) {
    return `/v1/applications/${encodeURIComponent(applicationId)}/history`
  },
  applicationLinkRemove(applicationId: string, linkId: string) {
    return `/v1/applications/${encodeURIComponent(applicationId)}/links/${encodeURIComponent(linkId)}/remove`
  },
  capture(captureId: string) {
    return `/v1/captures/${encodeURIComponent(captureId)}`
  },
  captureRemove(captureId: string) {
    return `/v1/captures/${encodeURIComponent(captureId)}/remove`
  },
  captureRestore(captureId: string) {
    return `/v1/captures/${encodeURIComponent(captureId)}/restore`
  },
  captureHistory(captureId: string) {
    return `/v1/captures/${encodeURIComponent(captureId)}/history`
  },
  capturePromoteToJob(captureId: string) {
    return `/v1/captures/${encodeURIComponent(captureId)}/promote-to-job`
  },
  captureResolutionDetail(captureId: string) {
    return `/v1/capture-resolution/captures/${encodeURIComponent(captureId)}`
  },
  captureResolutionRetry(captureId: string) {
    return `/v1/capture-resolution/captures/${encodeURIComponent(captureId)}/retry`
  },
  captureResolutionReplay(captureId: string) {
    return `/v1/capture-resolution/captures/${encodeURIComponent(captureId)}/replay`
  },
  captureResolutionCorrection(captureId: string) {
    return `/v1/capture-resolution/captures/${encodeURIComponent(captureId)}/correction`
  },
  captureResolutionCompletion(captureId: string) {
    return `/v1/capture-resolution/captures/${encodeURIComponent(captureId)}/completion`
  },
  job(jobId: string) {
    return `/v1/jobs/${encodeURIComponent(jobId)}`
  },
  jobFacts(jobId: string) {
    return `/v1/jobs/${encodeURIComponent(jobId)}/facts`
  },
  jobAvailability(jobId: string) {
    return `/v1/jobs/${encodeURIComponent(jobId)}/availability`
  },
  jobExternalIdentities(jobId: string) {
    return `/v1/jobs/${encodeURIComponent(jobId)}/external-identities`
  },
  jobExternalIdentityRemove(jobId: string) {
    return `/v1/jobs/${encodeURIComponent(jobId)}/external-identities/remove`
  },
  jobRemove(jobId: string) {
    return `/v1/jobs/${encodeURIComponent(jobId)}/remove`
  },
  jobRestore(jobId: string) {
    return `/v1/jobs/${encodeURIComponent(jobId)}/restore`
  },
  jobHistory(jobId: string) {
    return `/v1/jobs/${encodeURIComponent(jobId)}/history`
  },
  jobPromoteToOpportunity(jobId: string) {
    return `/v1/jobs/${encodeURIComponent(jobId)}/promote-to-opportunity`
  },
  opportunity(opportunityId: string) {
    return `/v1/opportunities/${encodeURIComponent(opportunityId)}`
  },
  opportunityEvaluation(opportunityId: string) {
    return `/v1/opportunities/${encodeURIComponent(opportunityId)}/evaluation`
  },
  opportunityDisposition(opportunityId: string) {
    return `/v1/opportunities/${encodeURIComponent(opportunityId)}/disposition`
  },
  opportunityRemove(opportunityId: string) {
    return `/v1/opportunities/${encodeURIComponent(opportunityId)}/remove`
  },
  opportunityRestore(opportunityId: string) {
    return `/v1/opportunities/${encodeURIComponent(opportunityId)}/restore`
  },
  opportunityHistory(opportunityId: string) {
    return `/v1/opportunities/${encodeURIComponent(opportunityId)}/history`
  },
  opportunityPromoteToApplication(opportunityId: string) {
    return `/v1/opportunities/${encodeURIComponent(opportunityId)}/promote-to-application`
  },
  applicationLinks(applicationId: string) {
    return `/v1/applications/${encodeURIComponent(applicationId)}/links`
  },
  applicationLink(applicationId: string, linkId: string) {
    return `/v1/applications/${encodeURIComponent(applicationId)}/links/${encodeURIComponent(linkId)}`
  },
  applicationStatus(applicationId: string) {
    return `/v1/applications/${encodeURIComponent(applicationId)}/status`
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
  scores: '/v1/scores',
} as const
