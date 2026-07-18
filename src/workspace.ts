import { z } from 'zod'

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

const workspaceLatestErrorSchema: z.ZodType<WorkspaceLatestError> = z
  .object({
    at: z.string(),
    message: z.string(),
  })
  .strict()

export const workspaceListItemSchema: z.ZodType<WorkspaceListItem> = z
  .object({
    id: z.string(),
    name: z.string(),
    open: z.boolean(),
    path: z.string().optional(),
    source: z.enum(['local', 'cloud']),
    lastOpenedAt: z.string().optional(),
    latestError: workspaceLatestErrorSchema.nullable().optional(),
  })
  .strict()

export const workspaceListResultSchema: z.ZodType<WorkspaceListResult> = z
  .object({
    items: z.array(workspaceListItemSchema),
  })
  .strict()
