export const sourceRunStatuses = [
  'queued',
  'locked',
  'extracting',
  'continued',
  'normalizing',
  'validating',
  'publishing',
  'blocked',
  'failed',
  'no_change',
  'published',
  'suspect',
] as const

export type SourceRunStatus = (typeof sourceRunStatuses)[number]

export const careerSourceLifecycleStatuses = [
  'candidate',
  'discovering',
  'ready',
  'active',
  'suspect',
  'paused',
  'retired',
  'blocked_by_policy',
  'blocked_by_waf',
] as const

export type CareerSourceLifecycleStatus = (typeof careerSourceLifecycleStatuses)[number]

export function isSourceRunStatus(value: string): value is SourceRunStatus {
  return (sourceRunStatuses as readonly string[]).includes(value)
}

export function isCareerSourceLifecycleStatus(
  value: string,
): value is CareerSourceLifecycleStatus {
  return (careerSourceLifecycleStatuses as readonly string[]).includes(value)
}

export interface SourceIngestionPagination {
  limit: number
  offset: number
  nextOffset: number | null
}

export interface SourcedJobPosting {
  active: boolean
  applyUrl: string | null
  companyId: string
  contentHash: string | null
  detailUrl: string | null
  firstSeenAt: string
  lastSeenAt: string
  lastVerifiedAt: string
  latestSnapshotId: string
  locations: unknown
  sourceId: string
  stableJobKey: string
  title: string
}

export interface SourceJobsListQuery {
  limit?: number
  offset?: number
}

export interface SourceJobsListResponse {
  jobs: SourcedJobPosting[]
  pagination: SourceIngestionPagination
}
