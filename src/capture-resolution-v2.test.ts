import { describe, expect, it } from 'vitest'
import {
  captureCompletionDetailSchema,
  captureResolutionProjectionSchema,
  completeCaptureManuallyInputSchema,
} from './capture-resolution.js'
import {
  captureCompletionDetailV2Schema,
  captureResolutionV2ContractVersion,
  captureResolutionProjectionV2Schema,
  completeCaptureManuallyV2InputSchema,
} from './capture-resolution-v2.js'
import {
  jobDestinationSchema,
  jobDestinationV2Schema,
  jobFactsV2Schema,
} from './job.js'

const captureId = 'capture-1'
const now = '2026-07-25T12:00:00.000Z'
const actor = { id: 'user-7', type: 'user' as const }
const destination = { url: 'https://jobs.example/search/448?source=jobright' }
const jobFacts = {
  companyName: 'Northstar Robotics',
  roleTitle: 'Controls Intern',
  sourceName: 'Jobright',
  roleKind: 'internship' as const,
  term: null,
  terms: [],
  timingMode: 'unknown' as const,
  startDate: null,
  endDate: null,
  location: null,
  workMode: 'unknown' as const,
  employmentType: 'internship' as const,
  seniority: 'student' as const,
  compensation: null,
  postedAt: null,
  destination,
}
const strongIdentity = {
  kind: 'ats_job' as const,
  provider: 'greenhouse',
  account: 'northstar',
  value: '448',
  strength: 'strong' as const,
}

function completionInput() {
  return {
    captureId,
    expectedCaptureRevision: 3,
    expectedGenerationId: 'generation-1',
    idempotencyKey: 'complete:capture-1:r3:g1',
    actor,
    jobFacts,
    destination,
    externalIdentities: [],
    evidenceReferences: [{ captureId, captureRevision: 3, evidenceIndexes: [0] }],
    companyResolution: {
      action: 'use_local' as const,
      companyId: 'company-1',
      expectedCompanyRevision: 4,
      restoreIfArchived: false,
    },
  }
}

function readyProjection(providerStatus: 'hidden' | 'closed' | undefined) {
  return {
    readiness: 'ready' as const,
    captureId,
    captureRevision: 3,
    generation: {
      id: 'generation-1',
      ordinal: 1,
      trigger: 'intake' as const,
      status: 'active' as const,
      processingSummary: 'awaiting_information' as const,
      destinationResolution: {
        generationId: 'generation-1',
        captureRevision: 3,
        updatedAt: now,
        attemptCount: 1,
        status: 'resolved' as const,
        currentIssue: null,
        nextAttemptAt: null,
        resolverId: 'jobright.provider-url',
        resolverVersion: 'jobright-provider-url@2',
        remoteOperationId: null,
        ...(providerStatus === undefined ? {} : { providerStatus }),
      },
      jobInformationResolution: {
        generationId: 'generation-1',
        captureRevision: 3,
        updatedAt: now,
        attemptCount: 0,
        status: 'awaiting_manual' as const,
        currentIssue: null,
      },
      promotion: {
        generationId: 'generation-1',
        captureRevision: 3,
        updatedAt: now,
        attemptCount: 0,
        status: 'not_ready' as const,
        currentIssue: null,
      },
      createdAt: now,
      updatedAt: now,
    },
  }
}

