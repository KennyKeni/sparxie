import type {
  CanonicalSourceCandidate,
  CanonicalSourceCandidateReference,
  FieldResolutionOutcome,
  NormalizationAttempt,
  NormalizationGateOutcome,
  RawSourceNormalizationResult,
  RawSourceIntakeReceipt,
  RawSourceRecord,
  RawSourceOccurrenceReceipt,
  RawSourceRecordInput,
  RawSourceReplayReceipt,
  ResolverDeclaration,
  SourceAdapterProvenance,
  ValedictorianClient,
} from '../src/index.js'
import { rawSourceNormalizationResultSchema } from '../src/index.js'

type IsExact<Actual, Expected> =
  (<Value>() => Value extends Actual ? 1 : 2) extends <Value>() =>
    Value extends Expected ? 1 : 2
    ? true
    : false

declare const unknownNormalizationResult: unknown
const runtimeValidatedNormalization: RawSourceNormalizationResult =
  rawSourceNormalizationResultSchema.parse(unknownNormalizationResult)

const receiptCarriesSourceEntity: IsExact<
  RawSourceIntakeReceipt['sourceEntityId'],
  string | null
> = true
const rawRecordCarriesSourceEntity: IsExact<
  RawSourceRecord['sourceEntityId'],
  string | null
> = true
const rawOccurrenceCarriesOptionalCapture: IsExact<
  RawSourceOccurrenceReceipt['capture'],
  import('../src/index.js').ConnectorCaptureReference | null | undefined
> = true
const candidateReferenceCarriesSourceEntity: IsExact<
  CanonicalSourceCandidateReference['sourceEntityId'],
  string
> = true

const sparseCliIntake: RawSourceRecordInput = {
  intakeItemId: 'item-sparse',
  adapter: { id: 'valedictorian-cli', kind: 'cli', version: '0.12.0' },
  observedAt: '2026-07-10T14:00:00.000Z',
}

declare const broadlyTypedLegacyAdapter: SourceAdapterProvenance

// @ts-expect-error A broadly typed adapter could be a connector and cannot omit capture.
const uncapturedBroadAdapter: RawSourceRecordInput = {
  adapter: broadlyTypedLegacyAdapter,
  observedAt: '2026-07-10T14:00:00.000Z',
}

const connectorCaptureIntake: RawSourceRecordInput = {
  intakeItemId: 'item-connector',
  adapter: { id: 'jobright', kind: 'connector', version: '2.1.0' },
  capture: {
    connectorInstanceId: 'connector-instance-1',
    connectorRunId: 'connector-run-1',
    executionScopeId: 'scope_connector_1',
  },
  observedAt: '2026-07-10T14:00:00.000Z',
}

// @ts-expect-error Only a registered connector adapter can claim connector capture references.
const spoofedCaptureAdapter: RawSourceRecordInput = {
  adapter: { id: 'manual-entry', kind: 'manual', version: '1.0.0' },
  capture: {
    connectorInstanceId: 'connector-instance-1',
    connectorRunId: 'connector-run-1',
    executionScopeId: 'scope_connector_1',
  },
  observedAt: '2026-07-10T14:00:00.000Z',
}

const spoofedCaptureWorkspace: RawSourceRecordInput = {
  adapter: { id: 'jobright', kind: 'connector', version: '2.1.0' },
  capture: {
    connectorInstanceId: 'connector-instance-1',
    connectorRunId: 'connector-run-1',
    // @ts-expect-error Capture references are bound to the workspace route by the server.
    workspaceId: 'workspace-2',
  },
  observedAt: '2026-07-10T14:00:00.000Z',
}

void connectorCaptureIntake
void uncapturedBroadAdapter
void spoofedCaptureAdapter
void spoofedCaptureWorkspace

const completedReplay: RawSourceReplayReceipt = {
  replayId: 'replay-1',
  status: 'completed',
  acceptedAt: '2026-07-11T14:00:00.000Z',
  completedAt: '2026-07-11T14:00:01.000Z',
  matchedRawRevisionIds: [],
  items: [],
}

const failedReplay: RawSourceReplayReceipt = {
  replayId: 'replay-2',
  status: 'completed_with_failures',
  acceptedAt: '2026-07-11T14:00:00.000Z',
  completedAt: '2026-07-11T14:00:01.000Z',
  matchedRawRevisionIds: ['revision-1'],
  items: [
    {
      status: 'failed',
      rawRecordId: 'raw-1',
      rawRevisionId: 'revision-1',
      failure: { code: 'normalization_failed', retryable: false },
    },
  ],
}

