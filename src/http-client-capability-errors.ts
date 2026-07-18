import {
  connectorCreateErrorBodySchema,
  connectorCreateErrorCodes,
  connectorCreateErrorKindByCode,
  connectorCreateErrorStatusByCode,
  type ConnectorCreateErrorBody,
  type ConnectorCreateErrorCode,
} from './connector.js'
import {
  connectorOptionQueryErrorBodySchema,
  connectorOptionQueryErrorCodes,
  connectorOptionQueryErrorKindByCode,
  connectorOptionQueryErrorStatusByCode,
  type ConnectorOptionQueryErrorBody,
  type ConnectorOptionQueryErrorCode,
} from './connector-option-query.js'
import {
  connectorRetirementActiveWorkConflictKind,
  connectorRetirementActiveWorkConflictStatus,
  type ConnectorRetirementActiveWorkConflict,
} from './connector-retirement.js'
import {
  ValedictorianHttpError,
  ValedictorianProtocolError,
  createFailClosedHttpError,
  getHttpErrorResponseBody,
} from './http-client-error.js'
import {
  invalidPersistedRawDetailErrorCode,
  invalidPersistedRawDetailErrorBodySchema,
  invalidPersistedRawDetailErrorKindByCode,
  validateValedictorianEndpointError,
  type InvalidPersistedRawDetailErrorBody,
  type ValedictorianFailureKind,
} from './http-error-contract.js'
import {
  profileDocumentErrorBodySchema,
  profileDocumentErrorCodes,
  profileDocumentErrorKindByCode,
  profileDocumentErrorStatusByCode,
  type ProfileDocumentErrorBody,
  type ProfileDocumentErrorCode,
} from './profile-document.js'

export class InvalidPersistedRawDetailHttpError
  extends ValedictorianHttpError<InvalidPersistedRawDetailErrorBody> {
  declare readonly kind: ValedictorianFailureKind

  constructor(body: InvalidPersistedRawDetailErrorBody, status: number) {
    super({
      body,
      message: body.message,
      status,
      kind: invalidPersistedRawDetailErrorKindByCode[body.code],
    })
    this.name = 'InvalidPersistedRawDetailHttpError'
  }
}

export class ConnectorOptionQueryHttpError
  extends ValedictorianHttpError<ConnectorOptionQueryErrorBody> {
  readonly code: ConnectorOptionQueryErrorCode
  declare readonly kind: ValedictorianFailureKind

  constructor(body: ConnectorOptionQueryErrorBody, status: number) {
    super({
      body,
      message: body.message,
      status,
      kind: connectorOptionQueryErrorKindByCode[body.code],
    })
    this.name = 'ConnectorOptionQueryHttpError'
    this.code = body.code
  }
}

export class ConnectorRetirementConflictError extends ValedictorianHttpError {
  readonly conflict: ConnectorRetirementActiveWorkConflict
  declare readonly kind: typeof connectorRetirementActiveWorkConflictKind

  constructor(conflict: ConnectorRetirementActiveWorkConflict) {
    super({
      body: conflict,
      message: conflict.message,
      status: connectorRetirementActiveWorkConflictStatus,
      kind: connectorRetirementActiveWorkConflictKind,
    })
    this.name = 'ConnectorRetirementConflictError'
    this.conflict = conflict
  }
}

export class ProfileDocumentHttpError extends ValedictorianHttpError<ProfileDocumentErrorBody> {
  readonly code: ProfileDocumentErrorCode
  declare readonly kind: ValedictorianFailureKind

  constructor(body: ProfileDocumentErrorBody, status: number) {
    super({
      body,
      message: body.message,
      status,
      kind: profileDocumentErrorKindByCode[body.code],
    })
    this.name = 'ProfileDocumentHttpError'
    this.code = body.code
  }
}

export class ConnectorCreateHttpError extends ValedictorianHttpError<ConnectorCreateErrorBody> {
  readonly code: ConnectorCreateErrorCode
  declare readonly kind: ValedictorianFailureKind

  constructor(body: ConnectorCreateErrorBody, status: number) {
    super({
      body,
      message: body.message,
      status,
      kind: connectorCreateErrorKindByCode[body.code],
    })
    this.name = 'ConnectorCreateHttpError'
    this.code = body.code
  }
}

