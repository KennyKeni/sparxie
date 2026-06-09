import type { ApplicationStatus } from './application.js'

export const policyEvidenceTags = [
  'apply_cutoff_override',
  'explicit_approval_required',
  'explicit_user_approval',
  'final_review_verification_receipt',
  'official_path_verified',
  'high_risk_form',
  'high_risk_form_verified',
  'profile_retry_completed',
  'headed_profile_retry_completed',
  'second_pass_verified',
  'yc_company',
  'small_startup',
  'pre_series_b',
  'requires_second_pass',
  'do_not_submit',
] as const

export type PolicyEvidenceTag = (typeof policyEvidenceTags)[number]

export const policySubjectTypes = [
  'application',
  'sourcing_finding',
  'workflow_run',
  'global',
] as const

export type PolicySubjectType = (typeof policySubjectTypes)[number]

export const policyDecisionStatuses = [
  'allow',
  'deny',
  'needs_evidence',
  'needs_review',
  'skip',
] as const

export type PolicyDecisionStatus = (typeof policyDecisionStatuses)[number]

export interface PolicyTimeWindow {
  start: string
  end: string
  timezone: 'local' | string
}

export interface PolicyConfig {
  version: 1
  scoring: {
    applyCutoff: number
  }
  queue: {
    staleLockHours: number
  }
  manualReview: {
    pickupDelayHours: number
    daytimeWindow: PolicyTimeWindow
    nonOverridableTags: PolicyEvidenceTag[]
    manualReviewCompanyPatterns: string[]
    explicitApprovalCompanyPatterns: string[]
  }
  officialPath: {
    allowedNativePlatforms: string[]
    highRiskFormBuilders: string[]
    requireEmployerDomainVerificationForHighRiskForms: boolean
  }
  verification: {
    requireFinalReviewReceiptForSubmit: boolean
    requireSecondPassForSubmit: boolean
  }
  retries: {
    captchaSecurityMinProfileAttempts: number
    platformErrorMinProfileAttempts: number
    loginNeededRequiresRecoveryAttempt: boolean
  }
  sourcing: {
    timezone: string
    overlapMinutes: number
    weekdayNormalCadenceHours: number
    weekdayOvernightCadenceHours: number
    weekendCadenceHours: number
    minimumNormalLookbackHours: number
    overnightStartHour: number
    overnightEndHour: number
  }
}

export type PolicyConfigPatch = DeepPartial<PolicyConfig>

export interface PolicyReason {
  code: string
  message: string
}

export interface PolicyDecision {
  action: string
  configVersion: PolicyConfig['version']
  reasons: PolicyReason[]
  requiredEvidence: PolicyEvidenceTag[]
  status: PolicyDecisionStatus
  tags: PolicyEvidenceTag[]
}

export interface PolicyEvidenceInput {
  subjectType: PolicySubjectType
  subjectId: string
  tag: PolicyEvidenceTag
  source?: string
  note?: string | null
  payload?: unknown
}

export interface PolicyEvidenceRecord {
  id: string
  subjectType: PolicySubjectType
  subjectId: string
  tag: PolicyEvidenceTag
  source: string
  note: string | null
  payloadJson: string
  createdAt: string
}

export interface PolicyEvidenceListInput {
  subjectType?: PolicySubjectType
  subjectId?: string
  tag?: PolicyEvidenceTag
  limit?: number
  offset?: number
}

export interface EvaluateApplicationPolicyInput {
  applicationId: string
  attemptId?: string | null
  outcome?: ApplicationStatus | string | null
}

export interface EvaluateSourcingCandidatePolicyInput {
  findingId?: string | null
  companyName?: string | null
  roleTitle?: string | null
  officialUrl?: string | null
  sourceUrl?: string | null
  priorityScore?: number | null
  evidence?: PolicyEvidenceRecord[]
}

export interface EvaluateRunWindowPolicyInput {
  sourceId?: string | null
  sourceName?: string | null
  now?: string | null
  previousRunCompletedAt?: string | null
  timezone?: string | null
}

export interface PolicyRunWindowDecision extends PolicyDecision {
  cadenceHours: number
  overlapMinutes: number
  recommendedCoverageStartedAt: string
  recommendedCoverageEndedAt: string
  timezone: string
}

type DeepPartial<T> = {
  [Key in keyof T]?: T[Key] extends Array<infer Item>
    ? Item[]
    : T[Key] extends object
      ? DeepPartial<T[Key]>
      : T[Key]
}

