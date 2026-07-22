import { describe, expect, it } from 'vitest'
import {
  installedConnectorDescriptorSchema,
  installedConnectorDescriptorsListResultSchema,
} from '../index.js'

const jobrightDescriptor = {
  connectorId: 'jobright',
  connectorVersion: '0.13.0',
  displayName: 'Jobright',
  configSchema: {
    version: '1',
    schema: {
      type: 'object',
      additionalProperties: true,
      properties: {
        enabled: { type: 'boolean', default: true },
        resultLimit: {
          type: 'integer', minimum: 10, maximum: 100, multipleOf: 10,
          default: 50, enum: [10, 20, 50, 100],
        },
        rankingWeight: {
          type: 'number', minimum: 0, maximum: 1, multipleOf: 0.1, default: 0.5,
        },
        oldestPostingDate: {
          type: 'string', format: 'date', minLength: 10, maxLength: 10,
          default: '2026-07-01',
        },
        sort: { type: 'string', const: 'most_recent' },
        keywords: {
          type: 'array', minItems: 1, maxItems: 12, uniqueItems: true,
          items: { type: 'string', minLength: 1, maxLength: 80 },
        },
        paging: {
          type: 'object', additionalProperties: false,
          properties: {
            pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
          },
          required: ['pageSize'],
        },
      },
      required: ['enabled', 'resultLimit', 'keywords'],
    },
  },
  filterSchema: {
    version: '1',
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        state: { type: 'string', minLength: 2, maxLength: 2 },
        city: { type: 'string', minLength: 1, maxLength: 100 },
        location: {
          oneOf: [
            {
              type: 'object', additionalProperties: false,
              properties: {
                kind: { type: 'string', const: 'city' },
                city: { type: 'string', minLength: 1, maxLength: 100 },
                state: { type: 'string', minLength: 2, maxLength: 2 },
              },
              required: ['kind', 'city', 'state'],
            },
            {
              type: 'object', additionalProperties: false,
              properties: {
                kind: { type: 'string', const: 'state' },
                state: { type: 'string', minLength: 2, maxLength: 2 },
              },
              required: ['kind', 'state'],
            },
          ],
        },
        workModes: {
          type: 'array', minItems: 1, maxItems: 3, uniqueItems: true,
          items: { type: 'string', enum: ['remote', 'hybrid', 'onsite'] },
        },
      },
    },
  },
  dynamicOptions: {
    protocolVersion: 'connector-dynamic-options@1',
    version: 'jobright-options@1',
    sources: [
      {
        id: 'states', version: 'states@1', label: 'States',
        valueSchema: {
          type: 'object', additionalProperties: false,
          properties: {
            code: { type: 'string', minLength: 2, maxLength: 2 },
            name: { type: 'string', minLength: 1, maxLength: 100 },
          },
          required: ['code', 'name'],
          maxProperties: 2,
        },
        display: { kind: 'property', labelPointer: '/name' },
        operations: {
          search: { minSearchLength: 1, maxSearchLength: 100, defaultLimit: 25, maxLimit: 100 },
          resolve: { maxValues: 100 },
        },
      },
      {
        id: 'cities', version: 'cities@1', label: 'Cities',
        valueSchema: {
          oneOf: [
            {
              type: 'object', additionalProperties: false,
              properties: {
                id: { type: 'string', minLength: 1, maxLength: 80 },
                city: { type: 'string', minLength: 1, maxLength: 100 },
                state: { type: 'string', minLength: 2, maxLength: 2 },
              },
              required: ['id', 'city', 'state'],
              maxProperties: 3,
            },
            {
              type: 'object', additionalProperties: false,
              properties: {
                id: { type: 'string', minLength: 1, maxLength: 80 },
                state: { type: 'string', minLength: 2, maxLength: 2 },
              },
              required: ['id', 'state'],
              maxProperties: 2,
            },
          ],
        },
        display: { kind: 'first_nonempty_property', labelPointers: ['/city', '/state'] },
        operations: {
          search: { minSearchLength: 1, maxSearchLength: 100, defaultLimit: 20, maxLimit: 50 },
        },
        dependencies: [
          { id: 'state', filterPointer: '/state', cardinality: 'one', required: true },
        ],
      },
    ],
    bindings: [
      { filterPointer: '/state', sourceId: 'states', cardinality: 'one', intent: 'include' },
      { filterPointer: '/city', sourceId: 'cities', cardinality: 'one', intent: 'include' },
    ],
  },
} as const

