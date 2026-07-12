import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHttpValedictorianClient, ValedictorianHttpError } from './index.js'
import { jsonResponse } from './http-client.test-support.js'

describe('HTTP sourcing projection client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('gets a runtime-validated receipt through encoded workspace and revision ids', async () => {
    const receipt = {
      rawRecordId: 'raw-1',
      rawRevisionId: 'revision/one',
      updatedAt: '2026-07-12T12:00:00.000Z',
      status: 'pending',
      normalizationStatus: 'completed',
      gateStatus: 'passed',
      canonicalCandidateId: 'candidate-1',
    }
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(jsonResponse(receipt))
    vi.stubGlobal('fetch', fetchMock)
    const workspace = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    }).forWorkspace('workspace/one')

    await expect(
      workspace.sourcing.rawRevisions.projection.get('revision/one'),
    ).resolves.toEqual(receipt)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://valedictorian.test/v1/workspaces/workspace%2Fone/sourcing/raw-revisions/revision%2Fone/projection',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('runtime-validates every projection receipt branch', async () => {
    const base = {
      rawRecordId: 'raw-1',
      rawRevisionId: 'revision-1',
      updatedAt: '2026-07-12T12:00:00.000Z',
    }
    const receipts = [
      {
        ...base,
        status: 'not_eligible',
        normalizationStatus: 'completed',
        gateStatus: 'needs_enrichment',
        canonicalCandidateId: null,
      },
      {
        ...base,
        status: 'pending',
        normalizationStatus: 'completed',
        gateStatus: 'passed',
        canonicalCandidateId: 'candidate-1',
      },
      {
        ...base,
        status: 'projected',
        normalizationStatus: 'completed',
        gateStatus: 'passed',
        canonicalCandidateId: 'candidate-1',
        projectedAt: '2026-07-12T11:59:59.000Z',
        finding: { id: 'finding-1', mergeStatus: 'new', mergedApplicationId: null },
      },
      {
        ...base,
        status: 'failed',
        normalizationStatus: 'completed',
        gateStatus: 'passed',
        canonicalCandidateId: 'candidate-1',
        failedAt: '2026-07-12T11:59:59.000Z',
        failure: { code: 'internal_error', retryable: false },
      },
    ]
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    for (const receipt of receipts) {
      fetchMock.mockResolvedValueOnce(jsonResponse(receipt))
    }
    vi.stubGlobal('fetch', fetchMock)
    const projection = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    }).forWorkspace('workspace-1').sourcing.rawRevisions.projection

    for (const receipt of receipts) {
      await expect(projection.get('revision-1')).resolves.toEqual(receipt)
    }
  })

  it('rejects failure receipts that expose raw exception text', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        rawRecordId: 'raw-1',
        rawRevisionId: 'revision-1',
        updatedAt: '2026-07-12T12:00:00.000Z',
        status: 'failed',
        normalizationStatus: 'completed',
        gateStatus: 'passed',
        canonicalCandidateId: 'candidate-1',
        failedAt: '2026-07-12T11:59:59.000Z',
        failure: {
          code: 'internal_error',
          retryable: false,
          message: 'raw database exception',
        },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const projection = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    }).forWorkspace('workspace-1').sourcing.rawRevisions.projection

    await expect(projection.get('revision-1')).rejects.toThrow()
  })

  it('preserves standard 404 errors for unknown or cross-workspace revisions', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ message: 'Raw revision not found' }, { status: 404 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const projection = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    }).forWorkspace('workspace-1').sourcing.rawRevisions.projection

    const error = await projection.get('unknown').catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(ValedictorianHttpError)
    expect(error).toMatchObject({
      status: 404,
      body: { message: 'Raw revision not found' },
    })
  })
})