function isProfileDocumentErrorCode(value: unknown): value is ProfileDocumentErrorCode {
  return typeof value === 'string'
    && (profileDocumentErrorCodes as readonly string[]).includes(value)
}

export function rethrowProfileDocumentError(error: unknown): never {
  if (!(error instanceof ValedictorianHttpError)) throw error

  const responseBody = getHttpErrorResponseBody(error)
  const validated = validateValedictorianEndpointError({
    body: responseBody,
    status: error.status,
    spec: {
      bodySchema: profileDocumentErrorBodySchema,
      statusByCode: profileDocumentErrorStatusByCode,
      kindByCode: profileDocumentErrorKindByCode,
    },
  })
  if (validated.ok) {
    throw new ProfileDocumentHttpError(validated.body, validated.status)
  }

  if (
    typeof responseBody === 'object'
    && responseBody !== null
    && 'code' in responseBody
    && isProfileDocumentErrorCode(responseBody.code)
  ) {
    throw new ValedictorianProtocolError()
  }

  throw createFailClosedHttpError(error.status, responseBody)
}

export function rethrowRawRecordDetailError(error: unknown): never {
  if (
    !(error instanceof ValedictorianHttpError)
    || error.status < 500
    || error.status > 599
  ) {
    if (error instanceof ValedictorianHttpError) {
      throw createFailClosedHttpError(error.status, getHttpErrorResponseBody(error))
    }
    throw error
  }

  const responseBody = getHttpErrorResponseBody(error)
  const integrityError = invalidPersistedRawDetailErrorBodySchema.safeParse(responseBody)

  if (integrityError.success) {
    throw new InvalidPersistedRawDetailHttpError(integrityError.data, error.status)
  }

  if (
    typeof responseBody === 'object'
    && responseBody !== null
    && 'code' in responseBody
    && responseBody.code === invalidPersistedRawDetailErrorCode
  ) {
    throw new ValedictorianProtocolError()
  }

  throw createFailClosedHttpError(error.status, responseBody)
}

function isConnectorOptionQueryErrorCode(value: unknown): value is ConnectorOptionQueryErrorCode {
  return typeof value === 'string'
    && (connectorOptionQueryErrorCodes as readonly string[]).includes(value)
}

export function rethrowConnectorOptionQueryError(error: unknown): never {
  if (!(error instanceof ValedictorianHttpError)) throw error

  const responseBody = getHttpErrorResponseBody(error)
  const validated = validateValedictorianEndpointError({
    body: responseBody,
    status: error.status,
    spec: {
      bodySchema: connectorOptionQueryErrorBodySchema,
      statusByCode: connectorOptionQueryErrorStatusByCode,
      kindByCode: connectorOptionQueryErrorKindByCode,
    },
  })
  if (validated.ok) {
    throw new ConnectorOptionQueryHttpError(validated.body, validated.status)
  }

  if (typeof responseBody === 'object'
    && responseBody !== null
    && 'code' in responseBody
    && isConnectorOptionQueryErrorCode(responseBody.code)) {
    throw new ValedictorianProtocolError()
  }

  throw createFailClosedHttpError(error.status, responseBody)
}

function isConnectorCreateErrorCode(value: unknown): value is ConnectorCreateErrorCode {
  return typeof value === 'string'
    && (connectorCreateErrorCodes as readonly string[]).includes(value)
}

export function rethrowConnectorCreateError(error: unknown): never {
  if (!(error instanceof ValedictorianHttpError)) throw error

  const responseBody = getHttpErrorResponseBody(error)
  const validated = validateValedictorianEndpointError({
    body: responseBody,
    status: error.status,
    spec: {
      bodySchema: connectorCreateErrorBodySchema,
      statusByCode: connectorCreateErrorStatusByCode,
      kindByCode: connectorCreateErrorKindByCode,
    },
  })
  if (validated.ok) {
    throw new ConnectorCreateHttpError(validated.body, validated.status)
  }

  if (
    typeof responseBody === 'object'
    && responseBody !== null
    && 'code' in responseBody
    && isConnectorCreateErrorCode(responseBody.code)
  ) {
    throw new ValedictorianProtocolError()
  }

  throw createFailClosedHttpError(error.status, responseBody)
}

export function requireResponseIdentity<T>(value: T, actual: string, expected: string): T {
  if (actual !== expected) {
    throw new ValedictorianProtocolError({ cause: new Error('response identity mismatch') })
  }
  return value
}
