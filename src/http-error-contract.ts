import { z } from 'zod'

export const invalidPersistedRawDetailErrorCode = 'invalid_persisted_raw_detail'

export const invalidPersistedRawDetailErrorMessage = 'Stored raw record detail is invalid.'

export interface InvalidPersistedRawDetailErrorBody {
  readonly code: typeof invalidPersistedRawDetailErrorCode
  readonly message: typeof invalidPersistedRawDetailErrorMessage
}

export const invalidPersistedRawDetailErrorBody: InvalidPersistedRawDetailErrorBody =
  Object.freeze({
    code: invalidPersistedRawDetailErrorCode,
    message: invalidPersistedRawDetailErrorMessage,
  })

export const invalidPersistedRawDetailErrorBodySchema:
  z.ZodType<InvalidPersistedRawDetailErrorBody> = z
  .object({
    code: z.literal(invalidPersistedRawDetailErrorCode),
    message: z.literal(invalidPersistedRawDetailErrorMessage),
  })
  .strict()

export const invalidPersistedRawDetailErrorKindByCode = Object.freeze({
  invalid_persisted_raw_detail: 'integrity',
} as const satisfies Record<typeof invalidPersistedRawDetailErrorCode, 'integrity'>)

export const valedictorianFailureKinds = Object.freeze([
  'validation',
  'not_found',
  'conflict',
  'authentication',
  'authorization',
  'rate_limit',
  'unavailable',
  'integrity',
  'internal',
] as const)

export type ValedictorianFailureKind = (typeof valedictorianFailureKinds)[number]

export const valedictorianFailureKindMessages = Object.freeze({
  validation: 'The request is invalid.',
  not_found: 'The requested resource was not found.',
  conflict: 'The request conflicts with the current state.',
  authentication: 'Authentication is required.',
  authorization: 'You do not have permission to perform this request.',
  rate_limit: 'The request rate limit was exceeded.',
  unavailable: 'The service is temporarily unavailable.',
  integrity: 'Stored data integrity could not be verified.',
  internal: 'An unexpected error occurred.',
} as const satisfies Record<ValedictorianFailureKind, string>)

export const valedictorianInternalErrorCode = 'internal_error'
export const valedictorianInternalErrorStatus = 500
export const valedictorianInternalErrorKind = 'internal'

export interface ValedictorianInternalErrorBody {
  readonly code: typeof valedictorianInternalErrorCode
  readonly message: typeof valedictorianFailureKindMessages.internal
  readonly requestId: string
}

export const valedictorianSafeRequestFailedMessage = 'Request failed'

export interface ValedictorianErrorBody<
  Code extends string = string,
  Details = never,
> {
  code: Code
  message: string
  details?: Details
  requestId?: string
}

const valedictorianRequestIdMaxLength = 128
const valedictorianRequestIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/

export const valedictorianRequestIdSchema = z
  .string()
  .min(1)
  .max(valedictorianRequestIdMaxLength)
  .regex(valedictorianRequestIdPattern)

export const valedictorianInternalErrorBodySchema:
  z.ZodType<ValedictorianInternalErrorBody> = z
  .object({
    code: z.literal(valedictorianInternalErrorCode),
    message: z.literal(valedictorianFailureKindMessages.internal),
    requestId: valedictorianRequestIdSchema,
  })
  .strict()

export function createValedictorianInternalErrorBody(
  requestId: string,
): ValedictorianInternalErrorBody {
  return valedictorianInternalErrorBodySchema.parse({
    code: valedictorianInternalErrorCode,
    message: valedictorianFailureKindMessages.internal,
    requestId,
  })
}

export function parseValedictorianRequestId(value: unknown): string | undefined {
  const parsed = valedictorianRequestIdSchema.safeParse(value)
  return parsed.success ? parsed.data : undefined
}

export const valedictorianRetryAfterMaxDeltaSeconds = 86_400

export type ValedictorianRetryAfter =
  | { readonly kind: 'delta-seconds'; readonly seconds: number }
  | { readonly kind: 'http-date'; readonly at: string }

const deltaSecondsPattern = /^(0|[1-9]\d*)$/
const imfFixdatePattern = /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), (?:0[1-9]|[12]\d|3[01]) (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} (?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d GMT$/

export function parseValedictorianRetryAfterHeader(
  value: string | null | undefined,
): ValedictorianRetryAfter | undefined {
  if (value === null || value === undefined) return undefined
  const trimmed = value.trim()
  if (trimmed.length === 0) return undefined

  if (deltaSecondsPattern.test(trimmed)) {
    const seconds = Number(trimmed)
    if (!Number.isInteger(seconds)) return undefined
    if (seconds < 0 || seconds > valedictorianRetryAfterMaxDeltaSeconds) return undefined
    return { kind: 'delta-seconds', seconds }
  }

  if (!imfFixdatePattern.test(trimmed)) return undefined

  const parsed = Date.parse(trimmed)
  if (Number.isNaN(parsed)) return undefined
  const date = new Date(parsed)
  if (date.toUTCString() !== trimmed) return undefined
  return { kind: 'http-date', at: date.toISOString() }
}

export interface ValedictorianEndpointErrorSpec<
  Code extends string,
  Body extends ValedictorianErrorBody<Code, unknown>,
> {
  bodySchema: z.ZodType<Body>
  statusByCode: Readonly<Record<Code, number>>
  kindByCode: Readonly<Record<Code, ValedictorianFailureKind>>
  supportsRetryAfter?: boolean
}

export type ValedictorianEndpointErrorValidation<
  Code extends string,
  Body extends ValedictorianErrorBody<Code, unknown>,
> =
  | {
      ok: true
      body: Body
      status: number
      kind: ValedictorianFailureKind
      retryAfter?: ValedictorianRetryAfter
    }
  | {
      ok: false
      reason: 'malformed_body' | 'status_mismatch' | 'invalid_retry_after'
    }

export function validateValedictorianEndpointError<
  Code extends string,
  Body extends ValedictorianErrorBody<Code, unknown>,
>({
  body,
  status,
  spec,
  retryAfterHeader,
}: {
  body: unknown
  status: number
  spec: ValedictorianEndpointErrorSpec<Code, Body>
  retryAfterHeader?: string | null
}): ValedictorianEndpointErrorValidation<Code, Body> {
  const parsed = spec.bodySchema.safeParse(body)
  if (!parsed.success) {
    return { ok: false, reason: 'malformed_body' }
  }

  const expectedStatus = spec.statusByCode[parsed.data.code]
  if (expectedStatus !== status) {
    return { ok: false, reason: 'status_mismatch' }
  }

  if (!spec.supportsRetryAfter) {
    return {
      ok: true,
      body: parsed.data,
      status,
      kind: spec.kindByCode[parsed.data.code],
    }
  }

  if (retryAfterHeader === null || retryAfterHeader === undefined || retryAfterHeader.trim() === '') {
    return {
      ok: true,
      body: parsed.data,
      status,
      kind: spec.kindByCode[parsed.data.code],
    }
  }

  const retryAfter = parseValedictorianRetryAfterHeader(retryAfterHeader)
  if (retryAfter === undefined) {
    return { ok: false, reason: 'invalid_retry_after' }
  }

  return {
    ok: true,
    body: parsed.data,
    status,
    kind: spec.kindByCode[parsed.data.code],
    retryAfter,
  }
}

export function createValedictorianErrorDetailsSchema<Details>(
  detailsSchema: z.ZodType<Details>,
): z.ZodType<Details> {
  return detailsSchema
}
