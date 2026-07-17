import { z } from 'zod'
import { canonicalDateOnlySchema } from './canonical-date.js'
import {
  profileGenderOptions,
  profileRaceEthnicityOptions,
  profileSelfIdResponseOptions,
  profileVeteranStatusOptions,
  userProfileSchema,
  type ProfileAnswerInput,
  type ProfileEducationInput,
  type ProfileUpdateInput,
  type UserProfile,
} from './profile.js'

export const profileDocumentSchemaVersion = 1 as const

export interface ProfileDocument {
  profile: UserProfile
  revision: string
  schemaVersion: typeof profileDocumentSchemaVersion
}

export interface ProfileDocumentUpdateInput {
  expectedRevision: string
  profile: ProfileUpdateInput
}

const nullableStringInputSchema = z.string().nullable().optional()
const nullableBooleanInputSchema = z.boolean().nullable().optional()
const profileGenderInputSchema = z.enum(profileGenderOptions).nullable().optional()
const profileSelfIdInputSchema = z.enum(profileSelfIdResponseOptions).nullable().optional()
const profileRaceEthnicityInputSchema = z.enum(profileRaceEthnicityOptions).nullable().optional()
const profileVeteranStatusInputSchema = z.enum(profileVeteranStatusOptions).nullable().optional()

const profileAnswerInputSchema: z.ZodType<ProfileAnswerInput> = z
  .object({
    answer: z.string().nullable().optional(),
    category: nullableStringInputSchema,
    includeInAgentContext: z.boolean().optional(),
    key: z.string().nullable().optional(),
    label: z.string().nullable().optional(),
    questionPattern: z.string().nullable().optional(),
  })
  .strict()

const profileEducationInputSchema: z.ZodType<ProfileEducationInput> = z
  .object({
    classStanding: nullableStringInputSchema,
    degree: nullableStringInputSchema,
    educationType: nullableStringInputSchema,
    graduationDate: nullableStringInputSchema,
    id: nullableStringInputSchema,
    major: nullableStringInputSchema,
    notes: nullableStringInputSchema,
    satScore: nullableStringInputSchema,
    school: nullableStringInputSchema,
    transcriptPath: nullableStringInputSchema,
  })
  .strict()

export const profileUpdateInputSchema: z.ZodType<ProfileUpdateInput> = z
  .object({
    addressLine1: nullableStringInputSchema,
    addressLine2: nullableStringInputSchema,
    answers: z.array(profileAnswerInputSchema).optional(),
    city: nullableStringInputSchema,
    country: nullableStringInputSchema,
    citizenship: nullableStringInputSchema,
    classStanding: nullableStringInputSchema,
    coverLetterPath: nullableStringInputSchema,
    dateOfBirth: canonicalDateOnlySchema.nullable().optional(),
    degree: nullableStringInputSchema,
    disabilityStatus: profileSelfIdInputSchema,
    education: z.array(profileEducationInputSchema).optional(),
    email: nullableStringInputSchema,
    fullName: nullableStringInputSchema,
    gender: profileGenderInputSchema,
    githubUrl: nullableStringInputSchema,
    graduationDate: nullableStringInputSchema,
    highSchool: nullableStringInputSchema,
    hispanicLatino: profileSelfIdInputSchema,
    language: nullableStringInputSchema,
    linkedinUrl: nullableStringInputSchema,
    major: nullableStringInputSchema,
    phone: nullableStringInputSchema,
    phoneDeviceType: nullableStringInputSchema,
    portfolioUrl: nullableStringInputSchema,
    preferredName: nullableStringInputSchema,
    raceEthnicity: profileRaceEthnicityInputSchema,
    region: nullableStringInputSchema,
    relocation: nullableStringInputSchema,
    relocationNotes: nullableStringInputSchema,
    requireSponsorship: nullableStringInputSchema,
    requireSponsorshipFuture: nullableStringInputSchema,
    satScore: nullableStringInputSchema,
    school: nullableStringInputSchema,
    transcriptPath: nullableStringInputSchema,
    travel: nullableStringInputSchema,
    travelNotes: nullableStringInputSchema,
    veteranStatus: profileVeteranStatusInputSchema,
    willingToRelocate: nullableBooleanInputSchema,
    willingToTravel: nullableBooleanInputSchema,
    workAuthorization: nullableStringInputSchema,
  })
  .strict()

export const profileDocumentSchema: z.ZodType<ProfileDocument> = z
  .object({
    profile: userProfileSchema,
    revision: z.string().min(1),
    schemaVersion: z.literal(profileDocumentSchemaVersion),
  })
  .strict()

export const profileDocumentUpdateInputSchema: z.ZodType<ProfileDocumentUpdateInput> = z
  .object({
    expectedRevision: z.string().min(1),
    profile: profileUpdateInputSchema,
  })
  .strict()

