import type {
  CreateSourcingFindingInput,
  ProcessSourcingCandidateInput,
  SetSourcingFindingDecisionInput,
  SourcingFinding,
  SourcingFindingCanonicalProjection,
  SourcingFindingsListInput,
  UpdateSourcingFindingInput,
} from '../src/index.js'
import { createSourcingFindingInputSchema } from '../src/index.js'

type ProjectionOwnedFields = {
  destinationClass: 'employer_or_ats' | 'third_party_job_posting' | null
  destinationUrl: string | null
  intermediaryUrl: string | null
  usability: 'usable' | 'review_only'
}

type HasProjectionOwnedFields<T> = Extract<keyof T, keyof ProjectionOwnedFields> extends never
  ? false
  : true

type IsExact<Actual, Expected> =
  (<Value>() => Value extends Actual ? 1 : 2) extends <Value>() =>
    Value extends Expected ? 1 : 2
    ? true
    : false

const createIsProjectionNeutral: HasProjectionOwnedFields<CreateSourcingFindingInput> = false
const updateIsProjectionNeutral: HasProjectionOwnedFields<UpdateSourcingFindingInput> = false
const decisionIsProjectionNeutral: HasProjectionOwnedFields<SetSourcingFindingDecisionInput> = false
const processIsProjectionNeutral: HasProjectionOwnedFields<ProcessSourcingCandidateInput> = false
const destinationClassIsCompatibilityOptional: IsExact<
  SourcingFinding['destinationClass'],
  ProjectionOwnedFields['destinationClass'] | undefined
> = true
const destinationUrlIsCompatibilityOptional: IsExact<
  SourcingFinding['destinationUrl'],
  ProjectionOwnedFields['destinationUrl'] | undefined
> = true
const intermediaryUrlIsCompatibilityOptional: IsExact<
  SourcingFinding['intermediaryUrl'],
  ProjectionOwnedFields['intermediaryUrl'] | undefined
> = true
const usabilityIsCompatibilityOptional: IsExact<
  SourcingFinding['usability'],
  ProjectionOwnedFields['usability'] | undefined
> = true
const rawRevisionLineageIsCompatibilityOptional: IsExact<
  SourcingFinding['rawRevisionId'],
  string | undefined
> = true
const candidateLineageIsCompatibilityOptional: IsExact<
  SourcingFinding['canonicalCandidateId'],
  string | undefined
> = true
const employmentTypeIsExplicitWhenProjected: IsExact<
  SourcingFinding['employmentType'],
  | 'full_time'
  | 'part_time'
  | 'contract'
  | 'temporary'
  | 'internship'
  | 'apprenticeship'
  | 'other'
  | 'unknown'
  | undefined
> = true
const seniorityIsExplicitWhenProjected: IsExact<
  SourcingFinding['seniority'],
  | 'internship'
  | 'entry_level'
  | 'associate'
  | 'mid_level'
  | 'senior'
  | 'staff'
  | 'principal'
  | 'manager'
  | 'director'
  | 'executive'
  | 'unknown'
  | undefined
> = true
const findingCountryIsNullable: IsExact<SourcingFinding['country'], string | null> = true
const createCountryIsOptionalNullable: IsExact<
  CreateSourcingFindingInput['country'],
  string | null | undefined
> = true
const updateCountryIsOptionalNullable: IsExact<
  UpdateSourcingFindingInput['country'],
  string | null | undefined
> = true

declare const findingWithPossiblyUnknownCountry: SourcingFinding
// @ts-expect-error Consumers must handle an explicitly unknown sourcing country.
const definitelyKnownCountry: string = findingWithPossiblyUnknownCountry.country

declare const legacyFindingBase: Omit<
  SourcingFinding,
  Exclude<keyof SourcingFindingCanonicalProjection, 'workMode'>
>

// @ts-expect-error Finding reads carry either no canonical projection or all of it.
const impossiblePartialFindingRead: SourcingFinding = {
  ...legacyFindingBase,
  rawRevisionId: 'raw-revision-1',
}
const destinationClassFilterIsExact: IsExact<
  SourcingFindingsListInput['destinationClass'],
  Exclude<ProjectionOwnedFields['destinationClass'], null> | undefined
> = true
const usabilityFilterIsExact: IsExact<
  SourcingFindingsListInput['usability'],
  ProjectionOwnedFields['usability'] | undefined
> = true

const validCreate: CreateSourcingFindingInput = {
  workflowRunId: 'run-1',
  companyName: 'Example',
  roleTitle: 'Engineer',
  roleKind: 'internship',
  workMode: 'remote',
}

