import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  validateValedictorianEndpointError,
  valedictorianFailureKindMessages,
  valedictorianFailureKinds,
  valedictorianRequestIdSchema,
  type ValedictorianErrorBody,
  type ValedictorianFailureKind,
} from './index.js'

describe('shared Valedictorian error contract foundation', () => {
  it('exports a closed failure-kind taxonomy with canonical safe fallback copy', () => {
    expect([...valedictorianFailureKinds]).toEqual([
      'validation',
      'not_found',
      'conflict',
      'authentication',
      'authorization',
      'rate_limit',
      'unavailable',
      'integrity',
      'internal',
    ])

    const kinds: ValedictorianFailureKind[] = [...valedictorianFailureKinds]
    expect(kinds).toHaveLength(9)

    expect(valedictorianFailureKindMessages).toEqual({
      validation: 'The request is invalid.',
      not_found: 'The requested resource was not found.',
      conflict: 'The request conflicts with the current state.',
      authentication: 'Authentication is required.',
      authorization: 'You do not have permission to perform this request.',
      rate_limit: 'The request rate limit was exceeded.',
      unavailable: 'The service is temporarily unavailable.',
      integrity: 'Stored data integrity could not be verified.',
      internal: 'An unexpected error occurred.',
    })

    const body: ValedictorianErrorBody<'example_code'> = {
      code: 'example_code',
      message: valedictorianFailureKindMessages.validation,
    }
    expect(body.code).toBe('example_code')
    expect(valedictorianRequestIdSchema.safeParse('req_01HZX').success).toBe(true)
    expect(valedictorianRequestIdSchema.safeParse('').success).toBe(false)
    expect(valedictorianRequestIdSchema.safeParse('has space').success).toBe(false)
  })

  it('validates endpoint-specific body, status, and failure kind together', () => {
    type ExampleCode = 'example_not_found' | 'example_conflict'
    type ExampleBody = ValedictorianErrorBody<ExampleCode>
    const bodies = {
      example_not_found: {
        code: 'example_not_found',
        message: 'The example was not found.',
      },
      example_conflict: {
        code: 'example_conflict',
        message: 'The example conflicts with current state.',
      },
    } as const satisfies Record<ExampleCode, ExampleBody>
    const bodySchema: z.ZodType<ExampleBody> = z
      .object({
        code: z.enum(['example_not_found', 'example_conflict']),
        message: z.string(),
      })
      .strict()
      .transform((value, context) => {
        const canonical = bodies[value.code]
        if (value.message !== canonical.message) {
          context.addIssue({ code: 'custom', message: 'noncanonical message' })
          return z.NEVER
        }
        return canonical
      })
    const spec = {
      bodySchema,
      statusByCode: {
        example_not_found: 404,
        example_conflict: 409,
      },
      kindByCode: {
        example_not_found: 'not_found',
        example_conflict: 'conflict',
      },
    } as const

    expect(validateValedictorianEndpointError({
      body: bodies.example_not_found,
      status: 404,
      spec,
    })).toEqual({
      ok: true,
      body: bodies.example_not_found,
      status: 404,
      kind: 'not_found',
    })
    expect(validateValedictorianEndpointError({
      body: { ...bodies.example_not_found, message: 'canary-leak' },
      status: 404,
      spec,
    })).toEqual({ ok: false, reason: 'malformed_body' })
    expect(validateValedictorianEndpointError({
      body: bodies.example_conflict,
      status: 500,
      spec,
    })).toEqual({ ok: false, reason: 'status_mismatch' })
  })
})
