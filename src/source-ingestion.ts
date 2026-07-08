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
  companyName: string
  companySlug: string
  contentHash: string | null
  detailUrl: string | null
  firstSeenAt: string
  lastSeenAt: string
  lastVerifiedAt: string
  latestSnapshotId: string
  locations: unknown
  sourceId: string
  sourceSlug: string
  stableJobKey: string
  title: string
}

export type SourceJobsListSort =
  | 'company_asc'
  | 'company_desc'
  | 'first_seen_asc'
  | 'first_seen_desc'
  | 'last_seen_asc'
  | 'last_seen_desc'
  | 'title_asc'
  | 'title_desc'
  | 'verified_asc'
  | 'verified_desc'

export interface SourceJobsListQuery {
  active?: boolean
  companyId?: string
  companyRef?: string
  limit?: number
  offset?: number
  search?: string
  sourceId?: string
  sourceRef?: string
  sort?: SourceJobsListSort
  staleBefore?: string
}

export interface SourceJobsListResponse {
  jobs: SourcedJobPosting[]
  pagination: SourceIngestionPagination
}

export type SourceCompaniesListSort =
  | 'active_jobs_desc'
  | 'active_jobs_asc'
  | 'company_asc'
  | 'company_desc'
  | 'created_asc'
  | 'created_desc'
  | 'updated_asc'
  | 'updated_desc'

export interface SourceCompaniesListQuery {
  limit?: number
  offset?: number
  search?: string
  sort?: SourceCompaniesListSort
}

export interface SourceCompanySummary {
  activeJobCount: number
  careerSourceCount: number
  createdAt: string
  companyId: string
  companyName: string
  companySlug: string
  updatedAt: string
}

export interface SourceCompaniesListResponse {
  companies: SourceCompanySummary[]
  pagination: SourceIngestionPagination
  summary: {
    totalActiveJobs: number
    totalCompanies: number
  }
}

export interface CareerSourceSummary {
  id: string
  companyId: string
  companyName: string
  companySlug: string
  entryUrl: string
  canonicalHost: string
  sourceType: string
  observedProvider: string | null
  activeStrategyVersionId: string | null
  latestSnapshotId: string | null
  slug: string
  status: CareerSourceLifecycleStatus
  politenessPolicy: Record<string, unknown>
  schedule?: SourceScheduleSummary | null
  createdAt: string
  updatedAt: string
}

export type CareerSourcesListSort =
  | 'company_asc'
  | 'company_desc'
  | 'updated_asc'
  | 'updated_desc'
  | 'status_asc'
  | 'status_desc'

export interface CareerSourcesListQuery {
  limit?: number
  observedProvider?: string
  offset?: number
  scheduleEnabled?: boolean
  search?: string
  sourceType?: string
  sort?: CareerSourcesListSort
  status?: CareerSourceLifecycleStatus
}

export interface CareerSourcesListResponse {
  sources: CareerSourceSummary[]
  pagination: SourceIngestionPagination
}

export type DashboardCareerSourceLifecycleStatus = 'active' | 'paused' | 'retired'

export interface CareerSourceLifecycleInput {
  status: DashboardCareerSourceLifecycleStatus
}

export interface CareerSourceLifecycleResponse {
  source: {
    id: string
    slug: string
    status: CareerSourceLifecycleStatus
    updatedAt: string
  }
}

export interface CreateCareerSourceInput {
  companyName: string
  careerUrl: string
  templateKey?: string
  config?: Record<string, unknown>
  allowDuplicate?: boolean
}

export interface CareerSourceRegistrationResponse {
  source: {
    companyId: string
    companySlug: string
    sourceId: string
    sourceSlug: string
    strategyVersionId: string
  }
}

export type SourceProbeDiscoveryMethod =
  | 'browser_render_provider_link'
  | 'direct_provider_url'
  | 'static_provider_link'

export type BrowserProxyInput =
  | {
      mode: 'managed'
      countryCode: 'us'
    }
  | {
      mode: 'none'
    }

