export interface ValedictorianCapabilities {
  localSqlite: boolean
  agentWorkflows: boolean
  workflowRuns: boolean
  applicationAttempts: boolean
  sourcing: boolean
  connectors: boolean
  hostedSync: boolean
  multiWorkspace: boolean
  billing: boolean
}

export const defaultLocalCapabilities: ValedictorianCapabilities = {
  localSqlite: true,
  agentWorkflows: false,
  workflowRuns: true,
  applicationAttempts: true,
  sourcing: true,
  connectors: true,
  hostedSync: false,
  multiWorkspace: true,
  billing: false,
}
