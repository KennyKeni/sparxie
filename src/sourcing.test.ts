import { describe, expect, it } from 'vitest'
import {
  createSourcingFindingInputSchema,
  sourcingFindingCanonicalProjectionSchema,
  sourcingFindingSchema,
  sourcingFindingsListResultSchema,
  updateSourcingFindingInputSchema,
} from './index.js'

const legacyFinding = {
  id: 'finding-1',
  workflowRunId: 'workflow-run-1',
  sourceId: 'source-1',
  sourceName: 'Example',
  companyName: 'Example Corp',
  roleTitle: 'Software Engineer',
  roleKind: 'full_time' as const,
  term: null,
  terms: [],
  timingMode: 'unknown' as const,
  startDate: null,
  endDate: null,
  city: null,
  region: null,
  country: 'US',
  workMode: 'remote' as const,
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
  mergeStatus: 'new' as const,
  mergedApplicationId: null,
  mergedApplicationCompanyName: null,
  mergedApplicationRoleTitle: null,
  mergeNotes: null,
  discoveredAt: '2026-07-11T14:00:00.000Z',
  createdAt: '2026-07-11T14:00:00.000Z',
  updatedAt: '2026-07-11T14:00:00.000Z',
}

describe('sourcing finding canonical projection contract', () => {
  it('requires a nullable country on finding outputs', () => {
    expect(sourcingFindingSchema.parse(legacyFinding)).toEqual(legacyFinding)
    expect(sourcingFindingSchema.parse({ ...legacyFinding, country: null })).toEqual({
      ...legacyFinding,
      country: null,
    })
    expect(sourcingFindingSchema.safeParse({ ...legacyFinding, country: undefined }).success).toBe(
      false,
    )
    expect(sourcingFindingSchema.safeParse({ ...legacyFinding, country: 42 }).success).toBe(false)
  })

  it('preserves complete canonical finding projections and rejects partial lineage', () => {
    const canonicalFinding = {
      ...legacyFinding,
      country: null,
      rawRevisionId: 'raw-revision-1',
      canonicalCandidateId: 'candidate-1',
      destination: null,
      employmentType: 'unknown' as const,
      seniority: 'unknown' as const,
      location: { raw: 'Remote', city: null, region: null, country: null },
      compensation: null,
      postedAt: { value: null, precision: 'unknown' as const, raw: null },
    }

    expect(sourcingFindingSchema.parse(canonicalFinding)).toEqual(canonicalFinding)
    expect(
      sourcingFindingSchema.safeParse({
        ...legacyFinding,
        rawRevisionId: 'raw-revision-1',
      }).success,
    ).toBe(false)
  })

  it('strictly validates paginated finding results', () => {
    const result = {
      items: [{ ...legacyFinding, country: null }],
      total: 1,
      limit: 25,
      offset: 0,
      hasMore: false,
    }

    expect(sourcingFindingsListResultSchema.parse(result)).toEqual(result)
    expect(
      sourcingFindingsListResultSchema.safeParse({
        ...result,
        items: [{ ...legacyFinding, country: undefined }],
      }).success,
    ).toBe(false)
    expect(sourcingFindingsListResultSchema.safeParse({ ...result, extra: true }).success).toBe(
      false,
    )
  })

  it('distinguishes an omitted update country from explicit null', () => {
    expect(updateSourcingFindingInputSchema.parse({ findingId: 'finding-1' })).toEqual({
      findingId: 'finding-1',
    })
    expect(
      updateSourcingFindingInputSchema.parse({ findingId: 'finding-1', country: null }),
    ).toEqual({ findingId: 'finding-1', country: null })
    expect(
      updateSourcingFindingInputSchema.parse({ findingId: 'finding-1', country: 'US' }),
    ).toEqual({ findingId: 'finding-1', country: 'US' })
    expect(
      updateSourcingFindingInputSchema.safeParse({ findingId: 'finding-1', country: 42 }).success,
    ).toBe(false)
    expect(updateSourcingFindingInputSchema.safeParse({ findingId: '' }).success).toBe(false)
    expect(
      updateSourcingFindingInputSchema.safeParse({
        findingId: 'finding-1',
        mergeStatus: 'merged',
      }).success,
    ).toBe(false)
    expect(
      updateSourcingFindingInputSchema.safeParse({
        findingId: 'finding-1',
        destinationClass: 'employer_or_ats',
      }).success,
    ).toBe(false)
  })

  it('accepts explicit unknown countries in legacy and canonical finding creation', () => {
    const base = {
      workflowRunId: 'workflow-run-1',
      companyName: 'Example Corp',
      roleTitle: 'Software Engineer',
      roleKind: 'full_time' as const,
      country: null,
      workMode: 'remote' as const,
    }

    expect(createSourcingFindingInputSchema.parse(base)).toEqual(base)

    const canonical = {
      ...base,
      rawRevisionId: 'raw-revision-1',
      canonicalCandidateId: 'candidate-1',
      destination: null,
      employmentType: 'unknown' as const,
      seniority: 'unknown' as const,
      location: { raw: null, city: null, region: null, country: null },
      compensation: null,
      postedAt: { value: null, precision: 'unknown' as const, raw: null },
    }

    expect(createSourcingFindingInputSchema.parse(canonical)).toEqual(canonical)
  })

  it('accepts complete canonical lineage and explicit unknown job facts', () => {
    const projection = {
      rawRevisionId: 'raw-revision-1',
      canonicalCandidateId: 'candidate-1',
      destination: null,
      employmentType: 'unknown',
      seniority: 'unknown',
      workMode: 'unclear',
      location: null,
      compensation: null,
      postedAt: { value: null, precision: 'unknown', raw: null },
    }

    expect(sourcingFindingCanonicalProjectionSchema.parse(projection)).toEqual(projection)
  })

  it('rejects a concrete posted time labelled as unknown', () => {
    expect(
      sourcingFindingCanonicalProjectionSchema.safeParse({
        rawRevisionId: 'raw-revision-1',
        canonicalCandidateId: 'candidate-1',
        destination: null,
        employmentType: 'unknown',
        seniority: 'unknown',
        workMode: 'unclear',
        location: null,
        compensation: null,
        postedAt: {
          value: '2026-07-11T14:00:00.000Z',
          precision: 'unknown',
          raw: null,
        },
      }).success,
    ).toBe(false)
  })

  it('rejects finding creation with partial canonical lineage', () => {
    expect(
      createSourcingFindingInputSchema.safeParse({
        workflowRunId: 'workflow-run-1',
        companyName: 'Example Corp',
        roleTitle: 'Software Engineer',
        roleKind: 'full_time',
        workMode: 'remote',
        rawRevisionId: 'raw-revision-1',
      }).success,
    ).toBe(false)
  })

  it('rejects an invalid finding merge status', () => {
    expect(
      createSourcingFindingInputSchema.safeParse({
        workflowRunId: 'workflow-run-1',
        companyName: 'Example Corp',
        roleTitle: 'Software Engineer',
        roleKind: 'full_time',
        workMode: 'remote',
        mergeStatus: 'totally-invalid',
      }).success,
    ).toBe(false)
  })

  it('rejects producer workspace binding data on finding creation', () => {
    expect(
      createSourcingFindingInputSchema.safeParse({
        workflowRunId: 'workflow-run-1',
        companyName: 'Example Corp',
        roleTitle: 'Software Engineer',
        roleKind: 'full_time',
        workMode: 'remote',
        workspaceId: 'workspace-2',
      }).success,
    ).toBe(false)
  })

  it('accepts every legacy optional finding-create field', () => {
    const input = {
      workflowRunId: 'workflow-run-1',
      sourceId: null,
      sourceName: 'Manual',
      companyName: 'Example Corp',
      roleTitle: 'Software Engineer',
      roleKind: 'full_time',
      term: null,
      terms: [{ season: 'summer', year: 2026 }],
      timingMode: 'terms',
      startDate: null,
      endDate: null,
      city: 'New York',
      region: 'NY',
      country: 'US',
      workMode: 'remote',
      locationRaw: 'New York, NY',
      officialUrl: null,
      sourceUrl: 'https://example.test/jobs/1',
      postedAge: '3 days ago',
      priorityScore: 8,
      priorityBand: 'high',
      fitNotes: null,
      duplicateNotes: null,
      blocker: null,
      policyBlocker: null,
      dispositionReason: null,
      mergeStatus: 'new',
      discoveredAt: '2026-07-11T14:00:00.000Z',
    }

    expect(createSourcingFindingInputSchema.parse(input)).toEqual(input)
  })

  it('validates canonical posted times according to their precision', () => {
    const projection = {
      rawRevisionId: 'raw-revision-1',
      canonicalCandidateId: 'candidate-1',
      destination: null,
      employmentType: 'unknown',
      seniority: 'unknown',
      workMode: 'unclear',
      location: null,
      compensation: null,
    }

    for (const postedAt of [
      {
        value: '2026-07-11T14:00:00.000-04:00',
        precision: 'instant',
        raw: null,
      },
      { value: '2026-07-11', precision: 'date', raw: null },
      { value: '3 days ago', precision: 'relative', raw: '3 days ago' },
      { value: null, precision: 'unknown', raw: null },
    ]) {
      expect(
        sourcingFindingCanonicalProjectionSchema.safeParse({
          ...projection,
          postedAt,
        }).success,
      ).toBe(true)
    }

    for (const postedAt of [
      { value: '2026-07-11', precision: 'instant', raw: null },
      {
        value: '2026-07-11T14:00:00.000Z',
        precision: 'date',
        raw: null,
      },
      { value: '', precision: 'relative', raw: null },
      { value: 'x'.repeat(257), precision: 'relative', raw: null },
      { value: 'unknown', precision: 'unknown', raw: null },
    ]) {
      expect(
        sourcingFindingCanonicalProjectionSchema.safeParse({
          ...projection,
          postedAt,
        }).success,
      ).toBe(false)
    }
  })
})
