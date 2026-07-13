import {
  InvalidPersistedRawDetailHttpError,
  invalidPersistedRawDetailErrorBody,
  type InvalidPersistedRawDetailErrorBody,
} from '../src/index.js'

const error = new InvalidPersistedRawDetailHttpError(
  invalidPersistedRawDetailErrorBody,
  503,
)

const canonicalBody: InvalidPersistedRawDetailErrorBody = error.body

void canonicalBody
