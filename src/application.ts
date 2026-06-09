export const applicationStatuses = [
  'queued',
  'in_progress',
  'ready_for_review',
  'needs_user_info',
  'submitted',
  'already_applied',
  'manual_captcha',
  'security_gate',
  'login_needed',
  'platform_error',
  'closed',
  'not_fit',
  'not_pursued',
] as const

export type ApplicationStatus = (typeof applicationStatuses)[number]

export const roleKinds = [
  'internship',
  'new_grad',
  'full_time',
  'contract',
  'part_time',
  'other',
] as const

export type RoleKind = (typeof roleKinds)[number]

export const workModes = ['remote', 'onsite', 'hybrid', 'unclear'] as const

export type WorkMode = (typeof workModes)[number]

export const manualReviewKinds = ['overridable', 'non_overridable'] as const

export type ManualReviewKind = (typeof manualReviewKinds)[number]

export const applicationAttemptStatuses = ['in_progress', 'completed'] as const

export type ApplicationAttemptStatus = (typeof applicationAttemptStatuses)[number]

export const applicationAttemptActorTypes = ['agent', 'automation', 'user', 'system'] as const

export type ApplicationAttemptActorType = (typeof applicationAttemptActorTypes)[number]

export const applicationAttemptStepTypes = [
  'attempt_started',
  'resume_created',
  'resume_uploaded',
  'page_verified',
  'verification_receipt',
  'manual_review_hold_created',
  'blocked',
  'submitted',
  'confirmation_verified',
  'attempt_completed',
  'note',
] as const

export type ApplicationAttemptStepType = (typeof applicationAttemptStepTypes)[number]

export interface VerificationReceiptPayload {
  version: 1
  scope: 'final_review'
  status: 'passed' | 'failed'
  verified: string[]
  unresolved: string[]
  evidence: string
}

export type ApplicationListSort =
  | 'priority_desc'
  | 'priority_asc'
  | 'company_asc'
  | 'company_desc'
  | 'role_asc'
  | 'role_desc'
  | 'source_asc'
  | 'source_desc'
  | 'status_asc'
  | 'status_desc'
  | 'updated_desc'
  | 'updated_asc'

export const applicationListSorts = [
  'priority_desc',
  'priority_asc',
  'company_asc',
  'company_desc',
  'role_asc',
  'role_desc',
  'source_asc',
  'source_desc',
  'status_asc',
  'status_desc',
  'updated_desc',
  'updated_asc',
] as const

export const DEFAULT_APPLICATION_LIST_LIMIT = 50
export const MAX_APPLICATION_LIST_LIMIT = 200
export const DEFAULT_APPLICATION_LIST_OFFSET = 0

export function isApplicationStatus(value: string): value is ApplicationStatus {
  return (applicationStatuses as readonly string[]).includes(value)
}

export function isApplicationListSort(value: string): value is ApplicationListSort {
  return (applicationListSorts as readonly string[]).includes(value)
}

export function isRoleKind(value: string): value is RoleKind {
  return (roleKinds as readonly string[]).includes(value)
}

export function isWorkMode(value: string): value is WorkMode {
  return (workModes as readonly string[]).includes(value)
}

export function isManualReviewKind(value: string): value is ManualReviewKind {
  return (manualReviewKinds as readonly string[]).includes(value)
}

export function isApplicationAttemptActorType(
  value: string,
): value is ApplicationAttemptActorType {
  return (applicationAttemptActorTypes as readonly string[]).includes(value)
}

export function isApplicationAttemptStepType(value: string): value is ApplicationAttemptStepType {
  return (applicationAttemptStepTypes as readonly string[]).includes(value)
}

const trackingParamNames = new Set(['gh_src', 'ref', 'ref_src', 'trk', 'trackingId', 'source'])

export function canonicalizeApplicationUrl(value: string) {
  const trimmed = value.trim()

  try {
    const url = new URL(trimmed)

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('unsupported protocol')
    }

    url.protocol = url.protocol.toLowerCase()
    url.hostname = url.hostname.toLowerCase()
    url.hash = ''

    if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) {
      url.port = ''
    }

    const params: Array<[string, string]> = []
    url.searchParams.forEach((paramValue, key) => {
      params.push([key, paramValue])
    })

    const keptParams = params
      .filter(([key]) => !isTrackingParam(key))
      .sort(([leftKey, leftValue], [rightKey, rightValue]) => {
        if (leftKey === rightKey) {
          return leftValue.localeCompare(rightValue)
        }

        return leftKey.localeCompare(rightKey)
      })

    url.search = ''

    for (const [key, paramValue] of keptParams) {
      url.searchParams.append(key, paramValue)
    }

    return url.toString()
  } catch {
    throw new Error(`Invalid application URL: ${trimmed}`)
  }
}

export function normalizeApplicationLinkKind(value: string) {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '_')

  if (!normalized) {
    throw new Error('link kind is required')
  }

  if (!/^[a-z0-9_:-]+$/.test(normalized)) {
    throw new Error(`Invalid link kind: ${value}`)
  }

  return normalized
}

function isTrackingParam(key: string) {
  return key.startsWith('utm_') || trackingParamNames.has(key)
}

