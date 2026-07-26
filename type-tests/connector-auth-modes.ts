import type {
  ConnectorAuthMode,
  ConnectorAuthReferenceInput,
  CreateConnectorInstanceInput,
  UpdateConnectorInstanceInput,
} from '../src/index.js'
import { connectorAuthModes, connectorAuthReferenceInputSchema } from '../src/index.js'

type IsExact<Actual, Expected> =
  (<Value>() => Value extends Actual ? 1 : 2) extends <Value>() =>
    Value extends Expected ? 1 : 2
    ? true
    : false

const authModeVocabularyIsSecretReferenceOnly: IsExact<
  ConnectorAuthMode,
  'none' | 'api_key' | 'bearer_token' | 'oauth' | 'cookie_jar' | 'username_password'
> = true

const authReferenceKeysAreSecretReferenceOnly: IsExact<
  keyof ConnectorAuthReferenceInput,
  'id' | 'mode' | 'label' | 'secretKey'
> = true

const secretReference: ConnectorAuthReferenceInput = {
  id: 'jobright-login',
  mode: 'username_password',
  label: 'Jobright login',
  secretKey: 'jobright_credentials',
}

const retiredMode: ConnectorAuthReferenceInput = {
  id: 'jobright-session',
  // @ts-expect-error Browser-session authentication is no longer a public auth mode.
  mode: 'browser_session',
}

const retiredSessionKey: ConnectorAuthReferenceInput = {
  id: 'jobright-login',
  mode: 'username_password',
  // @ts-expect-error Auth references carry no session key.
  sessionKey: 'workspace-session',
}

const createWithRetiredSessionKey: CreateConnectorInstanceInput = {
  id: 'connector-1',
  connectorId: 'jobright.resolver',
  connectorVersion: '0.1.0',
  displayName: 'Jobright',
  enabled: true,
  auth: [
    {
      id: 'jobright-login',
      mode: 'username_password',
      // @ts-expect-error Create input never accepts a session key.
      sessionKey: 'workspace-session',
    },
  ],
}

const updateWithRetiredMode: UpdateConnectorInstanceInput = {
  connectorInstanceId: 'connector-1',
  auth: [
    {
      id: 'jobright-session',
      // @ts-expect-error Update input never accepts the retired browser-session mode.
      mode: 'browser_session',
    },
  ],
}

void authModeVocabularyIsSecretReferenceOnly
void authReferenceKeysAreSecretReferenceOnly
void secretReference
void retiredMode
void retiredSessionKey
void createWithRetiredSessionKey
void updateWithRetiredMode
void connectorAuthModes
void connectorAuthReferenceInputSchema
