import { describe, expect, it, vi } from 'vitest'
import { ValedictorianSourceHttpClient } from './index'

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status: 200,
    ...init,
  })
}

describe('Valedictorian source HTTP client', () => {
  it('lists sourced jobs with query params and bearer auth', async () => {
    const payload = {
      jobs: [
        {
          active: true,
          applyUrl: 'https://jobs.example.com/apply/1',
          companyId: 'com_1',
          contentHash: 'hash:one',
          detailUrl: 'https://jobs.example.com/roles/1',
          firstSeenAt: '2026-07-05T12:00:00.000Z',
          lastSeenAt: '2026-07-05T12:00:00.000Z',
          lastVerifiedAt: '2026-07-05T12:30:00.000Z',
          latestSnapshotId: 'snp_1',
          locations: [{ rawText: 'New York, NY' }],
          sourceId: 'src_greenhouse',
          stableJobKey: 'job-1',
          title: 'Software Engineer Intern',
        },
      ],
      pagination: {
        limit: 25,
        nextOffset: 35,
        offset: 10,
      },
    }
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValue(jsonResponse(payload))
    const client = new ValedictorianSourceHttpClient({
      baseUrl: 'https://source.test/api/',
      fetch: fetchMock,
      token: 'reader-token',
    })

    await expect(client.listJobs({ limit: 25, offset: 10 })).resolves.toEqual(payload)

    expect(fetchMock).toHaveBeenCalledWith('https://source.test/jobs?limit=25&offset=10', {
      headers: {
        accept: 'application/json',
        authorization: 'Bearer reader-token',
      },
      method: 'GET',
    })
  })

  it('lists source runs with sourceId and limit query params', async () => {
    const payload = {
      runs: [
        {
          diff: {
            addedCount: 1,
            changedCount: 0,
            previousSnapshotId: null,
            removedCount: 0,
          },
          evidencePath: 'evidence/sources/src_greenhouse/runs/run_1',
          normalizedJobCount: 12,
          outcome: 'published',
          rawJobCount: 12,
          sourceId: 'src_greenhouse',
          sourceRunId: 'run_1',
          status: 'published',
        },
      ],
    }
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValue(jsonResponse(payload))
    const client = new ValedictorianSourceHttpClient({
      baseUrl: 'https://source.test/api/',
      fetch: fetchMock,
      token: 'reader-token',
    })

    await expect(client.listRuns({ sourceId: 'src_greenhouse', limit: 5 })).resolves.toEqual(
      payload,
    )

    expect(fetchMock).toHaveBeenCalledWith(
      'https://source.test/runs?sourceId=src_greenhouse&limit=5',
      {
        headers: {
          accept: 'application/json',
          authorization: 'Bearer reader-token',
        },
        method: 'GET',
      },
    )
  })
})