if (failedReplay.status === 'completed_with_failures') {
  for (const item of failedReplay.items) {
    if (item.status === 'failed') {
      const failureCode: 'normalization_failed' | 'persistence_failed' | 'internal_error' =
        item.failure.code
      void failureCode
    }
  }
}

async function inspectWorkspaceReplay(client: ValedictorianClient) {
  const receipt = await client.forWorkspace('workspace-1').sourcing.rawRecords.replay({
    selector: { rawRevisionIds: ['revision-1'] },
    invalidate: {},
  })

  if (receipt.status === 'completed_with_failures') {
    const failedItems = receipt.items.filter((item) => item.status === 'failed')
    const firstFailure = failedItems[0]?.failure.code
    void firstFailure
  } else {
    for (const item of receipt.items) {
      const completedStatus: 'completed' = item.status
      void completedStatus
      // @ts-expect-error Completed receipt items have no failure data.
      void item.failure
    }
  }

  // @ts-expect-error Raw replay remains workspace-scoped, not a root client API.
  await client.sourcing.rawRecords.replay({
    selector: { rawRevisionIds: ['revision-1'] },
    invalidate: {},
  })
}

const impossibleCompletedReplay: RawSourceReplayReceipt = {
  replayId: 'replay-3',
  status: 'completed',
  acceptedAt: '2026-07-11T14:00:00.000Z',
  completedAt: '2026-07-11T14:00:01.000Z',
  matchedRawRevisionIds: ['revision-1'],
  items: [
    {
      status: 'failed',
      rawRecordId: 'raw-1',
      rawRevisionId: 'revision-1',
      // @ts-expect-error Completed receipts cannot contain failed items.
      failure: { code: 'normalization_failed', retryable: false },
    },
  ],
}

const impossibleFailedItem: RawSourceReplayReceipt = {
  replayId: 'replay-4',
  status: 'completed_with_failures',
  acceptedAt: '2026-07-11T14:00:00.000Z',
  completedAt: '2026-07-11T14:00:01.000Z',
  matchedRawRevisionIds: ['revision-1'],
  items: [
    // @ts-expect-error Failed items require bounded typed failure data.
    {
      status: 'failed',
      rawRecordId: 'raw-1',
      rawRevisionId: 'revision-1',
    },
  ],
}

// @ts-expect-error Adapter provenance is required even when all job fields are absent.
const missingAdapter: RawSourceRecordInput = {
  observedAt: '2026-07-10T14:00:00.000Z',
}

const naturalUrl: RawSourceRecordInput = {
  intakeItemId: 'item-natural',
  adapter: { id: 'manual-entry', kind: 'manual', version: '1.0.0' },
  observedAt: '2026-07-10T14:00:00.000Z',
  reportedOrigin: {
    kind: 'employer',
    name: 'Example Corp',
    url: 'https://jobs.example.com/roles/123',
  },
  payload: { url: 'https://jobs.example.com/roles/123' },
}

const jobrightIntermediary: RawSourceRecordInput = {
  intakeItemId: 'item-jobright',
  adapter: { id: 'valedictorian-cli', kind: 'cli', version: '0.12.0' },
  observedAt: '2026-07-10T14:00:00.000Z',
  reportedOrigin: { kind: 'aggregator', name: 'Jobright' },
  payload: {
    intermediaryUrl: 'https://jobright.ai/jobs/info/abc',
    outboundUrl: 'https://boards.greenhouse.io/example/jobs/123',
  },
  evidence: [
    {
      kind: 'link',
      label: 'outbound_destination',
      value: 'https://boards.greenhouse.io/example/jobs/123',
    },
  ],
}

const providerMapper: ResolverDeclaration = {
  id: 'linkedin-employment-type',
  version: '2.1.0',
  scopeRequirement: 'source',
  supportedAdapters: {
    kinds: ['connector'],
    ids: ['linkedin'],
    versions: ['3.2.0'],
  },
  supportedProviderSchemas: ['linkedin/job/v3'],
  requiredInputs: ['payload.employmentType'],
  outputFields: ['employmentType'],
  capabilities: ['pure'],
  costClass: 'none',
  precedence: 100,
}

