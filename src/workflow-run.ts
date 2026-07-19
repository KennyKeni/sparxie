import type { ApplicationAttemptActorType, ApplicationAttemptStepType } from './application.js'
import type { PursuitApplicationStatus } from './lifecycle-application.js'

export const runTypes = [
  'application_attempt',
  'sourcing',
  'merge',
  'manual_review_pickup',
  'stale_lock_pickup',
  'import',
] as const

export type RunType = (typeof runTypes)[number]

export const runStatuses = ['in_progress', 'completed', 'failed'] as const

export type RunStatus = (typeof runStatuses)[number]

export function isRunType(value: string): value is RunType {
  return (runTypes as readonly string[]).includes(value)
}

export function isRunStatus(value: string): value is RunStatus {
  return (runStatuses as readonly string[]).includes(value)
}

export interface WorkflowRunStep {
  id: string
  workflowRunId: string
  sequence: number
  type: ApplicationAttemptStepType | string
  message: string
  payloadJson: string
  actor: string
  createdAt: string
}

export interface WorkflowRun {
  id: string
  runType: RunType
  status: RunStatus
  actorType: ApplicationAttemptActorType
  actorName: string | null
  sourceId: string | null
  sourceName: string | null
  subjectApplicationId: string | null
  startedAt: string
  completedAt: string | null
  coverageStartedAt: string | null
  coverageEndedAt: string | null
  timezone: string | null
  inputJson: string
  summary: string | null
  outcome: PursuitApplicationStatus | null
  blocker: string | null
  metadataJson: string
  createdAt: string
  updatedAt: string
  steps: WorkflowRunStep[]
}

export interface WorkflowRunsListInput {
  runType?: RunType
  status?: RunStatus
  sourceId?: string
  source?: string
  subjectApplicationId?: string
  limit?: number
  offset?: number
}

export interface WorkflowRunsListResult {
  items: WorkflowRun[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

export interface StartWorkflowRunInput {
  runType: RunType
  actorType: ApplicationAttemptActorType
  actorName?: string | null
  sourceId?: string | null
  sourceName?: string | null
  subjectApplicationId?: string | null
  coverageStartedAt?: string | null
  coverageEndedAt?: string | null
  timezone?: string | null
  input?: unknown
  summary?: string | null
  metadata?: unknown
}

export interface CreateWorkflowRunStepInput {
  workflowRunId: string
  type: ApplicationAttemptStepType | string
  message: string
  payload?: unknown
  actor?: string
}

export interface CompleteWorkflowRunInput {
  workflowRunId: string
  status?: RunStatus
  outcome?: PursuitApplicationStatus | null
  summary?: string | null
  blocker?: string | null
  metadata?: unknown
}
