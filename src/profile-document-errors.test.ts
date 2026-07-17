import { describe, expect, it } from 'vitest'
import {
  profileDocumentErrorBodies,
  profileDocumentErrorBodySchema,
  profileDocumentErrorCodes,
  profileDocumentErrorStatusByCode,
  type ProfileDocumentErrorBody,
} from './index'

describe('profile document error contract', () => {
  it('exports a closed discriminated error body with path diagnostics', () => {
    expect([...profileDocumentErrorCodes]).toEqual([
      'invalid_profile_document',
      'unsupported_profile_schema_version',
      'profile_revision_conflict',
      'profile_document_unavailable',
      'profile_backup_unavailable',
    ])

    const invalid: ProfileDocumentErrorBody = {
      code: 'invalid_profile_document',
      message: profileDocumentErrorBodies.invalid_profile_document.message,
      path: ['profile', 'dateOfBirth'],
      line: 12,
      column: 4,
    }
    expect(profileDocumentErrorBodySchema.parse(invalid)).toEqual(invalid)
    expect(
      profileDocumentErrorBodySchema.safeParse({
        ...invalid,
        line: 0,
      }).success,
    ).toBe(false)
    expect(
      profileDocumentErrorBodySchema.safeParse({
        ...invalid,
        column: -1,
      }).success,
    ).toBe(false)
    expect(
      profileDocumentErrorBodySchema.safeParse({
        code: 'invalid_profile_document',
        message: profileDocumentErrorBodies.invalid_profile_document.message,
        path: ['profile'],
        diagnostics: { raw: 'secret' },
      }).success,
    ).toBe(false)

    for (const code of profileDocumentErrorCodes) {
      if (code === 'invalid_profile_document') continue
      const body = profileDocumentErrorBodies[code]
      expect(profileDocumentErrorBodySchema.parse(body)).toEqual(body)
      expect(
        profileDocumentErrorBodySchema.safeParse({
          ...body,
          message: 'custom leak',
        }).success,
      ).toBe(false)
    }

    expect(profileDocumentErrorStatusByCode).toEqual({
      invalid_profile_document: 422,
      unsupported_profile_schema_version: 409,
      profile_revision_conflict: 409,
      profile_document_unavailable: 404,
      profile_backup_unavailable: 404,
    })
  })
})