const providerTitleResolver: ResolverDeclaration = {
  id: 'linkedin-title',
  version: '2.1.0',
  scopeRequirement: 'source',
  supportedAdapters: {
    kinds: ['connector'],
    ids: ['linkedin'],
    versions: ['3.2.0'],
  },
  supportedProviderSchemas: ['linkedin/job/v3'],
  requiredInputs: ['payload.title'],
  outputFields: ['roleTitle'],
  capabilities: ['pure'],
  costClass: 'none',
  precedence: 100,
}

const authoritativeMapping: FieldResolutionOutcome = {
  status: 'resolved',
  resolverId: providerMapper.id,
  resolverVersion: providerMapper.version,
  field: 'employmentType',
  inputHash: 'sha256:employment-type',
  value: 'full_time',
  confidence: 1,
  authoritative: true,
  evidence: [{ kind: 'provider_field', value: 'FT', path: 'employmentType' }],
}

const fallbackAfterAbstention: NormalizationAttempt[] = [
  {
    id: 'attempt-provider',
    rawRevisionId: 'revision-1',
    resolver: providerTitleResolver,
    inputHash: 'sha256:title',
    executionScopeId: 'scope_connector_1',
    operationOutcome: null,
    status: 'completed',
    startedAt: '2026-07-10T14:01:00.000Z',
    completedAt: '2026-07-10T14:01:00.010Z',
    outcomes: [
      {
        status: 'abstained',
        resolverId: providerTitleResolver.id,
        resolverVersion: providerTitleResolver.version,
        field: 'roleTitle',
        inputHash: 'sha256:title',
        reason: 'provider_mapping_missing',
      },
    ],
  },
  {
    id: 'attempt-generic',
    rawRevisionId: 'revision-1',
    resolver: {
      id: 'generic-title',
      version: '1.0.0',
      scopeRequirement: 'none',
      supportedAdapters: { kinds: ['connector', 'cli', 'manual', 'import'] },
      requiredInputs: ['payload.title'],
      outputFields: ['roleTitle'],
      capabilities: ['pure'],
      costClass: 'none',
      precedence: 10,
    },
    inputHash: 'sha256:title',
    executionScopeId: null,
    operationOutcome: null,
    status: 'completed',
    startedAt: '2026-07-10T14:01:00.011Z',
    completedAt: '2026-07-10T14:01:00.012Z',
    outcomes: [
      {
        status: 'resolved',
        resolverId: 'generic-title',
        resolverVersion: '1.0.0',
        field: 'roleTitle',
        inputHash: 'sha256:title',
        value: 'Software Engineer',
        confidence: 0.9,
      },
    ],
  },
]

const lockedValue: FieldResolutionOutcome = {
  status: 'locked',
  resolverId: 'manual-lock',
  resolverVersion: '1.0.0',
  field: 'companyName',
  inputHash: 'sha256:company',
  value: 'Example Corp',
  reason: 'user_accepted',
  policyVersion: 'manual/v1',
}

const candidate: CanonicalSourceCandidate = {
  id: 'candidate-1',
  rawRecordId: 'raw-1',
  rawRevisionId: 'revision-1',
  schemaVersion: 'job-candidate/v3',
  sourceEntityId: 'source-entity-1',
  canonicalIdentity: {
    kind: 'destination_url',
    value: 'https://boards.greenhouse.io/example/jobs/123',
  },
  companyName: 'Example Corp',
  roleTitle: 'Software Engineer',
  employmentType: 'full_time',
  seniority: 'entry_level',
  workMode: 'remote',
  location: {
    raw: 'New York, NY',
    city: 'New York',
    region: 'NY',
    country: 'US',
  },
  compensation: {
    minimum: 45,
    maximum: 55,
    currency: 'USD',
    interval: 'hour',
    raw: '$45-$55/hour',
  },
  postedAt: {
    value: '2026-07-09T12:00:00.000Z',
    precision: 'instant',
    raw: '1 day ago',
  },
  destination: {
    class: 'employer_or_ats',
    url: 'https://boards.greenhouse.io/example/jobs/123',
    intermediaryUrl: 'https://jobright.ai/jobs/info/abc',
  },
  sourceUrl: 'https://jobright.ai/jobs/info/abc',
  providerJobId: null,
  observedAt: '2026-07-10T14:00:00.000Z',
}

type IsNullable<Value> = null extends Value ? true : false