export interface SourceProbeUrlInput {
  browserFallback?: boolean
  browserProxy?: BrowserProxyInput
  url: string
}

export interface SourceProbeResult {
  candidateTemplate: string | null
  config: Record<string, unknown>
  discoveryMethod?: SourceProbeDiscoveryMethod
  evidence: Record<string, unknown>
  failedRequirement: string | null
  listingCount: number | null
  observedProvider: string
  probedCareerUrl?: string
  readiness: 'not-ready' | 'ready'
  sampleStableJobKey: string | null
  submittedCareerUrl?: string
}

export interface SourceProbeResponse {
  probe: SourceProbeResult
}

export type SourceScheduleCadence = 'hourly' | 'daily' | 'weekly'

export interface SourceScheduleSummary {
  cadence: SourceScheduleCadence
  enabled: boolean
  nextDueAt: string
  timezone: string
}

export interface SourceSchedule {
  cadence: SourceScheduleCadence
  cronExpression: string | null
  enabled: boolean
  id: string
  intervalMinutes: number | null
  jitterSeconds: number
  nextDueAt: string
  priority: number
  sourceId: string
  sourceSlug: string
  timezone: string
}

export interface SourceScheduleInput {
  cadence: SourceScheduleCadence
  timezone?: string
  nextDueAt?: string
  priority?: number
  jitterSeconds?: number
}

export interface SourceScheduleResponse {
  schedule: SourceSchedule | null
}

export type SourceSchedulesListSort =
  | 'cadence_asc'
  | 'cadence_desc'
  | 'company_asc'
  | 'company_desc'
  | 'next_due_asc'
  | 'next_due_desc'
  | 'updated_asc'
  | 'updated_desc'

export interface SourceSchedulesListQuery {
  cadence?: SourceScheduleCadence
  companyId?: string
  companyRef?: string
  enabled?: boolean
  limit?: number
  offset?: number
  search?: string
  sort?: SourceSchedulesListSort
  sourceId?: string
  sourceRef?: string
}

export interface SourceScheduleBrowseRow extends SourceSchedule {
  canonicalHost: string
  companyId: string
  companyName: string
  companySlug: string
  createdAt: string
  entryUrl: string
  sourceStatus: CareerSourceLifecycleStatus
  updatedAt: string
}

export interface SourceSchedulesListResponse {
  pagination: SourceIngestionPagination
  schedules: SourceScheduleBrowseRow[]
}

export interface SourceRunRequestInput {
  admit?: boolean
}

export interface SourceRunAdmission {
  admitted: boolean
  [key: string]: unknown
}

export interface SourceRunRequestResponse {
  requestId: string
  admission?: SourceRunAdmission
}

export interface SourceRunOverrideResult {
  kind: 'accept_baseline' | 'force_publish'
  overriddenRuleKeys: string[]
  publishedJobCount: number
  snapshotId: string
  sourceRunId: string
}

export interface SourceRunOverrideResponse {
  override: SourceRunOverrideResult
}

export interface SourceRunDiff {
  addedCount: number
  changedCount: number
  previousSnapshotId: string | null
  removedCount: number
}

export interface SourceRunSummary {
  completedAt: string | null
  diff: SourceRunDiff
  evidencePath: string | null
  normalizedJobCount: number | null
  outcome: SourceRunStatus | string
  rawJobCount: number | null
  sourceId: string | null
  sourceSlug: string | null
  sourceRunId: string
  startedAt: string | null
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

export type SourceRunsListSort =
  | 'completed_asc'
  | 'completed_desc'
  | 'created_asc'
  | 'created_desc'
  | 'started_asc'
  | 'started_desc'
  | 'status_asc'
  | 'status_desc'

export interface SourceRunsListQuery {
  limit?: number
  offset?: number
  outcome?: SourceRunStatus
  sourceId?: string
  sourceRef?: string
  sort?: SourceRunsListSort
  status?: SourceRunStatus
}

export interface SourceRunsListResponse {
  pagination: SourceIngestionPagination
  runs: SourceRunSummary[]
}

export interface SourceRunResponse {
  run: SourceRunDetail
}
