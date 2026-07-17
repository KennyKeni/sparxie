import { describe, expect, it } from 'vitest'
import {
  defaultUserProfile,
  profileDocumentFormatInputSchema,
  profileDocumentRestoreInputSchema,
  profileDocumentSchema,
  profileDocumentSchemaVersion,
  profileDocumentUpdateInputSchema,
  profileDocumentValidateResultSchema,
} from './index'

describe('profile document contracts', () => {
  it('validates a versioned document and revision-aware update without secret fields', () => {
    const document = {
      schemaVersion: profileDocumentSchemaVersion,
      revision: 'rev-1',
      profile: {
        ...defaultUserProfile,
        dateOfBirth: '1998-04-12',
        fullName: 'Kenny Lin',
        gender: 'Man',
      },
    }

    expect(profileDocumentSchema.parse(document)).toEqual(document)
    expect(
      profileDocumentSchema.safeParse({
        ...document,
        profile: { ...document.profile, ssnLast4: '5125' },
      }).success,
    ).toBe(false)
    expect(
      profileDocumentSchema.safeParse({
        ...document,
        extra: true,
      }).success,
    ).toBe(false)
    expect(
      profileDocumentSchema.safeParse({
        schemaVersion: 2,
        revision: 'rev-1',
        profile: document.profile,
      }).success,
    ).toBe(false)

    const update = {
      expectedRevision: 'rev-1',
      profile: {
        fullName: 'Kenny Lin',
        dateOfBirth: '1998-04-12',
        gender: 'Man' as const,
      },
    }
    expect(profileDocumentUpdateInputSchema.parse(update)).toEqual(update)
    expect(
      profileDocumentUpdateInputSchema.safeParse({
        fullName: 'Kenny Lin',
      }).success,
    ).toBe(false)
    expect(
      profileDocumentUpdateInputSchema.safeParse({
        expectedRevision: 'rev-1',
        profile: { fullName: 'Kenny Lin' },
        revision: 'client-owned',
      }).success,
    ).toBe(false)
    expect(
      profileDocumentUpdateInputSchema.safeParse({
        expectedRevision: '',
        profile: { fullName: 'Kenny Lin' },
      }).success,
    ).toBe(false)
  })

  it('requires revision-aware format and restore inputs and reports validate success identity', () => {
    expect(
      profileDocumentValidateResultSchema.parse({
        schemaVersion: profileDocumentSchemaVersion,
        revision: 'rev-1',
      }),
    ).toEqual({
      schemaVersion: profileDocumentSchemaVersion,
      revision: 'rev-1',
    })
    expect(
      profileDocumentValidateResultSchema.safeParse({
        schemaVersion: profileDocumentSchemaVersion,
        revision: 'rev-1',
        profile: defaultUserProfile,
      }).success,
    ).toBe(false)

    expect(profileDocumentFormatInputSchema.parse({ expectedRevision: 'rev-1' })).toEqual({
      expectedRevision: 'rev-1',
    })
    expect(profileDocumentFormatInputSchema.safeParse({}).success).toBe(false)
    expect(
      profileDocumentFormatInputSchema.safeParse({ expectedRevision: null }).success,
    ).toBe(false)

    expect(profileDocumentRestoreInputSchema.parse({ expectedRevision: 'rev-1' })).toEqual({
      expectedRevision: 'rev-1',
    })
    expect(profileDocumentRestoreInputSchema.parse({ expectedRevision: null })).toEqual({
      expectedRevision: null,
    })
    expect(profileDocumentRestoreInputSchema.safeParse({}).success).toBe(false)
  })
})
