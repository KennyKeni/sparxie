import type { PursuitApplicationStatus } from './lifecycle-application.js'
import type { JobWorkMode } from './job.js'
import type { PolicyReason } from './policy.js'

export const actionQueueBuckets = [
  'apply_now',
  'manual_review_pickup',
  'needs_user_info',
  'stale_lock_recovery',
  'user_review_required',
  'blocked',
  'skip_below_cutoff',
] as const

export type ActionQueueBucket = (typeof actionQueueBuckets)[number]
export type NextAction = ActionQueueBucket

export function isActionQueueBucket(value: string): value is ActionQueueBucket {
  return (actionQueueBuckets as readonly string[]).includes(value)
}

export interface ActionQueueListQuery {
  actionBucket?: ActionQueueBucket
  limit?: number
  offset?: number
}

export interface ActionQueueListItem {
  id: string
  companyName: string
  roleTitle: string
  sourceName: string
  status: PursuitApplicationStatus
  location: string
  workMode: JobWorkMode
  hasApplied: boolean
  currentPriorityScore: number | null
  currentPriorityBand: string | null
  primaryLink: { label: string; url: string } | null
  createdAt: string
  updatedAt: string
  actionBucket: ActionQueueBucket
  nextAction: NextAction
  reason: string
  policyReasons: PolicyReason[]
}

export interface ActionQueueListResult {
  items: ActionQueueListItem[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
  actionBucketCounts: Record<ActionQueueBucket, number>
}
