export interface JobAppCapabilities {
  localSqlite: boolean
  agentWorkflows: boolean
  hostedSync: boolean
  multiWorkspace: boolean
  billing: boolean
}

export const defaultLocalCapabilities: JobAppCapabilities = {
  localSqlite: true,
  agentWorkflows: true,
  hostedSync: false,
  multiWorkspace: false,
  billing: false,
}
