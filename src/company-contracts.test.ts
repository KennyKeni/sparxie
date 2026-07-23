import { describe, expect, it } from 'vitest'
import {
  companyCapabilitySchema,
  companyAssignedJobKeysetOrder,
  companyDirectoryKeysetOrder,
  companyDirectoryListInputSchema,
  companyDirectoryPageSchema,
  companyHistoryEventSchema,
  companyHistoryKeysetOrder,
  companyHistoryListInputSchema,
  companyHistoryPageSchema,
  companyDuplicateKeysetOrder,
  companyDuplicateReviewDecisionSchema,
  companyDuplicateListInputSchema,
  companyMatchPreviewSchema,
  companyNotesSchema,
  companySearchInputSchema,
  mergeCompaniesInputSchema,
  workspaceCompanyLookupSchema,
  workspaceCompanySchema,
} from './index.js'

const now = '2026-07-23T12:00:00.000Z'
const pageInfo = {
  startCursor: null,
  endCursor: null,
  hasPreviousPage: false,
  hasNextPage: false,
}

function company(
  id: string,
  status: 'active' | 'archived' | 'merged' = 'active',
  mergedIntoCompanyId: string | null = null,
) {
  return {
    id,
    workspaceId: 'workspace-1',
    displayName: id === 'company-1' ? 'Acme' : 'Acme Labs',
    aliases: [],
    websiteUrl: 'https://acme.example',
    notes: null,
    revision: 2,
    status,
    mergedIntoCompanyId,
    createdAt: now,
    updatedAt: now,
  }
}