export const defaultPolicyConfig: PolicyConfig = {
  version: 1,
  scoring: {
    applyCutoff: 6,
  },
  queue: {
    staleLockHours: 2,
  },
  manualReview: {
    pickupDelayHours: 6,
    daytimeWindow: {
      start: '12:00',
      end: '23:59',
      timezone: 'local',
    },
    nonOverridableTags: ['yc_company', 'small_startup', 'pre_series_b', 'explicit_approval_required'],
    manualReviewCompanyPatterns: ['Google', 'Netflix', 'Meta'],
    explicitApprovalCompanyPatterns: ['TikTok', 'ByteDance'],
  },
  officialPath: {
    allowedNativePlatforms: ['Handshake', 'LinkedIn Easy Apply'],
    highRiskFormBuilders: ['Google Forms', 'Tally', 'Airtable', 'Typeform', 'Jotform', 'Notion'],
    requireEmployerDomainVerificationForHighRiskForms: true,
  },
  verification: {
    requireFinalReviewReceiptForSubmit: true,
    requireSecondPassForSubmit: true,
  },
  retries: {
    captchaSecurityMinProfileAttempts: 2,
    platformErrorMinProfileAttempts: 2,
    loginNeededRequiresRecoveryAttempt: true,
  },
  sourcing: {
    timezone: 'America/New_York',
    overlapMinutes: 30,
    weekdayNormalCadenceHours: 1,
    weekdayOvernightCadenceHours: 3,
    weekendCadenceHours: 6,
    minimumNormalLookbackHours: 2,
    overnightStartHour: 1,
    overnightEndHour: 7,
  },
}

export function isPolicyEvidenceTag(value: string): value is PolicyEvidenceTag {
  return (policyEvidenceTags as readonly string[]).includes(value)
}

export function isPolicySubjectType(value: string): value is PolicySubjectType {
  return (policySubjectTypes as readonly string[]).includes(value)
}

export function isPolicyDecisionStatus(value: string): value is PolicyDecisionStatus {
  return (policyDecisionStatuses as readonly string[]).includes(value)
}