describe('Capture resolution v2 contracts', () => {
  it('publishes a strict URL-only destination and Job facts shape', () => {
    expect(captureResolutionV2ContractVersion).toBe(2)
    expect(jobDestinationV2Schema.parse(destination)).toEqual(destination)
    expect(jobFactsV2Schema.parse(jobFacts)).toEqual(jobFacts)
    expect(jobDestinationV2Schema.safeParse({ ...destination, class: 'employer_or_ats' }).success)
      .toBe(false)
    expect(jobDestinationSchema.safeParse(destination).success).toBe(false)
    expect(jobFactsV2Schema.safeParse({
      ...jobFacts,
      destination: { ...destination, class: 'third_party_job_posting' },
    }).success).toBe(false)
  })

  it('accepts a validated URL without destination classification and preserves v1', () => {
    const input = completionInput()
    expect(completeCaptureManuallyV2InputSchema.parse(input)).toEqual(input)
    expect(completeCaptureManuallyInputSchema.safeParse(input).success).toBe(false)
    expect(completeCaptureManuallyV2InputSchema.safeParse({
      ...input,
      destination: null,
      jobFacts: { ...jobFacts, destination: null },
    }).success).toBe(false)
    expect(completeCaptureManuallyV2InputSchema.parse({
      ...input,
      destination: null,
      jobFacts: { ...jobFacts, destination: null },
      externalIdentities: [strongIdentity],
    })).toMatchObject({ destination: null })
    expect(completeCaptureManuallyV2InputSchema.safeParse({
      ...input,
      destination: null,
      externalIdentities: [strongIdentity],
    }).success).toBe(false)
    expect(completeCaptureManuallyV2InputSchema.safeParse({
      ...input,
      destination: { url: 'https://jobs.example/search/other' },
      externalIdentities: [strongIdentity],
    }).success).toBe(false)
    expect(completeCaptureManuallyV2InputSchema.safeParse({
      ...input,
      jobFacts: { ...jobFacts, destination: null },
      externalIdentities: [strongIdentity],
    }).success).toBe(false)
    expect(completeCaptureManuallyV2InputSchema.safeParse({
      ...input,
      destination: { url: 'ftp://jobs.example/448' },
      jobFacts: { ...jobFacts, destination: { url: 'ftp://jobs.example/448' } },
    }).success).toBe(false)
    expect(completeCaptureManuallyV2InputSchema.safeParse({
      ...input,
      destination: { url: 'https://jobs.example/' + 'a'.repeat(4_080) },
      jobFacts: {
        ...jobFacts,
        destination: { url: 'https://jobs.example/' + 'a'.repeat(4_080) },
      },
    }).success).toBe(false)
  })

  it('keeps v1 reads strict while v2 carries bounded provider status', () => {
    expect(captureResolutionProjectionSchema.safeParse(readyProjection('hidden')).success)
      .toBe(false)
    expect(captureResolutionProjectionV2Schema.parse(readyProjection(undefined)))
      .toMatchObject({ generation: { destinationResolution: { status: 'resolved' } } })
    expect(captureResolutionProjectionV2Schema.parse(readyProjection('hidden')))
      .toMatchObject({
        generation: { destinationResolution: { providerStatus: 'hidden' } },
      })
    expect(captureResolutionProjectionV2Schema.safeParse({
      ...readyProjection('closed'),
      generation: {
        ...readyProjection('closed').generation,
        processingSummary: 'processing',
        destinationResolution: {
          ...readyProjection('closed').generation.destinationResolution,
          status: 'queued',
        },
      },
    }).success).toBe(false)
    const detail = {
      captureId,
      captureRevision: 3,
      expectedGenerationId: 'generation-1',
      sourceSummary: { displayName: 'Jobright', provider: 'jobright', observedAt: now },
      provenance: [],
      destination: { status: 'resolved' as const, url: destination.url, providerStatus: 'closed' as const },
      rawEvidence: [],
      exactEvidenceReferences: [],
      jobDefaults: { companyName: 'Northstar Robotics' },
      lastIssue: null,
    }
    const v1Detail = {
      ...detail,
      destination: { status: 'resolved' as const, url: destination.url },
      jobDefaults: {
        companyName: 'Northstar Robotics',
        destination: { class: 'employer_or_ats' as const, url: destination.url },
      },
    }
    expect(captureCompletionDetailSchema.safeParse(detail).success).toBe(false)
    expect(captureCompletionDetailSchema.parse(v1Detail)).toEqual(v1Detail)
    expect(captureCompletionDetailSchema.safeParse({
      ...v1Detail,
      jobDefaults: { companyName: 'Northstar Robotics', destination },
    }).success).toBe(false)
    expect(captureCompletionDetailV2Schema.parse({
      ...detail,
      destination: { status: 'resolved', url: destination.url },
    })).toMatchObject({ destination: { status: 'resolved' } })
    expect(captureCompletionDetailV2Schema.parse({
      ...detail,
      jobDefaults: { companyName: 'Northstar Robotics', destination },
    })).toMatchObject({ jobDefaults: { destination } })
    expect(captureCompletionDetailV2Schema.safeParse({
      ...detail,
      jobDefaults: v1Detail.jobDefaults,
    }).success).toBe(false)
    expect(captureCompletionDetailV2Schema.parse(detail)).toEqual(detail)
    expect(captureCompletionDetailV2Schema.safeParse({
      ...detail,
      destination: { status: 'action_required', url: null, providerStatus: 'closed' },
    }).success).toBe(false)
  })
})