export interface ApplicationLinkSummary {
  label: string
  url: string
}

export interface ApplicationListItem {
  id: string
  companyName: string
  roleTitle: string
  sourceName: string
  status: ApplicationStatus
  term: string | null
  location: string
  workMode: WorkMode
  hasApplied: boolean
  currentPriorityScore: number | null
  currentPriorityBand: string | null
  primaryLink: ApplicationLinkSummary | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface ApplicationListQuery {
  status?: ApplicationStatus
  hasApplied?: boolean
  priorityBand?: string
  minScore?: number
  maxScore?: number
  company?: string
  role?: string
  source?: string
  search?: string
  workMode?: WorkMode
  createdFrom?: string
  createdTo?: string
  updatedFrom?: string
  updatedTo?: string
  sort?: ApplicationListSort
  limit?: number
  offset?: number
}

export interface ApplicationListResult {
  items: ApplicationListItem[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

export interface ApplicationDetail extends ApplicationListItem {}

export interface ApplicationLinkInput {
  kind: string
  label: string
  url: string
  externalId?: string | null
}

export interface ApplicationLinkRecord extends ApplicationLinkInput {
  id: string
  applicationId: string
  isPrimary: boolean
  discoveredAt: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface ApplicationLinksListInput {
  applicationId: string
  limit?: number
  offset?: number
}

export interface ApplicationLinksListResult {
  items: ApplicationLinkRecord[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

export interface CreateApplicationInput {
  companyName: string
  roleTitle: string
  sourceName: string
  roleKind: RoleKind
  country: string
  workMode: WorkMode
  status: ApplicationStatus
  term?: string | null
  city?: string | null
  region?: string | null
  locationRaw?: string | null
  hasApplied?: boolean
  currentResumeVariant?: string | null
  primaryLink?: ApplicationLinkInput
  sourceLink?: ApplicationLinkInput
  initialNote?: string
}

export interface UpdateApplicationInput {
  applicationId: string
  roleTitle?: string
  roleKind?: RoleKind
  term?: string | null
  city?: string | null
  region?: string | null
  country?: string
  workMode?: WorkMode
  locationRaw?: string | null
  hasApplied?: boolean
  currentResumeVariant?: string | null
}

export interface StatusUpdateInput {
  applicationId: string
  status: ApplicationStatus
  notes?: string
}

export interface AppendApplicationNoteInput {
  applicationId: string
  message: string
}

export interface ArchiveApplicationInput {
  applicationId: string
  note?: string
}

export interface CreateApplicationLinkInput extends ApplicationLinkInput {
  applicationId: string
  isPrimary?: boolean
}

export interface UpdateApplicationLinkInput {
  applicationId: string
  linkId: string
  archived?: boolean
  kind?: string
  label?: string
  url?: string
  externalId?: string | null
  isPrimary?: boolean
}

export interface ApplicationEvent {
  id: string
  applicationId: string
  type: string
  message: string
  payloadJson: string
  actor: string
  createdAt: string
}

export interface ApplicationEventsListInput {
  applicationId: string
  limit?: number
  offset?: number
}

export interface ApplicationEventsListResult {
  items: ApplicationEvent[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

export interface ApplicationAttemptStep {
  id: string
  attemptId: string
  applicationId: string
  sequence: number
  type: ApplicationAttemptStepType
  message: string
  payloadJson: string
  actor: string
  createdAt: string
}

export interface ApplicationAttempt {
  id: string
  applicationId: string
  status: ApplicationAttemptStatus
  outcome: ApplicationStatus | null
  actorType: ApplicationAttemptActorType
  actorName: string | null
  entryUrl: string | null
  resumeVariant: string | null
  resumeArtifactPath: string | null
  summary: string | null
  stopReason: string | null
  confirmationUrl: string | null
  confirmationText: string | null
  startedAt: string
  completedAt: string | null
  createdAt: string
  updatedAt: string
  steps: ApplicationAttemptStep[]
}

export interface ApplicationAttemptsListInput {
  applicationId: string
  limit?: number
  offset?: number
}

export interface ApplicationAttemptsListResult {
  items: ApplicationAttempt[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

export interface StartApplicationAttemptInput {
  applicationId: string
  actorType: ApplicationAttemptActorType
  actorName?: string | null
  entryUrl?: string | null
  resumeVariant?: string | null
  resumeArtifactPath?: string | null
  summary?: string | null
}

export interface CreateApplicationAttemptStepInput {
  applicationId: string
  attemptId: string
  type: ApplicationAttemptStepType
  message: string
  payload?: unknown
  actor?: string
}

export interface CompleteApplicationAttemptInput {
  applicationId: string
  attemptId: string
  outcome: ApplicationStatus
  summary?: string | null
  stopReason?: string | null
  confirmationUrl?: string | null
  confirmationText?: string | null
  holdStartedAt?: string | null
  manualReviewKind?: ManualReviewKind | null
  missingUserInfo?: string | null
  blockerReason?: string | null
}

export interface UpdateApplicationWorkflowInput {
  applicationId: string
  lockStartedAt?: string | null
  holdStartedAt?: string | null
  manualReviewKind?: ManualReviewKind | null
  missingUserInfo?: string | null
  blockerReason?: string | null
}
