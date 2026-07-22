import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHttpValedictorianClient } from './index.js'

const capture = {
  id: '018f6f88-4c35-7a62-9f2e-318dd8e164c4', workspaceId: 'workspace-north', evidenceMode: 'reported',
  adapter: { id: 'manual-entry', kind: 'manual', version: '1.0.0' },
  observedAt: '2026-07-17T15:30:00.000Z', receivedAt: '2026-07-17T15:31:00.000Z',
  providerRecordId: null, providerSchema: null, payload: { title: 'Controls Intern' }, evidence: [], revision: 1,
  createdAt: '2026-07-17T15:31:00.000Z', updatedAt: '2026-07-17T15:31:00.000Z', removedAt: null,
} as const

const timestamp = '2026-07-18T15:00:00.000Z'
const lifecycleActor = { id: 'user-7', type: 'user' as const }
const jobId = '018f6f88-4c35-7a62-9f2e-318dd8e164c5'
const otherJobId = '018f6f88-4c35-7a62-9f2e-318dd8e164c6'
const jobFacts = {
  companyName: 'Northstar Robotics', roleTitle: 'Controls Intern', sourceName: 'Campus Network',
  roleKind: 'internship' as const, term: null, terms: [], timingMode: 'unknown' as const,
  startDate: null, endDate: null, location: null, workMode: 'unknown' as const,
  employmentType: 'internship' as const, seniority: 'student' as const,
  compensation: null, postedAt: null, destination: null,
}
const job = {
  id: jobId, workspaceId: 'workspace-north', factsRevision: 1, facts: jobFacts,
  availabilityRevision: 1, availability: { state: 'open' as const, observedAt: timestamp },
  externalIdentities: [],
  captureEvidenceReferences: [{ captureId: capture.id, captureRevision: 1, evidenceIndexes: [] }],
  createdAt: timestamp, updatedAt: timestamp, removedAt: null,
}
const application = {
  id: 'application-1', workspaceId: 'workspace-north', opportunityId: 'opportunity-1', jobId,
  revision: 1, status: 'active' as const,
  snapshot: {
    jobFactsRevision: 1, capturedAt: timestamp, companyName: jobFacts.companyName,
    roleTitle: jobFacts.roleTitle, sourceName: jobFacts.sourceName, roleKind: jobFacts.roleKind,
    term: jobFacts.term, terms: jobFacts.terms, timingMode: jobFacts.timingMode,
    startDate: jobFacts.startDate, endDate: jobFacts.endDate, location: jobFacts.location,
    workMode: jobFacts.workMode, initialDestination: jobFacts.destination, initialLinks: [],
  },
  companyName: jobFacts.companyName, sourceName: jobFacts.sourceName, links: [],
  createdAt: timestamp, updatedAt: timestamp, removedAt: null,
}

