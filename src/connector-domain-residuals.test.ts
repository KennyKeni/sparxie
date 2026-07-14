import { describe, expect, it } from 'vitest'
import * as Sparxie from './index.js'
import {
  connectorDescriptorMaxBindings,
  connectorDescriptorMaxDependencies,
  connectorDescriptorMaxDisplayPointers,
  connectorDescriptorMaxSources,
  connectorOptionQueryBodySchema,
  connectorOptionValueSchema,
  installedConnectorDescriptorSchema,
} from './index.js'

const stringValueSchema = { type: 'string', minLength: 1, maxLength: 40 } as const

function source(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    version: 'source@1',
    label: id,
    valueSchema: { ...stringValueSchema },
    display: { kind: 'value' },
    operations: {
      search: { minSearchLength: 1, maxSearchLength: 40, defaultLimit: 10, maxLimit: 20 },
    },
    ...overrides,
  }
}

function descriptor(dynamicOptions: Record<string, unknown>, filterProperties = {
  value0: { ...stringValueSchema },
  value1: { ...stringValueSchema },
  value2: { ...stringValueSchema },
}) {
  return {
    connectorId: 'example.jobs',
    connectorVersion: '1.0.0',
    displayName: 'Example Jobs',
    filterSchema: {
      version: '1',
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: filterProperties,
      },
    },
    dynamicOptions: {
      protocolVersion: 'connector-dynamic-options@1',
      version: 'catalog@1',
      bindings: [],
      ...dynamicOptions,
    },
  }
}

function bindings(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    filterPointer: `/value${Math.floor(index / 200)}`,
    sourceId: `source${index % 100}`,
    cardinality: 'one',
    intent: Math.floor(index / 100) % 2 === 0 ? 'include' : 'exclude',
  }))
}

function objectValueSchema(propertyCount: number) {
  const properties = Object.fromEntries(Array.from(
    { length: propertyCount },
    (_, index) => [`p${index}`, { ...stringValueSchema }],
  ))
  return {
    type: 'object',
    additionalProperties: false,
    properties,
    required: Object.keys(properties),
    maxProperties: propertyCount,
  }
}

