import { describe, expect, it } from 'vitest'
import { canonicalDateOnlySchema } from './index'

describe('canonicalDateOnlySchema', () => {
  it('accepts ordinary, leap, and Gregorian boundary dates', () => {
    for (const value of [
      '2024-07-11',
      '2024-02-29',
      '2000-02-29',
      '0001-01-01',
      '9999-12-31',
    ]) {
      expect(canonicalDateOnlySchema.parse(value)).toBe(value)
    }
  })

  it('rejects malformed, impossible, non-padded, and year-zero dates', () => {
    for (const value of [
      'not-a-date',
      '2024-01-01T00:00:00Z',
      '2024/01/01',
      '2023-02-29',
      '2024-02-30',
      '2024-13-01',
      '2024-00-01',
      '2024-1-01',
      '2024-01-1',
      '24-01-01',
      '0000-01-01',
      '0000-12-31',
    ]) {
      expect(
        canonicalDateOnlySchema.safeParse(value).success,
        JSON.stringify(value),
      ).toBe(false)
    }
  })
})
