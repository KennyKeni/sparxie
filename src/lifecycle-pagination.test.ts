import { describe, expect, it } from 'vitest'
import {
  captureListInputSchema,
  captureListResultSchema,
  jobListInputSchema,
  jobListResultSchema,
  lifecycleApplicationListInputSchema,
  lifecycleApplicationListResultSchema,
  lifecycleDefaultPageLimit,
  lifecycleMaximumPageLimit,
  lifecyclePageInfoSchema,
  opportunityListInputSchema,
  opportunityListResultSchema,
} from './index.js'

const timestamp = '2026-07-17T15:30:00.000Z'

const capture = {
  id: '018f6f88-4c35-7a62-9f2e-318dd8e164c4', workspaceId: 'workspace-north',
  evidenceMode: 'reported' as const,
  adapter: { id: 'manual-entry', kind: 'manual' as const, version: '1.0.0' },
  observedAt: timestamp, receivedAt: timestamp, providerRecordId: null, providerSchema: null,
  payload: { title: 'Controls Intern' }, evidence: [], revision: 1,
  createdAt: timestamp, updatedAt: timestamp, removedAt: null,
}

const emptyPageInfo = {
  startCursor: null, endCursor: null, hasPreviousPage: false, hasNextPage: false,
}

/** The four resource list inputs share one page contract; only filters differ. */
const listInputSchemas = [
  ['captures', captureListInputSchema],
  ['jobs', jobListInputSchema],
  ['opportunities', opportunityListInputSchema],
  ['applications', lifecycleApplicationListInputSchema],
] as const

const listResultSchemas = [
  ['captures', captureListResultSchema],
  ['jobs', jobListResultSchema],
  ['opportunities', opportunityListResultSchema],
  ['applications', lifecycleApplicationListResultSchema],
] as const

describe('canonical bidirectional lifecycle page contract', () => {
  it.each(listInputSchemas)('defaults %s paging to the first page', (_resource, schema) => {
    expect(schema.parse({})).toEqual({ limit: lifecycleDefaultPageLimit })
    expect(schema.parse({ after: 'boundary' })).toEqual({
      limit: lifecycleDefaultPageLimit, after: 'boundary',
    })
    expect(schema.parse({ before: 'boundary' })).toEqual({
      limit: lifecycleDefaultPageLimit, before: 'boundary',
    })
  })

  it.each(listInputSchemas)('rejects ambiguous, unknown, and out-of-range %s paging', (_resource, schema) => {
    expect(schema.safeParse({ after: 'forward', before: 'backward' }).success).toBe(false)
    expect(schema.safeParse({ unknownField: 'unsupported' }).success).toBe(false)
    expect(schema.safeParse({ after: '' }).success).toBe(false)
    expect(schema.safeParse({ before: 'b'.repeat(2_049) }).success).toBe(false)
    expect(schema.safeParse({ limit: 0 }).success).toBe(false)
    expect(schema.safeParse({ limit: lifecycleMaximumPageLimit + 1 }).success).toBe(false)
  })

  it('exposes authoritative boundaries in both directions', () => {
    const middle = {
      startCursor: 'first-item', endCursor: 'last-item',
      hasPreviousPage: true, hasNextPage: true,
    }
    expect(lifecyclePageInfoSchema.parse(middle)).toEqual(middle)
    expect(lifecyclePageInfoSchema.safeParse({ ...middle, unknownField: 'unsupported' }).success).toBe(false)
    for (const field of ['startCursor', 'endCursor', 'hasPreviousPage', 'hasNextPage'] as const) {
      const { [field]: _omitted, ...partial } = middle
      expect(lifecyclePageInfoSchema.safeParse(partial).success).toBe(false)
    }
  })

  it.each(listResultSchemas)('accepts empty %s pages reached from either end', (_resource, schema) => {
    expect(schema.safeParse({ items: [], pageInfo: emptyPageInfo }).success).toBe(true)
    // Paging past either end returns nothing while the opposite side remains.
    expect(schema.safeParse({
      items: [], pageInfo: { ...emptyPageInfo, hasPreviousPage: true },
    }).success).toBe(true)
    expect(schema.safeParse({
      items: [], pageInfo: { ...emptyPageInfo, hasNextPage: true },
    }).success).toBe(true)
  })

  it('accepts populated first, middle, and final Capture pages', () => {
    const boundaries = { startCursor: 'first-item', endCursor: 'last-item' }
    for (const [hasPreviousPage, hasNextPage] of [[false, true], [true, true], [true, false]]) {
      expect(captureListResultSchema.safeParse({
        items: [capture], pageInfo: { ...boundaries, hasPreviousPage, hasNextPage },
      }).success).toBe(true)
    }
  })

  it.each(listResultSchemas)('rejects %s results without page info or with unknown fields', (_resource, schema) => {
    expect(schema.safeParse({ items: [] }).success).toBe(false)
    expect(schema.safeParse({
      items: [], pageInfo: emptyPageInfo, unknownField: 'unsupported',
    }).success).toBe(false)
  })

  it.each(listResultSchemas)('rejects half-populated %s cursor metadata', (_resource, schema) => {
    expect(schema.safeParse({
      items: [], pageInfo: { ...emptyPageInfo, startCursor: 'unexpected' },
    }).success).toBe(false)
    expect(schema.safeParse({
      items: [], pageInfo: { ...emptyPageInfo, endCursor: 'unexpected' },
    }).success).toBe(false)
    expect(schema.safeParse({
      items: [], pageInfo: { startCursor: null, endCursor: null, hasPreviousPage: true, hasNextPage: true },
    }).success).toBe(false)
  })

  it('rejects half-populated boundaries on a populated page', () => {
    for (const pageInfo of [
      { startCursor: 'first-item', endCursor: null, hasPreviousPage: false, hasNextPage: false },
      { startCursor: null, endCursor: 'last-item', hasPreviousPage: false, hasNextPage: false },
      emptyPageInfo,
    ]) {
      expect(captureListResultSchema.safeParse({ items: [capture], pageInfo }).success).toBe(false)
    }
  })
})
