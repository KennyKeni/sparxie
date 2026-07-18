import { z } from 'zod'
import { snapshotBoundedPlainData } from './safe-plain-data.js'

export const connectorOptionQueryMaxIdentifierLength = 128
export const connectorOptionQueryMaxVersionLength = 128
export const connectorOptionQueryMaxSearchLength = 10_000
export const connectorOptionQueryMaxLimit = 1_000
export const connectorOptionQueryMaxDependencies = 64
export const connectorOptionQueryMaxDependencyValues = 1_000
export const connectorOptionQueryMaxResolveValues = 1_000
export const connectorOptionQueryMaxOptions = 1_000
export const connectorOptionQueryMaxOptionStringLength = 10_000
export const connectorOptionQueryMaxOptionObjectProperties = 100
export const connectorOptionQueryMaxOptionKeyLength = 1_000
export const connectorOptionQueryMaxOptionLabelLength = 1_000
export const connectorOptionQueryMaxRetryAfterMs = 86_400_000

const unsafeNames = new Set(['__proto__', 'prototype', 'constructor'])
const capabilityIdPattern = /^[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)*$/
const genericVersionPattern = /^[A-Za-z0-9][A-Za-z0-9._@+-]*$/
const identifierSchema = z.string().min(1).max(connectorOptionQueryMaxIdentifierLength)
  .regex(capabilityIdPattern)
const versionSchema = z.string().min(1).max(connectorOptionQueryMaxVersionLength)
  .regex(genericVersionPattern)
const dynamicVersionSchema = z.string().min(3).max(connectorOptionQueryMaxVersionLength)
  .regex(/^[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)*@\d+$/)
const connectorInstanceIdSchema = z.string().min(1).max(connectorOptionQueryMaxIdentifierLength)
  .refine((value) => value.trim().length > 0 && !/^(?:https?:\/\/|\.{1,2}\/|\/)/i.test(value))
const optionScalarSchema = z.union([
  z.string().max(connectorOptionQueryMaxOptionStringLength),
  z.number().finite(),
  z.boolean(),
])

type ConnectorOptionScalar = string | number | boolean

export type ConnectorOptionValue =
  | ConnectorOptionScalar
  | Readonly<Record<string, ConnectorOptionScalar>>

function isSafePlainRecord(
  value: unknown,
  maximumProperties: number,
  allowEmpty: boolean,
): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  if (Object.getPrototypeOf(value) !== Object.prototype) return false
  const keys = Object.keys(value)
  if ((!allowEmpty && keys.length === 0) || keys.length > maximumProperties) return false
  return keys.every((key) => !unsafeNames.has(key))
}

const optionObjectInputSchema = z.custom<Record<string, unknown>>(
  (value) => isSafePlainRecord(value, connectorOptionQueryMaxOptionObjectProperties, false),
  'option value must be a non-empty safe plain object',
)

const optionObjectKeySchema = z.string().min(1).max(connectorOptionQueryMaxIdentifierLength)
  .regex(capabilityIdPattern)

const optionObjectSchema = optionObjectInputSchema.pipe(z.record(
  optionObjectKeySchema,
  optionScalarSchema,
))

const connectorOptionValueInnerSchema: z.ZodType<ConnectorOptionValue> = z.union([
  optionScalarSchema,
  optionObjectSchema,
])

const queryPlainDataSchema = z.unknown().transform((value, context) => {
  const snapshot = snapshotBoundedPlainData(value, {
    maxDepth: 16,
    maxNodes: 250_000,
    maxArrayLength: 10_000,
  })
  if (!snapshot.success) {
    context.addIssue({ code: 'custom', message: 'connector option data must be bounded plain data' })
    return z.NEVER
  }
  return snapshot.value
})

export const connectorOptionValueSchema: z.ZodType<ConnectorOptionValue> =
  queryPlainDataSchema.pipe(connectorOptionValueInnerSchema)

function canonicalScalar(value: ConnectorOptionScalar): string {
  if (typeof value === 'string') return `string:${JSON.stringify(value)}`
  if (typeof value === 'boolean') return `boolean:${value}`
  return `number:${String(value)}`
}

