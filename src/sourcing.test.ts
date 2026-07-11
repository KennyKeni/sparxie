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
})
