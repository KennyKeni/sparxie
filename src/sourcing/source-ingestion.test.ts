import { describe, expect, it } from 'vitest'
import {
  careerSourceLifecycleStatuses,
  isCareerSourceLifecycleStatus,
  isSourceRunStatus,
  sourceRunStatuses,
} from '../index'
import type {
  CareerSourceSummary,
  SourceCompaniesListResponse,
  SourceJobsListResponse,
  SourceProbeUrlInput,
  SourceProbeResponse,
  SourceRunDetail,
  SourceRunOverrideResponse,
  SourceRunRequestResponse,
  SourceRunsListResponse,
  SourceScheduleResponse,
  SourcedJobPosting,
} from '../index'

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
      companyId: '11111111-1111-4111-8111-111111111111',
      companyName: 'Figma',
      companySlug: 'figma',
      contentHash: 'hash:one',
      detailUrl: 'https://jobs.example.com/roles/1',
      firstSeenAt: '2026-07-05T12:00:00.000Z',
      lastSeenAt: '2026-07-05T12:00:00.000Z',
      lastVerifiedAt: '2026-07-05T12:30:00.000Z',
      latestSnapshotId: '33333333-3333-4333-8333-333333333333',
      locations: [{ rawText: 'New York, NY' }],
      sourceId: '22222222-2222-4222-8222-222222222222',
      sourceSlug: 'figma-greenhouse',
      stableJobKey: 'job-1',
      title: 'Software Engineer Intern',
    }
    const source: CareerSourceSummary = {
      activeStrategyVersionId: '44444444-4444-4444-8444-444444444444',
      canonicalHost: 'boards.greenhouse.io',
      companyId: '11111111-1111-4111-8111-111111111111',
      companyName: 'Figma',
      companySlug: 'figma',
      createdAt: '2026-07-05T12:00:00.000Z',
      entryUrl: 'https://boards.greenhouse.io/figma',
      id: '22222222-2222-4222-8222-222222222222',
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
      slug: 'figma-greenhouse',
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
      evidenceBundleId: '55555555-5555-4555-8555-555555555555',
      evidencePath: 'evidence/sources/src_greenhouse/runs/run_1',
      normalizedJobCount: 12,
      outcome: 'published',
      rawJobCount: 12,
      sourceId: '22222222-2222-4222-8222-222222222222',
      sourceSlug: 'figma-greenhouse',
      sourceRunId: '66666666-6666-4666-8666-666666666666',
      startedAt: '2026-07-05T12:30:00.000Z',
      status: 'published',
    }
    const probeResponse: SourceProbeResponse = {
      probe: {
        candidateTemplate: 'greenhouse_board_api',
        config: { boardToken: 'figma' },
        discoveryMethod: 'browser_render_provider_link',
        evidence: { sourceRunId: 'run_probe' },
        failedRequirement: null,
        listingCount: 12,
        observedProvider: 'greenhouse',
        probedCareerUrl: 'https://boards.greenhouse.io/figma',
        readiness: 'ready',
        sampleStableJobKey: '123',
        submittedCareerUrl: 'https://boards.greenhouse.io/figma',
      },
    }
    const probeInput: SourceProbeUrlInput = {
      browserFallback: true,
      browserProxy: { mode: 'managed', countryCode: 'us' },
      url: 'https://figma.com/careers',
    }
    const scheduleResponse: SourceScheduleResponse = {
      schedule: {
        cadence: 'hourly',
        cronExpression: null,
        enabled: true,
        id: '77777777-7777-4777-8777-777777777777',
        intervalMinutes: null,
        jitterSeconds: 0,
        nextDueAt: '2026-07-05T13:00:00.000Z',
        priority: 0,
        sourceId: '22222222-2222-4222-8222-222222222222',
        sourceSlug: 'figma-greenhouse',
        timezone: 'UTC',
      },
    }
    const requestResponse: SourceRunRequestResponse = {
      requestId: '88888888-8888-4888-8888-888888888888',
    }
    const overrideResponse: SourceRunOverrideResponse = {
      override: {
        kind: 'force_publish',
        overriddenRuleKeys: ['detail_url_sample'],
        publishedJobCount: 12,
        snapshotId: '33333333-3333-4333-8333-333333333333',
        sourceRunId: '66666666-6666-4666-8666-666666666666',
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
          companyId: '11111111-1111-4111-8111-111111111111',
          companyName: 'Figma',
          companySlug: 'figma',
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
    expect(probeInput.browserFallback).toBe(true)
    expect(scheduleResponse.schedule?.enabled).toBe(true)
    expect(requestResponse.requestId).toBe('88888888-8888-4888-8888-888888888888')
    expect(overrideResponse.override.kind).toBe('force_publish')
    expect(jobsResponse.pagination.nextOffset).toBeNull()
    expect(companiesResponse.companies[0]?.careerSourceCount).toBe(1)
    expect(runsResponse.pagination.nextOffset).toBeNull()
  })
})
