import { z } from 'zod'

export const opaqueCursorSchema = z.string().min(1).max(2_048)

/**
 * Authoritative page boundaries. `startCursor` and `endCursor` address the
 * first and last returned item; `hasPreviousPage` and `hasNextPage` are
 * answered for both directions regardless of how the page was requested.
 */
export function createPageInfoSchema<Cursor extends z.ZodType>(cursor: Cursor) {
  return z.object({
    startCursor: cursor.nullable(),
    endCursor: cursor.nullable(),
    hasPreviousPage: z.boolean(),
    hasNextPage: z.boolean(),
  }).strict()
}

/**
 * Bidirectional page request. `after` continues forward from a boundary cursor
 * and `before` continues backward from one; supplying both is rejected and
 * supplying neither requests the first page.
 */
export function createPageInputSchema<Cursor extends z.ZodType, Fields extends z.ZodRawShape>(
  cursor: Cursor,
  fields: Fields,
) {
  return z.union([
    z.object({ ...fields, after: cursor, before: z.never().optional() }).strict(),
    z.object({ ...fields, before: cursor, after: z.never().optional() }).strict(),
    z.object({ ...fields, after: z.never().optional(), before: z.never().optional() }).strict(),
  ])
}

type PageBoundaries = {
  items: readonly unknown[]
  pageInfo: {
    startCursor: unknown
    endCursor: unknown
    hasPreviousPage: boolean
    hasNextPage: boolean
  }
}

export function refinePageBoundaries(page: unknown, context: z.RefinementCtx) {
  const { items, pageInfo } = page as PageBoundaries
  const boundaries = Number(pageInfo.startCursor !== null) + Number(pageInfo.endCursor !== null)
  if (boundaries !== (items.length === 0 ? 0 : 2)) {
    context.addIssue({
      code: 'custom',
      message: 'page boundary cursors must match item presence',
      path: ['pageInfo'],
    })
  }
  // A bounded keyset window with a positive limit cannot be empty while items
  // exist on both sides of it.
  if (items.length === 0 && pageInfo.hasPreviousPage && pageInfo.hasNextPage) {
    context.addIssue({
      code: 'custom',
      message: 'an empty page cannot report adjacent pages in both directions',
      path: ['pageInfo'],
    })
  }
}