export interface ProfileDocumentValidateResult {
  revision: string
  schemaVersion: typeof profileDocumentSchemaVersion
}

export interface ProfileDocumentFormatInput {
  expectedRevision: string
}

export interface ProfileDocumentRestoreInput {
  expectedRevision: string | null
}

export type ProfileDocumentFormatResult = ProfileDocument
export type ProfileDocumentRestoreResult = ProfileDocument

export const profileDocumentValidateResultSchema: z.ZodType<ProfileDocumentValidateResult> = z
  .object({
    revision: z.string().min(1),
    schemaVersion: z.literal(profileDocumentSchemaVersion),
  })
  .strict()

export const profileDocumentFormatInputSchema: z.ZodType<ProfileDocumentFormatInput> = z
  .object({
    expectedRevision: z.string().min(1),
  })
  .strict()

export const profileDocumentRestoreInputSchema: z.ZodType<ProfileDocumentRestoreInput> = z
  .object({
    expectedRevision: z.string().min(1).nullable(),
  })
  .strict()

export const profileDocumentErrorCodes = [
  'invalid_profile_document',
  'unsupported_profile_schema_version',
  'profile_revision_conflict',
  'profile_document_unavailable',
  'profile_backup_unavailable',
] as const

export type ProfileDocumentErrorCode = (typeof profileDocumentErrorCodes)[number]

export const profileDocumentErrorBodies = Object.freeze({
  invalid_profile_document: {
    code: 'invalid_profile_document',
    message: 'The profile document is invalid.',
  },
  unsupported_profile_schema_version: {
    code: 'unsupported_profile_schema_version',
    message: 'The profile document schema version is unsupported.',
  },
  profile_revision_conflict: {
    code: 'profile_revision_conflict',
    message: 'The profile document revision does not match the expected revision.',
  },
  profile_document_unavailable: {
    code: 'profile_document_unavailable',
    message: 'The profile document is unavailable.',
  },
  profile_backup_unavailable: {
    code: 'profile_backup_unavailable',
    message: 'The profile document backup is unavailable.',
  },
} as const)

export const profileDocumentErrorStatusByCode = Object.freeze({
  invalid_profile_document: 422,
  unsupported_profile_schema_version: 409,
  profile_revision_conflict: 409,
  profile_document_unavailable: 404,
  profile_backup_unavailable: 404,
} as const satisfies Record<ProfileDocumentErrorCode, 404 | 409 | 422>)

const profileDocumentErrorPathSegmentSchema = z.union([z.string().min(1), z.number().int().nonnegative()])

type ProfileDocumentInvalidErrorBody = {
  code: 'invalid_profile_document'
  message: typeof profileDocumentErrorBodies.invalid_profile_document.message
  path: ReadonlyArray<string | number>
  line?: number
  column?: number
}

type ProfileDocumentSimpleErrorBody = {
  [Code in Exclude<ProfileDocumentErrorCode, 'invalid_profile_document'>]: {
    code: Code
    message: (typeof profileDocumentErrorBodies)[Code]['message']
  }
}[Exclude<ProfileDocumentErrorCode, 'invalid_profile_document'>]

export type ProfileDocumentErrorBody =
  | ProfileDocumentInvalidErrorBody
  | ProfileDocumentSimpleErrorBody

const profileDocumentInvalidErrorBodySchema: z.ZodType<ProfileDocumentInvalidErrorBody> = z
  .object({
    code: z.literal('invalid_profile_document'),
    message: z.literal(profileDocumentErrorBodies.invalid_profile_document.message),
    path: z.array(profileDocumentErrorPathSegmentSchema),
    line: z.number().int().positive().optional(),
    column: z.number().int().positive().optional(),
  })
  .strict()

const profileDocumentSimpleErrorBodySchema: z.ZodType<ProfileDocumentSimpleErrorBody> = z
  .object({
    code: z.enum([
      'unsupported_profile_schema_version',
      'profile_revision_conflict',
      'profile_document_unavailable',
      'profile_backup_unavailable',
    ]),
    message: z.string(),
  })
  .strict()
  .transform((value, context) => {
    const canonical = profileDocumentErrorBodies[value.code]
    if (value.message !== canonical.message) {
      context.addIssue({ code: 'custom', message: 'invalid profile document error body' })
      return z.NEVER
    }
    return { code: canonical.code, message: canonical.message } as ProfileDocumentSimpleErrorBody
  })

export const profileDocumentErrorBodySchema: z.ZodType<ProfileDocumentErrorBody> = z.union([
  profileDocumentInvalidErrorBodySchema,
  profileDocumentSimpleErrorBodySchema,
])
