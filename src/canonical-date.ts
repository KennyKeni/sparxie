import { z } from 'zod'

export const canonicalDateOnlySchema = z.iso.date().refine(
  (value) => value.slice(0, 4) !== '0000',
  { message: 'year 0000 is not a supported Gregorian date' },
)

export type CanonicalDateOnly = z.infer<typeof canonicalDateOnlySchema>
