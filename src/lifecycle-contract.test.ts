import { describe, expect, it } from 'vitest'
import {
  applicationSchema,
  captureSchema,
  createCaptureInputSchema,
  evidenceModes,
  jobSchema,
  lifecycleBlockerSchema,
  lifecycleWarningSchema,
  opportunitySchema,
  promoteCaptureToJobInputSchema,
  promoteOpportunityToApplicationInputSchema,
  removalResultSchema,
  lifecycleAuditEvidenceSchema,
  type Capture,
} from './index.js'

describe('public sourcing lifecycle contract', () => {
  it('represents an immutable Capture with attributable corrections and tombstones', () => {
    const capture: Capture = {
      id: '018f6f88-4c35-7a62-9f2e-318dd8e164c4',
      workspaceId: 'workspace-north',
      evidenceMode: 'reported',
      adapter: { id: 'campus-feed', kind: 'import', version: '2.1.0' },
      observedAt: '2026-07-17T15:30:00.000Z',
      receivedAt: '2026-07-17T15:31:00.000Z',
      providerRecordId: 'opening-448',
      providerSchema: 'campus-opening/v2',
      payload: { employer: 'Northstar Robotics', title: 'Controls Intern' },
      evidence: [{ kind: 'posting_url', label: 'Listing', value: 'https://northstar.example/jobs/448' }],
      revision: 1,
      createdAt: '2026-07-17T15:31:00.000Z',
      updatedAt: '2026-07-17T15:31:00.000Z',
      removedAt: null,
    }

    expect(evidenceModes).toEqual(['reported', 'ats_details_provided'])
    expect(captureSchema.parse(capture)).toEqual(capture)
    expect(captureSchema.safeParse({ ...capture, evidenceMode: 'retrievable' }).success).toBe(false)
    expect(captureSchema.safeParse({ ...capture, payload: { token: 'secret' }, unexpected: true }).success).toBe(false)
    const { receivedAt: _serverReceipt, ...evidence } = capture
    const createInput = {
      evidenceMode: evidence.evidenceMode, adapter: evidence.adapter, observedAt: evidence.observedAt,
      providerRecordId: evidence.providerRecordId, providerSchema: evidence.providerSchema,
      payload: evidence.payload, evidence: evidence.evidence,
    }
    expect(createCaptureInputSchema.parse(createInput)).toEqual(createInput)
    expect(createCaptureInputSchema.safeParse({ ...createInput, receivedAt: capture.receivedAt }).success).toBe(false)
  })

  it('keeps canonical Job facts referenced by Opportunity and deliberately copied by Application', () => {
    const facts = {
      companyName: 'Northstar Robotics', roleTitle: 'Controls Intern', sourceName: 'Campus Network',
      roleKind: 'internship' as const, term: 'Fall 2026', terms: [{ season: 'fall' as const, year: 2026 }],
      timingMode: 'fixed' as const, startDate: '2026-09-01', endDate: '2026-12-18',
      location: { display: 'Boulder, CO', city: 'Boulder', region: 'CO', country: 'US' },
      workMode: 'hybrid' as const, employmentType: 'internship' as const, seniority: 'student' as const,
      compensation: null, postedAt: '2026-07-16',
      destination: { class: 'employer_or_ats' as const, url: 'https://northstar.example/jobs/448' },
    }
    const job = {
      id: '018f6f88-4c35-7a62-9f2e-318dd8e164c5', workspaceId: 'workspace-north',
      factsRevision: 2, facts, availabilityRevision: 1,
      availability: { state: 'open' as const, observedAt: '2026-07-17T15:30:00.000Z' },
      externalIdentities: [{ kind: 'ats_job' as const, provider: 'greenhouse', account: 'northstar', value: '448', strength: 'strong' as const }],
      captureEvidenceReferences: [{ captureId: '018f6f88-4c35-7a62-9f2e-318dd8e164c4', captureRevision: 1, evidenceIndexes: [0] }],
      createdAt: '2026-07-17T15:32:00.000Z', updatedAt: '2026-07-17T15:34:00.000Z', removedAt: null,
    }
    const opportunity = {
      id: '018f6f88-4c35-7a62-9f2e-318dd8e164c6', workspaceId: 'workspace-north',
      jobId: job.id, revision: 1, fit: 'fit' as const, rank: 2, cutoff: 'above' as const,
      disposition: 'reviewing' as const, override: null,
      createdAt: '2026-07-17T15:35:00.000Z', updatedAt: '2026-07-17T15:35:00.000Z', removedAt: null,
    }
    const application = {
      id: '018f6f88-4c35-7a62-9f2e-318dd8e164c7', workspaceId: 'workspace-north',
      opportunityId: opportunity.id, jobId: job.id, revision: 1, status: 'active' as const,
      snapshot: {
        jobFactsRevision: 2, capturedAt: '2026-07-17T15:36:00.000Z',
        companyName: facts.companyName, roleTitle: facts.roleTitle, sourceName: facts.sourceName,
        roleKind: facts.roleKind, term: facts.term, terms: facts.terms, timingMode: facts.timingMode,
        startDate: facts.startDate, endDate: facts.endDate, location: facts.location,
        workMode: facts.workMode, initialDestination: facts.destination,
        initialLinks: [{ kind: 'application', label: 'Apply', url: facts.destination.url }],
      },
      companyName: facts.companyName, sourceName: facts.sourceName,
      links: [{ id: 'link-1', kind: 'application', label: 'Apply', url: facts.destination.url, isPrimary: true }],
      createdAt: '2026-07-17T15:36:00.000Z', updatedAt: '2026-07-17T15:36:00.000Z', removedAt: null,
    }

    expect(jobSchema.parse(job)).toEqual(job)
    expect(opportunitySchema.parse(opportunity)).toEqual(opportunity)
    expect(opportunitySchema.safeParse({ ...opportunity, companyName: facts.companyName }).success).toBe(false)
    expect(applicationSchema.parse(application)).toEqual(application)
  })

  it('closes blocker and warning codes and requires bounded warning overrides', () => {
    expect(lifecycleBlockerSchema.parse({
      code: 'deterministic_duplicate', message: 'This opening already exists.',
      conflictingResourceId: 'job-existing', allowedDuplicateResolutions: ['attach', 'merge'],
    }).code).toBe('deterministic_duplicate')
    expect(lifecycleBlockerSchema.safeParse({ code: 'unknown_failure', message: 'No.' }).success).toBe(false)
    expect(lifecycleWarningSchema.safeParse({ code: 'weak_possible_match', message: 'Review identity.' }).success).toBe(true)
    expect(promoteOpportunityToApplicationInputSchema.safeParse({
      opportunityId: '018f6f88-4c35-7a62-9f2e-318dd8e164c6',
      expectedJobId: '018f6f88-4c35-7a62-9f2e-318dd8e164c5',
      actor: { id: 'user-7', type: 'user' },
      override: { actor: { id: 'user-7', type: 'user' }, rationale: '', warningCodes: ['cutoff'] },
    }).success).toBe(false)
  })

  it('defines lineage-bound, idempotent promotion commands without accepting copied raw evidence', () => {
    const promotion = {
      captureId: '018f6f88-4c35-7a62-9f2e-318dd8e164c4', captureRevision: 1,
      idempotencyKey: 'normalize-opening-448-v1', actor: { id: 'normalizer', type: 'agent' as const },
      selectedFacts: {
        companyName: 'Northstar Robotics', roleTitle: 'Controls Intern', sourceName: 'Campus Network',
        roleKind: 'internship' as const, term: null, terms: [], timingMode: 'unknown' as const,
        startDate: null, endDate: null, location: null, workMode: 'unknown' as const,
        employmentType: 'internship' as const, seniority: 'student' as const, compensation: null,
        postedAt: null, destination: null,
      },
      evidenceReferences: [{ captureId: '018f6f88-4c35-7a62-9f2e-318dd8e164c4', captureRevision: 1, evidenceIndexes: [] }],
      externalIdentities: [],
    }
    expect(promoteCaptureToJobInputSchema.parse(promotion)).toEqual(promotion)
    expect(promoteCaptureToJobInputSchema.safeParse({ ...promotion, rawPayload: { title: 'Controls Intern' } }).success).toBe(false)
  })

  it('makes unsupported removal choices and sanitized audit evidence explicit', () => {
    const blocked = {
      status: 'blocked' as const,
      id: '018f6f88-4c35-7a62-9f2e-318dd8e164c5',
      blocker: { code: 'impossible_state' as const, message: 'Applications cannot unlink their Job lineage.' },
      supportedChoices: ['reject_if_dependents', 'preserve_historical_lineage'],
      dependentIds: ['018f6f88-4c35-7a62-9f2e-318dd8e164c7'],
    }
    expect(removalResultSchema.parse(blocked)).toEqual(blocked)
    expect(lifecycleAuditEvidenceSchema.safeParse({
      actor: { id: 'user-7', type: 'user' }, timestamp: '2026-07-17T15:40:00.000Z',
      sourceId: 'capture-1', targetId: 'job-1', priorRevision: 1, newRevision: 2,
      payload: { authorization: 'unsafe' },
    }).success).toBe(false)
  })
})
