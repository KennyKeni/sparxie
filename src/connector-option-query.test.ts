import { describe, expect, it } from 'vitest'
import {
  connectorOptionQueryBodySchema,
  connectorOptionQueryErrorBodies,
  connectorOptionQueryErrorBodySchema,
  connectorOptionQueryErrorCodes,
  connectorOptionQueryErrorStatusByCode,
  connectorOptionQueryMaxDependencies,
  connectorOptionQueryMaxDependencyValues,
  connectorOptionQueryMaxIdentifierLength,
  connectorOptionQueryMaxLimit,
  connectorOptionQueryMaxOptionKeyLength,
  connectorOptionQueryMaxOptionLabelLength,
  connectorOptionQueryMaxOptions,
  connectorOptionQueryMaxOptionObjectProperties,
  connectorOptionQueryMaxOptionStringLength,
  connectorOptionQueryMaxResolveValues,
  connectorOptionQueryMaxRetryAfterMs,
  connectorOptionQueryMaxSearchLength,
  connectorOptionQueryMaxVersionLength,
  connectorOptionQueryResultErrorCodes,
  connectorOptionQueryResultSchema,
  connectorOptionQueryStatuses,
  connectorOptionValueSchema,
} from './index.js'

const binding = {
  connectorInstanceId: 'installed-jobright-1',
  connectorId: 'jobright',
  connectorVersion: '0.13.0',
  filterSchemaVersion: 'jobright-filter@1',
  catalogVersion: 'jobright-options@1',
  sourceId: 'cities',
  sourceVersion: 'cities@1',
} as const

const option = {
  key: 'new-york-ny',
  label: 'New York, NY',
  value: { city: 'New York', state: 'NY' },
} as const

const clone = <Value>(value: Value): Value => structuredClone(value)

