import { describe, expect, it } from 'vitest'
import {
  createSourcingFindingInputSchema,
  sourcingFindingCanonicalProjectionSchema,
} from './index.js'

describe('sourcing finding canonical projection contract', () => {
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
