import type {
  ConnectorOptionQueryBody,
  ConnectorOptionQueryErrorBody,
  ConnectorOptionQueryErrorCode,
  ConnectorOptionQueryResult,
  ConnectorOptionQueryResultErrorCode,
  ConnectorOptionQueryStatus,
  ConnectorOptionValue,
} from '../src/index.js'
import {
  connectorOptionQueryBodySchema,
  connectorOptionQueryErrorBodies,
  connectorOptionQueryErrorBodySchema,
  connectorOptionQueryErrorCodes,
  connectorOptionQueryErrorStatusByCode,
  connectorOptionQueryMaxOptionKeyLength,
  connectorOptionQueryMaxOptionLabelLength,
  connectorOptionQueryResultErrorCodes,
  connectorOptionQueryResultSchema,
  connectorOptionQueryStatuses,
  connectorOptionValueSchema,
} from '../src/index.js'

type IsExact<Actual, Expected> =
  (<Value>() => Value extends Actual ? 1 : 2) extends
    (<Value>() => Value extends Expected ? 1 : 2)
    ? true
    : false

const bodyKeysAreExact: IsExact<
  keyof ConnectorOptionQueryBody,
  'sourceId' | 'operation' | 'dependencies'
> = true
const bodyOmitsBackendIdentity: IsExact<
  keyof ConnectorOptionQueryBody & (
    | 'connectorInstanceId'
    | 'connectorId'
    | 'connectorVersion'
    | 'filterSchemaVersion'
    | 'catalogVersion'
    | 'sourceVersion'
    | 'workspaceId'
    | 'executionScopeId'
    | 'auth'
    | 'route'
    | 'module'
    | 'function'
    | 'url'
    | 'secretKey'
  ),
  never
> = true
const statusesAreClosed: IsExact<
  ConnectorOptionQueryStatus,
  'search_ready' | 'search_empty' | 'resolve_ready' | 'auth_required' | 'error' | 'cancelled'
> = true
const resultErrorCodesAreClosed: IsExact<
  ConnectorOptionQueryResultErrorCode,
  'rate_limited' | 'temporarily_unavailable' | 'provider_rejected' | 'unexpected_response'
> = true
const compatibilityCodesAreClosed: IsExact<
  ConnectorOptionQueryErrorCode,
  | 'unsupported_descriptor'
  | 'connector_version_mismatch'
  | 'filter_schema_version_mismatch'
  | 'option_catalog_version_mismatch'
  | 'option_source_version_mismatch'
  | 'option_source_undeclared'
  | 'option_dependency_undeclared'
  | 'option_dependency_invalid'
  | 'option_value_invalid'
  | 'option_query_unavailable'
> = true
const optionValuesAreExact: IsExact<
  ConnectorOptionValue,
  string | number | boolean | Readonly<Record<string, string | number | boolean>>
> = true
const maxOptionKeyLength: 1_000 = connectorOptionQueryMaxOptionKeyLength
const maxOptionLabelLength: 1_000 = connectorOptionQueryMaxOptionLabelLength

const search: ConnectorOptionQueryBody = {
  sourceId: 'cities',
  operation: { kind: 'search', search: 'new', limit: 25 },
  dependencies: { state: 'NY', workModes: ['remote', 'hybrid'] },
}
const resolve: ConnectorOptionQueryBody = {
  sourceId: 'cities',
  operation: { kind: 'resolve', values: [{ city: 'New York', state: 'NY' }] },
  dependencies: {},
}

const bodyWithRouteIdentity: ConnectorOptionQueryBody = {
  ...search,
  // @ts-expect-error Connector instance identity is route input, never serialized body data.
  connectorInstanceId: 'connector-instance-1',
}
const bodyWithSpoofedVersion: ConnectorOptionQueryBody = {
  ...search,
  // @ts-expect-error Connector versions are derived by the backend.
  connectorVersion: '999.0.0',
}
const bodyWithAuth: ConnectorOptionQueryBody = {
  ...search,
  // @ts-expect-error Authentication internals are not public option-query input.
  auth: { requirementIds: ['provider-cookie'] },
}
const nestedOptionValue: ConnectorOptionValue = {
  // @ts-expect-error Public option objects are flat scalar records.
  nested: { code: 'NY' },
}
// @ts-expect-error Arrays are never public option values.
const arrayOptionValue: ConnectorOptionValue = ['NY']
// @ts-expect-error Null is never a public option value.
const nullOptionValue: ConnectorOptionValue = null

const binding = {
  connectorInstanceId: 'installed-jobright-1',
  connectorId: 'jobright',
  connectorVersion: '0.13.0',
  filterSchemaVersion: 'jobright-filter@1',
  catalogVersion: 'jobright-options@1',
  sourceId: 'cities',
  sourceVersion: 'cities@1',
} as const