describe('trusted connector option query request contract', () => {
  it('accepts only a declared source, bounded operation, and dependency values', () => {
    const search = {
      sourceId: 'cities',
      operation: { kind: 'search', search: 'new', limit: 25 },
      dependencies: { state: 'NY', workModes: ['remote', 'hybrid'] },
    } as const
    const resolve = {
      sourceId: 'cities',
      operation: {
        kind: 'resolve',
        values: [{ city: 'New York', state: 'NY' }, 'remote', 25, true],
      },
      dependencies: {},
    } as const

    expect(connectorOptionQueryBodySchema.parse(search)).toEqual(search)
    expect(connectorOptionQueryBodySchema.parse(resolve)).toEqual(resolve)
  })

  it('keeps route identity and every backend-derived binding out of the body', () => {
    const base = {
      sourceId: 'cities',
      operation: { kind: 'search', search: 'new' },
      dependencies: {},
    }
    const spoofedFields = {
      connectorInstanceId: 'another-instance',
      connectorId: 'another-connector',
      connectorVersion: '999.0.0',
      filterSchemaVersion: 'attacker-filter@1',
      catalogVersion: 'attacker-catalog@1',
      sourceVersion: 'attacker-source@1',
      workspaceId: 'another-workspace',
      executionScopeId: 'another-scope',
      scope: 'admin',
      auth: { requirementIds: ['cookie'] },
      credentials: { password: 'plaintext-secret' },
      route: '/private/provider/search',
      endpoint: 'https://provider.example/private',
      url: 'https://provider.example/private',
      module: './provider.js',
      function: 'searchCities',
      secretKey: 'provider-cookie',
      cookie: 'session=plaintext-secret',
    }

    for (const [field, value] of Object.entries(spoofedFields)) {
      expect(connectorOptionQueryBodySchema.safeParse({ ...base, [field]: value }).success)
        .toBe(false)
    }
  })

  it('accepts bounded scalar and strict flat-object option values', () => {
    for (const value of [
      '',
      'remote',
      0,
      -12.5,
      true,
      false,
      { id: 'new-york-ny', count: 12, active: true },
    ]) {
      expect(connectorOptionValueSchema.parse(value)).toEqual(value)
    }
  })

  it('rejects null, arrays, nesting, non-finite numbers, empty objects, and unsafe names', () => {
    const nullPrototypeObject = Object.assign(Object.create(null) as Record<string, unknown>, {
      code: 'NY',
    })
    const inheritedObject = Object.create({ inherited: 'NY' }) as Record<string, unknown>
    inheritedObject.code = 'NY'
    const invalidValues = [
      null,
      [],
      ['NY'],
      Number.NaN,
      Number.POSITIVE_INFINITY,
      {},
      { nested: { value: 'NY' } },
      { nullable: null },
      { array: ['NY'] },
      { '__proto__': 'NY' },
      JSON.parse('{"__proto__":"NY"}'),
      { constructor: 'NY' },
      { prototype: 'NY' },
      nullPrototypeObject,
      inheritedObject,
    ]

    for (const value of invalidValues) {
      expect(connectorOptionValueSchema.safeParse(value).success).toBe(false)
    }
  })

  it('exports finite public bounds and enforces every request string and collection bound', () => {
    expect({
      connectorOptionQueryMaxIdentifierLength,
      connectorOptionQueryMaxVersionLength,
      connectorOptionQueryMaxSearchLength,
      connectorOptionQueryMaxLimit,
      connectorOptionQueryMaxDependencies,
      connectorOptionQueryMaxDependencyValues,
      connectorOptionQueryMaxResolveValues,
      connectorOptionQueryMaxOptions,
      connectorOptionQueryMaxOptionStringLength,
      connectorOptionQueryMaxOptionObjectProperties,
      connectorOptionQueryMaxOptionKeyLength,
      connectorOptionQueryMaxOptionLabelLength,
      connectorOptionQueryMaxRetryAfterMs,
    }).toEqual({
      connectorOptionQueryMaxIdentifierLength: 128,
      connectorOptionQueryMaxVersionLength: 128,
      connectorOptionQueryMaxSearchLength: 10_000,
      connectorOptionQueryMaxLimit: 1_000,
      connectorOptionQueryMaxDependencies: 64,
      connectorOptionQueryMaxDependencyValues: 1_000,
      connectorOptionQueryMaxResolveValues: 1_000,
      connectorOptionQueryMaxOptions: 1_000,
      connectorOptionQueryMaxOptionStringLength: 10_000,
      connectorOptionQueryMaxOptionObjectProperties: 100,
      connectorOptionQueryMaxOptionKeyLength: 1_000,
      connectorOptionQueryMaxOptionLabelLength: 1_000,
      connectorOptionQueryMaxRetryAfterMs: 86_400_000,
    })

    const base = {
      sourceId: 'cities',
      operation: { kind: 'search', search: '' },
      dependencies: {},
    }
    const tooManyDependencies = Object.fromEntries(
      Array.from({ length: connectorOptionQueryMaxDependencies + 1 }, (_, index) => [
        `dependency-${index}`, 'value',
      ]),
    )
    const tooManyProperties = Object.fromEntries(
      Array.from({ length: connectorOptionQueryMaxOptionObjectProperties + 1 }, (_, index) => [
        `property-${index}`, index,
      ]),
    )
    const invalidBodies = [
      { ...base, sourceId: 's'.repeat(connectorOptionQueryMaxIdentifierLength + 1) },
      {
        ...base,
        operation: { kind: 'search', search: 's'.repeat(connectorOptionQueryMaxSearchLength + 1) },
      },
      { ...base, operation: { kind: 'search', search: '', limit: 0 } },
      { ...base, operation: { kind: 'search', search: '', limit: 1.5 } },
      { ...base, operation: { kind: 'search', search: '', limit: connectorOptionQueryMaxLimit + 1 } },
      { ...base, operation: { kind: 'resolve', values: [] } },
      {
        ...base,
        operation: {
          kind: 'resolve',
          values: Array.from({ length: connectorOptionQueryMaxResolveValues + 1 }, (_, i) => i),
        },
      },
      { ...base, dependencies: tooManyDependencies },
      {
        ...base,
        dependencies: { ['d'.repeat(connectorOptionQueryMaxIdentifierLength + 1)]: 'value' },
      },
      {
        ...base,
        dependencies: {
          state: Array.from({ length: connectorOptionQueryMaxDependencyValues + 1 }, (_, i) => i),
        },
      },
      { ...base, dependencies: JSON.parse('{"__proto__":"NY"}') },
      { ...base, dependencies: { constructor: 'NY' } },
      { ...base, dependencies: { prototype: 'NY' } },
      { ...base, dependencies: { state: [] } },
      { ...base, dependencies: { state: ['NY', 'NY'] } },
      { ...base, dependencies: { state: 's'.repeat(connectorOptionQueryMaxOptionStringLength + 1) } },
      { ...base, dependencies: { state: tooManyProperties } },
      {
        ...base,
        dependencies: {
          state: { ['p'.repeat(connectorOptionQueryMaxIdentifierLength + 1)]: 'value' },
        },
      },
      {
        ...base,
        dependencies: Object.assign(Object.create(null) as Record<string, unknown>, {
          state: 'NY',
        }),
      },
    ]

    for (const body of invalidBodies) {
      expect(connectorOptionQueryBodySchema.safeParse(body).success).toBe(false)
    }
  })

  it('keeps operations discriminated, exact, and resolve values unique', () => {
    const base = { sourceId: 'cities', dependencies: {} }
    const invalidOperations = [
      { kind: 'browse', search: '' },
      { kind: 'search', values: ['NY'] },
      { kind: 'search', search: '', cursor: 'private-provider-cursor' },
      { kind: 'resolve', search: 'new', values: ['NY'] },
      { kind: 'resolve', values: ['NY'], limit: 10 },
      { kind: 'resolve', values: ['NY', 'NY'] },
      { kind: 'resolve', values: [{ code: 'NY' }, { code: 'NY' }] },
    ]

    for (const operation of invalidOperations) {
      expect(connectorOptionQueryBodySchema.safeParse({ ...base, operation }).success).toBe(false)
    }
  })

  it('rejects capability identifiers and versions that select routes or implementations', () => {
    const invalidCapabilityTexts = [
      '   ',
      'https://provider.invalid/options',
      '/private/provider/options',
      './provider-options.js',
    ]
    const base = {
      sourceId: 'cities',
      operation: { kind: 'search', search: '' },
      dependencies: {},
    }
    const ready = { ...binding, status: 'search_ready', options: [option], truncated: false }

    for (const invalid of invalidCapabilityTexts) {
      expect(connectorOptionQueryBodySchema.safeParse({ ...base, sourceId: invalid }).success)
        .toBe(false)
      expect(connectorOptionQueryBodySchema.safeParse({
        ...base,
        dependencies: { [invalid]: 'value' },
      }).success).toBe(false)

      for (const key of ['connectorInstanceId', 'connectorId', 'sourceId'] as const) {
        expect(connectorOptionQueryResultSchema.safeParse({
          ...ready, [key]: invalid,
        }).success).toBe(false)
      }
      for (const key of [
        'connectorVersion', 'filterSchemaVersion', 'catalogVersion', 'sourceVersion',
      ] as const) {
        expect(connectorOptionQueryResultSchema.safeParse({
          ...ready, [key]: invalid,
        }).success).toBe(false)
      }
    }
  })

  it('rejects recursive accessors without invoking them or allowing safeParse to throw', () => {
    let getterCalls = 0
    const getter = (): never => {
      getterCalls += 1
      throw new Error('secret accessor canary must not execute')
    }
    const sourceBody = {
      operation: { kind: 'search', search: '' },
      dependencies: {},
    } as Record<string, unknown>
    Object.defineProperty(sourceBody, 'sourceId', { enumerable: true, get: getter })

    const dependencies = {} as Record<string, unknown>
    Object.defineProperty(dependencies, 'state', { enumerable: true, get: getter })
    const dependencyBody = {
      sourceId: 'cities',
      operation: { kind: 'search', search: '' },
      dependencies,
    }

    const optionObject = {} as Record<string, unknown>
    Object.defineProperty(optionObject, 'code', { enumerable: true, get: getter })

    const resultOption = { key: 'ny', value: 'NY' } as Record<string, unknown>
    Object.defineProperty(resultOption, 'label', { enumerable: true, get: getter })
    const resultWithOption = {
      ...binding,
      status: 'search_ready',
      options: [resultOption],
      truncated: false,
    }

    const resultWithIdentity = {
      connectorInstanceId: binding.connectorInstanceId,
      connectorVersion: binding.connectorVersion,
      filterSchemaVersion: binding.filterSchemaVersion,
      catalogVersion: binding.catalogVersion,
      sourceId: binding.sourceId,
      sourceVersion: binding.sourceVersion,
      status: 'search_empty',
    } as Record<string, unknown>
    Object.defineProperty(resultWithIdentity, 'connectorId', {
      enumerable: true,
      get: getter,
    })

    const errorBody = {
      code: 'option_value_invalid',
    } as Record<string, unknown>
    Object.defineProperty(errorBody, 'message', { enumerable: true, get: getter })

    const attempts = [
      () => connectorOptionQueryBodySchema.safeParse(sourceBody),
      () => connectorOptionQueryBodySchema.safeParse(dependencyBody),
      () => connectorOptionValueSchema.safeParse(optionObject),
      () => connectorOptionQueryResultSchema.safeParse(resultWithOption),
      () => connectorOptionQueryResultSchema.safeParse(resultWithIdentity),
      () => connectorOptionQueryErrorBodySchema.safeParse(errorBody),
    ]
    for (const attempt of attempts) {
      let result: ReturnType<typeof attempt> | undefined
      expect(() => {
        result = attempt()
      }).not.toThrow()
      expect(result?.success).toBe(false)
    }
    expect(getterCalls).toBe(0)
  })

  it('treats zero and negative zero as duplicate values across the JSON boundary', () => {
    const invalidBodies = [
      {
        sourceId: 'cities',
        operation: { kind: 'resolve', values: [0, -0] },
        dependencies: {},
      },
      {
        sourceId: 'cities',
        operation: { kind: 'search', search: '' },
        dependencies: { counts: [0, -0] },
      },
    ]
    for (const body of invalidBodies) {
      expect(connectorOptionQueryBodySchema.safeParse(body).success).toBe(false)
    }

    const invalidResults = [
      {
        ...binding,
        status: 'search_ready',
        options: [
          { key: 'zero', label: 'Zero', value: 0 },
          { key: 'negative-zero', label: 'Negative zero', value: -0 },
        ],
        truncated: false,
      },
      {
        ...binding,
        status: 'resolve_ready',
        options: [],
        unknownValues: [0, -0],
      },
    ]
    for (const result of invalidResults) {
      expect(connectorOptionQueryResultSchema.safeParse(result).success).toBe(false)
    }
  })
})