function jobCreateInput() {
  return {
    idempotencyKey: 'manual-job-1', actor: lifecycleActor, facts: jobFacts,
    availability: job.availability, evidenceReferences: job.captureEvidenceReferences,
    externalIdentities: [],
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

describe('lifecycle HTTP workspace client', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('uses explicit workspace Capture routes and strictly parses the public resource', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      .mockResolvedValueOnce(jsonResponse({ items: [capture], limit: 20, nextCursor: null }))
      .mockResolvedValueOnce(jsonResponse(capture))
    vi.stubGlobal('fetch', fetchMock)
    const workspace = createHttpValedictorianClient({ baseUrl: 'https://api.example' })
      .forWorkspace('workspace-north')

    await expect(workspace.captures.list({ evidenceMode: 'reported', limit: 20 }))
      .resolves.toEqual({ items: [capture], limit: 20, nextCursor: null })
    await expect(workspace.captures.get(capture.id)).resolves.toEqual(capture)

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.example/v1/workspaces/workspace-north/captures?evidenceMode=reported&limit=20',
      expect.objectContaining({ method: 'GET' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `https://api.example/v1/workspaces/workspace-north/captures/${capture.id}`,
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('serializes connectorRunId as a percent-encoded query parameter with existing filters', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      .mockResolvedValueOnce(jsonResponse({ items: [capture], limit: 25, nextCursor: null }))
    vi.stubGlobal('fetch', fetchMock)
    const workspace = createHttpValedictorianClient({ baseUrl: 'https://api.example' })
      .forWorkspace('workspace-north')

    await expect(
      workspace.captures.list({
        evidenceMode: 'reported',
        adapterId: 'manual-entry',
        connectorRunId: 'connector-run/one',
        includeRemoved: false,
        limit: 25,
        cursor: 'capture-cursor',
      }),
    ).resolves.toEqual({ items: [capture], limit: 25, nextCursor: null })

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.example/v1/workspaces/workspace-north/captures'
        + '?evidenceMode=reported&adapterId=manual-entry&connectorRunId=connector-run%2Fone'
        + '&includeRemoved=false&limit=25&cursor=capture-cursor',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('routes all three promotions and explicit Application edits without a legacy sourcing hop', async () => {
    const blocked = {
      status: 'blocked',
      blocker: { code: 'impossible_state', message: 'Unavailable in this worked example.' },
    }
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      .mockImplementation(async () => jsonResponse(blocked))
    vi.stubGlobal('fetch', fetchMock)
    const workspace = createHttpValedictorianClient({ baseUrl: 'https://api.example' })
      .forWorkspace('workspace-north')
    const actor = { id: 'user-7', type: 'user' as const }
    const captureId = 'capture-glacier-19'
    const jobId = '018f6f88-4c35-7a62-9f2e-318dd8e164c5'
    const opportunityId = 'opportunity-glacier-19'
    const applicationId = 'application-glacier-19'
    const selectedFacts = {
      companyName: 'Glacier Analytics', roleTitle: 'Data Engineering Co-op', sourceName: 'Career Fair',
      roleKind: 'co_op' as const, term: 'Winter 2027', terms: [{ season: 'winter' as const, year: 2027 }],
      timingMode: 'fixed' as const, startDate: '2027-01-04', endDate: '2027-04-30',
      location: { display: 'Calgary, AB', city: 'Calgary', region: 'AB', country: 'CA' },
      workMode: 'hybrid' as const, employmentType: 'temporary' as const,
      seniority: 'student' as const, compensation: null, postedAt: '2026-07-18',
      destination: { class: 'employer_or_ats' as const, url: 'https://glacier.example/careers/19' },
    }

    await workspace.captures.promoteToJob({
      captureId, captureRevision: 1, idempotencyKey: 'capture-job-19', actor,
      selectedFacts,
      evidenceReferences: [{ captureId, captureRevision: 1, evidenceIndexes: [] }],
      externalIdentities: [],
    })
    await workspace.jobs.promoteToOpportunity({
      jobId, expectedFactsRevision: 1, idempotencyKey: 'job-opportunity-19', actor,
      evaluation: { fit: 'fit', rank: 1, cutoff: 'above', disposition: 'reviewing' },
    })
    await workspace.opportunities.promoteToApplication({
      opportunityId, expectedJobId: jobId, idempotencyKey: 'opportunity-application-19', actor,
      initialLinks: [{ kind: 'application', label: 'Apply', url: 'https://glacier.example/careers/19' }],
    })
    await workspace.jobs.create({
      idempotencyKey: 'direct-job-19', actor, facts: selectedFacts,
      availability: { state: 'open', observedAt: timestamp },
      evidenceReferences: [{ captureId, captureRevision: 1, evidenceIndexes: [] }],
      externalIdentities: [],
    })
    await workspace.opportunities.create({
      idempotencyKey: 'direct-opportunity-19', actor, jobId, expectedJobFactsRevision: 1,
      fit: 'fit', rank: 1, cutoff: 'above', disposition: 'reviewing',
    })
    await workspace.applications.create({
      idempotencyKey: 'direct-application-19', actor, opportunityId, jobId,
      expectedJobFactsRevision: 1, initialLinks: [],
    })
    await workspace.applications.updateCompany({
      applicationId, expectedRevision: 1, actor, companyName: 'Glacier Analytics Ltd.',
      rationale: 'Match the application portal.',
    })
    await workspace.applications.updateSource({
      applicationId, expectedRevision: 2, actor, sourceName: 'University Career Fair',
      rationale: 'Use the attributable source.',
    })
    await workspace.applications.links.create({
      applicationId, expectedRevision: 3, actor, primary: false,
      link: { kind: 'company', label: 'Company', url: 'https://glacier.example' },
    })
    await workspace.applications.links.update({
      applicationId, expectedRevision: 4, actor, linkId: 'link-company', primary: true,
      link: { kind: 'company', label: 'Employer site', url: 'https://glacier.example/about' },
    })
    await workspace.applications.links.remove({
      applicationId, expectedRevision: 5, actor, linkId: 'link-company',
      rationale: 'Link no longer applies.',
    })
    await workspace.applications.refreshSnapshot({
      applicationId, expectedRevision: 6, expectedJobFactsRevision: 2, actor,
      preserveCompanyEdit: true, preserveSourceEdit: true, preserveLinkEdits: true,
      rationale: 'Adopt the corrected timing while preserving pursuit edits.',
    })

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      `https://api.example/v1/workspaces/workspace-north/captures/${captureId}/promote-to-job`,
      `https://api.example/v1/workspaces/workspace-north/jobs/${jobId}/promote-to-opportunity`,
      `https://api.example/v1/workspaces/workspace-north/opportunities/${opportunityId}/promote-to-application`,
      'https://api.example/v1/workspaces/workspace-north/jobs',
      'https://api.example/v1/workspaces/workspace-north/opportunities',
      'https://api.example/v1/workspaces/workspace-north/applications',
      `https://api.example/v1/workspaces/workspace-north/applications/${applicationId}/company`,
      `https://api.example/v1/workspaces/workspace-north/applications/${applicationId}/source`,
      `https://api.example/v1/workspaces/workspace-north/applications/${applicationId}/links`,
      `https://api.example/v1/workspaces/workspace-north/applications/${applicationId}/links/link-company`,
      `https://api.example/v1/workspaces/workspace-north/applications/${applicationId}/links/link-company/remove`,
      `https://api.example/v1/workspaces/workspace-north/applications/${applicationId}/snapshot/refresh`,
    ])
  })

  it('rejects foreign workspace and wrong-id lifecycle responses', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      .mockResolvedValueOnce(jsonResponse({ items: [{ ...capture, workspaceId: 'workspace-foreign' }], limit: 25, nextCursor: null }))
      .mockResolvedValueOnce(jsonResponse({ ...capture, id: 'capture-other' }))
    vi.stubGlobal('fetch', fetchMock)
    const captures = createHttpValedictorianClient({ baseUrl: 'https://api.example' })
      .forWorkspace('workspace-north').captures

    await expect(captures.list()).rejects.toThrow()
    await expect(captures.get(capture.id)).rejects.toThrow()
  })

  it('parses audited direct creates and preserves idempotency, overrides, and duplicate decisions', async () => {
    const override = {
      actor: lifecycleActor, rationale: 'Reviewed the weak match.',
      warningCodes: ['weak_possible_match'] as const,
    }
    const duplicateResolution = { action: 'attach' as const, targetResourceId: jobId }
    const input = { ...jobCreateInput(), override, duplicateResolution }
    const result = {
      status: 'succeeded', resource: job, duplicateResolution,
      audit: { actor: lifecycleActor, timestamp, override },
    }
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      .mockResolvedValueOnce(jsonResponse(result))
    vi.stubGlobal('fetch', fetchMock)
    const jobs = createHttpValedictorianClient({ baseUrl: 'https://api.example' })
      .forWorkspace('workspace-north').jobs

    await expect(jobs.create(input)).resolves.toEqual(result)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example/v1/workspaces/workspace-north/jobs',
      expect.objectContaining({ body: JSON.stringify(input), method: 'POST' }),
    )
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).not.toHaveProperty('workspaceId')
  })

  it('rejects drifted promotion revisions, direct-create lineage, and applied choices', async () => {
    const mismatchedRevisionJob = {
      ...job,
      captureEvidenceReferences: [{ captureId: capture.id, captureRevision: 2, evidenceIndexes: [] }],
    }
    const promotion = {
      status: 'promoted', resource: mismatchedRevisionJob, created: true, warnings: [],
      override: null, duplicateResolution: null, audit: { actor: lifecycleActor, timestamp },
    }
    const lineageMismatch = {
      status: 'succeeded', resource: mismatchedRevisionJob, duplicateResolution: null,
      audit: { actor: lifecycleActor, timestamp },
    }
    const unexpectedDuplicate = {
      status: 'succeeded', resource: job,
      duplicateResolution: { action: 'merge', targetResourceId: jobId },
      audit: { actor: lifecycleActor, timestamp },
    }
    const driftedOverride = {
      actor: lifecycleActor, rationale: 'A different rationale.',
      warningCodes: ['weak_possible_match'] as const,
    }
    const overrideResult = {
      status: 'succeeded', resource: job, duplicateResolution: null,
      audit: { actor: lifecycleActor, timestamp, override: driftedOverride },
    }
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      .mockResolvedValueOnce(jsonResponse(promotion))
      .mockResolvedValueOnce(jsonResponse(lineageMismatch))
      .mockResolvedValueOnce(jsonResponse(unexpectedDuplicate))
      .mockResolvedValueOnce(jsonResponse(overrideResult))
    vi.stubGlobal('fetch', fetchMock)
    const workspace = createHttpValedictorianClient({ baseUrl: 'https://api.example' })
      .forWorkspace('workspace-north')

    await expect(workspace.captures.promoteToJob({
      captureId: capture.id, captureRevision: 1, idempotencyKey: 'promote-1', actor: lifecycleActor,
      selectedFacts: jobFacts, evidenceReferences: job.captureEvidenceReferences, externalIdentities: [],
    })).rejects.toThrow()
    await expect(workspace.jobs.create(jobCreateInput())).rejects.toThrow()
    await expect(workspace.jobs.create(jobCreateInput())).rejects.toThrow()
    await expect(workspace.jobs.create({
      ...jobCreateInput(),
      override: { ...driftedOverride, rationale: 'The requested rationale.' },
    })).rejects.toThrow()
  })

  it('rejects command actor drift, removal choice drift, and duplicate target drift', async () => {
    const systemActor = { id: 'lifecycle-system', type: 'system' as const }
    const actorDrift = {
      status: 'succeeded', resource: job, duplicateResolution: null,
      audit: { actor: systemActor, timestamp },
    }
    const choiceDrift = {
      status: 'removed', id: capture.id, choice: 'unlink_dependents', removedAt: timestamp,
      affectedDependentIds: [], audit: { actor: lifecycleActor, timestamp },
    }
    const targetDrift = {
      status: 'succeeded', resource: { ...job, id: otherJobId },
      duplicateResolution: { action: 'attach', targetResourceId: jobId },
      audit: { actor: lifecycleActor, timestamp },
    }
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      .mockResolvedValueOnce(jsonResponse(actorDrift))
      .mockResolvedValueOnce(jsonResponse(choiceDrift))
      .mockResolvedValueOnce(jsonResponse(targetDrift))
    vi.stubGlobal('fetch', fetchMock)
    const workspace = createHttpValedictorianClient({ baseUrl: 'https://api.example' })
      .forWorkspace('workspace-north')

    await expect(workspace.jobs.create(jobCreateInput())).rejects.toThrow()
    await expect(workspace.captures.remove({
      id: capture.id, choice: 'preserve_historical_lineage', actor: lifecycleActor, rationale: 'Duplicate.',
    })).rejects.toThrow()
    await expect(workspace.jobs.create({
      ...jobCreateInput(), duplicateResolution: { action: 'attach', targetResourceId: jobId },
    })).rejects.toThrow()
  })

  it('correlates direct Application create and snapshot refresh to the exact Job facts revision', async () => {
    const successCreate = {
      status: 'succeeded', resource: application, duplicateResolution: null,
      audit: { actor: lifecycleActor, timestamp },
    }
    const driftedCreate = {
      ...successCreate, resource: { ...application, snapshot: { ...application.snapshot, jobFactsRevision: 2 } },
    }
    const refreshed = {
      ...application, revision: 2, snapshot: { ...application.snapshot, jobFactsRevision: 2 },
    }
    const successRefresh = {
      status: 'succeeded', resource: refreshed, duplicateResolution: null,
      audit: { actor: lifecycleActor, timestamp },
    }
    const driftedRefresh = {
      ...successRefresh, resource: { ...refreshed, snapshot: { ...refreshed.snapshot, jobFactsRevision: 3 } },
    }
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      .mockResolvedValueOnce(jsonResponse(successCreate))
      .mockResolvedValueOnce(jsonResponse(driftedCreate))
      .mockResolvedValueOnce(jsonResponse(successRefresh))
      .mockResolvedValueOnce(jsonResponse(driftedRefresh))
    vi.stubGlobal('fetch', fetchMock)
    const applications = createHttpValedictorianClient({ baseUrl: 'https://api.example' })
      .forWorkspace('workspace-north').applications
    const createInput = {
      idempotencyKey: 'application-create-1', actor: lifecycleActor,
      opportunityId: application.opportunityId, jobId, expectedJobFactsRevision: 1, initialLinks: [],
    }

    await expect(applications.create(createInput)).resolves.toEqual(successCreate)
    await expect(applications.create(createInput)).rejects.toThrow()
    await expect(applications.refreshSnapshot({
      applicationId: application.id, expectedRevision: 1, expectedJobFactsRevision: 2,
      actor: lifecycleActor, preserveCompanyEdit: true, preserveSourceEdit: true,
      preserveLinkEdits: true, rationale: 'Adopt corrected facts.',
    })).resolves.toEqual(successRefresh)
    await expect(applications.refreshSnapshot({
      applicationId: application.id, expectedRevision: 1, expectedJobFactsRevision: 2,
      actor: lifecycleActor, preserveCompanyEdit: true, preserveSourceEdit: true,
      preserveLinkEdits: true, rationale: 'Adopt corrected facts.',
    })).rejects.toThrow()
  })

  it('parses audited removal, restore, and history responses with bounded request bodies', async () => {
    const audit = { actor: lifecycleActor, timestamp }
    const removed = {
      status: 'removed', id: capture.id, choice: 'preserve_historical_lineage', removedAt: timestamp,
      affectedDependentIds: ['opportunity-1'], audit,
    }
    const restored = {
      status: 'restored', id: capture.id, restoredAt: timestamp,
      dependentLinks: [{ dependentId: 'opportunity-1', state: 'remained_unlinked' }], audit,
    }
    const history = {
      items: [{ captureId: capture.id, revision: 1, kind: 'created', snapshot: capture, audit }],
      limit: 10, nextCursor: null,
    }
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      .mockResolvedValueOnce(jsonResponse(removed))
      .mockResolvedValueOnce(jsonResponse(restored))
      .mockResolvedValueOnce(jsonResponse(history))
    vi.stubGlobal('fetch', fetchMock)
    const captures = createHttpValedictorianClient({ baseUrl: 'https://api.example' })
      .forWorkspace('workspace-north').captures

    await expect(captures.remove({
      id: capture.id, choice: 'preserve_historical_lineage', actor: lifecycleActor, rationale: 'Duplicate.',
    })).resolves.toEqual(removed)
    await expect(captures.restore({
      id: capture.id, actor: lifecycleActor, rationale: 'Removal was mistaken.',
    })).resolves.toEqual(restored)
    await expect(captures.history({ id: capture.id, limit: 10 })).resolves.toEqual(history)
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).not.toHaveProperty('id')
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).not.toHaveProperty('id')
  })

  it('rejects contradictory history lineage even when the snapshot matches the requested resource', async () => {
    const history = {
      items: [{ captureId: 'capture-other', revision: 1, kind: 'created', snapshot: capture,
        audit: { actor: lifecycleActor, timestamp } }],
      limit: 10, nextCursor: null,
    }
    vi.stubGlobal('fetch', vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      .mockResolvedValueOnce(jsonResponse(history)))
    const captures = createHttpValedictorianClient({ baseUrl: 'https://api.example' })
      .forWorkspace('workspace-north').captures

    await expect(captures.history({ id: capture.id, limit: 10 })).rejects.toThrow()
  })

  it('rejects foreign-workspace Application attempts and events', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      .mockResolvedValueOnce(jsonResponse({
        items: [{ id: 'attempt-1', workspaceId: 'workspace-foreign', applicationId: 'application-1',
          state: 'pending', startedAt: timestamp, completedAt: null, summary: null }],
        limit: 25, nextCursor: null,
      }))
      .mockResolvedValueOnce(jsonResponse({
        items: [{ id: 'event-1', workspaceId: 'workspace-foreign', applicationId: 'application-1',
          type: 'started', occurredAt: timestamp, actor: lifecycleActor, summary: 'Started.' }],
        limit: 25, nextCursor: null,
      }))
    vi.stubGlobal('fetch', fetchMock)
    const applications = createHttpValedictorianClient({ baseUrl: 'https://api.example' })
      .forWorkspace('workspace-north').applications

    await expect(applications.attempts.list({ applicationId: 'application-1' })).rejects.toThrow()
    await expect(applications.events.list({ applicationId: 'application-1' })).rejects.toThrow()
  })

  it('exposes only read-only Application attempt and event queries', () => {
    const applications = createHttpValedictorianClient({ baseUrl: 'https://api.example' })
      .forWorkspace('workspace-north').applications
    expect(applications.attempts).toHaveProperty('list')
    expect(applications.attempts).not.toHaveProperty('start')
    expect(applications.events).toHaveProperty('list')
    expect(applications.events).not.toHaveProperty('create')
  })
})