const employmentTypeIsNotNullable: IsNullable<
  CanonicalSourceCandidate['employmentType']
> = false
const workModeIsNotNullable: IsNullable<CanonicalSourceCandidate['workMode']> = false

const explicitUnknownFacts: CanonicalSourceCandidate = {
  ...candidate,
  employmentType: 'unknown',
  seniority: 'unknown',
  workMode: 'unclear',
  location: null,
  compensation: null,
  postedAt: {
    value: null,
    precision: 'unknown',
    raw: null,
  },
}

const needsEnrichmentGate: NormalizationGateOutcome = {
  status: 'needs_enrichment',
  policyVersion: 'sourcing-gate/v4',
  requiredFields: ['companyName', 'roleTitle', 'destinationUrl'],
  missingFields: ['destinationUrl'],
  conflictingFields: [],
  candidate: null,
  reason: 'required_destination_missing',
  evaluatedAt: '2026-07-10T14:01:01.000Z',
}

const failedGate: NormalizationGateOutcome = {
  status: 'failed',
  policyVersion: 'sourcing-gate/v4',
  requiredFields: ['companyName', 'roleTitle', 'destinationUrl'],
  missingFields: [],
  conflictingFields: [],
  candidate: null,
  reason: 'gate_policy_unavailable',
  evaluatedAt: '2026-07-10T14:01:01.000Z',
}

const rejectedGate: NormalizationGateOutcome = {
  status: 'rejected',
  policyVersion: 'sourcing-gate/v4',
  requiredFields: ['companyName', 'roleTitle', 'destinationUrl'],
  missingFields: [],
  conflictingFields: [],
  candidate: null,
  reason: 'destination_disallowed',
  evaluatedAt: '2026-07-10T14:01:01.000Z',
}

// @ts-expect-error A passed gate must carry its canonical candidate reference.
const impossiblePassedGate: NormalizationGateOutcome = {
  ...needsEnrichmentGate,
  status: 'passed',
}

const impossiblePassedGateWithMissingFacts: NormalizationGateOutcome = {
  status: 'passed',
  policyVersion: 'sourcing-gate/v4',
  requiredFields: ['companyName'],
  // @ts-expect-error A passed gate cannot report missing canonical facts.
  missingFields: ['companyName'],
  conflictingFields: [],
  candidate: {
    id: candidate.id,
    sourceEntityId: candidate.sourceEntityId,
    rawRecordId: candidate.rawRecordId,
    rawRevisionId: candidate.rawRevisionId,
    schemaVersion: candidate.schemaVersion,
  },
  evaluatedAt: '2026-07-10T14:01:01.000Z',
}

// @ts-expect-error A failed gate cannot carry a canonical candidate reference.
const impossibleFailedGateCandidate: NormalizationGateOutcome = {
  ...failedGate,
  candidate: {
    id: candidate.id,
    sourceEntityId: candidate.sourceEntityId,
    rawRecordId: candidate.rawRecordId,
    rawRevisionId: candidate.rawRevisionId,
    schemaVersion: candidate.schemaVersion,
  },
}

const normalization: RawSourceNormalizationResult = {
  rawRecordId: 'raw-1',
  rawRevisionId: 'revision-1',
  status: 'completed',
  canonicalSchemaVersion: 'job-candidate/v3',
  attempts: fallbackAfterAbstention,
  fieldOutcomes: [authoritativeMapping, lockedValue],
  gate: {
    status: 'passed',
    policyVersion: 'sourcing-gate/v4',
    requiredFields: ['companyName', 'roleTitle', 'destinationUrl'],
    missingFields: [],
    conflictingFields: [],
    candidate: {
      id: candidate.id,
      sourceEntityId: candidate.sourceEntityId,
      rawRecordId: candidate.rawRecordId,
      rawRevisionId: candidate.rawRevisionId,
      schemaVersion: candidate.schemaVersion,
    },
    evaluatedAt: '2026-07-10T14:01:01.000Z',
  },
  canonicalCandidate: candidate,
  updatedAt: '2026-07-10T14:01:01.000Z',
}

const normalizationBase = {
  rawRecordId: 'raw-1',
  rawRevisionId: 'revision-1',
  canonicalSchemaVersion: 'job-candidate/v3',
  attempts: fallbackAfterAbstention,
  fieldOutcomes: [authoritativeMapping, lockedValue],
  updatedAt: '2026-07-10T14:01:01.000Z',
}

