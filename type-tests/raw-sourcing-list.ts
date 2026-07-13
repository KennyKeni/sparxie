import type {
  RawSourceListNormalizationStatus,
  RawSourceListProjectionStatus,
  RawSourceRecordSummary,
  RawSourceRecordsListQuery,
  RawSourceRecordsListResult,
  ValedictorianClient,
  ValedictorianWorkspaceClient,
} from '../src/index.js'
import {
  RAW_SOURCE_RECORDS_LIST_ID_TIE_BREAK,
  compareIsoInstants,
  compareUtf8Bytewise,
  rawSourceRecordSummarySchema,
  rawSourceRecordsListQuerySchema,
  rawSourceRecordsListResultSchema,
} from '../src/index.js'

type IsExact<Actual, Expected> =
  (<Value>() => Value extends Actual ? 1 : 2) extends <Value>() =>
    Value extends Expected ? 1 : 2
    ? true
    : false

const normalizationStatusIsExhaustive: IsExact<
  RawSourceListNormalizationStatus,
  'raw_only' | 'pending' | 'in_progress' | 'completed' | 'blocked' | 'failed'
> = true

const projectionStatusIsExhaustive: IsExact<
  RawSourceListProjectionStatus,
  'not_eligible' | 'pending' | 'projected' | 'failed'
> = true

const listReturnsContract: IsExact<
  ReturnType<ValedictorianWorkspaceClient['sourcing']['rawRecords']['list']>,
  Promise<RawSourceRecordsListResult>
> = true

const rootClientHasNoRawRecordList: IsExact<
  keyof ValedictorianClient & ('sourcing' | 'rawRecords'),
  never
> = true

const queryOmitsOffset: IsExact<
  keyof RawSourceRecordsListQuery & ('offset' | 'total' | 'hasMore'),
  never
> = true

const resultOmitsOffset: IsExact<
  keyof RawSourceRecordsListResult & ('offset' | 'total' | 'hasMore' | 'limit'),
  never
> = true

const idTieBreakIsUtf8Bytewise: IsExact<
  typeof RAW_SOURCE_RECORDS_LIST_ID_TIE_BREAK,
  {
    readonly field: 'id'
    readonly direction: 'desc'
    readonly collation: 'utf8_bytewise'
    readonly encoding: 'utf8'
    readonly backends: {
      readonly sqlite: 'BINARY'
      readonly postgres: 'COLLATE "C"'
    }
  }
> = true

compareUtf8Bytewise satisfies (left: string, right: string) => number
compareIsoInstants satisfies (left: string, right: string) => number

const summaryOmitsForbiddenFields: IsExact<
  keyof RawSourceRecordSummary &
    (
      | 'payload'
      | 'evidence'
      | 'contentHash'
      | 'attempts'
      | 'fieldOutcomes'
      | 'destinationUrl'
      | 'sourceUrl'
      | 'headers'
      | 'cookies'
      | 'auth'
      | 'session'
      | 'credentials'
      | 'providerData'
    ),
  never
> = true

type ConnectorProjected = Extract<
  RawSourceRecordSummary,
  {
    adapter: { kind: 'connector' }
    projectionStatus: 'projected'
  }
>
type NonConnectorRawOnly = Extract<
  RawSourceRecordSummary,
  {
    connectorInstanceId: null
    normalizationStatus: 'raw_only'
  }
>
type PassedNotEligible = Extract<
  RawSourceRecordSummary,
  {
    normalizationStatus: 'completed'
    gateStatus: 'passed'
    projectionStatus: 'not_eligible'
  }
>

const connectorProjectedHasCapture: IsExact<
  ConnectorProjected['connectorInstanceId'],
  string
> = true
const connectorProjectedHasFinding: IsExact<ConnectorProjected['findingId'], string> =
  true
const nonConnectorRawOnlyHasNullCapture: IsExact<
  NonConnectorRawOnly['connectorInstanceId'],
  null
> = true
const nonConnectorRawOnlyHasNullRevision: IsExact<
  NonConnectorRawOnly['normalizationRawRevisionId'],
  null
> = true
const passedNotEligibleIsNever: IsExact<PassedNotEligible, never> = true

