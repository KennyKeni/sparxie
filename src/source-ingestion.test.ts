import { describe, expect, it } from 'vitest'
import {
  careerSourceLifecycleStatuses,
  isCareerSourceLifecycleStatus,
  isSourceRunStatus,
  sourceRunStatuses,
} from './index'
import type {
  CareerSourceSummary,
  SourceJobsListResponse,
  SourceRunDetail,
  SourceRunsListResponse,
  SourcedJobPosting,
} from './index'

describe('source ingestion contract', () => {
  it('exports source run and career source lifecycle status guards', () => {
    expect(sourceRunStatuses).toEqual([
      'queued',
      'locked',
      'extracting',
      'continued',
      'normalizing',
      'validating',
      'publishing',
      'blocked',
      'failed',
      'no_change',
      'published',
      'suspect',
    ])
    expect(isSourceRunStatus('published')).toBe(true)
    expect(isSourceRunStatus('completed')).toBe(false)

    expect(careerSourceLifecycleStatuses).toEqual([
      'candidate',
      'discovering',
      'ready',
      'active',
      'suspect',
      'paused',
      'retired',
      'blocked_by_policy',
      'blocked_by_waf',
    ])
    expect(isCareerSourceLifecycleStatus('active')).toBe(true)
    expect(isCareerSourceLifecycleStatus('disabled')).toBe(false)
  })

  it('models the source ingestion response envelopes', () => {
    const job: SourcedJobPosting = {
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
    }
    const source: CareerSourceSummary = {
      activeStrategyVersionId: 'str_1',
      canonicalHost: 'boards.greenhouse.io',
      companyId: 'com_1',
      createdAt: '2026-07-05T12:00:00.000Z',
      entryUrl: 'https://boards.greenhouse.io/figma',
      id: 'src_greenhouse',
      latestSnapshotId: null,
      observedProvider: 'greenhouse',
      politenessPolicy: { crawlDelayMs: 1000 },
      sourceType: 'provider_api',
      status: 'active',
      updatedAt: '2026-07-05T12:30:00.000Z',
    }
    const run: SourceRunDetail = {
      confidenceResults: [],
      diff: {
        addedCount: 1,
        changedCount: 0,
        previousSnapshotId: null,
        removedCount: 0,
      },
      evidenceArtifacts: ['response-summary.json'],
      evidenceBundleId: 'evb_1',
      evidencePath: 'evidence/sources/src_greenhouse/runs/run_1',
      normalizedJobCount: 12,
      outcome: 'published',
      rawJobCount: 12,
      sourceId: 'src_greenhouse',
      sourceRunId: 'run_1',
      status: 'published',
    }
    const jobsResponse: SourceJobsListResponse = {
      jobs: [job],
      pagination: {
        limit: 25,
        nextOffset: null,
        offset: 0,
      },
    }
    const runsResponse: SourceRunsListResponse = {
      runs: [run],
    }

    expect(source.status).toBe('active')
    expect(jobsResponse.pagination.nextOffset).toBeNull()
    expect(runsResponse).not.toHaveProperty('pagination')
  })
})
