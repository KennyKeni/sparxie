import type {
  RawSourceProjectionResult,
  SourcingProjectionFindingReference,
  ValedictorianWorkspaceClient,
} from '../src/index.js'
import { rawSourceProjectionResultSchema } from '../src/index.js'

type IsExact<Actual, Expected> =
  (<Value>() => Value extends Actual ? 1 : 2) extends <Value>() =>
    Value extends Expected ? 1 : 2
    ? true
    : false

type ProjectionStatus = RawSourceProjectionResult['status']

const statusIsExhaustive: IsExact<
  ProjectionStatus,
  'not_eligible' | 'pending' | 'projected' | 'failed'
> = true
const findingMergeStatusIsNarrow: IsExact<
  SourcingProjectionFindingReference['mergeStatus'],
  | 'new'
  | 'merged'
  | 'duplicate'
  | 'below_cutoff'
  | 'blocked'
  | 'not_fit'
  | 'not_pursued'
  | 'archived'
> = true
const projectionGetReturnsContract: IsExact<
  ReturnType<ValedictorianWorkspaceClient['sourcing']['rawRevisions']['projection']['get']>,
  Promise<RawSourceProjectionResult>
> = true

rawSourceProjectionResultSchema satisfies {
  parse(value: unknown): RawSourceProjectionResult
}

void statusIsExhaustive
void findingMergeStatusIsNarrow
void projectionGetReturnsContract