describe('connector-core 0.13 dynamic catalog residuals', () => {
  it('exports the exact dynamic catalog bounds', () => {
    expect({
      bindings: connectorDescriptorMaxBindings,
      dependencies: connectorDescriptorMaxDependencies,
      displayPointers: connectorDescriptorMaxDisplayPointers,
      dynamicObjectProperties: Reflect.get(
        Sparxie,
        'connectorDescriptorMaxDynamicObjectProperties',
      ),
      sources: connectorDescriptorMaxSources,
    }).toEqual({
      bindings: 500,
      dependencies: 50,
      displayPointers: 10,
      dynamicObjectProperties: 100,
      sources: 100,
    })
  })

  it('accepts source and binding limits and rejects one over each limit', () => {
    const sources = Array.from({ length: 101 }, (_, index) => source(`source${index}`))
    const candidates = [
      descriptor({ sources: sources.slice(0, 100) }),
      descriptor({ sources }),
      descriptor({ sources: sources.slice(0, 100), bindings: bindings(500) }),
      descriptor({ sources: sources.slice(0, 100), bindings: bindings(501) }),
    ]
    const outcomes = candidates.map((candidate) =>
      installedConnectorDescriptorSchema.safeParse(candidate).success)

    expect(outcomes).toEqual([true, false, true, false])
  })

  it('accepts dependency and display-pointer limits and rejects one over each limit', () => {
    const dependencies = Array.from({ length: 51 }, (_, index) => ({
      id: `dependency${index}`,
      filterPointer: '/value0',
      cardinality: 'one',
      required: false,
    }))
    const displaySchema = objectValueSchema(11)
    const candidates = [
      descriptor({ sources: [source('source0', { dependencies: dependencies.slice(0, 50) })] }),
      descriptor({ sources: [source('source0', { dependencies })] }),
      descriptor({ sources: [source('source0', {
        valueSchema: displaySchema,
        display: {
          kind: 'first_nonempty_property',
          labelPointers: Object.keys(displaySchema.properties).slice(0, 10).map((key) => `/${key}`),
        },
      })] }),
      descriptor({ sources: [source('source0', {
        valueSchema: displaySchema,
        display: {
          kind: 'first_nonempty_property',
          labelPointers: Object.keys(displaySchema.properties).map((key) => `/${key}`),
        },
      })] }),
    ]

    expect(candidates.map((candidate) =>
      installedConnectorDescriptorSchema.safeParse(candidate).success,
    )).toEqual([true, false, true, false])
  })

  it('bounds dynamic objects at 100 properties', () => {
    const candidates = [100, 101].map((count) => descriptor({
      sources: [source('source0', {
        valueSchema: objectValueSchema(count),
        display: { kind: 'property', labelPointer: '/p0' },
      })],
    }))

    expect(candidates.map((candidate) =>
      installedConnectorDescriptorSchema.safeParse(candidate).success,
    )).toEqual([true, false])
  })

  it('requires complete closed flat dynamic objects and capability-safe ids', () => {
    const validObject = objectValueSchema(1)
    const { required: _required, ...withoutRequired } = validObject
    const { maxProperties: _maxProperties, ...withoutMaxProperties } = validObject
    const objectCandidates = [
      withoutRequired,
      withoutMaxProperties,
      { ...validObject, additionalProperties: true },
      {
        ...validObject,
        properties: {
          nested: {
            type: 'object', additionalProperties: false,
            properties: { value: stringValueSchema }, required: ['value'], maxProperties: 1,
          },
        },
      },
      validObject,
    ]
    const objectOutcomes = objectCandidates.map((valueSchema) =>
      installedConnectorDescriptorSchema.safeParse(descriptor({
        sources: [source('source0', {
          valueSchema,
          display: { kind: 'property', labelPointer: '/p0' },
        })],
      })).success)
    const unsafeIdOutcomes = [
      { ...descriptor({ sources: [source('source0')] }), connectorId: 'https:provider' },
      descriptor({ sources: [source('https:provider')] }),
      descriptor({ sources: [source('source0', {
        valueSchema: {
          ...validObject,
          properties: { 'https:provider': stringValueSchema },
          required: ['https:provider'],
        },
        display: { kind: 'property', labelPointer: '/https:provider' },
      })] }),
    ].map((candidate) => installedConnectorDescriptorSchema.safeParse(candidate).success)

    expect({ objectOutcomes, unsafeIdOutcomes }).toEqual({
      objectOutcomes: [false, false, false, false, true],
      unsafeIdOutcomes: [false, false, false],
    })
  })

  it('fails closed when a nested union target changes cardinality in either branch order', () => {
    const scalarBranch = {
      type: 'object', additionalProperties: false,
      properties: { choice: { ...stringValueSchema } },
      required: ['choice'], maxProperties: 1,
    }
    const arrayBranch = {
      type: 'object', additionalProperties: false,
      properties: {
        choice: { type: 'array', maxItems: 3, items: { ...stringValueSchema } },
      },
      required: ['choice'], maxProperties: 1,
    }
    const orders = [[scalarBranch, arrayBranch], [arrayBranch, scalarBranch]]
    const bindingCandidates = orders.map((oneOf) => descriptor({
      sources: [source('source-x')],
      bindings: [{
        filterPointer: '/location/choice', sourceId: 'source-x',
        cardinality: 'one', intent: 'include',
      }],
    }, { location: { oneOf } }))
    const dependencyCandidates = orders.map((oneOf) => descriptor({
      sources: [source('source-x', { dependencies: [{
        id: 'choice', filterPointer: '/location/choice',
        cardinality: 'many', required: true,
      }] })],
    }, { location: { oneOf } }))

    expect([...bindingCandidates, ...dependencyCandidates].map((candidate) =>
      installedConnectorDescriptorSchema.safeParse(candidate).success,
    )).toEqual([false, false, false, false])
  })

  it('matches the remaining exact connector-core 0.13 catalog constraints', () => {
    const stringEnum = (count: number) => ({
      type: 'string', maxLength: 40,
      enum: Array.from({ length: count }, (_, index) => `value${index}`),
    })
    const objectUnion = (count: number) => ({
      valueSchema: { oneOf: Array.from({ length: count }, () => objectValueSchema(1)) },
      display: { kind: 'property', labelPointer: '/p0' },
    })
    const search = (minSearchLength: number) => ({
      search: { minSearchLength, maxSearchLength: 40, defaultLimit: 10, maxLimit: 20 },
    })
    const invalid = [
      source('source-x', { valueSchema: { type: 'number', enum: [1, 2] } }),
      source('source-x', { valueSchema: { type: 'integer', enum: [1, 2] } }),
      source('source-x', { valueSchema: stringEnum(101) }),
      source('source-x', objectUnion(11)),
      source('source-x', { operations: search(0) }),
      source('source@x'),
      source('source-x', { version: '1' }),
    ]
    const valid = [
      source('source-x', {
        valueSchema: { type: 'number', minimum: 0, maximum: 2 },
      }),
      source('source-x', {
        valueSchema: { type: 'integer', minimum: 0, maximum: 2, enum: [1, 2] },
      }),
      source('source-x', { valueSchema: stringEnum(100) }),
      source('source-x', objectUnion(10)),
      source('source-x', { operations: search(1) }),
      source('source-x', { version: 'source@1' }),
    ]
    const outcomes = (sources: unknown[]) => sources.map((candidate) =>
      installedConnectorDescriptorSchema.safeParse(descriptor({ sources: [candidate] })).success)

    expect({ invalid: outcomes(invalid), valid: outcomes(valid) }).toEqual({
      invalid: Array.from({ length: 7 }, () => false),
      valid: Array.from({ length: 6 }, () => true),
    })
  })

  it('accepts zero versions and one object branch while enforcing safe integer bounds', () => {
    const integerEnum = (count: number) => ({
      type: 'integer', minimum: 0, maximum: count,
      enum: Array.from({ length: count }, (_, index) => index),
    })
    const invalid = [
      source('source-x', {
        valueSchema: { type: 'integer', minimum: Number.MIN_SAFE_INTEGER - 1, maximum: 0 },
      }),
      source('source-x', {
        valueSchema: { type: 'integer', minimum: 0, maximum: Number.MAX_SAFE_INTEGER + 1 },
      }),
      source('source-x', {
        valueSchema: {
          type: 'integer', minimum: 0, maximum: Number.MAX_SAFE_INTEGER + 1,
          enum: [Number.MAX_SAFE_INTEGER + 1],
        },
      }),
      source('source-x', { valueSchema: integerEnum(101) }),
    ]
    const validDescriptors = [
      descriptor({ version: 'catalog@0', sources: [source('source-x')] }),
      descriptor({ sources: [source('source-x', { version: 'source@0' })] }),
      descriptor({ sources: [source('source-x', {
        valueSchema: { oneOf: [objectValueSchema(1)] },
        display: { kind: 'property', labelPointer: '/p0' },
      })] }),
      descriptor({ sources: [source('source-x', {
        valueSchema: { type: 'integer', minimum: 0, maximum: 2, enum: [1, 2] },
      })] }),
      descriptor({ sources: [source('source-x', { valueSchema: integerEnum(100) })] }),
    ]

    expect({
      invalid: invalid.map((candidate) =>
        installedConnectorDescriptorSchema.safeParse(descriptor({ sources: [candidate] })).success),
      valid: validDescriptors.map((candidate) =>
        installedConnectorDescriptorSchema.safeParse(candidate).success),
    }).toEqual({
      invalid: [false, false, false, false],
      valid: [true, true, true, true, true],
    })
  })

  it('matches exact string, leading-zero version, and object display semantics', () => {
    const candidate = (sourceOverrides: Record<string, unknown>, catalogVersion = 'catalog@1') =>
      installedConnectorDescriptorSchema.safeParse(descriptor({
        version: catalogVersion,
        sources: [source('source-x', sourceOverrides)],
      })).success
    const objectSchema = objectValueSchema(1)

    expect({
      objectDisplays: [
        candidate({ valueSchema: objectSchema, display: { kind: 'value' } }),
        candidate({ valueSchema: objectSchema, display: { kind: 'property', labelPointer: '/p0' } }),
      ],
      strings: [
        candidate({ valueSchema: {
          type: 'string', maxLength: 10, enum: ['a'], const: 'b',
        } }),
        candidate({ valueSchema: {
          type: 'string', maxLength: 10, enum: ['a'], const: 'a',
        } }),
      ],
      versions: [
        candidate({ version: 'source@00' }, 'catalog@00'),
        candidate({ version: 'source@0' }, 'catalog@0'),
      ],
    }).toEqual({
      objectDisplays: [true, true],
      strings: [false, true],
      versions: [true, true],
    })
  })

  it('rejects empty dynamic string enum and const values without a positive minimum', () => {
    const accepts = (valueSchema: Record<string, unknown>) =>
      installedConnectorDescriptorSchema.safeParse(descriptor({
        sources: [source('source-x', { valueSchema })],
      })).success

    expect({
      invalid: [
        { type: 'string', maxLength: 10, enum: [''] },
        { type: 'string', minLength: 0, maxLength: 10, enum: [''] },
        { type: 'string', maxLength: 10, const: '' },
        { type: 'string', minLength: 0, maxLength: 10, const: '' },
      ].map(accepts),
      valid: [
        { type: 'string', maxLength: 10, enum: ['a'] },
        { type: 'string', minLength: 0, maxLength: 10, const: 'a' },
      ].map(accepts),
    }).toEqual({
      invalid: [false, false, false, false],
      valid: [true, true],
    })
  })
})

