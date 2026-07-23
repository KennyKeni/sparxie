import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ValedictorianProtocolError,
  companyAssignedJobCursorSchema,
  companyDirectoryCursorSchema,
  companyDuplicateCursorSchema,
  companyHistoryCursorSchema,
  createHttpValedictorianClient,
  valedictorianApiPaths,
} from '../index.js'
import { jsonResponse } from './http-client.test-support.js'

const now = '2026-07-23T12:00:00.000Z'
const actor = { id: 'user-1', type: 'user' as const }
const jobId = '018f6f88-4c35-7a62-9f2e-318dd8e164c5'

function company(id: string, revision: number) {
  return {
    id,
    workspaceId: 'workspace-1',
    displayName: 'Acme',
    aliases: [],
    websiteUrl: null,
    notes: null,
    revision,
    status: 'active' as const,
    mergedIntoCompanyId: null,
    createdAt: now,
    updatedAt: now,
  }
}

describe('Company HTTP client', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('publishes encoded routes without merge undo or split operations', () => {
    expect(valedictorianApiPaths.company('company/1')).toBe('/v1/companies/company%2F1')
    expect(valedictorianApiPaths.companyLookup('company/1')).toBe(
      '/v1/companies/company%2F1/lookup',
    )
    expect(valedictorianApiPaths.companyAlias('company/1', 'alias/1')).toBe(
      '/v1/companies/company%2F1/aliases/alias%2F1',
    )
    expect(valedictorianApiPaths.companyDuplicateMarkDistinct('pair/1')).toBe(
      '/v1/companies/duplicate-candidates/pair%2F1/mark-distinct',
    )
    expect(valedictorianApiPaths.companyMerge).toBe('/v1/companies/merge')
    expect('companySplit' in valedictorianApiPaths).toBe(false)
    expect('companyMergeUndo' in valedictorianApiPaths).toBe(false)
  })

  it('preserves opaque directory cursors and validates requested detail identity', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      .mockResolvedValueOnce(jsonResponse({
        items: [],
        pageInfo: {
          startCursor: null,
          endCursor: null,
          hasPreviousPage: false,
          hasNextPage: false,
        },
        totalCount: 0,
      }))
      .mockResolvedValueOnce(jsonResponse({
        lookup: {
          requested: company('wrong-company', 2),
          canonical: company('wrong-company', 2),
          redirectPath: [],
        },
        assignedJobCount: 0,
        openDuplicateCandidateCount: 0,
        history: { lastEventAt: null, eventCount: 0, recentEvents: [] },
      }))
    vi.stubGlobal('fetch', fetchMock)
    const companies = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    }).forWorkspace('workspace-1').companies

    await companies.directory.list({ before: ' opaque cursor ' })
    await expect(companies.get('company-1')).rejects.toBeInstanceOf(ValedictorianProtocolError)
    expect(new URL(fetchMock.mock.calls[0]![0].toString()).searchParams.get('before'))
      .toBe(' opaque cursor ')
  })

  it('binds workspace and revision correlation for Company writes', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      .mockResolvedValueOnce(jsonResponse({
        status: 'updated',
        workspaceId: 'workspace-1',
        companyId: 'company-1',
        requestCompanyRevision: 2,
        idempotencyKey: 'update-1',
        company: company('company-1', 3),
      }))
      .mockResolvedValueOnce(jsonResponse({
        status: 'updated',
        workspaceId: 'workspace-1',
        companyId: 'company-1',
        requestCompanyRevision: 99,
        idempotencyKey: 'update-2',
        company: company('company-1', 100),
      }))
    vi.stubGlobal('fetch', fetchMock)
    const companies = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    }).forWorkspace('workspace-1').companies

    await expect(companies.update({
      workspaceId: 'workspace-1',
      companyId: 'company-1',
      expectedCompanyRevision: 2,
      actor,
      rationale: 'Correct display name.',
      idempotencyKey: 'update-1',
      displayName: 'Acme',
    })).resolves.toMatchObject({ status: 'updated' })
    await expect(companies.update({
      workspaceId: 'workspace-1',
      companyId: 'company-1',
      expectedCompanyRevision: 3,
      actor,
      rationale: 'Correct display name.',
      idempotencyKey: 'update-2',
      displayName: 'Acme',
    })).rejects.toBeInstanceOf(ValedictorianProtocolError)
    expect(JSON.parse(fetchMock.mock.calls[0]![1]!.body as string)).not
      .toHaveProperty('workspaceId')
  })

  it('keeps assignment reassignment separate and fail-closes correlation', async () => {
    const assignment = {
      jobId,
      assignmentRevision: 4,
      workspaceCompany: {
        companyId: 'company-1',
        revision: 2,
        displayName: 'Acme',
        status: 'active',
      },
      jobFactsCompanyName: 'Legacy Acme',
      roleTitle: 'Engineer',
      namesDiffer: true,
    }
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      .mockResolvedValueOnce(jsonResponse({
        status: 'reassigned',
        workspaceId: 'workspace-1',
        jobId,
        requestAssignmentRevision: 3,
        requestDestinationCompanyRevision: 2,
        idempotencyKey: 'reassign-1',
        assignment,
        jobFactsChanged: false,
      }))
      .mockResolvedValueOnce(jsonResponse({
        status: 'reassigned',
        workspaceId: 'workspace-1',
        jobId,
        requestAssignmentRevision: 3,
        requestDestinationCompanyRevision: 2,
        idempotencyKey: 'reassign-2',
        assignment: {
          ...assignment,
          workspaceCompany: { ...assignment.workspaceCompany, revision: 3 },
        },
        jobFactsChanged: false,
      }))
    vi.stubGlobal('fetch', fetchMock)
    const assignments = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    }).forWorkspace('workspace-1').companyAssignments

    await expect(assignments.reassign({
      workspaceId: 'workspace-1',
      jobId,
      expectedAssignmentRevision: 3,
      destinationCompanyId: 'company-1',
      expectedDestinationCompanyRevision: 2,
      actor,
      rationale: 'Correct the local Company assignment.',
      idempotencyKey: 'reassign-1',
    })).resolves.toMatchObject({ jobFactsChanged: false })
    await expect(assignments.reassign({
      workspaceId: 'workspace-1',
      jobId,
      expectedAssignmentRevision: 3,
      destinationCompanyId: 'company-1',
      expectedDestinationCompanyRevision: 2,
      actor,
      rationale: 'Correct the local Company assignment.',
      idempotencyKey: 'reassign-2',
    })).rejects.toBeInstanceOf(ValedictorianProtocolError)
    expect(fetchMock.mock.calls[0]![0].toString()).toContain(
      `/jobs/${jobId}/company-assignment/reassign`,
    )
  })

  it('rejects a write scoped to another workspace before transport', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    vi.stubGlobal('fetch', fetchMock)
    const companies = createHttpValedictorianClient()
      .forWorkspace('workspace-1').companies
    await expect(companies.archive({
      workspaceId: 'workspace-2',
      companyId: 'company-1',
      expectedCompanyRevision: 2,
      actor,
      rationale: 'No longer active.',
      idempotencyKey: 'archive-1',
    })).rejects.toBeInstanceOf(ValedictorianProtocolError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('uses separate opaque cursor queries for every Company page family', async () => {
    const emptyPage = {
      items: [],
      pageInfo: {
        startCursor: null,
        endCursor: null,
        hasPreviousPage: false,
        hasNextPage: false,
      },
      totalCount: 0,
    }
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    for (let index = 0; index < 4; index += 1) {
      fetchMock.mockResolvedValueOnce(jsonResponse(emptyPage))
    }
    vi.stubGlobal('fetch', fetchMock)
    const companies = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    }).forWorkspace('workspace-1').companies

    await companies.directory.list({
      after: companyDirectoryCursorSchema.parse(' raw directory '),
    })
    await companies.duplicates.list({
      after: companyDuplicateCursorSchema.parse(' raw duplicate '),
    })
    await companies.assignedJobs.list('company-1', {
      after: companyAssignedJobCursorSchema.parse(' raw jobs '),
    })
    await companies.history.list('company-1', {
      after: companyHistoryCursorSchema.parse(' raw history '),
    })

    const urls = fetchMock.mock.calls.map((call) => new URL(call[0].toString()))
    expect(urls.map((url) => url.pathname)).toEqual([
      '/v1/workspaces/workspace-1/companies',
      '/v1/workspaces/workspace-1/companies/duplicate-candidates',
      '/v1/workspaces/workspace-1/companies/company-1/assigned-jobs',
      '/v1/workspaces/workspace-1/companies/company-1/history',
    ])
    expect(urls.map((url) => url.searchParams.get('after'))).toEqual([
      ' raw directory ',
      ' raw duplicate ',
      ' raw jobs ',
      ' raw history ',
    ])
  })

  it('rejects archived rows from active-only search and foreign history events', async () => {
    const archivedSearch = {
      items: [{
        companyId: 'company-1',
        revision: 2,
        displayName: 'Acme',
        websiteUrl: null,
        status: 'archived',
        assignedJobCount: 0,
      }],
      truncated: false,
    }
    const historyEvent = {
      eventId: 'event-1',
      workspaceId: 'workspace-2',
      companyId: 'company-1',
      companyRevision: 2,
      kind: 'updated',
      occurredAt: now,
      actor,
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
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      .mockResolvedValueOnce(jsonResponse(archivedSearch))
      .mockResolvedValueOnce(jsonResponse({
        items: [historyEvent],
        pageInfo: {
          startCursor: 'start',
          endCursor: 'end',
          hasPreviousPage: false,
          hasNextPage: false,
        },
        totalCount: 1,
      }))
    vi.stubGlobal('fetch', fetchMock)
    const companies = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    }).forWorkspace('workspace-1').companies

    await expect(companies.search({ query: 'Acme' }))
      .rejects.toBeInstanceOf(ValedictorianProtocolError)
    await expect(companies.history.list('company-1', {}))
      .rejects.toBeInstanceOf(ValedictorianProtocolError)
  })

  it('rejects detail and lookup resources from another workspace', async () => {
    const foreign = { ...company('company-1', 2), workspaceId: 'workspace-2' }
    const lookup = {
      requested: foreign,
      canonical: foreign,
      redirectPath: [],
    }
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      .mockResolvedValueOnce(jsonResponse({
        lookup,
        assignedJobCount: 0,
        openDuplicateCandidateCount: 0,
        history: { lastEventAt: null, eventCount: 0, recentEvents: [] },
      }))
      .mockResolvedValueOnce(jsonResponse(lookup))
      .mockResolvedValueOnce(jsonResponse({
        items: [{
          jobId,
          assignmentRevision: 2,
          workspaceCompany: {
            companyId: 'company-2',
            revision: 1,
            displayName: 'Other',
            status: 'active',
          },
          jobFactsCompanyName: 'Other',
          roleTitle: 'Engineer',
          namesDiffer: false,
        }],
        pageInfo: {
          startCursor: 'start',
          endCursor: 'end',
          hasPreviousPage: false,
          hasNextPage: false,
        },
        totalCount: 1,
      }))
    vi.stubGlobal('fetch', fetchMock)
    const companies = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    }).forWorkspace('workspace-1').companies

    await expect(companies.get('company-1'))
      .rejects.toBeInstanceOf(ValedictorianProtocolError)
    await expect(companies.lookup('company-1'))
      .rejects.toBeInstanceOf(ValedictorianProtocolError)
    await expect(companies.assignedJobs.list('company-1', {}))
      .rejects.toBeInstanceOf(ValedictorianProtocolError)
  })

  it('rejects unrelated stale guards and invalid lifecycle success states', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      .mockResolvedValueOnce(jsonResponse({
        status: 'blocked',
        workspaceId: 'workspace-1',
        companyId: 'company-1',
        requestCompanyRevision: 2,
        idempotencyKey: 'update-1',
        failure: {
          kind: 'stale_guard',
          blocker: { code: 'impossible_state', message: 'State changed.' },
          recovery: {
            action: 'refresh_and_resubmit',
            guards: [{
              kind: 'company_revision',
              companyId: 'company-elsewhere',
              expectedRevision: 2,
              currentRevision: 3,
            }],
          },
        },
      }))
      .mockResolvedValueOnce(jsonResponse({
        status: 'archived',
        workspaceId: 'workspace-1',
        companyId: 'company-1',
        requestCompanyRevision: 2,
        idempotencyKey: 'archive-1',
        company: company('company-1', 3),
      }))
    vi.stubGlobal('fetch', fetchMock)
    const companies = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    }).forWorkspace('workspace-1').companies
    const base = {
      workspaceId: 'workspace-1',
      companyId: 'company-1',
      expectedCompanyRevision: 2,
      actor,
      rationale: 'Operator correction.',
    }

    await expect(companies.update({
      ...base,
      idempotencyKey: 'update-1',
      displayName: 'Acme Labs',
    })).rejects.toBeInstanceOf(ValedictorianProtocolError)
    await expect(companies.archive({
      ...base,
      idempotencyKey: 'archive-1',
    })).rejects.toBeInstanceOf(ValedictorianProtocolError)
  })

  it('rejects successful mutations that did not apply submitted field values', async () => {
    const updated = (
      idempotencyKey: string,
      resource: Record<string, unknown>,
    ) => jsonResponse({
      status: 'updated',
      workspaceId: 'workspace-1',
      companyId: 'company-1',
      requestCompanyRevision: 2,
      idempotencyKey,
      company: { ...resource, revision: 3 },
    })
    const created = (
      idempotencyKey: string,
      resource: Record<string, unknown>,
    ) => jsonResponse({
      status: 'created',
      workspaceId: 'workspace-1',
      companyId: 'company-created',
      requestCompanyRevision: null,
      idempotencyKey,
      company: {
        ...company('company-created', 1),
        displayName: 'Created Company',
        websiteUrl: 'https://created.example',
        notes: 'Created notes.',
        ...resource,
      },
    })
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      .mockResolvedValueOnce(created('create-display', { displayName: 'Different' }))
      .mockResolvedValueOnce(created('create-website', { websiteUrl: null }))
      .mockResolvedValueOnce(created('create-notes', { notes: 'Different notes.' }))
      .mockResolvedValueOnce(created('create-workspace', { workspaceId: 'workspace-2' }))
      .mockResolvedValueOnce(updated('display-1', company('company-1', 3)))
      .mockResolvedValueOnce(updated('website-1', {
        ...company('company-1', 3),
        displayName: 'Acme Labs',
        websiteUrl: null,
      }))
      .mockResolvedValueOnce(updated('notes-1', company('company-1', 3)))
      .mockResolvedValueOnce(updated('alias-add-1', company('company-1', 3)))
      .mockResolvedValueOnce(updated('alias-update-1', {
        ...company('company-1', 3),
        aliases: [{ id: 'alias-1', value: 'Old Alias' }],
      }))
      .mockResolvedValueOnce(updated('alias-remove-1', {
        ...company('company-1', 3),
        aliases: [{ id: 'alias-1', value: 'Alias to remove' }],
      }))
    vi.stubGlobal('fetch', fetchMock)
    const companies = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    }).forWorkspace('workspace-1').companies
    const base = {
      workspaceId: 'workspace-1',
      actor,
      rationale: 'Apply the submitted correction.',
    }
    const revision = {
      ...base,
      companyId: 'company-1',
      expectedCompanyRevision: 2,
    }

    const create = (idempotencyKey: string) => companies.create({
      ...base,
      displayName: 'Created Company',
      websiteUrl: 'https://created.example',
      notes: 'Created notes.',
      idempotencyKey,
    })
    await expect(create('create-display')).rejects
      .toBeInstanceOf(ValedictorianProtocolError)
    await expect(create('create-website')).rejects
      .toBeInstanceOf(ValedictorianProtocolError)
    await expect(create('create-notes')).rejects
      .toBeInstanceOf(ValedictorianProtocolError)
    await expect(create('create-workspace')).rejects
      .toBeInstanceOf(ValedictorianProtocolError)
    await expect(companies.update({
      ...revision,
      displayName: 'Acme Labs',
      idempotencyKey: 'display-1',
    })).rejects.toBeInstanceOf(ValedictorianProtocolError)
    await expect(companies.update({
      ...revision,
      displayName: 'Acme Labs',
      websiteUrl: 'https://acme.example',
      idempotencyKey: 'website-1',
    })).rejects.toBeInstanceOf(ValedictorianProtocolError)
    await expect(companies.notes.update({
      ...revision,
      notes: 'Submitted notes.',
      idempotencyKey: 'notes-1',
    })).rejects.toBeInstanceOf(ValedictorianProtocolError)
    await expect(companies.aliases.add({
      ...revision,
      value: 'Submitted Alias',
      idempotencyKey: 'alias-add-1',
    })).rejects.toBeInstanceOf(ValedictorianProtocolError)
    await expect(companies.aliases.update({
      ...revision,
      aliasId: 'alias-1',
      value: 'Updated Alias',
      idempotencyKey: 'alias-update-1',
    })).rejects.toBeInstanceOf(ValedictorianProtocolError)
    await expect(companies.aliases.remove({
      ...revision,
      aliasId: 'alias-1',
      idempotencyKey: 'alias-remove-1',
    })).rejects.toBeInstanceOf(ValedictorianProtocolError)
  })
})