const runtimeValidatedCreate: CreateSourcingFindingInput =
  createSourcingFindingInputSchema.parse(validCreate)

const invalidMergeStatusCreate: CreateSourcingFindingInput = {
  ...validCreate,
  // @ts-expect-error Finding merge status is a closed public contract.
  mergeStatus: 'totally-invalid',
}

const workspaceSpoofCreate: CreateSourcingFindingInput = {
  ...validCreate,
  // @ts-expect-error Workspace binding comes only from the explicit HTTP route.
  workspaceId: 'workspace-2',
}

const canonicalCreate: CreateSourcingFindingInput = {
  ...validCreate,
  rawRevisionId: 'raw-revision-1',
  canonicalCandidateId: 'candidate-1',
  destination: null,
  employmentType: 'unknown',
  seniority: 'unknown',
  location: null,
  compensation: null,
  postedAt: { value: null, precision: 'unknown', raw: null },
}

const explicitUnknownCountryCreate: CreateSourcingFindingInput = {
  ...validCreate,
  country: null,
}

const explicitUnknownCountryUpdate: UpdateSourcingFindingInput = {
  findingId: 'finding-1',
  country: null,
}

// @ts-expect-error Raw revision and canonical candidate lineage must travel together.
const impossiblePartialLineage: CreateSourcingFindingInput = {
  ...validCreate,
  rawRevisionId: 'raw-revision-1',
}

const impossibleUnknownPostedAt: CreateSourcingFindingInput = {
  ...validCreate,
  rawRevisionId: 'raw-revision-1',
  canonicalCandidateId: 'candidate-1',
  destination: null,
  employmentType: 'unknown',
  seniority: 'unknown',
  location: null,
  compensation: null,
  postedAt: {
    value: '2026-07-11T14:00:00.000Z',
    // @ts-expect-error A concrete canonical time cannot have unknown precision.
    precision: 'unknown',
    raw: null,
  },
}

const spoofedCreate: CreateSourcingFindingInput = {
  ...validCreate,
  // @ts-expect-error Destination provenance is projection-owned.
  destinationClass: 'employer_or_ats',
}

const spoofedUpdate: UpdateSourcingFindingInput = {
  findingId: 'finding-1',
  // @ts-expect-error Destination provenance is projection-owned.
  destinationUrl: 'https://jobs.example.test/123',
}

const spoofedDecision: SetSourcingFindingDecisionInput = {
  findingId: 'finding-1',
  mergeStatus: 'blocked',
  // @ts-expect-error Destination provenance is projection-owned.
  intermediaryUrl: 'https://source.example.test/123',
}

const spoofedProcess: ProcessSourcingCandidateInput = {
  workflowRunId: 'run-1',
  companyName: 'Example',
  roleTitle: 'Engineer',
  roleKind: 'internship',
  workMode: 'remote',
  // @ts-expect-error Destination provenance is projection-owned.
  usability: 'usable',
}

// @ts-expect-error Destination classes are a closed public contract.
const invalidDestinationClass: NonNullable<SourcingFinding['destinationClass']> = 'official'

// @ts-expect-error Usability is a closed public contract.
const invalidUsability: NonNullable<SourcingFinding['usability']> = 'unresolved'

void createIsProjectionNeutral
void updateIsProjectionNeutral
void decisionIsProjectionNeutral
void processIsProjectionNeutral
void destinationClassIsCompatibilityOptional
void destinationUrlIsCompatibilityOptional
void intermediaryUrlIsCompatibilityOptional
void usabilityIsCompatibilityOptional
void rawRevisionLineageIsCompatibilityOptional
void candidateLineageIsCompatibilityOptional
void employmentTypeIsExplicitWhenProjected
void seniorityIsExplicitWhenProjected
void findingCountryIsNullable
void createCountryIsOptionalNullable
void updateCountryIsOptionalNullable
void definitelyKnownCountry
void impossiblePartialFindingRead
void destinationClassFilterIsExact
void usabilityFilterIsExact
void spoofedCreate
void canonicalCreate
void explicitUnknownCountryCreate
void explicitUnknownCountryUpdate
void runtimeValidatedCreate
void invalidMergeStatusCreate
void workspaceSpoofCreate
void impossiblePartialLineage
void impossibleUnknownPostedAt
void spoofedUpdate
void spoofedDecision
void spoofedProcess
void invalidDestinationClass
void invalidUsability
