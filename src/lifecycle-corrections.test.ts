import { describe, expect, it } from 'vitest'
import {
  applicationMutationResultSchema,
  applicationHistoryEntrySchema,
  applicationIdSchema,
  captureListResultSchema,
  captureMutationResultSchema,
  captureRevisionSchema,
  captureSchema,
  createApplicationInputSchema,
  createJobInputSchema,
  createOpportunityInputSchema,
  jobHistoryEntrySchema,
  jobMutationResultSchema,
  lifecycleAuditEvidenceSchema,
  lifecycleBlockerSchema,
  opportunityHistoryEntrySchema,
  opportunityIdSchema,
  promoteCaptureToJobInputSchema,
  promotionResultSchema,
  removalResultSchema,
  restoreResultSchema,
} from './index.js'

const actor = { id: 'user-7', type: 'user' as const }
const timestamp = '2026-07-18T15:00:00.000Z'
const jobId = '018f6f88-4c35-7a62-9f2e-318dd8e164c5'
const validCapture = {
  id: 'capture-1', workspaceId: 'workspace-1', evidenceMode: 'reported' as const,
  adapter: { id: 'manual', kind: 'manual' as const, version: '1' }, observedAt: timestamp,
  receivedAt: timestamp, providerRecordId: null, providerSchema: null, payload: null,
  evidence: [], revision: 1, createdAt: timestamp, updatedAt: timestamp, removedAt: null,
}
const facts = {
  companyName: 'Northstar Robotics', roleTitle: 'Controls Intern', sourceName: 'Campus Network',
  roleKind: 'internship' as const, term: null, terms: [], timingMode: 'unknown' as const,
  startDate: null, endDate: null, location: null, workMode: 'unknown' as const,
  employmentType: 'internship' as const, seniority: 'student' as const,
  compensation: null, postedAt: null, destination: null,
}
const validJob = {
  id: jobId, workspaceId: 'workspace-1', factsRevision: 1, facts,
  availabilityRevision: 1, availability: { state: 'open' as const, observedAt: timestamp },
  externalIdentities: [],
  captureEvidenceReferences: [{ captureId: validCapture.id, captureRevision: 1, evidenceIndexes: [] }],
  createdAt: timestamp, updatedAt: timestamp, removedAt: null,
}
const opportunityId = 'opportunity-1'
const validOpportunity = {
  id: opportunityId, workspaceId: 'workspace-1', jobId, revision: 1,
  fit: 'possible' as const, rank: null, cutoff: 'not_evaluated' as const,
  disposition: 'reviewing' as const, override: null,
  createdAt: timestamp, updatedAt: timestamp, removedAt: null,
}
const applicationId = 'application-1'
const validApplication = {
  id: applicationId, workspaceId: 'workspace-1', opportunityId, jobId, revision: 1,
  status: 'active' as const,
  snapshot: {
    jobFactsRevision: 1, capturedAt: timestamp, companyName: facts.companyName,
    roleTitle: facts.roleTitle, sourceName: facts.sourceName, roleKind: facts.roleKind,
    term: facts.term, terms: facts.terms, timingMode: facts.timingMode,
    startDate: facts.startDate, endDate: facts.endDate, location: facts.location,
    workMode: facts.workMode, initialDestination: facts.destination, initialLinks: [],
  },
  companyName: facts.companyName, sourceName: facts.sourceName, links: [],
  createdAt: timestamp, updatedAt: timestamp, removedAt: null,
}

