import type { JobTimingInput, NormalizedJobTiming } from '../src/index.js'
import { normalizeJobTimingInput } from '../src/index.js'

type IsExact<Actual, Expected> =
  (<Value>() => Value extends Actual ? 1 : 2) extends <Value>() =>
    Value extends Expected ? 1 : 2
    ? true
    : false

const timingInputKeysAreStructuredOnly: IsExact<
  keyof JobTimingInput,
  'terms' | 'timingMode' | 'startDate' | 'endDate'
> = true

const normalizedTimingRetainsFormattedTerm: IsExact<
  NormalizedJobTiming['term'],
  string | null
> = true

const structuredTerms: JobTimingInput = {
  terms: [{ season: 'fall', year: 2026 }],
  timingMode: 'terms',
}

const datedTiming: JobTimingInput = {
  timingMode: 'dates',
  startDate: '2026-09-14',
  endDate: '2027-04-16',
}

const formattedTermIsOutputOnly: string | null =
  normalizeJobTimingInput(structuredTerms).term

void timingInputKeysAreStructuredOnly
void normalizedTimingRetainsFormattedTerm
void structuredTerms
void datedTiming
void formattedTermIsOutputOnly