export function normalizePolicyConfig(value: unknown): PolicyConfig {
  const candidate = isRecord(value) ? value : {}
  const scoring = isRecord(candidate.scoring) ? candidate.scoring : {}
  const queue = isRecord(candidate.queue) ? candidate.queue : {}
  const manualReview = isRecord(candidate.manualReview) ? candidate.manualReview : {}
  const daytimeWindow = isRecord(manualReview.daytimeWindow) ? manualReview.daytimeWindow : {}
  const officialPath = isRecord(candidate.officialPath) ? candidate.officialPath : {}
  const verification = isRecord(candidate.verification) ? candidate.verification : {}
  const retries = isRecord(candidate.retries) ? candidate.retries : {}
  const sourcing = isRecord(candidate.sourcing) ? candidate.sourcing : {}

  return {
    version: 1,
    scoring: {
      applyCutoff: readPositiveNumber(scoring.applyCutoff, defaultPolicyConfig.scoring.applyCutoff),
    },
    queue: {
      staleLockHours: readPositiveNumber(queue.staleLockHours, defaultPolicyConfig.queue.staleLockHours),
    },
    manualReview: {
      pickupDelayHours: readPositiveNumber(
        manualReview.pickupDelayHours,
        defaultPolicyConfig.manualReview.pickupDelayHours,
      ),
      daytimeWindow: {
        start: readTimeString(
          daytimeWindow.start,
          defaultPolicyConfig.manualReview.daytimeWindow.start,
        ),
        end: readTimeString(daytimeWindow.end, defaultPolicyConfig.manualReview.daytimeWindow.end),
        timezone:
          typeof daytimeWindow.timezone === 'string' && daytimeWindow.timezone.trim()
            ? daytimeWindow.timezone.trim()
            : defaultPolicyConfig.manualReview.daytimeWindow.timezone,
      },
      nonOverridableTags: readEvidenceTagArray(
        manualReview.nonOverridableTags,
        defaultPolicyConfig.manualReview.nonOverridableTags,
      ),
      manualReviewCompanyPatterns: readStringArray(
        manualReview.manualReviewCompanyPatterns,
        defaultPolicyConfig.manualReview.manualReviewCompanyPatterns,
      ),
      explicitApprovalCompanyPatterns: readStringArray(
        manualReview.explicitApprovalCompanyPatterns,
        defaultPolicyConfig.manualReview.explicitApprovalCompanyPatterns,
      ),
    },
    officialPath: {
      allowedNativePlatforms: readStringArray(
        officialPath.allowedNativePlatforms,
        defaultPolicyConfig.officialPath.allowedNativePlatforms,
      ),
      highRiskFormBuilders: readStringArray(
        officialPath.highRiskFormBuilders,
        defaultPolicyConfig.officialPath.highRiskFormBuilders,
      ),
      requireEmployerDomainVerificationForHighRiskForms: readBoolean(
        officialPath.requireEmployerDomainVerificationForHighRiskForms,
        defaultPolicyConfig.officialPath.requireEmployerDomainVerificationForHighRiskForms,
      ),
    },
    verification: {
      requireFinalReviewReceiptForSubmit: readBoolean(
        verification.requireFinalReviewReceiptForSubmit,
        defaultPolicyConfig.verification.requireFinalReviewReceiptForSubmit,
      ),
      requireSecondPassForSubmit: readBoolean(
        verification.requireSecondPassForSubmit,
        defaultPolicyConfig.verification.requireSecondPassForSubmit,
      ),
    },
    retries: {
      captchaSecurityMinProfileAttempts: readPositiveInteger(
        retries.captchaSecurityMinProfileAttempts,
        defaultPolicyConfig.retries.captchaSecurityMinProfileAttempts,
      ),
      platformErrorMinProfileAttempts: readPositiveInteger(
        retries.platformErrorMinProfileAttempts,
        defaultPolicyConfig.retries.platformErrorMinProfileAttempts,
      ),
      loginNeededRequiresRecoveryAttempt: readBoolean(
        retries.loginNeededRequiresRecoveryAttempt,
        defaultPolicyConfig.retries.loginNeededRequiresRecoveryAttempt,
      ),
    },
    sourcing: {
      timezone:
        typeof sourcing.timezone === 'string' && sourcing.timezone.trim()
          ? sourcing.timezone.trim()
          : defaultPolicyConfig.sourcing.timezone,
      overlapMinutes: readPositiveInteger(
        sourcing.overlapMinutes,
        defaultPolicyConfig.sourcing.overlapMinutes,
      ),
      weekdayNormalCadenceHours: readPositiveNumber(
        sourcing.weekdayNormalCadenceHours,
        defaultPolicyConfig.sourcing.weekdayNormalCadenceHours,
      ),
      weekdayOvernightCadenceHours: readPositiveNumber(
        sourcing.weekdayOvernightCadenceHours,
        defaultPolicyConfig.sourcing.weekdayOvernightCadenceHours,
      ),
      weekendCadenceHours: readPositiveNumber(
        sourcing.weekendCadenceHours,
        defaultPolicyConfig.sourcing.weekendCadenceHours,
      ),
      minimumNormalLookbackHours: readPositiveNumber(
        sourcing.minimumNormalLookbackHours,
        defaultPolicyConfig.sourcing.minimumNormalLookbackHours,
      ),
      overnightStartHour: readHour(sourcing.overnightStartHour, defaultPolicyConfig.sourcing.overnightStartHour),
      overnightEndHour: readHour(sourcing.overnightEndHour, defaultPolicyConfig.sourcing.overnightEndHour),
    },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function readBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}

function readPositiveNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
}

function readPositiveInteger(value: unknown, fallback: number) {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : fallback
}

function readHour(value: unknown, fallback: number) {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 23
    ? Number(value)
    : fallback
}

function readTimeString(value: unknown, fallback: string) {
  return typeof value === 'string' && /^\d{2}:\d{2}$/.test(value) ? value : fallback
}

function readStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) {
    return [...fallback]
  }

  const strings = value.filter(
    (item): item is string => typeof item === 'string' && item.trim().length > 0,
  )

  return strings.length > 0 ? strings.map((item) => item.trim()) : [...fallback]
}

function readEvidenceTagArray(value: unknown, fallback: PolicyEvidenceTag[]) {
  if (!Array.isArray(value)) {
    return [...fallback]
  }

  const tags = value.filter((item): item is PolicyEvidenceTag => (
    typeof item === 'string' && isPolicyEvidenceTag(item)
  ))

  return tags.length > 0 ? tags : [...fallback]
}