const providerNeutralDescriptor = {
  connectorId: 'example.jobs',
  connectorVersion: '1.2.3',
  displayName: 'Example Jobs',
  configSchema: {
    version: '2026-07-14',
    schema: { type: 'object', additionalProperties: true, properties: {} },
  },
  filterSchema: {
    version: '2026-07-14',
    schema: { type: 'object', additionalProperties: false, properties: {} },
  },
  dynamicOptions: {
    protocolVersion: 'connector-dynamic-options@1',
    version: 'example-options@2',
    sources: [{
      id: 'teams', version: 'teams@2', label: 'Teams',
      valueSchema: { type: 'string', minLength: 1, maxLength: 60 },
      display: { kind: 'value' },
      operations: {
        search: { minSearchLength: 1, maxSearchLength: 60, defaultLimit: 10, maxLimit: 25 },
      },
    }],
    bindings: [],
  },
} as const

// Sanitized copy of the released @sparxie/valedictorian-connectors-jobright@0.13.0
// declaration. Keep this local so Sparxie's contract tests do not depend on a sibling workspace.
const releasedJobrightDescriptor = {
  connectorId: 'jobright.resolver',
  connectorVersion: '0.13.0',
  displayName: 'Jobright',
  configSchema: {
    version: 'jobright-api-config@1',
    schema: {
      type: 'object',
      properties: {
        discoveryCount: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        maxRunElapsedMs: {
          type: 'integer', minimum: 1, maximum: 1_800_000, default: 120_000,
        },
        maxRetryAttemptsPerSource: {
          type: 'integer', minimum: 1, maximum: 5, default: 3,
        },
      },
      additionalProperties: true,
    },
  },
  filterSchema: {
    version: 'jobright-search-filters@1',
    schema: {
      type: 'object',
      properties: {
        jobTaxonomyList: {
          type: 'array', minItems: 1, maxItems: 50, uniqueItems: true,
          items: {
            type: 'object',
            properties: {
              taxonomyId: { type: 'string', minLength: 1, maxLength: 1_000 },
              title: { type: 'string', minLength: 1, maxLength: 1_000 },
            },
            required: ['taxonomyId', 'title'],
            additionalProperties: false,
          },
        },
        excludedTitle: {
          type: 'array', maxItems: 10, uniqueItems: true,
          items: { type: 'string', minLength: 1, maxLength: 1_000 },
        },
        locations: {
          type: 'array', maxItems: 6, uniqueItems: true,
          items: {
            oneOf: [
              {
                type: 'object',
                properties: {
                  type: { type: 'string', maxLength: 4, const: 'city' },
                  city: { type: 'string', minLength: 1, maxLength: 1_000 },
                  state: { type: 'string', minLength: 1, maxLength: 1_000 },
                  radiusRange: {
                    type: 'integer', enum: [0, 5, 25, 50, 100], default: 25,
                  },
                },
                required: ['type', 'city'],
                additionalProperties: false,
              },
              {
                type: 'object',
                properties: {
                  type: { type: 'string', maxLength: 5, const: 'state' },
                  state: { type: 'string', minLength: 1, maxLength: 1_000 },
                },
                required: ['type', 'state'],
                additionalProperties: false,
              },
            ],
          },
        },
        minYearsOfExperienceRange: {
          type: 'array', minItems: 2, maxItems: 2,
          items: { type: 'integer', minimum: 0, maximum: 11 },
        },
        jobTypes: {
          type: 'array', maxItems: 4, uniqueItems: true,
          items: { type: 'integer', enum: [1, 2, 3, 4] },
        },
        workModel: {
          type: 'array', maxItems: 3, uniqueItems: true,
          items: { type: 'integer', enum: [1, 2, 3] },
        },
        country: { type: 'string', enum: ['US', 'CA'] },
        seniority: {
          type: 'array', maxItems: 6, uniqueItems: true,
          items: { type: 'integer', enum: [1, 2, 3, 4, 5, 6] },
        },
        daysAgo: { type: 'integer', enum: [1, 3, 7, 30] },
        roleType: { type: 'string', enum: ['IC', 'Manager'] },
        companyStages: {
          type: 'array', maxItems: 4, uniqueItems: true,
          items: {
            type: 'string', enum: ['Early Stage', 'Growth Stage', 'Late Stage', 'Public'],
          },
        },
        annualSalaryMinimum: {
          type: 'integer', minimum: 10_000, maximum: 800_000, multipleOf: 10_000,
        },
        isH1BOnly: { type: 'boolean' },
        excludeSecurityClearance: { type: 'boolean' },
        excludeUsCitizen: { type: 'boolean' },
        excludeStaffingAgency: { type: 'boolean' },
        companyCategory: {
          type: 'array', maxItems: 10, uniqueItems: true,
          items: { type: 'string', minLength: 1, maxLength: 1_000 },
        },
        excludeCompanyCategory: {
          type: 'array', maxItems: 10, uniqueItems: true,
          items: { type: 'string', minLength: 1, maxLength: 1_000 },
        },
        skills: {
          type: 'array', maxItems: 10, uniqueItems: true,
          items: { type: 'string', minLength: 1, maxLength: 1_000 },
        },
        excludedSkills: {
          type: 'array', maxItems: 10, uniqueItems: true,
          items: { type: 'string', minLength: 1, maxLength: 1_000 },
        },
        companies: {
          type: 'array', maxItems: 50, uniqueItems: true,
          items: {
            type: 'object',
            properties: {
              companyId: { type: 'string', minLength: 1, maxLength: 1_000 },
              companyName: { type: 'string', minLength: 1, maxLength: 1_000 },
            },
            required: ['companyId', 'companyName'], additionalProperties: false,
          },
        },
        excludedCompanies: {
          type: 'array', maxItems: 50, uniqueItems: true,
          items: {
            type: 'object',
            properties: {
              companyId: { type: 'string', minLength: 1, maxLength: 1_000 },
              companyName: { type: 'string', minLength: 1, maxLength: 1_000 },
            },
            required: ['companyId', 'companyName'], additionalProperties: false,
          },
        },
      },
      required: ['jobTaxonomyList'],
      additionalProperties: false,
    },
  },
  dynamicOptions: {
    protocolVersion: 'connector-dynamic-options@1',
    version: 'jobright-dynamic-options@1',
    sources: [
      {
        id: 'jobright.taxonomy', version: 'jobright-taxonomy@1', label: 'Job taxonomy',
        valueSchema: {
          type: 'object',
          properties: {
            taxonomyId: { type: 'string', minLength: 1, maxLength: 1_000 },
            title: { type: 'string', minLength: 1, maxLength: 1_000 },
          },
          required: ['taxonomyId', 'title'], additionalProperties: false, maxProperties: 2,
        },
        display: { kind: 'property', labelPointer: '/title' },
        operations: {
          search: { minSearchLength: 1, maxSearchLength: 40, defaultLimit: 50, maxLimit: 50 },
          resolve: { maxValues: 50 },
        },
      },
      {
        id: 'jobright.title', version: 'jobright-title@1', label: 'Excluded title',
        valueSchema: { type: 'string', minLength: 1, maxLength: 1_000 },
        display: { kind: 'value' },
        operations: {
          search: { minSearchLength: 1, maxSearchLength: 1_000, defaultLimit: 10, maxLimit: 10 },
          resolve: { maxValues: 10 },
        },
      },
      {
        id: 'jobright.company', version: 'jobright-company@1', label: 'Company',
        valueSchema: {
          type: 'object',
          properties: {
            companyId: { type: 'string', minLength: 1, maxLength: 1_000 },
            companyName: { type: 'string', minLength: 1, maxLength: 1_000 },
          },
          required: ['companyId', 'companyName'], additionalProperties: false, maxProperties: 2,
        },
        display: { kind: 'property', labelPointer: '/companyName' },
        operations: {
          search: { minSearchLength: 1, maxSearchLength: 1_000, defaultLimit: 50, maxLimit: 50 },
          resolve: { maxValues: 50 },
        },
      },
      {
        id: 'jobright.industry', version: 'jobright-industry@1', label: 'Industry',
        valueSchema: { type: 'string', minLength: 1, maxLength: 1_000 },
        display: { kind: 'value' },
        operations: {
          search: { minSearchLength: 1, maxSearchLength: 1_000, defaultLimit: 10, maxLimit: 10 },
          resolve: { maxValues: 10 },
        },
      },
      {
        id: 'jobright.skill', version: 'jobright-skill@1', label: 'Skill',
        valueSchema: { type: 'string', minLength: 1, maxLength: 1_000 },
        display: { kind: 'value' },
        operations: {
          search: { minSearchLength: 1, maxSearchLength: 1_000, defaultLimit: 10, maxLimit: 10 },
          resolve: { maxValues: 10 },
        },
      },
      {
        id: 'jobright.location', version: 'jobright-location@1', label: 'Location',
        valueSchema: {
          oneOf: [
            {
              type: 'object',
              properties: {
                type: { type: 'string', maxLength: 4, const: 'city' },
                city: { type: 'string', minLength: 1, maxLength: 1_000 },
                state: { type: 'string', minLength: 1, maxLength: 1_000 },
                radiusRange: {
                  type: 'integer', minimum: 0, maximum: 100, enum: [0, 5, 25, 50, 100],
                },
              },
              required: ['type', 'city'], additionalProperties: false, maxProperties: 4,
            },
            {
              type: 'object',
              properties: {
                type: { type: 'string', maxLength: 5, const: 'state' },
                state: { type: 'string', minLength: 1, maxLength: 1_000 },
              },
              required: ['type', 'state'], additionalProperties: false, maxProperties: 2,
            },
          ],
        },
        display: { kind: 'first_nonempty_property', labelPointers: ['/city', '/state'] },
        operations: {
          search: { minSearchLength: 1, maxSearchLength: 1_000, defaultLimit: 20, maxLimit: 50 },
          resolve: { maxValues: 50 },
        },
        dependencies: [
          { id: 'country', filterPointer: '/country', cardinality: 'one', required: true },
        ],
      },
    ],
    bindings: [
      { filterPointer: '/jobTaxonomyList', sourceId: 'jobright.taxonomy', cardinality: 'many', intent: 'include' },
      { filterPointer: '/excludedTitle', sourceId: 'jobright.title', cardinality: 'many', intent: 'exclude' },
      { filterPointer: '/companies', sourceId: 'jobright.company', cardinality: 'many', intent: 'include' },
      { filterPointer: '/excludedCompanies', sourceId: 'jobright.company', cardinality: 'many', intent: 'exclude' },
      { filterPointer: '/companyCategory', sourceId: 'jobright.industry', cardinality: 'many', intent: 'include' },
      { filterPointer: '/excludeCompanyCategory', sourceId: 'jobright.industry', cardinality: 'many', intent: 'exclude' },
      { filterPointer: '/skills', sourceId: 'jobright.skill', cardinality: 'many', intent: 'include' },
      { filterPointer: '/excludedSkills', sourceId: 'jobright.skill', cardinality: 'many', intent: 'exclude' },
      { filterPointer: '/locations', sourceId: 'jobright.location', cardinality: 'many', intent: 'include' },
    ],
  },
} as const

