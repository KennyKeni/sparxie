import type {
  CanonicalSourceCandidate,
  CanonicalSourceCandidateReference,
  FieldResolutionOutcome,
  NormalizationAttempt,
  NormalizationGateOutcome,
  RawSourceNormalizationResult,
  RawSourceIntakeReceipt,
  RawSourceRecord,
  RawSourceRecordInput,
  ResolverDeclaration,
} from '../src/index.js'

type IsExact<Actual, Expected> =
  (<Value>() => Value extends Actual ? 1 : 2) extends <Value>() =>
    Value extends Expected ? 1 : 2
    ? true
    : false

const receiptCarriesSourceEntity: IsExact<
  RawSourceIntakeReceipt['sourceEntityId'],
  string | null
> = true
const rawRecordCarriesSourceEntity: IsExact<
  RawSourceRecord['sourceEntityId'],
  string | null
> = true
const candidateReferenceCarriesSourceEntity: IsExact<
  CanonicalSourceCandidateReference['sourceEntityId'],
  string
> = true

const sparseCliIntake: RawSourceRecordInput = {
  adapter: { id: 'valedictorian-cli', kind: 'cli', version: '0.12.0' },
  observedAt: '2026-07-10T14:00:00.000Z',
}

// @ts-expect-error Adapter provenance is required even when all job fields are absent.
const missingAdapter: RawSourceRecordInput = {
  observedAt: '2026-07-10T14:00:00.000Z',
}

const naturalUrl: RawSourceRecordInput = {
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
    resolver: providerMapper,
    inputHash: 'sha256:title',
    status: 'completed',
    startedAt: '2026-07-10T14:01:00.000Z',
    completedAt: '2026-07-10T14:01:00.010Z',
    outcomes: [
      {
        status: 'abstained',
        resolverId: providerMapper.id,
        resolverVersion: providerMapper.version,
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
      supportedAdapters: { kinds: ['connector', 'cli', 'manual', 'import'] },
      requiredInputs: ['payload.title'],
      outputFields: ['roleTitle'],
      capabilities: ['pure'],
      costClass: 'none',
      precedence: 10,
    },
    inputHash: 'sha256:title',
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
void candidateReferenceCarriesSourceEntity
void needsEnrichmentGate
void failedGate