describe('settled connector option query result contract', () => {
  it('exports a closed status union and accepts every sanitized settled outcome', () => {
    expect(connectorOptionQueryStatuses).toEqual([
      'search_ready',
      'search_empty',
      'resolve_ready',
      'auth_required',
      'error',
      'cancelled',
    ])
    expect(connectorOptionQueryResultErrorCodes).toEqual([
      'rate_limited',
      'temporarily_unavailable',
      'provider_rejected',
      'unexpected_response',
    ])

    const results = [
      { ...binding, status: 'search_ready', options: [option], truncated: false },
      { ...binding, status: 'search_empty' },
      { ...binding, status: 'resolve_ready', options: [option], unknownValues: ['missing'] },
      { ...binding, status: 'auth_required' },
      {
        ...binding,
        status: 'error',
        code: 'rate_limited',
        retryable: true,
        retryAfterMs: 30_000,
      },
      {
        ...binding,
        status: 'error',
        code: 'provider_rejected',
        retryable: false,
      },
      { ...binding, status: 'cancelled' },
    ]

    for (const result of results) {
      expect(connectorOptionQueryResultSchema.parse(result)).toEqual(result)
    }
  })

  it('requires the complete backend-derived binding identity on every result branch', () => {
    const ready = { ...binding, status: 'search_ready', options: [option], truncated: false }

    for (const key of Object.keys(binding)) {
      const result = clone(ready) as Record<string, unknown>
      delete result[key]
      expect(connectorOptionQueryResultSchema.safeParse(result).success).toBe(false)
    }

    const versionKeys = [
      'connectorVersion', 'filterSchemaVersion', 'catalogVersion', 'sourceVersion',
    ] as const
    for (const key of versionKeys) {
      expect(connectorOptionQueryResultSchema.safeParse({
        ...ready,
        [key]: 'v'.repeat(connectorOptionQueryMaxVersionLength + 1),
      }).success).toBe(false)
    }

    const identifierKeys = ['connectorInstanceId', 'connectorId', 'sourceId'] as const
    for (const key of identifierKeys) {
      expect(connectorOptionQueryResultSchema.safeParse({
        ...ready,
        [key]: 'i'.repeat(connectorOptionQueryMaxIdentifierLength + 1),
      }).success).toBe(false)
    }
  })

  it('accepts opaque instance ids but rejects leading route, URL, and module canaries', () => {
    const result = { ...binding, status: 'search_empty' }
    const leadingCanaries = [
      '/v1/connectors/private',
      'https://provider.example/private',
      './provider-module.js',
    ]

    const outcomes = leadingCanaries.map((connectorInstanceId) =>
      connectorOptionQueryResultSchema.safeParse({ ...result, connectorInstanceId }).success)
    outcomes.push(connectorOptionQueryResultSchema.safeParse({
      ...result,
      connectorInstanceId: 'instance/with space',
    }).success)

    expect(outcomes).toEqual([false, false, false, true])
  })

  it('keeps each status exact and authentication-required free of auth internals', () => {
    const invalidResults = [
      { ...binding, status: 'search_ready', options: [], truncated: false },
      { ...binding, status: 'search_ready', options: [option], truncated: false, cursor: 'secret' },
      { ...binding, status: 'search_empty', options: [] },
      { ...binding, status: 'resolve_ready', options: [option] },
      { ...binding, status: 'auth_required', requirementIds: ['provider-cookie'] },
      { ...binding, status: 'auth_required', auth: { mode: 'cookie_jar' } },
      { ...binding, status: 'auth_required', loginUrl: 'https://provider.example/login' },
      { ...binding, status: 'cancelled', reason: 'provider cancelled request with cookie=secret' },
      { ...binding, status: 'provider_paused' },
    ]

    for (const result of invalidResults) {
      expect(connectorOptionQueryResultSchema.safeParse(result).success).toBe(false)
    }
  })

  it('enforces option bounds and uniqueness of keys, values, and unknown values', () => {
    const anotherOption = { key: 'boston-ma', label: 'Boston, MA', value: 'Boston' }
    const invalidResults = [
      {
        ...binding,
        status: 'search_ready',
        options: [{ ...option, key: 'k'.repeat(connectorOptionQueryMaxOptionKeyLength + 1) }],
        truncated: false,
      },
      {
        ...binding,
        status: 'search_ready',
        options: [{ ...option, label: 'l'.repeat(connectorOptionQueryMaxOptionLabelLength + 1) }],
        truncated: false,
      },
      {
        ...binding,
        status: 'search_ready',
        options: Array.from({ length: connectorOptionQueryMaxOptions + 1 }, (_, index) => ({
          key: `key-${index}`, label: `Option ${index}`, value: index,
        })),
        truncated: false,
      },
      {
        ...binding,
        status: 'search_ready',
        options: [option, { ...anotherOption, key: option.key }],
        truncated: false,
      },
      {
        ...binding,
        status: 'search_ready',
        options: [option, { ...anotherOption, value: option.value }],
        truncated: false,
      },
      {
        ...binding,
        status: 'resolve_ready',
        options: [option],
        unknownValues: ['missing', 'missing'],
      },
      {
        ...binding,
        status: 'resolve_ready',
        options: [option],
        unknownValues: [option.value],
      },
      {
        ...binding,
        status: 'resolve_ready',
        options: [],
        unknownValues: Array.from(
          { length: connectorOptionQueryMaxResolveValues + 1 }, (_, index) => index,
        ),
      },
    ]

    for (const result of invalidResults) {
      expect(connectorOptionQueryResultSchema.safeParse(result).success).toBe(false)
    }
  })

  it('accepts released Jobright option keys and labels through 1,000 characters', () => {
    const result = (keyLength: number, labelLength: number) => ({
      ...binding,
      status: 'search_ready',
      options: [{ key: 'k'.repeat(keyLength), label: 'l'.repeat(labelLength), value: 'value' }],
      truncated: false,
    })

    expect([
      result(1_000, 1),
      result(1, 1_000),
      result(1_001, 1),
      result(1, 1_001),
    ].map((candidate) => connectorOptionQueryResultSchema.safeParse(candidate).success))
      .toEqual([true, true, false, false])
  })

  it('bounds resolved and unknown values by one shared resolve limit', () => {
    expect(connectorOptionQueryResultSchema.safeParse({
      ...binding,
      status: 'resolve_ready',
      options: [{ key: 'known', label: 'Known', value: 'known' }],
      unknownValues: Array.from(
        { length: connectorOptionQueryMaxResolveValues },
        (_, index) => `unknown-${index}`,
      ),
    }).success).toBe(false)
  })

  it('binds each public error code to its intended retry semantics', () => {
    const validErrors = [
      { ...binding, status: 'error', code: 'rate_limited', retryable: true, retryAfterMs: 1_000 },
      { ...binding, status: 'error', code: 'temporarily_unavailable', retryable: true },
      { ...binding, status: 'error', code: 'provider_rejected', retryable: false },
      { ...binding, status: 'error', code: 'unexpected_response', retryable: true },
      { ...binding, status: 'error', code: 'unexpected_response', retryable: false },
    ]
    for (const result of validErrors) {
      expect(connectorOptionQueryResultSchema.safeParse(result).success).toBe(true)
    }

    const invalidErrors = [
      { ...binding, status: 'error', code: 'rate_limited', retryable: false },
      { ...binding, status: 'error', code: 'temporarily_unavailable', retryable: false },
      { ...binding, status: 'error', code: 'provider_rejected', retryable: true },
      {
        ...binding,
        status: 'error', code: 'unexpected_response', retryable: false, retryAfterMs: 1_000,
      },
    ]
    for (const result of invalidErrors) {
      expect(connectorOptionQueryResultSchema.safeParse(result).success).toBe(false)
    }
  })

  it('exposes only closed sanitized error codes and bounded retry advice', () => {
    const base = { ...binding, status: 'error' }
    const invalidErrors = [
      { ...base, code: 'provider_cookie_expired', retryable: false },
      { ...base, code: 'rate_limited', retryable: false, retryAfterMs: 1_000 },
      { ...base, code: 'rate_limited', retryable: true, retryAfterMs: 0 },
      { ...base, code: 'rate_limited', retryable: true, retryAfterMs: 1.5 },
      {
        ...base,
        code: 'rate_limited',
        retryable: true,
        retryAfterMs: connectorOptionQueryMaxRetryAfterMs + 1,
      },
      {
        ...base,
        code: 'unexpected_response',
        retryable: false,
        message: 'Provider returned Set-Cookie: session=plaintext-secret',
      },
      {
        ...base,
        code: 'unexpected_response',
        retryable: false,
        providerError: { body: '<html>private diagnostics</html>' },
      },
    ]

    for (const result of invalidErrors) {
      expect(connectorOptionQueryResultSchema.safeParse(result).success).toBe(false)
    }
  })
})

