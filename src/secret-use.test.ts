import { describe, expect, it } from 'vitest'
import { createSecretReference } from './secret-reference.js'
import {
  localSecretResolutionErrorBodies,
  localSecretResolutionErrorBodySchema,
  localSecretResolutionErrorCodes,
  localSecretResolutionErrorStatusByCode,
  localSecretResolutionInputSchema,
  localSecretResolutionPurposes,
  localSecretResolutionPurposeSchema,
  localSecretResolutionResultSchema,
  type LocalSecretResolutionInput,
  type LocalSecretResolutionResult,
} from './secret-use.js'

describe('local secret resolution purpose and envelopes', () => {
  it('exports the closed subprocess_injection purpose and validates strict input/result shapes', () => {
    expect([...localSecretResolutionPurposes]).toEqual(['subprocess_injection'])

    const input: LocalSecretResolutionInput = {
      reference: createSecretReference('connector_jobright/password'),
      purpose: { kind: 'subprocess_injection' },
    }
    const result: LocalSecretResolutionResult = {
      value: 'placeholder-not-a-real-secret',
      handling: { cache: 'no-store', sensitivity: 'secret' },
    }

    expect(localSecretResolutionPurposeSchema.parse({ kind: 'subprocess_injection' })).toEqual({
      kind: 'subprocess_injection',
    })
    expect(localSecretResolutionInputSchema.parse(input)).toEqual(input)
    expect(localSecretResolutionResultSchema.parse(result)).toEqual(result)

    expect(localSecretResolutionPurposeSchema.safeParse({ kind: 'browser_fill' }).success).toBe(false)
    expect(localSecretResolutionInputSchema.safeParse({
      reference: input.reference,
      purpose: { kind: 'subprocess_injection' },
      extra: true,
    }).success).toBe(false)
    expect(localSecretResolutionInputSchema.safeParse({
      reference: 'secret://connector_jobright/password',
      purpose: { kind: 'subprocess_injection' },
    }).success).toBe(false)
    expect(localSecretResolutionResultSchema.safeParse({
      value: 'placeholder-not-a-real-secret',
      handling: { cache: 'no-store' },
    }).success).toBe(false)
    expect(localSecretResolutionResultSchema.safeParse({
      value: 'placeholder-not-a-real-secret',
      handling: { cache: 'private', sensitivity: 'secret' },
    }).success).toBe(false)
  })
})

describe('local secret resolution closed errors', () => {
  it('exports value-free canonical bodies and status mapping for every closed code', () => {
    expect([...localSecretResolutionErrorCodes]).toEqual([
      'secret_not_found',
      'local_secret_resolution_unsupported',
      'local_secret_resolution_unauthorized',
      'secure_storage_unavailable',
    ])
    expect(localSecretResolutionErrorStatusByCode).toEqual({
      secret_not_found: 404,
      local_secret_resolution_unsupported: 409,
      local_secret_resolution_unauthorized: 403,
      secure_storage_unavailable: 503,
    })
    expect(localSecretResolutionErrorBodies).toEqual({
      secret_not_found: {
        code: 'secret_not_found',
        message: 'The secret was not found.',
      },
      local_secret_resolution_unsupported: {
        code: 'local_secret_resolution_unsupported',
        message: 'Local secret resolution is unsupported.',
      },
      local_secret_resolution_unauthorized: {
        code: 'local_secret_resolution_unauthorized',
        message: 'Local secret resolution is unauthorized.',
      },
      secure_storage_unavailable: {
        code: 'secure_storage_unavailable',
        message: 'Secure storage is unavailable.',
      },
    })

    for (const code of localSecretResolutionErrorCodes) {
      const body = localSecretResolutionErrorBodies[code]
      expect(localSecretResolutionErrorBodySchema.parse(body)).toEqual(body)
      expect(JSON.stringify(body)).not.toMatch(/password|token|value|secret:\/\//i)
      expect(
        localSecretResolutionErrorBodySchema.safeParse({
          ...body,
          message: `${body.message} with detail`,
        }).success,
      ).toBe(false)
      expect(
        localSecretResolutionErrorBodySchema.safeParse({
          ...body,
          detail: 'canary',
        }).success,
      ).toBe(false)
    }
  })
})
