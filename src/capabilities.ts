export interface ValedictorianCapabilities {
  localSqlite: boolean
  agentWorkflows: boolean
  hostedSync: boolean
  multiWorkspace: boolean
  billing: boolean
}

export const defaultLocalCapabilities: ValedictorianCapabilities = {
  localSqlite: true,
  agentWorkflows: false,
  hostedSync: false,
  multiWorkspace: true,
  billing: false,
}