describe('public-validator sparse array safety', () => {
  it('rejects huge sparse arrays and exotic array keys', () => {
    const hugeSparse: unknown[] = []
    hugeSparse.length = 10_001
    const exotic = ['NY']
    Object.defineProperty(exotic, '4294967295', {
      enumerable: true,
      value: 'must-not-survive-validation',
    })
    const body = (values: unknown[]) => ({
      sourceId: 'locations',
      operation: { kind: 'search', search: '' },
      dependencies: { values },
    })

    expect([hugeSparse, exotic].map((values) =>
      connectorOptionQueryBodySchema.safeParse(body(values)).success,
    )).toEqual([false, false])
  })

  it('applies capability identifier grammar to option and dependency object keys', () => {
    const invalidKeys = ['bad key', 'https:provider']
    const body = (dependencies: Record<string, string>) => ({
      sourceId: 'locations',
      operation: { kind: 'search', search: '' },
      dependencies,
    })

    expect({
      dependencies: invalidKeys.map((key) =>
        connectorOptionQueryBodySchema.safeParse(body({ [key]: 'value' })).success),
      options: invalidKeys.map((key) =>
        connectorOptionValueSchema.safeParse({ [key]: 'value' }).success),
      valid: [
        connectorOptionQueryBodySchema.safeParse(body({ good_key: 'value' })).success,
        connectorOptionValueSchema.safeParse({ good_key: 'value' }).success,
      ],
    }).toEqual({
      dependencies: [false, false],
      options: [false, false],
      valid: [true, true],
    })
  })
})
