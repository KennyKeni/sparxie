import { describe, expect, it } from 'vitest'
import {
  invalidPersistedRawDetailErrorBody,
  invalidPersistedRawDetailErrorBodySchema,
  invalidPersistedRawDetailErrorCode,
  invalidPersistedRawDetailErrorMessage,
  type InvalidPersistedRawDetailErrorBody,
} from './index.js'

describe('persisted raw-detail integrity error contract', () => {
  it('exports one closed, sanitized canonical body', () => {
    const body: InvalidPersistedRawDetailErrorBody = {
      code: invalidPersistedRawDetailErrorCode,
      message: invalidPersistedRawDetailErrorMessage,
    }

    expect(invalidPersistedRawDetailErrorBodySchema.parse(body)).toEqual(
      invalidPersistedRawDetailErrorBody,
    )
    expect(
      invalidPersistedRawDetailErrorBodySchema.safeParse({
        ...body,
        validation: 'payload.password: expected string',
      }).success,
    ).toBe(false)
  })
})
