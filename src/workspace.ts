export type WorkspaceSource = 'local' | 'cloud'

export interface WorkspaceLatestError {
  at: string
  message: string
}

export interface WorkspaceListItem {
  id: string
  name: string
  open: boolean
  path?: string
  source: WorkspaceSource
  lastOpenedAt?: string
  latestError?: WorkspaceLatestError | null
}

export interface WorkspaceListResult {
  items: WorkspaceListItem[]
}

export interface WorkspaceOpenInput {
  path: string
  rekey?: boolean
}

export interface WorkspaceCreateInput {
  path: string
  rekey?: boolean
}
