export const jobSeasons = ['spring', 'summer', 'fall'] as const

export type JobSeason = (typeof jobSeasons)[number]

export const jobTimingModes = ['unknown', 'terms', 'dates'] as const

export type JobTimingMode = (typeof jobTimingModes)[number]

export interface JobTerm {
  season: JobSeason
  year: number
}

export interface JobTimingInput {
  terms?: JobTerm[] | null
  timingMode?: JobTimingMode
  startDate?: string | null
  endDate?: string | null
}

export interface NormalizedJobTiming {
  /** Formatted display projection of `terms`; never accepted as input. */
  term: string | null
  terms: JobTerm[]
  timingMode: JobTimingMode
  startDate: string | null
  endDate: string | null
}

const seasonOrder = new Map<JobSeason, number>([
  ['spring', 1],
  ['summer', 2],
  ['fall', 3],
])

const seasonLabels: Record<JobSeason, string> = {
  spring: 'Spring',
  summer: 'Summer',
  fall: 'Fall',
}

export function isJobTimingMode(value: string): value is JobTimingMode {
  return (jobTimingModes as readonly string[]).includes(value)
}

export function isJobSeason(value: string): value is JobSeason {
  return (jobSeasons as readonly string[]).includes(value)
}

export function normalizeJobTimingInput(input: JobTimingInput = {}): NormalizedJobTiming {
  if (Object.prototype.hasOwnProperty.call(input, 'term')) {
    throw new Error('Timing input does not accept term; provide structured terms.')
  }

  const explicitTerms = input.terms === null || input.terms === undefined
    ? []
    : normalizeJobTerms(input.terms)
  const startDate = normalizeOptionalDate(input.startDate, 'startDate')
  const endDate = normalizeOptionalDate(input.endDate, 'endDate')
  const timingMode = input.timingMode ?? inferJobTimingMode({
    explicitTerms,
    startDate,
    endDate,
  })

  if (!isJobTimingMode(timingMode)) {
    throw new Error(`Invalid timingMode: ${String(timingMode)}`)
  }

  if (timingMode === 'dates') {
    if (!startDate) {
      throw new Error('Date-based timing requires startDate.')
    }
    if (explicitTerms.length > 0) {
      throw new Error('Date-based timing cannot include terms input.')
    }
    assertDateRange(startDate, endDate)
    const terms = deriveJobTermsFromDateRange(startDate, endDate)

    return {
      term: formatJobTerms(terms),
      terms,
      timingMode,
      startDate,
      endDate,
    }
  }

  if (timingMode === 'terms') {
    if (startDate || endDate) {
      throw new Error('Term-based timing cannot include startDate or endDate.')
    }

    if (explicitTerms.length === 0) {
      throw new Error('Term-based timing requires structured terms.')
    }

    return {
      term: formatJobTerms(explicitTerms),
      terms: explicitTerms,
      timingMode,
      startDate: null,
      endDate: null,
    }
  }

  if (startDate || endDate || explicitTerms.length > 0) {
    throw new Error('Unknown timing cannot include dates or structured terms.')
  }

  return {
    term: null,
    terms: [],
    timingMode: 'unknown',
    startDate: null,
    endDate: null,
  }
}

export function normalizeJobTerms(terms: readonly JobTerm[]) {
  const normalized = terms.map((term) => normalizeJobTerm(term))
  const seen = new Set<string>()
  const deduped: JobTerm[] = []

  for (const term of normalized) {
    const key = jobTermKey(term)
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    deduped.push(term)
  }

  return deduped.sort(compareJobTerms)
}

export function parseJobTermsJson(value: string | null | undefined) {
  if (!value) {
    return []
  }

  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }

    return normalizeJobTerms(parsed as JobTerm[])
  } catch {
    return []
  }
}

export function stringifyJobTerms(terms: readonly JobTerm[]) {
  return JSON.stringify(normalizeJobTerms(terms))
}

export function formatJobTerms(terms: readonly JobTerm[]) {
  return normalizeJobTerms(terms)
    .map((term) => `${seasonLabels[term.season]} ${term.year}`)
    .join(' / ')
}

export function deriveJobTermsFromDateRange(startDate: string, endDate?: string | null) {
  const normalizedStart = normalizeRequiredDate(startDate, 'startDate')
  const normalizedEnd = normalizeOptionalDate(endDate, 'endDate')
  assertDateRange(normalizedStart, normalizedEnd)

  const end = normalizedEnd ?? normalizedStart
  const startParts = parseIsoDateParts(normalizedStart)
  const endParts = parseIsoDateParts(end)
  const terms: JobTerm[] = []
  let year = startParts.year
  let month = startParts.month

  while (year < endParts.year || (year === endParts.year && month <= endParts.month)) {
    terms.push({ season: seasonForMonth(month), year })
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }

  return normalizeJobTerms(terms)
}

function normalizeJobTerm(term: JobTerm) {
  const season = String(term.season).trim().toLowerCase()
  const year = Number(term.year)

  if (!isJobSeason(season)) {
    throw new Error(`Invalid job term season: ${String(term.season)}`)
  }

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error(`Invalid job term year: ${String(term.year)}`)
  }

  return { season, year }
}

function inferJobTimingMode(input: {
  explicitTerms: JobTerm[]
  startDate: string | null
  endDate: string | null
}): JobTimingMode {
  if (input.startDate || input.endDate) {
    return 'dates'
  }

  if (input.explicitTerms.length > 0) {
    return 'terms'
  }

  return 'unknown'
}

function compareJobTerms(left: JobTerm, right: JobTerm) {
  if (left.year !== right.year) {
    return left.year - right.year
  }

  return (seasonOrder.get(left.season) ?? 0) - (seasonOrder.get(right.season) ?? 0)
}

function jobTermKey(term: JobTerm) {
  return `${term.season}:${term.year}`
}

function normalizeOptionalString(value: string | null | undefined) {
  if (value === null || value === undefined) {
    return null
  }

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function normalizeRequiredDate(value: string, fieldName: string) {
  const normalized = normalizeOptionalDate(value, fieldName)
  if (!normalized) {
    throw new Error(`${fieldName} is required.`)
  }

  return normalized
}

function normalizeOptionalDate(value: string | null | undefined, fieldName: string) {
  const normalized = normalizeOptionalString(value)
  if (!normalized) {
    return null
  }

  if (!isIsoDate(normalized)) {
    throw new Error(`${fieldName} must be an ISO date in YYYY-MM-DD format.`)
  }

  return normalized
}

function assertDateRange(startDate: string, endDate: string | null) {
  if (endDate && endDate < startDate) {
    throw new Error('endDate must be on or after startDate.')
  }
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) {
    return false
  }

  return date.toISOString().slice(0, 10) === value
}

function parseIsoDateParts(value: string) {
  return {
    year: Number(value.slice(0, 4)),
    month: Number(value.slice(5, 7)),
  }
}

function seasonForMonth(month: number): JobSeason {
  if (month >= 1 && month <= 4) {
    return 'spring'
  }

  if (month >= 5 && month <= 8) {
    return 'summer'
  }

  return 'fall'
}