const sparseCliRawOnly: RawSourceRecordSummary = {
  id: 'raw-1',
  sourceEntityId: null,
  adapter: { id: 'valedictorian-cli', kind: 'cli', version: '0.12.0' },
  reportedOrigin: null,
  connectorInstanceId: null,
  latestConnectorRunId: null,
  providerRecordId: null,
  companyName: null,
  roleTitle: null,
  createdAt: '2026-07-10T14:00:00.000Z',
  firstObservedAt: '2026-07-10T14:00:00.000Z',
  lastObservedAt: '2026-07-10T14:00:00.000Z',
  firstReceivedAt: '2026-07-10T14:00:01.000Z',
  lastReceivedAt: '2026-07-10T14:00:01.000Z',
  occurrenceCount: 1,
  revisionCount: 1,
  latestRevision: {
    id: 'revision-1',
    revision: 1,
    observedAt: '2026-07-10T14:00:00.000Z',
    createdAt: '2026-07-10T14:00:01.000Z',
  },
  normalizationStatus: 'raw_only',
  normalizationUpdatedAt: null,
  normalizationRawRevisionId: null,
  gateStatus: null,
  canonicalCandidateId: null,
  projectionStatus: 'not_eligible',
  findingId: null,
}

const connectorProjected: RawSourceRecordSummary = {
  id: 'raw-2',
  sourceEntityId: 'entity-2',
  adapter: { id: 'jobright', kind: 'connector', version: '2.1.0' },
  reportedOrigin: { kind: 'job_board', name: 'Jobright', providerId: null },
  connectorInstanceId: 'connector-instance-1',
  latestConnectorRunId: 'connector-run-9',
  providerRecordId: null,
  companyName: null,
  roleTitle: null,
  createdAt: '2026-07-10T12:00:00.000Z',
  firstObservedAt: '2026-07-10T12:00:00.000Z',
  lastObservedAt: '2026-07-11T09:00:00.000Z',
  firstReceivedAt: '2026-07-10T12:00:01.000Z',
  lastReceivedAt: '2026-07-11T09:00:02.000Z',
  occurrenceCount: 2,
  revisionCount: 2,
  latestRevision: {
    id: 'revision-2',
    revision: 2,
    observedAt: '2026-07-11T09:00:00.000Z',
    createdAt: '2026-07-11T09:00:02.000Z',
  },
  normalizationStatus: 'completed',
  normalizationUpdatedAt: '2026-07-11T09:05:00.000Z',
  normalizationRawRevisionId: 'revision-2',
  gateStatus: 'passed',
  canonicalCandidateId: 'candidate-2',
  projectionStatus: 'projected',
  findingId: 'finding-2',
}

// @ts-expect-error Connector summaries require non-null connector run identities.
const connectorMissingCapture: RawSourceRecordSummary = {
  ...sparseCliRawOnly,
  adapter: { id: 'jobright', kind: 'connector', version: '2.1.0' },
  connectorInstanceId: null,
  latestConnectorRunId: null,
}

// @ts-expect-error Non-connector summaries cannot claim connector capture ids.
const cliWithCapture: RawSourceRecordSummary = {
  ...sparseCliRawOnly,
  connectorInstanceId: 'connector-instance-1',
  latestConnectorRunId: 'connector-run-1',
}

// @ts-expect-error Passed candidates cannot remain projection not_eligible.
const passedNotEligible: RawSourceRecordSummary = {
  ...connectorProjected,
  projectionStatus: 'not_eligible',
  findingId: null,
}

// @ts-expect-error raw_only summaries cannot carry a normalization revision id.
const rawOnlyWithRevision: RawSourceRecordSummary = {
  ...sparseCliRawOnly,
  normalizationRawRevisionId: 'revision-1',
}

const originMissingProviderId: RawSourceRecordSummary = {
  ...sparseCliRawOnly,
  // @ts-expect-error Origin providerId must be explicit when origin exists.
  reportedOrigin: {
    kind: 'job_board',
    name: 'LinkedIn',
  },
}

rawSourceRecordSummarySchema satisfies {
  parse(value: unknown): RawSourceRecordSummary
}

rawSourceRecordsListQuerySchema satisfies {
  parse(value: unknown): RawSourceRecordsListQuery
}

rawSourceRecordsListResultSchema satisfies {
  parse(value: unknown): RawSourceRecordsListResult
}

void normalizationStatusIsExhaustive
void projectionStatusIsExhaustive
void listReturnsContract
void rootClientHasNoRawRecordList
void queryOmitsOffset
void resultOmitsOffset
void idTieBreakIsUtf8Bytewise
void summaryOmitsForbiddenFields
void connectorProjectedHasCapture
void connectorProjectedHasFinding
void nonConnectorRawOnlyHasNullCapture
void nonConnectorRawOnlyHasNullRevision
void passedNotEligibleIsNever
void sparseCliRawOnly
void connectorProjected
void connectorMissingCapture
void cliWithCapture
void passedNotEligible
void rawOnlyWithRevision
void originMissingProviderId
