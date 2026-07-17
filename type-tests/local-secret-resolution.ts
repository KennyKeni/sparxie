import type {
  LocalSecretResolutionHttpError,
  LocalSecretResolutionInput,
  LocalSecretResolutionResult,
  SecretReference,
  SecretReferenceUri,
  ValedictorianClient,
  ValedictorianWorkspaceClient,
} from '../src/index.js'
import {
  createSecretReference,
  localSecretResolutionErrorBodies,
  localSecretResolutionInputSchema,
  localSecretResolutionResultSchema,
  secretReferenceSchema,
} from '../src/index.js'

type IsExact<Actual, Expected> =
  (<Value>() => Value extends Actual ? 1 : 2) extends
    (<Value>() => Value extends Expected ? 1 : 2)
    ? true
    : false

const rootOmitsSecrets: IsExact<
  keyof ValedictorianClient & 'secrets',
  never
> = true

const workspaceSecretsKeysAreExact: IsExact<
  keyof ValedictorianWorkspaceClient['secrets'],
  'delete' | 'list' | 'upsert' | 'local'
> = true

const workspaceSecretsOmitRevealSurfaces: IsExact<
  keyof ValedictorianWorkspaceClient['secrets'] & ('get' | 'reveal' | 'query'),
  never
> = true

const localSecretsKeysAreExact: IsExact<
  keyof ValedictorianWorkspaceClient['secrets']['local'],
  'resolve'
> = true

const localSecretsOmitGetRevealQuery: IsExact<
  keyof ValedictorianWorkspaceClient['secrets']['local'] & ('get' | 'reveal' | 'query'),
  never
> = true

const referenceIsTaggedObject: IsExact<
  SecretReference,
  { readonly $valedictorianRef: SecretReferenceUri }
> = true

const resolveInputKeysAreExact: IsExact<
  keyof LocalSecretResolutionInput,
  'reference' | 'purpose'
> = true

const resolveResultKeysAreExact: IsExact<
  keyof LocalSecretResolutionResult,
  'value' | 'handling'
> = true

const typedErrorExposesCanonicalFields: IsExact<
  keyof LocalSecretResolutionHttpError & ('code' | 'body' | 'message' | 'status'),
  'code' | 'body' | 'message' | 'status'
> = true

secretReferenceSchema satisfies { parse(value: unknown): SecretReference }
localSecretResolutionInputSchema satisfies {
  parse(value: unknown): LocalSecretResolutionInput
}
localSecretResolutionResultSchema satisfies {
  parse(value: unknown): LocalSecretResolutionResult
}

const reference = createSecretReference('connector_jobright/password')
const notOrdinaryText: SecretReference = reference
// @ts-expect-error structured references are not ordinary text strings
const rejectedBareUri: SecretReference = 'secret://connector_jobright/password'

const canonicalUnsupported = localSecretResolutionErrorBodies.local_secret_resolution_unsupported
const messageIsValueFree: 'Local secret resolution is unsupported.' = canonicalUnsupported.message

void rootOmitsSecrets
void workspaceSecretsKeysAreExact
void workspaceSecretsOmitRevealSurfaces
void localSecretsKeysAreExact
void localSecretsOmitGetRevealQuery
void referenceIsTaggedObject
void resolveInputKeysAreExact
void resolveResultKeysAreExact
void typedErrorExposesCanonicalFields
void notOrdinaryText
void rejectedBareUri
void messageIsValueFree