const ready: ConnectorOptionQueryResult = {
  ...binding,
  status: 'search_ready',
  options: [{ key: 'new-york-ny', label: 'New York, NY', value: 'New York' }],
  truncated: false,
}
const empty: ConnectorOptionQueryResult = { ...binding, status: 'search_empty' }
const resolved: ConnectorOptionQueryResult = {
  ...binding,
  status: 'resolve_ready',
  options: [],
  unknownValues: ['missing'],
}
const authenticationRequired: ConnectorOptionQueryResult = {
  ...binding,
  status: 'auth_required',
}
const retryableError: ConnectorOptionQueryResult = {
  ...binding,
  status: 'error',
  code: 'rate_limited',
  retryable: true,
  retryAfterMs: 30_000,
}
const terminalError: ConnectorOptionQueryResult = {
  ...binding,
  status: 'error',
  code: 'provider_rejected',
  retryable: false,
}
const temporarilyUnavailable: ConnectorOptionQueryResult = {
  ...binding,
  status: 'error',
  code: 'temporarily_unavailable',
  retryable: true,
}
const retryableUnexpectedResponse: ConnectorOptionQueryResult = {
  ...binding,
  status: 'error',
  code: 'unexpected_response',
  retryable: true,
}
const terminalUnexpectedResponse: ConnectorOptionQueryResult = {
  ...binding,
  status: 'error',
  code: 'unexpected_response',
  retryable: false,
}
// @ts-expect-error Rate limits are always retryable.
const terminalRateLimit: ConnectorOptionQueryResult = { ...binding, status: 'error', code: 'rate_limited', retryable: false }
// @ts-expect-error Temporary unavailability is always retryable.
const terminalUnavailability: ConnectorOptionQueryResult = { ...binding, status: 'error', code: 'temporarily_unavailable', retryable: false }
// @ts-expect-error Provider rejection is always terminal.
const retryableProviderRejection: ConnectorOptionQueryResult = { ...binding, status: 'error', code: 'provider_rejected', retryable: true }
const cancelled: ConnectorOptionQueryResult = { ...binding, status: 'cancelled' }

const authenticationWithInternals: ConnectorOptionQueryResult = {
  ...binding,
  status: 'auth_required',
  // @ts-expect-error Authentication requirement ids are private implementation detail.
  requirementIds: ['provider-cookie'],
}
const cancelledWithReason: ConnectorOptionQueryResult = {
  ...binding,
  status: 'cancelled',
  // @ts-expect-error Server-settled cancellation exposes no provider reason.
  reason: 'provider session expired',
}
const nonRetryableDelay: ConnectorOptionQueryResult = {
  ...binding,
  status: 'error',
  code: 'provider_rejected',
  retryable: false,
  // @ts-expect-error A terminal error cannot expose retry scheduling.
  retryAfterMs: 30_000,
}
const providerErrorCode: ConnectorOptionQueryResult = {
  ...binding,
  status: 'error',
  // @ts-expect-error Raw provider error codes are outside the closed public code set.
  code: 'jobright_cookie_expired',
  retryable: false,
}

function narrowResult(result: ConnectorOptionQueryResult): void {
  switch (result.status) {
    case 'search_ready': {
      const options = result.options
      const truncated = result.truncated
      void [options, truncated]
      break
    }
    case 'search_empty':
      // @ts-expect-error search_empty is intentionally distinct from an empty options page.
      void result.options
      break
    case 'resolve_ready': {
      const unknownValues = result.unknownValues
      void unknownValues
      break
    }
    case 'auth_required':
      // @ts-expect-error Public auth-required results never reveal auth declarations.
      void result.requirementIds
      break
    case 'error':
      if (!result.retryable) {
        // @ts-expect-error Non-retryable errors cannot carry retryAfterMs.
        void result.retryAfterMs
      }
      break
    case 'cancelled':
      break
    default: {
      const exhaustive: never = result
      void exhaustive
    }
  }
}

const canonicalCompatibilityError: ConnectorOptionQueryErrorBody =
  connectorOptionQueryErrorBodies.option_value_invalid
const incorrectCompatibilityMessage: ConnectorOptionQueryErrorBody = {
  code: 'option_value_invalid',
  // @ts-expect-error Recognized errors use fixed sanitized messages.
  message: 'Provider rejected secret cookie.',
}
const compatibilityStatus: 409 | 422 =
  connectorOptionQueryErrorStatusByCode[canonicalCompatibilityError.code]

connectorOptionValueSchema satisfies { parse(value: unknown): ConnectorOptionValue }
connectorOptionQueryBodySchema satisfies { parse(value: unknown): ConnectorOptionQueryBody }
connectorOptionQueryResultSchema satisfies { parse(value: unknown): ConnectorOptionQueryResult }
connectorOptionQueryErrorBodySchema satisfies {
  parse(value: unknown): ConnectorOptionQueryErrorBody
}
connectorOptionQueryStatuses satisfies readonly ConnectorOptionQueryStatus[]
connectorOptionQueryResultErrorCodes satisfies readonly ConnectorOptionQueryResultErrorCode[]
connectorOptionQueryErrorCodes satisfies readonly ConnectorOptionQueryErrorCode[]

void arrayOptionValue
void authenticationRequired
void authenticationWithInternals
void bodyKeysAreExact
void bodyOmitsBackendIdentity
void bodyWithAuth
void bodyWithRouteIdentity
void bodyWithSpoofedVersion
void cancelled
void cancelledWithReason
void canonicalCompatibilityError
void compatibilityCodesAreClosed
void compatibilityStatus
void empty
void incorrectCompatibilityMessage
void nestedOptionValue
void nonRetryableDelay
void nullOptionValue
void optionValuesAreExact
void maxOptionKeyLength
void maxOptionLabelLength
void providerErrorCode
void ready
void resolve
void resolved
void resultErrorCodesAreClosed
void retryableProviderRejection
void retryableUnexpectedResponse
void retryableError
void search
void statusesAreClosed
void terminalError
void terminalRateLimit
void terminalUnavailability
void terminalUnexpectedResponse
void temporarilyUnavailable
void narrowResult
