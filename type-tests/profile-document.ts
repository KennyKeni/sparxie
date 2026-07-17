import type {
  ProfileAgentContext,
  ProfileDocument,
  ProfileDocumentUpdateInput,
  ProfileSensitiveDetails,
  ProfileUpdateInput,
  UserProfile,
} from '../src/index.js'

type IsExact<Actual, Expected> =
  (<Value>() => Value extends Actual ? 1 : 2) extends <Value>() =>
    Value extends Expected ? 1 : 2
    ? true
    : false

type HasKey<Type, Key extends PropertyKey> = Key extends keyof Type ? true : false

const userProfileOmitsSsn: IsExact<HasKey<UserProfile, 'ssn'>, false> = true
const userProfileOmitsSsnLast4: IsExact<HasKey<UserProfile, 'ssnLast4'>, false> = true
const documentProfileOmitsSsnLast4: IsExact<
  HasKey<ProfileDocument['profile'], 'ssnLast4'>,
  false
> = true
const agentBasicsOmitSsnLast4: IsExact<
  HasKey<ProfileAgentContext['basics'], 'ssnLast4'>,
  false
> = true

const sensitiveKeepsLegacySsnLast4: IsExact<
  ProfileSensitiveDetails['ssnLast4'],
  string | null
> = true
const sensitiveKeepsLegacyBirthDay: IsExact<
  ProfileSensitiveDetails['birthDay'],
  string | null
> = true

const legacySensitiveOmittingDateOfBirth: ProfileSensitiveDetails = {
  birthDay: '12',
  birthMonth: '4',
  birthYear: '1998',
  disabilityStatus: 'No',
  gender: 'Man',
  hispanicLatino: 'No',
  raceEthnicity: 'Asian',
  ssnLast4: '5125',
  veteranStatus: 'Not a protected veteran',
}

const legacySensitiveArbitraryStrings: ProfileSensitiveDetails = {
  birthDay: null,
  birthMonth: null,
  birthYear: null,
  dateOfBirth: 'not-necessarily-iso',
  disabilityStatus: 'custom-legacy-disability',
  gender: 'custom-legacy-gender',
  hispanicLatino: 'custom-legacy-hispanic',
  raceEthnicity: 'custom-legacy-race',
  ssnLast4: null,
  veteranStatus: 'custom-legacy-veteran',
}

declare const barePatch: ProfileUpdateInput
// @ts-expect-error Document update is not assignable from a bare profile patch.
const barePatchAsDocumentUpdate: ProfileDocumentUpdateInput = barePatch

const validDocumentUpdate: ProfileDocumentUpdateInput = {
  expectedRevision: 'rev-1',
  profile: {
    fullName: 'Kenny Lin',
    dateOfBirth: '1998-04-12',
  },
}

void userProfileOmitsSsn
void userProfileOmitsSsnLast4
void documentProfileOmitsSsnLast4
void agentBasicsOmitSsnLast4
void sensitiveKeepsLegacySsnLast4
void sensitiveKeepsLegacyBirthDay
void legacySensitiveOmittingDateOfBirth
void legacySensitiveArbitraryStrings
void barePatchAsDocumentUpdate
void validDocumentUpdate
