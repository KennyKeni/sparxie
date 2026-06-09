import type {
  ApplicationLinkSummary,
  ApplicationStatus,
  WorkMode,
} from './application.js'
import type { PolicyReason } from './policy.js'

export const queueBuckets = [
  'apply_now',
  'manual_review_pickup',
  'needs_user_info',
  'stale_lock_recovery',
  'user_review_required',
  'blocked',
  'skip_below_cutoff',
] as const

export type QueueBucket = (typeof queueBuckets)[number]
export type NextAction = QueueBucket

export function isQueueBucket(value: string): value is QueueBucket {
  return (queueBuckets as readonly string[]).includes(value)
}

export interface QueueListQuery {
  bucket?: QueueBucket
  limit?: number
  offset?: number
}

export interface QueueListItem {
  id: string
  companyName: string
  roleTitle: string
  sourceName: string
  status: ApplicationStatus
  location: string
  workMode: WorkMode
  hasApplied: boolean
  currentPriorityScore: number | null
  currentPriorityBand: string | null
  primaryLink: ApplicationLinkSummary | null
  createdAt: string
  updatedAt: string
  bucket: QueueBucket
  nextAction: NextAction
  reason: string
  policyReasons: PolicyReason[]
}

export interface QueueListResult {
  items: QueueListItem[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
  bucketCounts: Record<QueueBucket, number>
}
