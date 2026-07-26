import type {
  ProfileAgentContext,
  ProfileDocument,
  ProfileDocumentUpdateInput,
  ProfileSecretKind,
  ProfileSecretSummary,
  ProfileUpdateInput,
  UpsertProfileSecretInput,
  UserProfile,
  ValedictorianWorkspaceClient,
} from '../src/index.js'

type IsExact<Actual, Expected> =
  (<Value>() => Value extends Actual ? 1 : 2) extends <Value>() =>
    Value extends Expected ? 1 : 2
    ? true
    : false

type HasKey<Type, Key extends PropertyKey> = Key extends keyof Type ? true : false

const userProfileOmitsSsn: IsExact<HasKey<UserProfile, 'ssn'>, false> = true
const userProfileOmitsSsnLast4: IsExact<HasKey<UserProfile, 'ssnLast4'>, false> = true
const profileUpdateOmitsSsn: IsExact<
  keyof ProfileUpdateInput & ('ssn' | 'ssnLast4'),
  never
> = true
const documentProfileOmitsSsn: IsExact<
  keyof ProfileDocument['profile'] & ('ssn' | 'ssnLast4'),
  never
> = true
const documentUpdateProfileOmitsSsn: IsExact<
  keyof ProfileDocumentUpdateInput['profile'] & ('ssn' | 'ssnLast4'),
  never
> = true
const agentBasicsOmitSsn: IsExact<
  keyof ProfileAgentContext['basics'] & ('ssn' | 'ssnLast4'),
  never
> = true

const profileClientKeysAreExact: IsExact<
  keyof ValedictorianWorkspaceClient['profile'],
  'get' | 'update' | 'agentContext' | 'document'
> = true

const profileClientOmitsSensitiveSurfaces: IsExact<
  keyof ValedictorianWorkspaceClient['profile'] & ('sensitive' | 'secrets' | 'identity'),
  never
> = true

const identityRemainsASecretKind: IsExact<
  ProfileSecretKind,
  'password' | 'token' | 'identity' | 'other'
> = true

const secretSummaryKeysAreExact: IsExact<
  keyof ProfileSecretSummary,
  'key' | 'kind' | 'label' | 'updatedAt'
> = true

const upsertSecretKeysAreExact: IsExact<
  keyof UpsertProfileSecretInput,
  'key' | 'kind' | 'label' | 'value'
> = true

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

const documentUpdateRejectingSsn: ProfileDocumentUpdateInput = {
  expectedRevision: 'rev-1',
  profile: {
    fullName: 'Kenny Lin',
    // @ts-expect-error Identity secrets never travel on the profile document.
    ssnLast4: '5125',
  },
}

void userProfileOmitsSsn
void userProfileOmitsSsnLast4
void profileUpdateOmitsSsn
void documentProfileOmitsSsn
void documentUpdateProfileOmitsSsn
void agentBasicsOmitSsn
void profileClientKeysAreExact
void profileClientOmitsSensitiveSurfaces
void identityRemainsASecretKind
void secretSummaryKeysAreExact
void upsertSecretKeysAreExact
void barePatchAsDocumentUpdate
void validDocumentUpdate
void documentUpdateRejectingSsn
