import type { RoleKind, WorkMode } from './application.js'
import type { ScoreInput } from './scoring.js'

export const sourcingMergeStatuses = [
  'new',
  'merged',
  'duplicate',
  'below_cutoff',
  'blocked',
  'not_fit',
  'not_pursued',
  'archived',
] as const

export type SourcingMergeStatus = (typeof sourcingMergeStatuses)[number]

export const manualSourcingDecisionStatuses = [
  'not_fit',
  'not_pursued',
  'archived',
] as const

export type ManualSourcingDecisionStatus = (typeof manualSourcingDecisionStatuses)[number]

export function isSourcingMergeStatus(value: string): value is SourcingMergeStatus {
  return (sourcingMergeStatuses as readonly string[]).includes(value)
}

export function isManualSourcingDecisionStatus(
  value: string,
): value is ManualSourcingDecisionStatus {
  return (manualSourcingDecisionStatuses as readonly string[]).includes(value)
}

export interface SourcingFinding {
  id: string
  workflowRunId: string
  sourceId: string
  sourceName: string
  companyName: string
  roleTitle: string
  roleKind: RoleKind
  term: string | null
  city: string | null
  region: string | null
  country: string
  workMode: WorkMode
  locationRaw: string | null
  officialUrl: string | null
  sourceUrl: string | null
  postedAge: string | null
  priorityScore: number | null
  priorityBand: string | null
  fitNotes: string | null
  duplicateNotes: string | null
  blocker: string | null
  mergeStatus: SourcingMergeStatus
  mergedApplicationId: string | null
  mergedApplicationCompanyName: string | null
  mergedApplicationRoleTitle: string | null
  mergeNotes: string | null
  discoveredAt: string
  createdAt: string
  updatedAt: string
}

export interface SourcingFindingsListInput {
  workflowRunId?: string
  sourceId?: string
  source?: string
  mergeStatus?: SourcingMergeStatus
  limit?: number
  offset?: number
}

export interface SourcingFindingsListResult {
  items: SourcingFinding[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

export interface CreateSourcingFindingInput {
  workflowRunId: string
  sourceId?: string | null
  sourceName?: string | null
  companyName: string
  roleTitle: string
  roleKind: RoleKind
  term?: string | null
  city?: string | null
  region?: string | null
  country?: string
  workMode: WorkMode
  locationRaw?: string | null
  officialUrl?: string | null
  sourceUrl?: string | null
  postedAge?: string | null
  priorityScore?: number | null
  priorityBand?: string | null
  fitNotes?: string | null
  duplicateNotes?: string | null
  blocker?: string | null
  mergeStatus?: SourcingMergeStatus
  discoveredAt?: string | null
}

export interface UpdateSourcingFindingInput {
  findingId: string
  sourceId?: string | null
  sourceName?: string | null
  companyName?: string
  roleTitle?: string
  roleKind?: RoleKind
  term?: string | null
  city?: string | null
  region?: string | null
  country?: string
  workMode?: WorkMode
  locationRaw?: string | null
  officialUrl?: string | null
  sourceUrl?: string | null
  postedAge?: string | null
  priorityScore?: number | null
  priorityBand?: string | null
  fitNotes?: string | null
  duplicateNotes?: string | null
  blocker?: string | null
  mergeStatus?: SourcingMergeStatus
  mergeNotes?: string | null
}

export interface PromoteSourcingFindingInput {
  findingId: string
}

export interface SetSourcingFindingDecisionInput {
  findingId: string
  mergeStatus: ManualSourcingDecisionStatus
  mergeNotes?: string | null
}

export type SourcingCandidateScoreInput = Omit<ScoreInput, 'applicationId'>

export interface ProcessSourcingCandidateInput {
  workflowRunId: string
  sourceId?: string | null
  sourceName?: string | null
  companyName: string
  roleTitle: string
  roleKind: RoleKind
  term?: string | null
  city?: string | null
  region?: string | null
  country?: string
  workMode: WorkMode
  locationRaw?: string | null
  officialUrl?: string | null
  sourceUrl?: string | null
  postedAge?: string | null
  rawMetadata?: unknown
  score?: SourcingCandidateScoreInput | null
  cutoffScore?: number | null
}