function canonicalOptionValue(value: ConnectorOptionValue): string {
  if (typeof value !== 'object') return canonicalScalar(value)
  return `object:${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}=${canonicalScalar(value[key]!)}`)
    .join(',')}`
}

function valuesAreUnique(values: readonly ConnectorOptionValue[]): boolean {
  const canonicalValues = values.map(canonicalOptionValue)
  return new Set(canonicalValues).size === canonicalValues.length
}

const optionValueArraySchema = z.array(connectorOptionValueInnerSchema)
  .min(1)
  .max(connectorOptionQueryMaxDependencyValues)
  .refine(valuesAreUnique, 'option values must be unique')

export type ConnectorOptionQueryOperation =
  | { kind: 'search'; search: string; limit?: number }
  | { kind: 'resolve'; values: ConnectorOptionValue[] }

export type ConnectorOptionQueryDependencies = Readonly<Record<
  string,
  ConnectorOptionValue | ConnectorOptionValue[]
>>

export interface ConnectorOptionQueryBody {
  sourceId: string
  operation: ConnectorOptionQueryOperation
  dependencies: ConnectorOptionQueryDependencies
}

const queryOperationSchema: z.ZodType<ConnectorOptionQueryOperation> = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('search'),
    search: z.string().max(connectorOptionQueryMaxSearchLength),
    limit: z.number().int().positive().max(connectorOptionQueryMaxLimit).optional(),
  }).strict(),
  z.object({
    kind: z.literal('resolve'),
    values: z.array(connectorOptionValueInnerSchema)
      .min(1)
      .max(connectorOptionQueryMaxResolveValues)
      .refine(valuesAreUnique, 'resolve values must be unique'),
  }).strict(),
])

const dependenciesInputSchema = z.custom<Record<string, unknown>>(
  (value) => isSafePlainRecord(value, connectorOptionQueryMaxDependencies, true),
  'dependencies must be a safe plain object',
)

const dependenciesSchema: z.ZodType<ConnectorOptionQueryDependencies> = dependenciesInputSchema.pipe(
  z.record(
    identifierSchema,
    z.union([connectorOptionValueInnerSchema, optionValueArraySchema]),
  ),
)

const connectorOptionQueryBodyInnerSchema: z.ZodType<ConnectorOptionQueryBody> = z.object({
  sourceId: identifierSchema,
  operation: queryOperationSchema,
  dependencies: dependenciesSchema,
}).strict()

export const connectorOptionQueryBodySchema: z.ZodType<ConnectorOptionQueryBody> =
  queryPlainDataSchema.pipe(connectorOptionQueryBodyInnerSchema)

export const connectorOptionQueryStatuses = Object.freeze([
  'search_ready',
  'search_empty',
  'resolve_ready',
  'auth_required',
  'error',
  'cancelled',
] as const)

export type ConnectorOptionQueryStatus = typeof connectorOptionQueryStatuses[number]

export const connectorOptionQueryResultErrorCodes = Object.freeze([
  'rate_limited',
  'temporarily_unavailable',
  'provider_rejected',
  'unexpected_response',
] as const)

export type ConnectorOptionQueryResultErrorCode =
  typeof connectorOptionQueryResultErrorCodes[number]

export interface ConnectorOptionQueryBindingIdentity {
  connectorInstanceId: string
  connectorId: string
  connectorVersion: string
  filterSchemaVersion: string
  catalogVersion: string
  sourceId: string
  sourceVersion: string
}

export interface ConnectorOption {
  key: string
  label: string
  value: ConnectorOptionValue
}

type ConnectorOptionQueryBoundResult<Result> = ConnectorOptionQueryBindingIdentity & Result

export type ConnectorOptionQueryResult =
  | ConnectorOptionQueryBoundResult<{
      status: 'search_ready'
      options: ConnectorOption[]
      truncated: boolean
    }>
  | ConnectorOptionQueryBoundResult<{ status: 'search_empty' }>
  | ConnectorOptionQueryBoundResult<{
      status: 'resolve_ready'
      options: ConnectorOption[]
      unknownValues: ConnectorOptionValue[]
    }>
  | ConnectorOptionQueryBoundResult<{ status: 'auth_required' }>
  | ConnectorOptionQueryBoundResult<{
      status: 'error'
      code: 'rate_limited' | 'temporarily_unavailable'
      retryable: true
      retryAfterMs?: number
    }>
  | ConnectorOptionQueryBoundResult<{
      status: 'error'
      code: 'provider_rejected'
      retryable: false
    }>
  | ConnectorOptionQueryBoundResult<{
      status: 'error'
      code: 'unexpected_response'
      retryable: true
      retryAfterMs?: number
    }>
  | ConnectorOptionQueryBoundResult<{
      status: 'error'
      code: 'unexpected_response'
      retryable: false
    }>
  | ConnectorOptionQueryBoundResult<{ status: 'cancelled' }>

const bindingIdentityShape = {
  connectorInstanceId: connectorInstanceIdSchema,
  connectorId: identifierSchema,
  connectorVersion: versionSchema,
  filterSchemaVersion: versionSchema,
  catalogVersion: dynamicVersionSchema,
  sourceId: identifierSchema,
  sourceVersion: dynamicVersionSchema,
}

const optionSchema: z.ZodType<ConnectorOption> = z.object({
  key: z.string().min(1).max(connectorOptionQueryMaxOptionKeyLength),
  label: z.string().min(1).max(connectorOptionQueryMaxOptionLabelLength),
  value: connectorOptionValueInnerSchema,
}).strict()

const optionsSchema = z.array(optionSchema).max(connectorOptionQueryMaxOptions).superRefine(
  (options, context) => {
    if (new Set(options.map((option) => option.key)).size !== options.length) {
      context.addIssue({ code: 'custom', message: 'option keys must be unique' })
    }
    if (!valuesAreUnique(options.map((option) => option.value))) {
      context.addIssue({ code: 'custom', message: 'option values must be unique' })
    }
  },
)

const retryAfterMsSchema = z.number().int().positive().max(connectorOptionQueryMaxRetryAfterMs)

const searchReadyResultSchema = z.object({
  ...bindingIdentityShape,
  status: z.literal('search_ready'),
  options: optionsSchema.min(1),
  truncated: z.boolean(),
}).strict()

const searchEmptyResultSchema = z.object({
  ...bindingIdentityShape,
  status: z.literal('search_empty'),
}).strict()

const resolveReadyResultSchema = z.object({
  ...bindingIdentityShape,
  status: z.literal('resolve_ready'),
  options: optionsSchema,
  unknownValues: z.array(connectorOptionValueInnerSchema).max(connectorOptionQueryMaxResolveValues),
}).strict().superRefine((result, context) => {
  if (!valuesAreUnique(result.unknownValues)) {
    context.addIssue({ code: 'custom', message: 'unknown values must be unique' })
  }
  const knownValues = new Set(result.options.map((option) => canonicalOptionValue(option.value)))
  if (result.unknownValues.some((value) => knownValues.has(canonicalOptionValue(value)))) {
    context.addIssue({ code: 'custom', message: 'unknown values must not be resolved options' })
  }
  if (result.options.length + result.unknownValues.length > connectorOptionQueryMaxResolveValues) {
    context.addIssue({ code: 'custom', message: 'resolved and unknown values exceed limit' })
  }
})

const authRequiredResultSchema = z.object({
  ...bindingIdentityShape,
  status: z.literal('auth_required'),
}).strict()

const rateLimitedResultSchema = z.object({
  ...bindingIdentityShape,
  status: z.literal('error'),
  code: z.literal('rate_limited'),
  retryable: z.literal(true),
  retryAfterMs: retryAfterMsSchema.optional(),
}).strict()

const temporarilyUnavailableResultSchema = z.object({
  ...bindingIdentityShape,
  status: z.literal('error'),
  code: z.literal('temporarily_unavailable'),
  retryable: z.literal(true),
  retryAfterMs: retryAfterMsSchema.optional(),
}).strict()

const providerRejectedResultSchema = z.object({
  ...bindingIdentityShape,
  status: z.literal('error'),
  code: z.literal('provider_rejected'),
  retryable: z.literal(false),
}).strict()

const unexpectedResponseResultSchema = z.union([
  z.object({
    ...bindingIdentityShape,
    status: z.literal('error'),
    code: z.literal('unexpected_response'),
    retryable: z.literal(true),
    retryAfterMs: retryAfterMsSchema.optional(),
  }).strict(),
  z.object({
    ...bindingIdentityShape,
    status: z.literal('error'),
    code: z.literal('unexpected_response'),
    retryable: z.literal(false),
  }).strict(),
])

const cancelledResultSchema = z.object({
  ...bindingIdentityShape,
  status: z.literal('cancelled'),
}).strict()

const connectorOptionQueryResultInnerSchema: z.ZodType<ConnectorOptionQueryResult> = z.union([
  searchReadyResultSchema,
  searchEmptyResultSchema,
  resolveReadyResultSchema,
  authRequiredResultSchema,
  rateLimitedResultSchema,
  temporarilyUnavailableResultSchema,
  providerRejectedResultSchema,
  unexpectedResponseResultSchema,
  cancelledResultSchema,
])

export const connectorOptionQueryResultSchema: z.ZodType<ConnectorOptionQueryResult> =
  queryPlainDataSchema.pipe(connectorOptionQueryResultInnerSchema)

export const connectorOptionQueryErrorCodes = Object.freeze([
  'unsupported_descriptor',
  'connector_version_mismatch',
  'filter_schema_version_mismatch',
  'option_catalog_version_mismatch',
  'option_source_version_mismatch',
  'option_source_undeclared',
  'option_dependency_undeclared',
  'option_dependency_invalid',
  'option_value_invalid',
  'option_query_unavailable',
] as const)

export type ConnectorOptionQueryErrorCode = typeof connectorOptionQueryErrorCodes[number]

function freezeValues<Value extends Record<string, object>>(value: Value): Readonly<Value> {
  for (const nested of Object.values(value)) Object.freeze(nested)
  return Object.freeze(value)
}

export const connectorOptionQueryErrorBodies = freezeValues({
  unsupported_descriptor: {
    code: 'unsupported_descriptor',
    message: 'The installed connector descriptor is unsupported.',
  },
  connector_version_mismatch: {
    code: 'connector_version_mismatch',
    message: 'The connector version does not match the installed connector.',
  },
  filter_schema_version_mismatch: {
    code: 'filter_schema_version_mismatch',
    message: 'The filter schema version does not match the installed connector.',
  },
  option_catalog_version_mismatch: {
    code: 'option_catalog_version_mismatch',
    message: 'The option catalog version does not match the installed connector.',
  },
  option_source_version_mismatch: {
    code: 'option_source_version_mismatch',
    message: 'The option source version does not match the installed connector.',
  },
  option_source_undeclared: {
    code: 'option_source_undeclared',
    message: 'The option source is not declared by the installed connector.',
  },
  option_dependency_undeclared: {
    code: 'option_dependency_undeclared',
    message: 'An option dependency is not declared by the option source.',
  },
  option_dependency_invalid: {
    code: 'option_dependency_invalid',
    message: 'An option dependency value is invalid.',
  },
  option_value_invalid: {
    code: 'option_value_invalid',
    message: 'An option value is invalid for the option source.',
  },
  option_query_unavailable: {
    code: 'option_query_unavailable',
    message: 'Dynamic option queries are unavailable for this connector.',
  },
} as const)

export type ConnectorOptionQueryErrorBody =
  typeof connectorOptionQueryErrorBodies[ConnectorOptionQueryErrorCode]

export const connectorOptionQueryErrorStatusByCode = Object.freeze({
  unsupported_descriptor: 409,
  connector_version_mismatch: 409,
  filter_schema_version_mismatch: 409,
  option_catalog_version_mismatch: 409,
  option_source_version_mismatch: 409,
  option_source_undeclared: 422,
  option_dependency_undeclared: 422,
  option_dependency_invalid: 422,
  option_value_invalid: 422,
  option_query_unavailable: 409,
} as const satisfies Record<ConnectorOptionQueryErrorCode, 409 | 422>)

export const connectorOptionQueryErrorKindByCode = Object.freeze({
  unsupported_descriptor: 'conflict',
  connector_version_mismatch: 'conflict',
  filter_schema_version_mismatch: 'conflict',
  option_catalog_version_mismatch: 'conflict',
  option_source_version_mismatch: 'conflict',
  option_source_undeclared: 'validation',
  option_dependency_undeclared: 'validation',
  option_dependency_invalid: 'validation',
  option_value_invalid: 'validation',
  option_query_unavailable: 'conflict',
} as const satisfies Record<
  ConnectorOptionQueryErrorCode,
  'conflict' | 'validation'
>)

const connectorOptionQueryErrorBodyInnerSchema: z.ZodType<ConnectorOptionQueryErrorBody> = z
  .object({
    code: z.enum(connectorOptionQueryErrorCodes),
    message: z.string(),
  })
  .strict()
  .transform((value, context) => {
    const canonical = connectorOptionQueryErrorBodies[value.code]
    if (value.message !== canonical.message) {
      context.addIssue({ code: 'custom', message: 'invalid connector option query error body' })
      return z.NEVER
    }
    return { code: canonical.code, message: canonical.message } as ConnectorOptionQueryErrorBody
  })

export const connectorOptionQueryErrorBodySchema: z.ZodType<ConnectorOptionQueryErrorBody> =
  queryPlainDataSchema.pipe(connectorOptionQueryErrorBodyInnerSchema)