const clone = <Value>(value: Value): Value => structuredClone(value)

describe('installed connector descriptor contract', () => {
  it('accepts faithful Jobright 0.13 and provider-neutral sanitized descriptors', () => {
    expect(installedConnectorDescriptorSchema.parse(jobrightDescriptor)).toEqual(jobrightDescriptor)
    expect(installedConnectorDescriptorSchema.parse(providerNeutralDescriptor))
      .toEqual(providerNeutralDescriptor)
    expect(installedConnectorDescriptorsListResultSchema.parse({
      items: [jobrightDescriptor, providerNeutralDescriptor],
    })).toEqual({ items: [jobrightDescriptor, providerNeutralDescriptor] })
  })

  it('allows optional declarations to be absent and keeps descriptor and list envelopes strict', () => {
    const minimal = {
      connectorId: 'example.minimal', connectorVersion: '1.0.0', displayName: 'Minimal',
    }
    expect(installedConnectorDescriptorSchema.parse(minimal)).toEqual(minimal)

    for (const candidate of [
      { ...minimal, extra: true },
      { items: [minimal], total: 1 },
      { ...jobrightDescriptor, configSchema: { ...jobrightDescriptor.configSchema, dialect: 'json' } },
      {
        ...jobrightDescriptor,
        dynamicOptions: { ...jobrightDescriptor.dynamicOptions, provider: 'jobright' },
      },
    ]) {
      const schema = 'items' in candidate
        ? installedConnectorDescriptorsListResultSchema
        : installedConnectorDescriptorSchema
      expect(schema.safeParse(candidate).success).toBe(false)
    }
  })

  it('fails closed on secrets, provider routes, executable accessors, and implementation metadata', () => {
    const forbidden = [
      { auth: { cookie: 'secret' } },
      { credentials: { apiToken: 'secret' } },
      { endpoint: 'https://provider.test/internal' },
      { route: '/api/private/search' },
      { module: './jobright-provider.js' },
      { function: 'searchCities' },
      { accessor: 'provider.session.cookies' },
      { workspaceId: 'workspace-secret' },
      { executionScopeId: 'scope-secret' },
    ]

    for (const canary of forbidden) {
      expect(installedConnectorDescriptorSchema.safeParse({
        ...jobrightDescriptor, dynamicOptions: { ...jobrightDescriptor.dynamicOptions, ...canary },
      }).success).toBe(false)
      expect(installedConnectorDescriptorSchema.safeParse({
        ...jobrightDescriptor,
        dynamicOptions: {
          ...jobrightDescriptor.dynamicOptions,
          sources: [{ ...jobrightDescriptor.dynamicOptions.sources[0], ...canary }],
        },
      }).success).toBe(false)
    }
  })

  it('rejects unsupported schema formats and keywords, unsafe names, and non-finite numbers', () => {
    const invalidPropertySchemas = [
      { type: 'string', format: 'uri' },
      { type: 'string', pattern: '.*' },
      { type: 'number', minimum: Number.NaN },
      { type: 'number', maximum: Number.POSITIVE_INFINITY },
      { type: 'array', items: { type: 'string' }, contains: { type: 'string' } },
    ]

    for (const propertySchema of invalidPropertySchemas) {
      const descriptor = clone(providerNeutralDescriptor)
      descriptor.configSchema.schema.properties = { value: propertySchema } as never
      expect(installedConnectorDescriptorSchema.safeParse(descriptor).success).toBe(false)
    }

    for (const name of ['__proto__', 'prototype', 'constructor']) {
      const descriptor = clone(providerNeutralDescriptor)
      descriptor.configSchema.schema.properties = JSON.parse(
        `{${JSON.stringify(name)}:{"type":"string"}}`,
      )
      expect(installedConnectorDescriptorSchema.safeParse(descriptor).success).toBe(false)
    }
  })

  it('rejects excessive renderer schema depth, properties, item/string bounds, and enums', () => {
    let tooDeep: Record<string, unknown> = {
      type: 'object', additionalProperties: false, properties: {},
    }
    for (let index = 0; index < 100; index += 1) {
      tooDeep = {
        type: 'object', additionalProperties: false, properties: { nested: tooDeep },
      }
    }

    const excessiveSchemas = [
      tooDeep,
      {
        type: 'object', additionalProperties: true,
        properties: Object.fromEntries(
          Array.from({ length: 10_000 }, (_, index) => [`field${index}`, { type: 'boolean' }]),
        ),
      },
      { type: 'array', maxItems: 1_000_000, items: { type: 'string' } },
      { type: 'string', maxLength: 1_000_000 },
      { type: 'string', enum: Array.from({ length: 10_000 }, (_, index) => `value${index}`) },
    ]

    for (const schema of excessiveSchemas) {
      expect(installedConnectorDescriptorSchema.safeParse({
        ...providerNeutralDescriptor, configSchema: { version: '1', schema },
      }).success).toBe(false)
    }
  })

  it('rejects inconsistent bounds, invalid defaults, and required keys without properties', () => {
    const inconsistentSchemas = [
      { type: 'integer', minimum: 10, maximum: 1 },
      { type: 'number', minimum: 0, maximum: 1, default: 2 },
      { type: 'string', minLength: 5, maxLength: 2 },
      { type: 'string', enum: ['open', 'closed'], default: 'unknown' },
      { type: 'array', minItems: 3, maxItems: 1, items: { type: 'boolean' } },
      {
        type: 'object', additionalProperties: false,
        properties: { present: { type: 'boolean' } }, required: ['missing'],
      },
    ]

    for (const invalid of inconsistentSchemas) {
      expect(installedConnectorDescriptorSchema.safeParse({
        ...providerNeutralDescriptor,
        configSchema: {
          version: '1',
          schema: {
            type: 'object', additionalProperties: true, properties: { invalid },
          },
        },
      }).success).toBe(false)
    }
  })

  it('validates dynamic source, binding, dependency, and JSON-pointer relationships', () => {
    const dynamic = clone(jobrightDescriptor.dynamicOptions)
    const invalidCatalogs = [
      { ...dynamic, sources: [dynamic.sources[0], dynamic.sources[0]] },
      {
        ...dynamic,
        bindings: [...dynamic.bindings, dynamic.bindings[0]],
      },
      {
        ...dynamic,
        sources: dynamic.sources.map((source) => source.id === 'cities'
          ? { ...source, dependencies: [source.dependencies![0], source.dependencies![0]] }
          : source),
      },
      {
        ...dynamic,
        bindings: [{ ...dynamic.bindings[0], sourceId: 'missing-source' }],
      },
      {
        ...dynamic,
        bindings: [{ ...dynamic.bindings[0], filterPointer: '/missing-filter' }],
      },
      {
        ...dynamic,
        bindings: [{ ...dynamic.bindings[0], filterPointer: 'not-a-json-pointer' }],
      },
      {
        ...dynamic,
        sources: dynamic.sources.map((source) => source.id === 'cities'
          ? {
              ...source,
              dependencies: [{
                ...source.dependencies![0], filterPointer: '/missing-filter',
              }],
            }
          : source),
      },
    ]

    for (const dynamicOptions of invalidCatalogs) {
      expect(installedConnectorDescriptorSchema.safeParse({
        ...jobrightDescriptor, dynamicOptions,
      }).success).toBe(false)
    }
  })

  it('accepts the faithful sanitized Jobright 0.13 descriptor with all six sources', () => {
    const result = installedConnectorDescriptorSchema.safeParse(releasedJobrightDescriptor)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data).toEqual(releasedJobrightDescriptor)
    expect(releasedJobrightDescriptor.dynamicOptions.sources.map((source) => source.id))
      .toEqual([
        'jobright.taxonomy',
        'jobright.title',
        'jobright.company',
        'jobright.industry',
        'jobright.skill',
        'jobright.location',
      ])
  })

  it('keeps connector auth out of the public dynamic-option catalog', () => {
    const descriptor = clone(releasedJobrightDescriptor)
    const [source] = descriptor.dynamicOptions.sources
    expect(installedConnectorDescriptorSchema.safeParse({
      ...descriptor,
      dynamicOptions: {
        ...descriptor.dynamicOptions,
        sources: [{ ...source, auth: { mode: 'none' } }],
      },
    }).success).toBe(false)
  })

  it('limits dynamic values to bounded scalars, closed flat objects, and unions of them', () => {
    const dynamic = clone(jobrightDescriptor.dynamicOptions)
    const source = dynamic.sources[0]
    const invalidValueSchemas = [
      { type: 'string' },
      { type: 'number', minimum: 0 },
      { type: 'array', maxItems: 10, items: { type: 'string', maxLength: 20 } },
      {
        type: 'object', additionalProperties: false,
        properties: {
          nested: {
            type: 'object', additionalProperties: false,
            properties: { value: { type: 'string', maxLength: 20 } },
          },
        },
      },
      {
        type: 'object', additionalProperties: true,
        properties: { value: { type: 'string', maxLength: 20 } },
      },
      {
        oneOf: [
          { type: 'string', maxLength: 20 },
          { type: 'integer', enum: [1, 2] },
        ],
      },
    ]

    for (const valueSchema of invalidValueSchemas) {
      expect(installedConnectorDescriptorSchema.safeParse({
        ...jobrightDescriptor,
        dynamicOptions: {
          ...dynamic,
          sources: [{ ...source, valueSchema }],
          bindings: [],
        },
      }).success).toBe(false)
    }
  })

  it('matches the connector-core 0.13 sanitized dynamic scalar schema exactly', () => {
    const dynamic = clone(providerNeutralDescriptor.dynamicOptions)
    const source = dynamic.sources[0]
    const valueSchemas = [
      { type: 'string', maxLength: 60, default: 'remote' },
      { type: 'string', maxLength: 10, format: 'date' },
      { type: 'number', minimum: 0, maximum: 1, multipleOf: 0.1 },
      { type: 'number', minimum: 0, maximum: 1, integer: true },
      { type: 'integer', minimum: 0, maximum: 10 },
    ]
    const outcomes = valueSchemas.map((valueSchema) =>
      installedConnectorDescriptorSchema.safeParse({
        ...providerNeutralDescriptor,
        dynamicOptions: {
          ...dynamic,
          sources: [{ ...source, valueSchema }],
        },
      }).success)

    expect(outcomes).toEqual([false, false, false, true, true])
  })

  it('requires every dynamic source to support search and every catalog to declare a source', () => {
    const dynamic = clone(jobrightDescriptor.dynamicOptions)
    const source = dynamic.sources[0]
    const resolveOnly = {
      ...source,
      operations: { resolve: { maxValues: 10 } },
    }

    expect(installedConnectorDescriptorSchema.safeParse({
      ...jobrightDescriptor,
      dynamicOptions: { ...dynamic, sources: [resolveOnly], bindings: [] },
    }).success).toBe(false)
    expect(installedConnectorDescriptorSchema.safeParse({
      ...jobrightDescriptor,
      dynamicOptions: { ...dynamic, sources: [], bindings: [] },
    }).success).toBe(false)
  })

  it('rejects deeply nested schemas and defaults without allowing safeParse to throw', () => {
    let deepSchema: Record<string, unknown> = { type: 'string', maxLength: 1 }
    let deepDefault: unknown = 'secret-canary'
    for (let index = 0; index < 5_000; index += 1) {
      deepSchema = { type: 'array', maxItems: 1, items: deepSchema }
      deepDefault = [deepDefault]
    }

    const candidates = [
      {
        ...providerNeutralDescriptor,
        configSchema: {
          version: '1',
          schema: {
            type: 'object', additionalProperties: true,
            properties: { deep: deepSchema },
          },
        },
      },
      {
        ...providerNeutralDescriptor,
        configSchema: {
          version: '1',
          schema: {
            type: 'object', additionalProperties: true,
            properties: {
              unsafeDefault: {
                type: 'array', maxItems: 1, items: { type: 'boolean' },
                default: deepDefault,
              },
            },
          },
        },
      },
    ]

    for (const candidate of candidates) {
      let result: ReturnType<typeof installedConnectorDescriptorSchema.safeParse> | undefined
      expect(() => {
        result = installedConnectorDescriptorSchema.safeParse(candidate)
      }).not.toThrow()
      expect(result?.success).toBe(false)
    }
  })

  it('allows only scalar defaults in renderer schema version 1', () => {
    const containerDefaults = [
      {
        type: 'array', maxItems: 4, items: { type: 'string', maxLength: 20 },
        default: ['route-canary', 'module-canary', 'function-canary'],
      },
      {
        type: 'object', additionalProperties: false,
        properties: { enabled: { type: 'boolean' } },
        default: { secret: 'secret-canary' },
      },
    ]

    for (const invalid of containerDefaults) {
      expect(installedConnectorDescriptorSchema.safeParse({
        ...providerNeutralDescriptor,
        configSchema: {
          version: '1',
          schema: {
            type: 'object', additionalProperties: true, properties: { invalid },
          },
        },
      }).success).toBe(false)
    }

    expect(installedConnectorDescriptorSchema.safeParse(releasedJobrightDescriptor).success)
      .toBe(true)
  })

  it('requires renderer numbers, strings, and arrays to have finite domains', () => {
    const unboundedSchemas = [
      { type: 'number' },
      { type: 'integer', minimum: 0 },
      { type: 'string' },
      { type: 'array', items: { type: 'boolean' } },
    ]

    for (const invalid of unboundedSchemas) {
      expect(installedConnectorDescriptorSchema.safeParse({
        ...providerNeutralDescriptor,
        configSchema: {
          version: '1',
          schema: {
            type: 'object', additionalProperties: true, properties: { invalid },
          },
        },
      }).success).toBe(false)
    }
  })

  it('applies numeric constraints to every enum member and default', () => {
    const invalidNumberSchemas = [
      { type: 'integer', minimum: 0, maximum: 10, enum: [1.5] },
      { type: 'integer', minimum: 2, maximum: 10, enum: [1] },
      { type: 'number', minimum: 0, maximum: 10, enum: [11] },
      { type: 'integer', minimum: 0, maximum: 10, multipleOf: 2, enum: [3] },
      { type: 'integer', minimum: 0, maximum: 10, multipleOf: 2, default: 3 },
    ]

    for (const invalid of invalidNumberSchemas) {
      expect(installedConnectorDescriptorSchema.safeParse({
        ...providerNeutralDescriptor,
        configSchema: {
          version: '1',
          schema: {
            type: 'object', additionalProperties: true, properties: { invalid },
          },
        },
      }).success).toBe(false)
    }
  })

  it('applies string length and date constraints to enum, const, and default values', () => {
    const invalidStringSchemas = [
      { type: 'string', minLength: 2, maxLength: 4, enum: ['x'] },
      { type: 'string', minLength: 1, maxLength: 3, const: 'long' },
      { type: 'string', format: 'date', enum: ['not-a-date'] },
      { type: 'string', format: 'date', const: '2026-02-30' },
      { type: 'string', format: 'date', default: 'not-a-date' },
    ]

    for (const invalid of invalidStringSchemas) {
      expect(installedConnectorDescriptorSchema.safeParse({
        ...providerNeutralDescriptor,
        configSchema: {
          version: '1',
          schema: {
            type: 'object', additionalProperties: true, properties: { invalid },
          },
        },
      }).success).toBe(false)
    }
  })

  it('allows nested-object pointers for bindings and dependencies, but never array items', () => {
    const base = clone(jobrightDescriptor)
    base.filterSchema.schema.properties = {
      ...base.filterSchema.schema.properties,
      structuredValues: {
        type: 'array', maxItems: 5,
        items: {
          type: 'object', additionalProperties: false,
          properties: { name: { type: 'string', maxLength: 20 } },
        },
      },
    } as never
    const nestedBinding = clone(base)
    nestedBinding.dynamicOptions.bindings = [{
      filterPointer: '/location/city',
      sourceId: 'states',
      cardinality: 'one',
      intent: 'include',
    }]
    const nestedDependency = clone(base)
    nestedDependency.dynamicOptions.sources[0].dependencies = [{
      id: 'city', filterPointer: '/location/city', cardinality: 'one', required: false,
    }]
    const arrayBinding = clone(base)
    arrayBinding.dynamicOptions.bindings = [{
      filterPointer: '/structuredValues/name',
      sourceId: 'states',
      cardinality: 'one',
      intent: 'include',
    }]
    const arrayDependency = clone(base)
    arrayDependency.dynamicOptions.sources[0].dependencies = [{
      id: 'name', filterPointer: '/structuredValues/name', cardinality: 'one', required: false,
    }]

    expect([nestedBinding, nestedDependency, arrayBinding, arrayDependency].map((candidate) =>
      installedConnectorDescriptorSchema.safeParse(candidate).success,
    )).toEqual([true, true, false, false])
  })

  it('matches binding cardinality to scalar and array filter targets', () => {
    const dynamic = clone(jobrightDescriptor.dynamicOptions)
    const cardinalityMismatches = [
      {
        filterPointer: '/state', sourceId: 'states',
        cardinality: 'many', intent: 'include',
      },
      {
        filterPointer: '/workModes', sourceId: 'states',
        cardinality: 'one', intent: 'include',
      },
    ]

    for (const binding of cardinalityMismatches) {
      expect(installedConnectorDescriptorSchema.safeParse({
        ...jobrightDescriptor,
        dynamicOptions: { ...dynamic, bindings: [binding] },
      }).success).toBe(false)
    }
  })

  it('requires property displays in every union branch and fallback coverage across branches', () => {
    const dynamic = clone(jobrightDescriptor.dynamicOptions)
    const invalidDisplays = [
      { kind: 'property', labelPointer: '/city' },
      { kind: 'first_nonempty_property', labelPointers: ['/city'] },
    ]

    for (const display of invalidDisplays) {
      expect(installedConnectorDescriptorSchema.safeParse({
        ...jobrightDescriptor,
        dynamicOptions: {
          ...dynamic,
          sources: dynamic.sources.map((source) => source.id === 'cities'
            ? { ...source, display }
            : source),
        },
      }).success).toBe(false)
    }
  })

  it('includes intent in binding uniqueness', () => {
    const dynamic = clone(jobrightDescriptor.dynamicOptions)
    const binding = dynamic.bindings[0]
    expect(installedConnectorDescriptorSchema.safeParse({
      ...jobrightDescriptor,
      dynamicOptions: {
        ...dynamic,
        bindings: [binding, { ...binding, intent: 'exclude' }],
      },
    }).success).toBe(true)
  })

  it('rejects duplicate connector id and version identities in descriptor lists', () => {
    expect(installedConnectorDescriptorsListResultSchema.safeParse({
      items: [providerNeutralDescriptor, clone(providerNeutralDescriptor)],
    }).success).toBe(false)
  })

  it('rejects custom prototypes recursively', () => {
    const topLevel = Object.assign(Object.create({ inherited: true }), {
      connectorId: 'example.custom',
      connectorVersion: '1.0.0',
      displayName: 'Custom prototype',
    })
    const nested = clone(providerNeutralDescriptor)
    Object.setPrototypeOf(nested.dynamicOptions.sources[0], { inherited: true })
    const customArray = clone(providerNeutralDescriptor)
    Object.setPrototypeOf(
      customArray.dynamicOptions.sources,
      Object.create(Array.prototype) as unknown[],
    )

    for (const candidate of [topLevel, nested, customArray]) {
      expect(installedConnectorDescriptorSchema.safeParse(candidate).success).toBe(false)
    }
  })

  it('rejects accessors recursively without invoking them or throwing', () => {
    const topLevel = {
      connectorVersion: '1.0.0',
      displayName: 'Accessor canary',
    } as Record<string, unknown>
    const nested = clone(providerNeutralDescriptor)
    let getterCalls = 0
    const getter = (): never => {
      getterCalls += 1
      throw new Error('secret getter canary must not execute')
    }
    Object.defineProperty(topLevel, 'connectorId', { enumerable: true, get: getter })
    Object.defineProperty(nested.dynamicOptions.sources[0], 'label', {
      enumerable: true,
      get: getter,
    })

    for (const candidate of [topLevel, nested]) {
      let result: ReturnType<typeof installedConnectorDescriptorSchema.safeParse> | undefined
      expect(() => {
        result = installedConnectorDescriptorSchema.safeParse(candidate)
      }).not.toThrow()
      expect(result?.success).toBe(false)
    }
    expect(getterCalls).toBe(0)
  })

  it('supports the full 10,000-character renderer and search declarations', () => {
    const descriptor = clone(providerNeutralDescriptor)
    descriptor.configSchema.schema.properties = {
      query: { type: 'string', maxLength: 10_000 },
    } as never
    descriptor.dynamicOptions.sources[0].valueSchema = {
      type: 'string', maxLength: 10_000,
    }
    descriptor.dynamicOptions.sources[0].operations.search.maxSearchLength = 10_000

    expect(installedConnectorDescriptorSchema.safeParse(descriptor).success).toBe(true)
  })
})