describe('Workspace Company contracts', () => {
  it('closes capability states and keeps blocked migration non-actionable', () => {
    expect(companyCapabilitySchema.parse({ status: 'ready' })).toEqual({ status: 'ready' })
    expect(companyCapabilitySchema.parse({
      status: 'migrating',
      completed: 2,
      total: 3,
      issueCount: 0,
    }).status).toBe('migrating')
    expect(companyCapabilitySchema.parse({
      status: 'blocked',
      issueCount: 1,
      reason: 'migration_failed',
      message: 'Migration stopped.',
      remediation: null,
    }).remediation).toBeNull()
    expect(companyCapabilitySchema.safeParse({ status: 'unknown' }).success).toBe(false)
    expect(companyCapabilitySchema.safeParse({
      status: 'blocked',
      issueCount: 1,
      reason: 'migration_failed',
      message: 'Migration stopped.',
      remediation: { action: 'retry' },
    }).success).toBe(false)
  })

  it('keeps directory and duplicate pair paging distinct and opaque', () => {
    expect(companyDirectoryListInputSchema.parse({})).toEqual({
      filter: 'all',
      sort: 'display_name_asc',
      limit: 50,
    })
    expect(companyDuplicateListInputSchema.parse({})).toEqual({
      filter: 'open',
      sort: 'score_desc',
      limit: 50,
    })
    expect(companyDirectoryListInputSchema.parse({
      before: ' opaque cursor ',
    }).before).toBe(' opaque cursor ')
    expect(companyDirectoryListInputSchema.safeParse({
      before: 'a',
      after: 'b',
    }).success).toBe(false)
    expect(companyDirectoryKeysetOrder.fields).toEqual([
      'normalizedDisplayName',
      'companyId',
    ])
    expect(companyDuplicateKeysetOrder.fields).toEqual([
      'score',
      'updatedAt',
      'candidateId',
    ])
    expect(companyAssignedJobKeysetOrder).toEqual({
      fields: ['roleTitle', 'jobId'],
      directions: ['asc', 'asc'],
    })
    expect(companyDirectoryPageSchema.safeParse({
      items: [],
      pageInfo: { ...pageInfo, startCursor: 'unexpected' },
      totalCount: 0,
    }).success).toBe(false)
  })

  it('publishes a separately paged, newest-first Company history contract', () => {
    expect(companyHistoryListInputSchema.parse({})).toEqual({
      filter: 'all',
      sort: 'occurred_desc',
      limit: 50,
    })
    expect(companyHistoryListInputSchema.parse({
      after: ' raw history cursor ',
    }).after).toBe(' raw history cursor ')
    expect(companyHistoryKeysetOrder).toEqual({
      fields: ['occurredAt', 'eventId'],
      directions: ['desc', 'desc'],
    })
    expect(companyHistoryPageSchema.safeParse({
      items: [],
      pageInfo,
      totalCount: 0,
    }).success).toBe(true)
    expect(companyHistoryPageSchema.safeParse({
      items: [],
      pageInfo: { ...pageInfo, endCursor: 'unexpected' },
      totalCount: 0,
    }).success).toBe(false)
  })

  it('closes and bounds Company history event metadata', () => {
    const event = {
      eventId: 'event-1',
      workspaceId: 'workspace-1',
      companyId: 'company-1',
      companyRevision: 2,
      kind: 'updated',
      occurredAt: now,
      actor: { id: 'user-1', type: 'user' },
      rationale: 'Corrected the website.',
      change: {
        priorRevision: 1,
        newRevision: 2,
        changedFields: ['website_url'],
        aliasId: null,
        relatedCompanyId: null,
        affectedJobCount: 0,
      },
    }
    expect(companyHistoryEventSchema.safeParse(event).success).toBe(true)
    expect(companyHistoryEventSchema.safeParse({
      ...event,
      kind: 'split',
    }).success).toBe(false)
    expect(companyHistoryEventSchema.safeParse({
      ...event,
      change: { ...event.change, changedFields: ['global_company'] },
    }).success).toBe(false)
    expect(companyHistoryEventSchema.safeParse({
      ...event,
      kind: 'alias_added',
      change: {
        ...event.change,
        changedFields: ['notes'],
        aliasId: 'alias-1',
      },
    }).success).toBe(false)
    expect(companyHistoryEventSchema.safeParse({
      ...event,
      kind: 'archived',
      change: { ...event.change, changedFields: ['notes'] },
    }).success).toBe(false)
    const merge = {
      ...event,
      kind: 'merged',
      change: {
        ...event.change,
        changedFields: ['status', 'canonical_company'],
        relatedCompanyId: 'company-2',
        affectedJobCount: 0,
      },
    }
    expect(companyHistoryEventSchema.safeParse(merge).success).toBe(true)
    expect(companyHistoryEventSchema.safeParse({
      ...merge,
      change: { ...merge.change, relatedCompanyId: 'company-1' },
    }).success).toBe(false)
    expect(companyHistoryEventSchema.safeParse({
      ...merge,
      change: { ...merge.change, changedFields: ['status'] },
    }).success).toBe(false)
  })

  it('defaults search to active and requires explicit archived recovery scope', () => {
    expect(companySearchInputSchema.parse({ query: 'Acme' })).toEqual({
      query: 'Acme',
      scope: 'active',
      limit: 20,
    })
    expect(companySearchInputSchema.parse({
      query: 'Acme',
      scope: 'active_and_archived',
    }).scope).toBe('active_and_archived')
  })

  it('uses a closed deterministic match reason vocabulary', () => {
    expect(companyMatchPreviewSchema.safeParse({
      companyId: 'company-1',
      revision: 2,
      displayName: 'Acme',
      websiteUrl: null,
      score: 0.9,
      reasons: [{ code: 'alias_similarity', label: 'Alias is similar' }],
    }).success).toBe(true)
    expect(companyMatchPreviewSchema.safeParse({
      companyId: 'company-1',
      revision: 2,
      displayName: 'Acme',
      websiteUrl: null,
      score: 0.9,
      reasons: [{ code: 'model_similarity', label: 'A model selected it' }],
    }).success).toBe(false)
    expect(companyDuplicateReviewDecisionSchema.safeParse('mark_distinct').success).toBe(true)
    expect(companyDuplicateReviewDecisionSchema.safeParse('auto_merge').success).toBe(false)
  })

  it('retains requested merged resources and a one-hop canonical redirect', () => {
    const lookup = workspaceCompanyLookupSchema.parse({
      requested: company('company-2', 'merged', 'company-1'),
      canonical: company('company-1'),
      redirectPath: ['company-1'],
    })
    expect(lookup.requested.status).toBe('merged')
    expect(lookup.canonical.status).toBe('active')
    expect(workspaceCompanyLookupSchema.safeParse({
      requested: company('company-2', 'merged', 'company-1'),
      canonical: company('company-1'),
      redirectPath: ['company-9', 'company-1'],
    }).success).toBe(false)
  })

  it('keeps notes bounded and excludes Global Company concepts', () => {
    expect(companyNotesSchema.safeParse('x'.repeat(10_000)).success).toBe(true)
    expect(companyNotesSchema.safeParse('x'.repeat(10_001)).success).toBe(false)
    expect(workspaceCompanySchema.safeParse({
      ...company('company-1'),
      globalCompanyId: 'global-1',
    }).success).toBe(false)
  })

  it('requires explicit irreversible manual merge confirmation', () => {
    const base = {
      workspaceId: 'workspace-1',
      winnerCompanyId: 'company-1',
      expectedWinnerCompanyRevision: 2,
      loserCompanyId: 'company-2',
      expectedLoserCompanyRevision: 3,
      actor: { id: 'user-1', type: 'user' as const },
      rationale: 'Duplicate records.',
      loserDisplayNameConfirmation: 'Acme Labs',
      acknowledgeNoUndo: true as const,
      idempotencyKey: 'merge-1',
    }
    expect(mergeCompaniesInputSchema.safeParse(base).success).toBe(true)
    expect(mergeCompaniesInputSchema.safeParse({
      ...base,
      acknowledgeNoUndo: false,
    }).success).toBe(false)
  })
})
