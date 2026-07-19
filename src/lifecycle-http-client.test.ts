import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHttpValedictorianClient } from './index.js'

const capture = {
  id: '018f6f88-4c35-7a62-9f2e-318dd8e164c4', workspaceId: 'workspace-north', evidenceMode: 'reported',
  adapter: { id: 'manual-entry', kind: 'manual', version: '1.0.0' },
  observedAt: '2026-07-17T15:30:00.000Z', receivedAt: '2026-07-17T15:31:00.000Z',
  providerRecordId: null, providerSchema: null, payload: { title: 'Controls Intern' }, evidence: [], revision: 1,
  createdAt: '2026-07-17T15:31:00.000Z', updatedAt: '2026-07-17T15:31:00.000Z', removedAt: null,
} as const

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

describe('lifecycle HTTP workspace client', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('uses explicit workspace Capture routes and strictly parses the public resource', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      .mockResolvedValueOnce(jsonResponse({ items: [capture], nextCursor: null }))
      .mockResolvedValueOnce(jsonResponse(capture))
    vi.stubGlobal('fetch', fetchMock)
    const workspace = createHttpValedictorianClient({ baseUrl: 'https://api.example' })
      .forWorkspace('workspace north')

    await expect(workspace.captures.list({ evidenceMode: 'reported', limit: 20 }))
      .resolves.toEqual({ items: [capture], nextCursor: null })
    await expect(workspace.captures.get(capture.id)).resolves.toEqual(capture)

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.example/v1/workspaces/workspace%20north/captures?evidenceMode=reported&limit=20',
      expect.objectContaining({ method: 'GET' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `https://api.example/v1/workspaces/workspace%20north/captures/${capture.id}`,
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
      `https://api.example/v1/workspaces/workspace-north/applications/${applicationId}/company`,
      `https://api.example/v1/workspaces/workspace-north/applications/${applicationId}/source`,
      `https://api.example/v1/workspaces/workspace-north/applications/${applicationId}/links`,
      `https://api.example/v1/workspaces/workspace-north/applications/${applicationId}/links/link-company`,
      `https://api.example/v1/workspaces/workspace-north/applications/${applicationId}/links/link-company/remove`,
      `https://api.example/v1/workspaces/workspace-north/applications/${applicationId}/snapshot/refresh`,
    ])
  })
})