describe('connector option compatibility and misuse errors', () => {
  it('exports every issue-named code with one fixed sanitized body and HTTP status', () => {
    expect(connectorOptionQueryErrorCodes).toEqual([
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
    ])
    expect(connectorOptionQueryErrorBodies).toEqual({
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
    })
    expect(connectorOptionQueryErrorStatusByCode).toEqual({
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
    })

    for (const code of connectorOptionQueryErrorCodes) {
      expect(connectorOptionQueryErrorBodySchema.parse(connectorOptionQueryErrorBodies[code]))
        .toEqual(connectorOptionQueryErrorBodies[code])
    }
  })

  it('rejects malformed recognized bodies and secret/provider/auth diagnostic canaries', () => {
    const canonical = connectorOptionQueryErrorBodies.option_value_invalid
    const malformedBodies = [
      { ...canonical, message: 'value rejected because cookie=session-secret' },
      { ...canonical, detail: 'payload.password is invalid' },
      { ...canonical, validation: [{ path: ['auth', 'token'], received: 'plaintext-secret' }] },
      { ...canonical, provider: 'jobright' },
      { ...canonical, providerError: { status: 500, body: '<html>private</html>' } },
      { ...canonical, auth: { requirementIds: ['provider-cookie'] } },
      { ...canonical, url: 'https://provider.example/private' },
      { ...canonical, route: '/private/provider/search' },
      { ...canonical, module: './provider.js' },
      { ...canonical, function: 'resolveCities' },
      { code: 'option_value_invalid' },
      { code: 'option_value_invalid', message: 42 },
      { code: 'unknown_error', message: canonical.message },
    ]

    for (const body of malformedBodies) {
      expect(connectorOptionQueryErrorBodySchema.safeParse(body).success).toBe(false)
    }
  })
})

