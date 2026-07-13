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