const pendingNormalization: RawSourceNormalizationResult = {
  ...normalizationBase,
  status: 'pending',
  gate: null,
  canonicalCandidate: null,
}

const inProgressNormalization: RawSourceNormalizationResult = {
  ...normalizationBase,
  status: 'in_progress',
  gate: null,
  canonicalCandidate: null,
}

const blockedNormalization: RawSourceNormalizationResult = {
  ...normalizationBase,
  status: 'blocked',
  gate: null,
  canonicalCandidate: null,
}

const needsEnrichmentNormalization: RawSourceNormalizationResult = {
  ...normalizationBase,
  status: 'completed',
  gate: needsEnrichmentGate,
  canonicalCandidate: null,
}

const rejectedNormalization: RawSourceNormalizationResult = {
  ...normalizationBase,
  status: 'completed',
  gate: rejectedGate,
  canonicalCandidate: null,
}

const failedNormalization: RawSourceNormalizationResult = {
  ...normalizationBase,
  status: 'failed',
  gate: failedGate,
  canonicalCandidate: null,
}

// @ts-expect-error A passed gate requires a full canonical candidate.
const impossiblePassedNormalization: RawSourceNormalizationResult = {
  ...normalization,
  canonicalCandidate: null,
}

// @ts-expect-error Enrichment results cannot carry a canonical candidate.
const impossibleEnrichmentNormalization: RawSourceNormalizationResult = {
  ...normalizationBase,
  status: 'completed',
  gate: needsEnrichmentGate,
  canonicalCandidate: candidate,
}

// @ts-expect-error Rejected results cannot carry a canonical candidate.
const impossibleRejectedNormalization: RawSourceNormalizationResult = {
  ...normalizationBase,
  status: 'completed',
  gate: rejectedGate,
  canonicalCandidate: candidate,
}

// @ts-expect-error Pending normalization cannot carry a gate or candidate.
const impossiblePendingNormalization: RawSourceNormalizationResult = {
  ...normalizationBase,
  status: 'pending',
  gate: normalization.gate,
  canonicalCandidate: candidate,
}

// @ts-expect-error In-progress normalization cannot carry a gate or candidate.
const impossibleInProgressNormalization: RawSourceNormalizationResult = {
  ...normalizationBase,
  status: 'in_progress',
  gate: normalization.gate,
  canonicalCandidate: candidate,
}

// @ts-expect-error Blocked normalization cannot carry a gate or candidate.
const impossibleBlockedNormalization: RawSourceNormalizationResult = {
  ...normalizationBase,
  status: 'blocked',
  gate: normalization.gate,
  canonicalCandidate: candidate,
}

// @ts-expect-error A failed gate must correlate with failed normalization.
const impossibleCompletedFailure: RawSourceNormalizationResult = {
  ...normalizationBase,
  status: 'completed',
  gate: failedGate,
  canonicalCandidate: null,
}

// @ts-expect-error Failed normalization cannot carry a canonical candidate.
const impossibleFailedCandidate: RawSourceNormalizationResult = {
  ...normalizationBase,
  status: 'failed',
  gate: failedGate,
  canonicalCandidate: candidate,
}

void naturalUrl
void jobrightIntermediary
void normalization
void sparseCliIntake
void missingAdapter
void employmentTypeIsNotNullable
void workModeIsNotNullable
void explicitUnknownFacts
void receiptCarriesSourceEntity
void rawRecordCarriesSourceEntity
void rawOccurrenceCarriesOptionalCapture
void candidateReferenceCarriesSourceEntity
void needsEnrichmentGate
void failedGate
void rejectedGate
void impossiblePassedGate
void impossiblePassedGateWithMissingFacts
void impossibleFailedGateCandidate
void pendingNormalization
void inProgressNormalization
void blockedNormalization
void needsEnrichmentNormalization
void rejectedNormalization
void failedNormalization
void impossiblePassedNormalization
void impossibleEnrichmentNormalization
void impossibleRejectedNormalization
void impossiblePendingNormalization
void impossibleInProgressNormalization
void impossibleBlockedNormalization
void impossibleCompletedFailure
void impossibleFailedCandidate
void completedReplay
void failedReplay
void impossibleCompletedReplay
void runtimeValidatedNormalization
void impossibleFailedItem
void inspectWorkspaceReplay
