export interface ValedictorianCapabilities {
  localSqlite: boolean
  agentWorkflows: boolean
  hostedSync: boolean
  multiWorkspace: boolean
  billing: boolean
}

export const defaultLocalCapabilities: ValedictorianCapabilities = {
  localSqlite: true,
  agentWorkflows: true,
  hostedSync: false,
  multiWorkspace: false,
  billing: false,
}
