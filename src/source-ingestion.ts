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

export interface CareerSourceSummary {
  id: string
  companyId: string
  entryUrl: string
  canonicalHost: string
  sourceType: string
  observedProvider: string | null
  activeStrategyVersionId: string | null
  latestSnapshotId: string | null
  status: CareerSourceLifecycleStatus
  politenessPolicy: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface SourceRunDiff {
  addedCount: number
  changedCount: number
  previousSnapshotId: string | null
  removedCount: number
}

export interface SourceRunSummary {
  diff: SourceRunDiff
  evidencePath: string | null
  normalizedJobCount: number | null
  outcome: SourceRunStatus | string
  rawJobCount: number | null
  sourceId: string | null
  sourceRunId: string
  status: SourceRunStatus
}

export interface SourceRunConfidenceResult {
  message: string | null
  outcome: string
  ruleKey: string
  severity: string
}

export interface SourceRunDetail extends SourceRunSummary {
  confidenceResults: SourceRunConfidenceResult[]
  evidenceArtifacts: string[]
  evidenceBundleId: string | null
}

export interface SourceRunsListQuery {
  sourceId?: string
  limit?: number
}

export interface SourceRunsListResponse {
  runs: SourceRunSummary[]
}

export interface SourceRunResponse {
  run: SourceRunDetail
}
