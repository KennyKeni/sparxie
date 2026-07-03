import { describe, expect, it } from 'vitest'
import {
  deriveJobTermsFromDateRange,
  formatJobTerms,
  normalizeJobTimingInput,
  normalizeJobTerms,
  parseJobTermsFromText,
} from './job-timing'

describe('job timing', () => {
  it('normalizes and sorts explicit terms', () => {
    expect(
      normalizeJobTerms([
        { season: 'fall', year: 2026 },
        { season: 'spring', year: 2026 },
        { season: 'fall', year: 2026 },
        { season: 'summer', year: 2026 },
      ]),
    ).toEqual([
      { season: 'spring', year: 2026 },
      { season: 'summer', year: 2026 },
      { season: 'fall', year: 2026 },
    ])
  })

  it('derives terms from exact dates using internship seasons', () => {
    expect(deriveJobTermsFromDateRange('2026-09-14', '2027-04-16')).toEqual([
      { season: 'fall', year: 2026 },
      { season: 'spring', year: 2027 },
    ])
    expect(deriveJobTermsFromDateRange('2026-05-01', null)).toEqual([
      { season: 'summer', year: 2026 },
    ])
  })

  it('parses controlled legacy term text', () => {
    expect(parseJobTermsFromText('Fall 2026 internship')).toEqual([
      { season: 'fall', year: 2026 },
    ])
    expect(parseJobTermsFromText('Academic Year 2026')).toEqual([
      { season: 'fall', year: 2026 },
      { season: 'spring', year: 2027 },
    ])
    expect(parseJobTermsFromText('2026-09-14 to 2027-04-16')).toEqual([
      { season: 'fall', year: 2026 },
      { season: 'spring', year: 2027 },
    ])
  })

  it('normalizes timing modes exclusively', () => {
    expect(
      normalizeJobTimingInput({
        startDate: '2026-09-14',
        endDate: '2027-04-16',
      }),
    ).toEqual({
      term: 'Fall 2026 / Spring 2027',
      terms: [
        { season: 'fall', year: 2026 },
        { season: 'spring', year: 2027 },
      ],
      timingMode: 'dates',
      startDate: '2026-09-14',
      endDate: '2027-04-16',
    })

    expect(normalizeJobTimingInput({ term: 'Fall 2026 internship' })).toEqual({
      term: 'Fall 2026 internship',
      terms: [{ season: 'fall', year: 2026 }],
      timingMode: 'terms',
      startDate: null,
      endDate: null,
    })

    expect(normalizeJobTimingInput({ term: 'Internship' })).toEqual({
      term: 'Internship',
      terms: [],
      timingMode: 'unknown',
      startDate: null,
      endDate: null,
    })
  })

  it('rejects mixed or invalid timing input', () => {
    expect(() =>
      normalizeJobTimingInput({
        term: 'Fall 2026',
        startDate: '2026-09-14',
      }),
    ).toThrow('Date-based timing cannot include term or terms input')
    expect(() =>
      normalizeJobTimingInput({
        terms: [{ season: 'fall', year: 2026 }],
        endDate: '2026-12-01',
      }),
    ).toThrow('Date-based timing requires startDate')
    expect(() => normalizeJobTimingInput({ startDate: '2026-13-01' })).toThrow(
      'startDate must be an ISO date',
    )
    expect(() => normalizeJobTimingInput({ startDate: '2026-12-01', endDate: '2026-09-01' }))
      .toThrow('endDate must be on or after startDate')
  })

  it('formats terms for display', () => {
    expect(
      formatJobTerms([
        { season: 'spring', year: 2027 },
        { season: 'fall', year: 2026 },
      ]),
    ).toBe('Fall 2026 / Spring 2027')
  })
})
