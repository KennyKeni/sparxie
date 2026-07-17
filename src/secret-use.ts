import { z } from 'zod'
import {
  secretReferenceSchema,
  type SecretReference,
} from './secret-reference.js'

export const localSecretResolutionPurposes = ['subprocess_injection'] as const

export type LocalSecretResolutionPurposeKind = (typeof localSecretResolutionPurposes)[number]

export interface LocalSecretResolutionPurpose {
  readonly kind: LocalSecretResolutionPurposeKind
}

export interface LocalSecretResolutionInput {
  readonly reference: SecretReference
  readonly purpose: LocalSecretResolutionPurpose
}

export interface LocalSecretResolutionHandling {
  readonly cache: 'no-store'
  readonly sensitivity: 'secret'
}

export interface LocalSecretResolutionResult {
  readonly value: string
  readonly handling: LocalSecretResolutionHandling
}

export const localSecretResolutionPurposeSchema: z.ZodType<LocalSecretResolutionPurpose> = z
  .object({
    kind: z.enum(localSecretResolutionPurposes),
  })
  .strict()

export const localSecretResolutionInputSchema: z.ZodType<LocalSecretResolutionInput> = z
  .object({
    reference: secretReferenceSchema,
    purpose: localSecretResolutionPurposeSchema,
  })
  .strict()

export const localSecretResolutionResultSchema: z.ZodType<LocalSecretResolutionResult> = z
  .object({
    value: z.string(),
    handling: z
      .object({
        cache: z.literal('no-store'),
        sensitivity: z.literal('secret'),
      })
      .strict(),
  })
  .strict()

export const localSecretResolutionErrorCodes = [
  'secret_not_found',
  'local_secret_resolution_unsupported',
  'local_secret_resolution_unauthorized',
  'secure_storage_unavailable',
] as const

export type LocalSecretResolutionErrorCode = (typeof localSecretResolutionErrorCodes)[number]

function freezeValues<Value extends Record<string, object>>(value: Value): Readonly<Value> {
  for (const nested of Object.values(value)) Object.freeze(nested)
  return Object.freeze(value)
}

export const localSecretResolutionErrorBodies = freezeValues({
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
} as const)

export type LocalSecretResolutionErrorBody =
  (typeof localSecretResolutionErrorBodies)[LocalSecretResolutionErrorCode]

export const localSecretResolutionErrorStatusByCode = Object.freeze({
  secret_not_found: 404,
  local_secret_resolution_unsupported: 409,
  local_secret_resolution_unauthorized: 403,
  secure_storage_unavailable: 503,
} as const satisfies Record<LocalSecretResolutionErrorCode, 403 | 404 | 409 | 503>)

const localSecretResolutionErrorBodyInnerSchema: z.ZodType<LocalSecretResolutionErrorBody> = z
  .object({
    code: z.enum(localSecretResolutionErrorCodes),
    message: z.string(),
  })
  .strict()
  .transform((value, context) => {
    const canonical = localSecretResolutionErrorBodies[value.code]
    if (value.message !== canonical.message) {
      context.addIssue({ code: 'custom', message: 'invalid local secret resolution error body' })
      return z.NEVER
    }
    return { code: canonical.code, message: canonical.message } as LocalSecretResolutionErrorBody
  })

export const localSecretResolutionErrorBodySchema: z.ZodType<LocalSecretResolutionErrorBody> =
  localSecretResolutionErrorBodyInnerSchema
