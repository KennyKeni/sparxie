import { vi } from 'vitest'

export function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status: 200,
    ...init,
  })
}

export function mockFetch(response: Response) {
  const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
  fetchMock.mockResolvedValue(response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

export function sourcingFindingPayload(country: unknown = null) {
  return {
    id: 'finding-1',
    workflowRunId: 'workflow-run-1',
    sourceId: 'source-1',
    sourceName: 'Example',
    companyName: 'Example Corp',
    roleTitle: 'Software Engineer',
    roleKind: 'full_time',
    term: null,
    terms: [],
    timingMode: 'unknown',
    startDate: null,
    endDate: null,
    city: null,
    region: null,
    country,
    workMode: 'remote',
    locationRaw: 'Remote',
    officialUrl: null,
    sourceUrl: null,
    postedAge: null,
    priorityScore: null,
    priorityBand: null,
    fitNotes: null,
    duplicateNotes: null,
    blocker: null,
    policyBlocker: null,
    dispositionReason: null,
    mergeStatus: 'new',
    mergedApplicationId: null,
    mergedApplicationCompanyName: null,
    mergedApplicationRoleTitle: null,
    mergeNotes: null,
    discoveredAt: '2026-07-11T14:00:00.000Z',
    createdAt: '2026-07-11T14:00:00.000Z',
    updatedAt: '2026-07-11T14:00:00.000Z',
  }
}
