import { describe, expect, it } from 'vitest'
import {
  archiveCompanyInputSchema,
  createCompanyInputSchema,
  createCompanyResultSchema,
  markCompaniesDistinctInputSchema,
  markCompaniesDistinctResultSchema,
  mergeCompaniesResultSchema,
  reassignJobCompanyInputSchema,
  reassignJobCompanyResultSchema,
  updateCompanyAliasInputSchema,
  updateCompanyInputSchema,
  updateCompanyNotesInputSchema,
  updateCompanyResultSchema,
} from './index.js'

const actor = { id: 'user-1', type: 'user' as const }
const context = {
  workspaceId: 'workspace-1',
  actor,
  rationale: 'Operator requested this change.',
  idempotencyKey: 'request-1',
}

describe('Company command contracts', () => {
  it('requires workspace, actor, rationale, idempotency, and resource revisions', () => {
    expect(createCompanyInputSchema.safeParse({
      ...context,
      displayName: 'Acme',
    }).success).toBe(true)
    expect(updateCompanyInputSchema.safeParse({
      ...context,
      companyId: 'company-1',
      expectedCompanyRevision: 2,
      displayName: 'Acme Labs',
    }).success).toBe(true)
    expect(updateCompanyInputSchema.safeParse({
      ...context,
      companyId: 'company-1',
      displayName: 'Acme Labs',
    }).success).toBe(false)
    expect(archiveCompanyInputSchema.safeParse({
      ...context,
      companyId: 'company-1',
      expectedCompanyRevision: 2,
    }).success).toBe(true)
  })

  it('does not permit stale guards for create because no resource revision exists', () => {
    expect(createCompanyResultSchema.safeParse({
      status: 'blocked',
      workspaceId: 'workspace-1',
      idempotencyKey: 'request-1',
      failure: {
        kind: 'stale_guard',
        blocker: { code: 'impossible_state', message: 'Unrelated state changed.' },
        recovery: {
          action: 'refresh_and_resubmit',
          guards: [{
            kind: 'company_revision',
            companyId: 'company-1',
            expectedRevision: 1,
            currentRevision: 2,
          }],
        },
      },
    }).success).toBe(false)
  })

  it('normalizes empty notes to null and keeps alias writes revision-guarded', () => {
    expect(updateCompanyNotesInputSchema.parse({
      ...context,
      companyId: 'company-1',
      expectedCompanyRevision: 2,
      notes: '',
    }).notes).toBeNull()
    expect(updateCompanyAliasInputSchema.safeParse({
      ...context,
      companyId: 'company-1',
      expectedCompanyRevision: 2,
      aliasId: 'alias-1',
      value: 'Acme Incorporated',
    }).success).toBe(true)
  })

  it('guards both sides when marking a pair distinct', () => {
    expect(markCompaniesDistinctInputSchema.safeParse({
      ...context,
      candidateId: 'candidate-1',
      expectedCandidateRevision: 2,
      leftCompanyId: 'company-1',
      expectedLeftCompanyRevision: 3,
      rightCompanyId: 'company-2',
      expectedRightCompanyRevision: 4,
    }).success).toBe(true)
  })

  it('requires marked-distinct success to advance the same canonical pair', () => {
    const searchResult = (
      companyId: string,
      revision: number,
      displayName: string,
    ) => ({
      companyId,
      revision,
      displayName,
      websiteUrl: null,
      status: 'active',
      assignedJobCount: 0,
    })
    const result = {
      status: 'marked_distinct',
      workspaceId: 'workspace-1',
      candidateId: 'candidate-1',
      requestCandidateRevision: 2,
      leftCompanyId: 'company-1',
      requestLeftCompanyRevision: 3,
      rightCompanyId: 'company-2',
      requestRightCompanyRevision: 4,
      idempotencyKey: 'request-1',
      candidate: {
        candidateId: 'candidate-1',
        candidateRevision: 3,
        left: searchResult('company-1', 3, 'Acme'),
        right: searchResult('company-2', 4, 'Acme Labs'),
        score: 0.9,
        reasons: [{ code: 'alias_similarity', label: 'Alias is similar.' }],
        status: 'marked_distinct',
        updatedAt: '2026-07-23T12:00:00.000Z',
      },
    }
    expect(markCompaniesDistinctResultSchema.safeParse(result).success).toBe(true)
    expect(markCompaniesDistinctResultSchema.safeParse({
      ...result,
      candidate: { ...result.candidate, candidateRevision: 2 },
    }).success).toBe(false)
    expect(markCompaniesDistinctResultSchema.safeParse({
      ...result,
      candidate: {
        ...result.candidate,
        left: searchResult('company-0', 3, 'Other'),
      },
    }).success).toBe(false)
  })

  it('publishes separate assignment revision guards without changing Job facts', () => {
    const input = {
      ...context,
      jobId: '018f6f88-4c35-7a62-9f2e-318dd8e164c5',
      expectedAssignmentRevision: 3,
      destinationCompanyId: 'company-1',
      expectedDestinationCompanyRevision: 4,
    }
    expect(reassignJobCompanyInputSchema.safeParse(input).success).toBe(true)
    expect(reassignJobCompanyResultSchema.safeParse({
      status: 'reassigned',
      workspaceId: 'workspace-1',
      jobId: input.jobId,
      requestAssignmentRevision: 3,
      requestDestinationCompanyRevision: 4,
      idempotencyKey: 'request-1',
      assignment: {
        jobId: input.jobId,
        assignmentRevision: 4,
        workspaceCompany: {
          companyId: 'company-1',
          revision: 4,
          displayName: 'Acme',
          status: 'active',
        },
        jobFactsCompanyName: 'Legacy Acme',
        roleTitle: 'Engineer',
        namesDiffer: true,
      },
      jobFactsChanged: false,
    }).success).toBe(true)
  })

  it('closes stale metadata to refresh-and-resubmit guards', () => {
    expect(reassignJobCompanyResultSchema.safeParse({
      status: 'blocked',
      workspaceId: 'workspace-1',
      idempotencyKey: 'request-1',
      jobId: '018f6f88-4c35-7a62-9f2e-318dd8e164c5',
      requestAssignmentRevision: 3,
      destinationCompanyId: 'company-1',
      requestDestinationCompanyRevision: 4,
      failure: {
        kind: 'stale_guard',
        blocker: { code: 'impossible_state', message: 'Assignment changed.' },
        recovery: {
          action: 'refresh_and_resubmit',
          guards: [{
            kind: 'assignment_revision',
            jobId: '018f6f88-4c35-7a62-9f2e-318dd8e164c5',
            expectedRevision: 3,
            currentRevision: 4,
          }],
        },
      },
    }).success).toBe(true)
    expect(reassignJobCompanyResultSchema.safeParse({
      status: 'blocked',
      workspaceId: 'workspace-1',
      idempotencyKey: 'request-1',
      jobId: '018f6f88-4c35-7a62-9f2e-318dd8e164c5',
      requestAssignmentRevision: 3,
      destinationCompanyId: 'company-1',
      requestDestinationCompanyRevision: 4,
      failure: {
        kind: 'stale_guard',
        blocker: { code: 'impossible_state', message: 'Assignment changed.' },
        recovery: { action: 'retry_blindly', guards: [] },
      },
    }).success).toBe(false)
  })

  it('preserves legitimate non-stale impossible states as lifecycle failures', () => {
    expect(updateCompanyResultSchema.safeParse({
      status: 'blocked',
      workspaceId: 'workspace-1',
      companyId: 'company-1',
      requestCompanyRevision: 2,
      idempotencyKey: 'request-1',
      failure: {
        kind: 'lifecycle_failure',
        blocker: {
          code: 'impossible_state',
          message: 'Merged Companies have read-only identity fields.',
        },
      },
    }).success).toBe(true)
  })

  it('returns canonical redirect and preservation metadata after merge', () => {
    const resource = (id: string, status: 'active' | 'merged', revision: number) => ({
      id,
      workspaceId: 'workspace-1',
      displayName: id,
      aliases: [],
      websiteUrl: null,
      notes: null,
      revision,
      status,
      mergedIntoCompanyId: status === 'merged' ? 'company-1' : null,
      createdAt: '2026-07-23T12:00:00.000Z',
      updatedAt: '2026-07-23T12:01:00.000Z',
    })
    expect(mergeCompaniesResultSchema.safeParse({
      status: 'merged',
      workspaceId: 'workspace-1',
      idempotencyKey: 'request-1',
      requestWinnerCompanyRevision: 2,
      requestLoserCompanyRevision: 3,
      canonical: resource('company-1', 'active', 3),
      merged: resource('company-2', 'merged', 4),
      redirectPath: ['company-1'],
      reassignedJobCount: 2,
      flattenedRedirectCount: 1,
      resolvedCandidateCount: 3,
      historyPreserved: true,
      notesPreserved: { winner: true, loser: true },
    }).success).toBe(true)
  })
})
