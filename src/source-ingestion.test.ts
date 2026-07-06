import { describe, expect, it } from 'vitest'
import {
  careerSourceLifecycleStatuses,
  isCareerSourceLifecycleStatus,
  isSourceRunStatus,
  sourceRunStatuses,
} from './index'
import type {
  CareerSourceSummary,
  SourceCompaniesListResponse,
  SourceJobsListResponse,
  SourceProbeResponse,
  SourceRunDetail,
  SourceRunOverrideResponse,
  SourceRunRequestResponse,
  SourceRunsListResponse,
  SourceScheduleResponse,
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
      companyName: 'Figma',
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
      companyName: 'Figma',
      createdAt: '2026-07-05T12:00:00.000Z',
      entryUrl: 'https://boards.greenhouse.io/figma',
      id: 'src_greenhouse',
      latestSnapshotId: null,
      observedProvider: 'greenhouse',
      politenessPolicy: { crawlDelayMs: 1000 },
      schedule: {
        cadence: 'daily',
        enabled: true,
        nextDueAt: '2026-07-05T13:00:00.000Z',
        timezone: 'UTC',
      },
      sourceType: 'provider_api',
      status: 'active',
      updatedAt: '2026-07-05T12:30:00.000Z',
    }
    const run: SourceRunDetail = {
      confidenceResults: [],
      completedAt: '2026-07-05T12:31:00.000Z',
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
      startedAt: '2026-07-05T12:30:00.000Z',
      status: 'published',
    }
    const probeResponse: SourceProbeResponse = {
      probe: {
        candidateTemplate: 'greenhouse_board_api',
        config: { boardToken: 'figma' },
        evidence: { sourceRunId: 'run_probe' },
        failedRequirement: null,
        listingCount: 12,
        observedProvider: 'greenhouse',
        readiness: 'ready',
        sampleStableJobKey: '123',
      },
    }
    const scheduleResponse: SourceScheduleResponse = {
      schedule: {
        cadence: 'hourly',
        cronExpression: null,
        enabled: true,
        id: 'sch_1',
        intervalMinutes: null,
        jitterSeconds: 0,
        nextDueAt: '2026-07-05T13:00:00.000Z',
        priority: 0,
        sourceId: 'src_greenhouse',
        timezone: 'UTC',
      },
    }
    const requestResponse: SourceRunRequestResponse = {
      requestId: 'srr_1',
    }
    const overrideResponse: SourceRunOverrideResponse = {
      override: {
        kind: 'force_publish',
        overriddenRuleKeys: ['detail_url_sample'],
        publishedJobCount: 12,
        snapshotId: 'snp_1',
        sourceRunId: 'run_1',
      },
    }
    const jobsResponse: SourceJobsListResponse = {
      jobs: [job],
      pagination: {
        limit: 25,
        nextOffset: null,
        offset: 0,
      },
    }
    const companiesResponse: SourceCompaniesListResponse = {
      companies: [
        {
          activeJobCount: 2,
          careerSourceCount: 1,
          createdAt: '2026-07-05T12:00:00.000Z',
          companyId: 'com_1',
          companyName: 'Figma',
          updatedAt: '2026-07-05T12:30:00.000Z',
        },
      ],
      pagination: {
        limit: 25,
        nextOffset: null,
        offset: 0,
      },
      summary: {
        totalActiveJobs: 2,
        totalCompanies: 1,
      },
    }
    const runsResponse: SourceRunsListResponse = {
      pagination: {
        limit: 10,
        nextOffset: null,
        offset: 0,
      },
      runs: [run],
    }

    expect(source.status).toBe('active')
    expect(source.schedule?.cadence).toBe('daily')
    expect(probeResponse.probe.readiness).toBe('ready')
    expect(scheduleResponse.schedule?.enabled).toBe(true)
    expect(requestResponse.requestId).toBe('srr_1')
    expect(overrideResponse.override.kind).toBe('force_publish')
    expect(jobsResponse.pagination.nextOffset).toBeNull()
    expect(companiesResponse.companies[0]?.careerSourceCount).toBe(1)
    expect(runsResponse.pagination.nextOffset).toBeNull()
  })
})