describe('connector option plain-data and immutable export guarantees', () => {
  const inheritedCanary = <Value extends object>(
    value: Value,
    field: string,
  ): Value => Object.assign(Object.create({ [field]: 'secret-canary' }), value) as Value

  const hiddenCanary = <Value extends object>(value: Value, field: string): Value => {
    const candidate = clone(value)
    Object.defineProperty(candidate, field, {
      configurable: true,
      enumerable: false,
      value: 'secret-canary',
    })
    return candidate
  }

  it('rejects custom prototypes and inherited or non-enumerable canaries recursively', () => {
    const body = {
      sourceId: 'cities', operation: { kind: 'search', search: '' }, dependencies: {},
    }
    const ready = { ...binding, status: 'search_ready', options: [option], truncated: false }
    const canonicalError = { ...connectorOptionQueryErrorBodies.option_value_invalid }
    const candidates = [
      () => connectorOptionQueryBodySchema.safeParse(inheritedCanary(body, 'auth')),
      () => connectorOptionQueryBodySchema.safeParse(hiddenCanary(body, 'secretKey')),
      () => connectorOptionQueryBodySchema.safeParse({
        ...body, operation: inheritedCanary(body.operation, 'route'),
      }),
      () => connectorOptionQueryBodySchema.safeParse({
        ...body, operation: hiddenCanary(body.operation, 'secretKey'),
      }),
      () => connectorOptionQueryResultSchema.safeParse(inheritedCanary(ready, 'auth')),
      () => connectorOptionQueryResultSchema.safeParse(hiddenCanary(ready, 'secretKey')),
      () => connectorOptionQueryResultSchema.safeParse({
        ...ready, options: [inheritedCanary(option, 'auth')],
      }),
      () => connectorOptionQueryResultSchema.safeParse({
        ...ready, options: [hiddenCanary(option, 'secretKey')],
      }),
    ]
    for (const parse of candidates) {
      expect(parse().success).toBe(false)
    }

    for (const candidate of [
      inheritedCanary(canonicalError, 'providerError'),
      hiddenCanary(canonicalError, 'secretKey'),
    ]) {
      const result = connectorOptionQueryErrorBodySchema.safeParse(candidate)
      if (result.success) {
        expect(Object.getPrototypeOf(result.data)).toBe(Object.prototype)
        expect(Reflect.ownKeys(result.data).sort()).toEqual(['code', 'message'])
      }
      expect(result.success).toBe(false)
    }
  })

  it('freezes status/code registries, fixed error bodies, and status mappings', () => {
    expect({
      statuses: Object.isFrozen(connectorOptionQueryStatuses),
      resultCodes: Object.isFrozen(connectorOptionQueryResultErrorCodes),
      compatibilityCodes: Object.isFrozen(connectorOptionQueryErrorCodes),
      errorBodies: Object.isFrozen(connectorOptionQueryErrorBodies),
      nestedErrorBodies: connectorOptionQueryErrorCodes.every((code) =>
        Object.isFrozen(connectorOptionQueryErrorBodies[code])),
      statusMapping: Object.isFrozen(connectorOptionQueryErrorStatusByCode),
    }).toEqual({
      statuses: true,
      resultCodes: true,
      compatibilityCodes: true,
      errorBodies: true,
      nestedErrorBodies: true,
      statusMapping: true,
    })

    expect(() => {
      (connectorOptionQueryStatuses as unknown as string[]).push('secret_status')
    }).toThrow(TypeError)
    expect(() => {
      (connectorOptionQueryResultErrorCodes as unknown as string[]).push('secret_error')
    }).toThrow(TypeError)
    expect(() => {
      (connectorOptionQueryErrorCodes as unknown as string[]).push('secret_compatibility_error')
    }).toThrow(TypeError)
    expect(() => {
      (connectorOptionQueryErrorBodies.option_value_invalid as { message: string }).message =
        'Secret provider diagnostics'
    }).toThrow(TypeError)
    expect(() => {
      (connectorOptionQueryErrorStatusByCode as unknown as Record<string, number>)
        .option_value_invalid = 599
    }).toThrow(TypeError)

    expect(connectorOptionQueryStatuses).not.toContain('secret_status')
    expect(connectorOptionQueryResultErrorCodes).not.toContain('secret_error')
    expect(connectorOptionQueryErrorCodes).not.toContain('secret_compatibility_error')
    expect(connectorOptionQueryErrorBodies.option_value_invalid.message)
      .not.toContain('Secret')
    expect(connectorOptionQueryErrorStatusByCode.option_value_invalid).toBe(422)
  })
})
