import { describe, expect, it } from 'vitest'
import { installedConnectorDescriptorSchema } from './index.js'

function descriptorWithPresentation(presentation: unknown) {
  return {
    connectorId: 'example.presentation',
    connectorVersion: '1.0.0',
    displayName: 'Presentation Example',
    configSchema: {
      version: '1',
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          maxRunElapsedMs: {
            type: 'integer', minimum: 1, maximum: 1_800_000, default: 120_000,
          },
        },
      },
      presentation,
    },
  }
}

function enumDescriptor(presentation: unknown) {
  return {
    connectorId: 'example.enums',
    connectorVersion: '1.0.0',
    displayName: 'Enum Example',
    filterSchema: {
      version: '1',
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          workModel: {
            type: 'string',
            enum: ['remote', 'hybrid', 'onsite'],
          },
          seniority: {
            type: 'array',
            minItems: 1,
            maxItems: 3,
            uniqueItems: true,
            items: { type: 'integer', enum: [1, 2, 3] },
          },
        },
      },
      presentation,
    },
  }
}

describe('installed connector descriptor presentation metadata', () => {
  it('accepts bounded field label and description presentation on a versioned renderer schema', () => {
    const descriptor = descriptorWithPresentation({
      fields: {
        '/maxRunElapsedMs': {
          label: 'Maximum run duration',
          description: 'How long a single connector run may run before stopping.',
        },
      },
    })

    expect(installedConnectorDescriptorSchema.parse(descriptor)).toEqual(descriptor)
  })

  it('rejects presentation pointers that do not resolve to a root schema property', () => {
    expect(installedConnectorDescriptorSchema.safeParse(descriptorWithPresentation({
      fields: {
        '/missingField': {
          label: 'Missing',
          description: 'This field is not declared on the schema.',
        },
      },
    })).success).toBe(false)
  })

  it('accepts exact unique enum option labels for a string field and an array item enum', () => {
    const descriptor = enumDescriptor({
      fields: {
        '/workModel': {
          label: 'Work model',
          description: 'Preferred workplace arrangement.',
          options: [
            { value: 'remote', label: 'Remote' },
            { value: 'hybrid', label: 'Hybrid' },
            { value: 'onsite', label: 'On-site' },
          ],
        },
        '/seniority': {
          label: 'Seniority',
          description: 'Accepted seniority levels.',
          options: [
            { value: 1, label: 'Junior' },
            { value: 2, label: 'Mid' },
            { value: 3, label: 'Senior' },
          ],
        },
      },
    })

    expect(installedConnectorDescriptorSchema.parse(descriptor)).toEqual(descriptor)
  })

  it('accepts the closed duration display declaration for a direct integer field', () => {
    const descriptor = descriptorWithPresentation({
      fields: {
        '/maxRunElapsedMs': {
          label: 'Maximum run duration',
          description: 'How long a single connector run may run before stopping.',
          display: {
            kind: 'duration',
            storageUnit: 'milliseconds',
            displayUnit: 'minutes',
          },
        },
      },
    })

    expect(installedConnectorDescriptorSchema.parse(descriptor)).toEqual(descriptor)
  })

  it('resolves escaped root-property JSON pointers to declared schema fields', () => {
    const descriptor = {
      connectorId: 'example.escaped',
      connectorVersion: '1.0.0',
      displayName: 'Escaped Pointer Example',
      filterSchema: {
        version: '1',
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            'path/name': { type: 'string', enum: ['a', 'b'] },
            'tilde~name': { type: 'boolean' },
          },
        },
        presentation: {
          fields: {
            '/path~1name': {
              label: 'Path name',
              description: 'Escaped slash property.',
              options: [
                { value: 'a', label: 'Alpha' },
                { value: 'b', label: 'Beta' },
              ],
            },
            '/tilde~0name': {
              label: 'Tilde name',
              description: 'Escaped tilde property.',
            },
          },
        },
      },
    }

    expect(installedConnectorDescriptorSchema.parse(descriptor)).toEqual(descriptor)
  })

  it('keeps descriptors without presentation source- and wire-compatible', () => {
    const descriptor = {
      connectorId: 'example.compat',
      connectorVersion: '1.0.0',
      displayName: 'Compat',
      configSchema: {
        version: '1',
        schema: {
          type: 'object',
          additionalProperties: true,
          properties: {
            enabled: { type: 'boolean', default: true },
          },
        },
      },
    }

    expect(installedConnectorDescriptorSchema.parse(descriptor)).toEqual(descriptor)
  })

  it('fails closed on invalid presentation options, display, text, pointers, and unknown keys', () => {
    const baseField = {
      label: 'Work model',
      description: 'Preferred workplace arrangement.',
    }
    const invalid = [
      enumDescriptor({
        fields: {
          '/workModel': {
            ...baseField,
            options: [
              { value: 'remote', label: 'Remote' },
              { value: 'hybrid', label: 'Hybrid' },
            ],
          },
        },
      }),
      enumDescriptor({
        fields: {
          '/workModel': {
            ...baseField,
            options: [
              { value: 'remote', label: 'Remote' },
              { value: 'hybrid', label: 'Hybrid' },
              { value: 'onsite', label: 'On-site' },
              { value: 'office', label: 'Office' },
            ],
          },
        },
      }),
      enumDescriptor({
        fields: {
          '/workModel': {
            ...baseField,
            options: [
              { value: 'remote', label: 'Remote' },
              { value: 'remote', label: 'Also remote' },
              { value: 'hybrid', label: 'Hybrid' },
            ],
          },
        },
      }),
      enumDescriptor({
        fields: {
          '/workModel': {
            ...baseField,
            options: [
              { value: 1, label: 'Remote' },
              { value: 2, label: 'Hybrid' },
              { value: 3, label: 'On-site' },
            ],
          },
        },
      }),
      enumDescriptor({
        fields: {
          '/seniority': {
            label: 'Seniority',
            description: 'Accepted seniority levels.',
            display: {
              kind: 'duration',
              storageUnit: 'milliseconds',
              displayUnit: 'minutes',
            },
          },
        },
      }),
      enumDescriptor({
        fields: {
          '/workModel': {
            ...baseField,
            display: {
              kind: 'duration',
              storageUnit: 'milliseconds',
              displayUnit: 'minutes',
            },
          },
        },
      }),
      descriptorWithPresentation({
        fields: {
          '/maxRunElapsedMs': {
            ...baseField,
            display: {
              kind: 'duration',
              storageUnit: 'seconds',
              displayUnit: 'minutes',
            },
          },
        },
      }),
      descriptorWithPresentation({
        fields: {
          '/maxRunElapsedMs': {
            label: ' Maximum run duration',
            description: 'Trimmed leading space is required.',
          },
        },
      }),
      descriptorWithPresentation({
        fields: {
          '/maxRunElapsedMs': {
            label: 'Maximum\nrun duration',
            description: 'Control characters are rejected.',
          },
        },
      }),
      descriptorWithPresentation({
        fields: {
          '/maxRunElapsedMs': {
            label: '<b>Maximum run duration</b>',
            description: 'Markup-shaped labels are rejected.',
          },
        },
      }),
      descriptorWithPresentation({
        fields: {
          '/maxRunElapsedMs/nested': {
            label: 'Nested',
            description: 'Only root property pointers are supported.',
          },
        },
      }),
      descriptorWithPresentation({
        fields: {
          '/maxRunElapsedMs': {
            ...baseField,
            formatter: 'minutes',
          },
        },
      }),
      descriptorWithPresentation({
        fields: {
          '/maxRunElapsedMs': baseField,
        },
        locale: 'en-US',
      }),
      descriptorWithPresentation({
        fields: {
          '/maxRunElapsedMs': {
            label: 'x'.repeat(257),
            description: 'Over-limit labels are rejected.',
          },
        },
      }),
      descriptorWithPresentation({
        fields: {
          '/maxRunElapsedMs': {
            label: 'Maximum run duration',
            description: 'Integer fields without enums cannot declare options.',
            options: [{ value: 120_000, label: 'Two minutes' }],
          },
        },
      }),
    ]

    expect(invalid.map((candidate) =>
      installedConnectorDescriptorSchema.safeParse(candidate).success)).toEqual(
      invalid.map(() => false),
    )
  })

  it('fails closed on secret, auth, URL, cookie, and executable presentation canaries', () => {
    const baseField = {
      label: 'Maximum run duration',
      description: 'How long a single connector run may run before stopping.',
    }
    const canaries = [
      { url: 'https://provider.test/private' },
      { href: 'https://provider.test/private' },
      { auth: { cookie: 'session=secret-canary' } },
      { credentials: { apiToken: 'secret-canary' } },
      { cookie: 'session=secret-canary' },
      { secret: 'secret://workspace/token' },
      { $valedictorianRef: 'secret://workspace/token' },
      { module: './provider.js' },
      { function: 'renderLabel' },
      { accessor: 'getLabel' },
      { endpoint: 'https://provider.test/internal' },
      { route: '/api/private/search' },
    ]

    for (const canary of canaries) {
      expect(installedConnectorDescriptorSchema.safeParse(descriptorWithPresentation({
        fields: { '/maxRunElapsedMs': { ...baseField, ...canary } },
      })).success).toBe(false)
      expect(installedConnectorDescriptorSchema.safeParse(descriptorWithPresentation({
        fields: { '/maxRunElapsedMs': baseField },
        ...canary,
      })).success).toBe(false)
    }
  })

  it('rejects each forbidden presentation text canary independently in every text channel', () => {
    const safeLabel = 'Maximum run duration'
    const safeDescription = 'How long a single connector run may run before stopping.'
    const forbidden = [
      'https://evil.test',
      'javascript:alert(1)',
      'mailto:user@example.com',
      'secret://workspace/token',
      'www.evil.test/jobs',
      'example.com',
      'evil.test/jobs',
      'tel:+15551234567',
      'urn:provider:jobs',
      'cookie=session-secret',
      'Use Bearer abc123 for access.',
      'password token credential',
      'authorization session-secret material is rejected.',
      'Use OAuth client material.',
      'API key sk_live_abc123',
      'sessionid=abc123',
      '/api/private route',
      '/internal/search',
      '/v1/connectors',
      '/v2/connectors',
      '/connectors/options',
      'api/private',
      'Click **here**',
      'Markdown and `code` delimiters are rejected.',
      '~~Work model~~',
      '*Remote*',
      '_Remote_',
      'Remote () => {}',
      'Apply renderLabel(value) before display.',
      'Apply alert (1) before display.',
      'Apply alert (message) before display.',
      'eval(code)',
      'alert(1)',
      'foo.bar()',
    ]

    for (const canary of forbidden) {
      expect(installedConnectorDescriptorSchema.safeParse(descriptorWithPresentation({
        fields: {
          '/maxRunElapsedMs': { label: canary, description: safeDescription },
        },
      })).success).toBe(false)
      expect(installedConnectorDescriptorSchema.safeParse(descriptorWithPresentation({
        fields: {
          '/maxRunElapsedMs': { label: safeLabel, description: canary },
        },
      })).success).toBe(false)
      expect(installedConnectorDescriptorSchema.safeParse(enumDescriptor({
        fields: {
          '/workModel': {
            label: 'Work model',
            description: 'Preferred workplace arrangement.',
            options: [
              { value: 'remote', label: canary },
              { value: 'hybrid', label: 'Hybrid' },
              { value: 'onsite', label: 'On-site' },
            ],
          },
        },
      })).success).toBe(false)
    }
  })

  it('keeps ordinary Jobright-facing presentation prose expressible', () => {
    const allowed = [
      "Prefer remote, hybrid, or on-site roles (100% match isn't required).",
      'Exclude roles that require H-1B. Keep citizenship and clearance filters clear.',
      'Hybrid & flexible',
      'Senior+',
      'Mid-level',
      'Include remote roles; exclude on-site roles.',
      'Exclude staffing agencies/recruiting firms.',
      'C# experience',
      'Note: prefer roles with 3+ years.',
      'Select role(s) to exclude.',
      'Data: prefer recent postings.',
      'Select roles (remote, hybrid).',
      'Prefer locations (Denver, Boulder).',
      'Consider public/private employers.',
      'Include internal/external candidates.',
    ]

    for (const prose of allowed) {
      const labeled = descriptorWithPresentation({
        fields: {
          '/maxRunElapsedMs': { label: prose, description: prose },
        },
      })
      expect(installedConnectorDescriptorSchema.parse(labeled)).toEqual(labeled)

      const withOption = enumDescriptor({
        fields: {
          '/workModel': {
            label: 'Work model',
            description: 'Preferred workplace arrangement.',
            options: [
              { value: 'remote', label: prose },
              { value: 'hybrid', label: 'Hybrid' },
              { value: 'onsite', label: 'On-site' },
            ],
          },
        },
      })
      expect(installedConnectorDescriptorSchema.parse(withOption)).toEqual(withOption)
    }

    const descriptor = enumDescriptor({
      fields: {
        '/workModel': {
          label: 'Work model',
          description: "Prefer remote, hybrid, or on-site roles (100% match isn't required).",
          options: [
            { value: 'remote', label: 'Remote' },
            { value: 'hybrid', label: 'Hybrid & flexible' },
            { value: 'onsite', label: 'On-site' },
          ],
        },
        '/seniority': {
          label: 'H-1B sponsorship',
          description: 'Exclude roles that require H-1B. Keep citizenship and clearance filters clear.',
          options: [
            { value: 1, label: 'Junior' },
            { value: 2, label: 'Mid-level' },
            { value: 3, label: 'Senior+' },
          ],
        },
      },
    })

    expect(installedConnectorDescriptorSchema.parse(descriptor)).toEqual(descriptor)
  })
})