describe('lifecycle correction contract', () => {
  it('requires actionable deterministic duplicate metadata', () => {
    expect(lifecycleBlockerSchema.safeParse({
      code: 'deterministic_duplicate', message: 'Already exists.',
      allowedDuplicateResolutions: ['attach'],
    }).success).toBe(false)
    expect(lifecycleBlockerSchema.safeParse({
      code: 'deterministic_duplicate', message: 'Already exists.', conflictingResourceId: jobId,
    }).success).toBe(false)
    expect(lifecycleBlockerSchema.safeParse({
      code: 'deterministic_duplicate', message: 'Already exists.',
      conflictingResourceId: jobId, allowedDuplicateResolutions: ['attach', 'merge'],
    }).success).toBe(true)
  })

  it('uses structured normalized identities in bounded audit evidence', () => {
    const identity = {
      kind: 'ats_job', provider: 'greenhouse', account: 'northstar',
      value: '448', strength: 'strong',
    }
    expect(lifecycleAuditEvidenceSchema.parse({
      actor, timestamp, priorIdentity: { ...identity, provider: 'GreenHouse', account: 'NorthStar' },
      newIdentity: { ...identity, value: '449' },
      override: { actor, rationale: 'Reviewed the weak match.', warningCodes: ['weak_possible_match'] },
    }).priorIdentity).toEqual({ ...identity, provider: 'greenhouse', account: 'northstar' })
    expect(lifecycleAuditEvidenceSchema.safeParse({ actor, timestamp, priorIdentity: 'greenhouse:448' }).success).toBe(false)
    expect(lifecycleAuditEvidenceSchema.safeParse({
      actor, timestamp, override: { actor, rationale: 'Missing codes.', warningCodes: [] },
    }).success).toBe(false)
    expect(lifecycleAuditEvidenceSchema.safeParse({
      actor, timestamp, priorIdentity: { ...identity, kind: 'unsupported_identity' },
    }).success).toBe(false)
    expect(lifecycleAuditEvidenceSchema.safeParse({
      actor, timestamp, newIdentity: { ...identity, account: null },
    }).success).toBe(false)
  })

  it('requires audit on every successful mutation and explicit restore link state', () => {
    expect(captureMutationResultSchema.safeParse({ status: 'succeeded', resource: validCapture }).success).toBe(false)
    expect(restoreResultSchema.safeParse({ status: 'restored', id: 'capture-1', restoredAt: timestamp }).success).toBe(false)
    expect(captureMutationResultSchema.safeParse({
      status: 'succeeded', resource: validCapture, duplicateResolution: null,
      audit: { actor, timestamp, targetId: validCapture.id, newRevision: 1 },
    }).success).toBe(true)
    expect(removalResultSchema.safeParse({
      status: 'removed', id: validCapture.id, choice: 'preserve_historical_lineage',
      removedAt: timestamp, affectedDependentIds: ['opportunity-1'], audit: { actor, timestamp },
    }).success).toBe(true)
    expect(restoreResultSchema.safeParse({
      status: 'restored', id: validCapture.id, restoredAt: timestamp,
      dependentLinks: [{ dependentId: 'opportunity-1', state: 'remained_tombstoned' }],
      audit: { actor, timestamp },
    }).success).toBe(true)
  })

  it('recursively rejects secret-like Capture evidence keys', () => {
    expect(captureSchema.safeParse({
      ...validCapture, payload: { nested: { token: 'do-not-store' } },
    }).success).toBe(false)
    expect(captureSchema.safeParse({
      ...validCapture, evidence: [{ kind: 'page', label: 'Page', value: [{ headers: { authorization: 'unsafe' } }] }],
    }).success).toBe(false)
  })

  it('bounds list pages and exposes direct lineage-safe create schemas', () => {
    expect(captureListResultSchema.safeParse({ items: [], limit: 25, nextCursor: null }).success).toBe(true)
    expect(captureListResultSchema.safeParse({ items: [validCapture, { ...validCapture, id: 'capture-2' }], limit: 1, nextCursor: null }).success).toBe(false)
    expect(createJobInputSchema.safeParse({
      idempotencyKey: 'manual-job-1', actor, facts,
      availability: { state: 'open', observedAt: timestamp },
      evidenceReferences: [{ captureId: 'capture-1', captureRevision: 1, evidenceIndexes: [] }],
      externalIdentities: [],
    }).success).toBe(true)
    expect(createOpportunityInputSchema.safeParse({
      idempotencyKey: 'manual-opportunity-1', actor, jobId, expectedJobFactsRevision: 1,
      fit: 'possible', rank: null, cutoff: 'not_evaluated', disposition: 'reviewing',
    }).success).toBe(true)
    expect(createApplicationInputSchema.safeParse({
      idempotencyKey: 'manual-application-1', actor, opportunityId: 'opportunity-1', jobId,
      expectedJobFactsRevision: 1, initialLinks: [],
    }).success).toBe(true)
    expect(createJobInputSchema.safeParse({
      idempotencyKey: 'manual-job-1', actor, facts,
      availability: { state: 'open', observedAt: timestamp },
      evidenceReferences: [{ captureId: 'capture-1', captureRevision: 1, evidenceIndexes: [] }],
      externalIdentities: [], duplicateResolution: { action: 'replace', targetResourceId: jobId },
    }).success).toBe(false)
    expect(createJobInputSchema.safeParse({
      idempotencyKey: 'manual-job-1', actor, facts,
      availability: { state: 'open', observedAt: timestamp },
      evidenceReferences: [{ captureId: 'capture-1', captureRevision: 1, evidenceIndexes: [] }],
      externalIdentities: [], duplicateResolution: { action: 'attach', targetResourceId: 'job-1' },
    }).success).toBe(false)
  })

  it('rejects history entries whose aggregate identity contradicts the snapshot', () => {
    const audit = { actor, timestamp }
    const cases = [
      [captureRevisionSchema, 'captureId', {
        captureId: 'capture-other', revision: 1, kind: 'created', snapshot: validCapture, audit,
      }],
      [jobHistoryEntrySchema, 'jobId', {
        jobId: '018f6f88-4c35-7a62-9f2e-318dd8e164c6', sequence: 1,
        kind: 'created', snapshot: validJob, audit,
      }],
      [opportunityHistoryEntrySchema, 'opportunityId', {
        opportunityId: 'opportunity-other', revision: 1, kind: 'created', snapshot: validOpportunity, audit,
      }],
      [applicationHistoryEntrySchema, 'applicationId', {
        applicationId: 'application-other', revision: 1, kind: 'created', snapshot: validApplication, audit,
      }],
    ] as const
    for (const [schema, idKey, entry] of cases) {
      expect(schema.safeParse(entry).success).toBe(false)
      expect(schema.safeParse({ ...entry, [idKey]: entry.snapshot.id }).success).toBe(true)
    }
  })

  it('publishes resource-specific Opportunity and Application identity schemas', () => {
    expect(opportunityIdSchema.parse(opportunityId)).toBe(opportunityId)
    expect(applicationIdSchema.parse(applicationId)).toBe(applicationId)
  })

  it('rejects inapplicable or contradictory duplicate outcomes in concrete result schemas', () => {
    const result = {
      status: 'succeeded', resource: validJob,
      duplicateResolution: { action: 'attach', targetResourceId: 'job-1' },
      audit: { actor, timestamp },
    }
    expect(jobMutationResultSchema.safeParse(result).success).toBe(false)
    expect(jobMutationResultSchema.safeParse({
      ...result,
      duplicateResolution: {
        action: 'attach', targetResourceId: '018f6f88-4c35-7a62-9f2e-318dd8e164c6',
      },
    }).success).toBe(false)
  })

  it('carries warning overrides and applied duplicate outcomes through promotions', () => {
    expect(promoteCaptureToJobInputSchema.shape.override).toBeDefined()
    const override = { actor, rationale: 'Reviewed weak match.', warningCodes: ['weak_possible_match'] as const }
    const success = {
      status: 'promoted',
      resource: validCapture,
      created: false,
      warnings: [{ code: 'weak_possible_match', message: 'Weak possible match.' }],
      override,
      duplicateResolution: { action: 'attach', targetResourceId: validCapture.id },
      audit: { actor, timestamp, override },
    } as const
    expect(promotionResultSchema(captureSchema).safeParse(success).success).toBe(true)
    expect(promotionResultSchema(captureSchema).safeParse({
      ...success, audit: { actor, timestamp },
    }).success).toBe(false)
    expect(applicationMutationResultSchema).toBeDefined()
  })
})
