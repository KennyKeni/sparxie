import {
  valedictorianSafeRequestFailedMessage,
  type ValedictorianFailureKind,
  type ValedictorianRetryAfter,
} from './http-error-contract.js'

export class ValedictorianHttpError<Body = unknown> extends Error {
  readonly status: number
  readonly body: Body
  readonly retryAfter?: ValedictorianRetryAfter
  readonly requestId?: string
  readonly kind?: ValedictorianFailureKind

  constructor({
    body,
    message,
    status,
    retryAfter,
    requestId,
    kind,
  }: {
    body: Body
    message: string
    status: number
    retryAfter?: ValedictorianRetryAfter
    requestId?: string
    kind?: ValedictorianFailureKind
  }) {
    super(message)
    this.name = 'ValedictorianHttpError'
    this.status = status
    this.body = body
    if (retryAfter !== undefined) this.retryAfter = retryAfter
    if (requestId !== undefined) this.requestId = requestId
    if (kind !== undefined) this.kind = kind
  }
}

function defineNonEnumerableCause(error: Error, cause: unknown): void {
  Object.defineProperty(error, 'cause', {
    configurable: true,
    enumerable: false,
    value: cause,
    writable: true,
  })
}

export class ValedictorianTransportError extends Error {
  declare readonly cause?: unknown

  constructor({
    cause,
    message = valedictorianSafeRequestFailedMessage,
  }: {
    cause?: unknown
    message?: string
  } = {}) {
    super(message)
    this.name = 'ValedictorianTransportError'
    if (cause !== undefined) defineNonEnumerableCause(this, cause)
  }
}

export class ValedictorianProtocolError extends Error {
  declare readonly cause?: unknown

  constructor({
    cause,
    message = valedictorianSafeRequestFailedMessage,
  }: {
    cause?: unknown
    message?: string
  } = {}) {
    super(message)
    this.name = 'ValedictorianProtocolError'
    if (cause !== undefined) defineNonEnumerableCause(this, cause)
  }
}

const httpErrorResponseFacts = new WeakMap<
  object,
  { body: unknown; retryAfterHeader?: string | null }
>()

export function attachHttpErrorResponseBody(
  error: ValedictorianHttpError,
  body: unknown,
  facts?: { retryAfterHeader?: string | null },
): void {
  httpErrorResponseFacts.set(error, {
    body,
    retryAfterHeader: facts?.retryAfterHeader,
  })
}

export function getHttpErrorResponseBody(error: ValedictorianHttpError): unknown {
  const facts = httpErrorResponseFacts.get(error)
  if (facts) return facts.body
  return error.body
}

export function getHttpErrorRetryAfterHeader(
  error: ValedictorianHttpError,
): string | null | undefined {
  return httpErrorResponseFacts.get(error)?.retryAfterHeader
}

export function createFailClosedHttpError(
  status: number,
  responseBody?: unknown,
  facts?: { retryAfterHeader?: string | null },
): ValedictorianHttpError<null> {
  const error = new ValedictorianHttpError({
    body: null,
    message: valedictorianSafeRequestFailedMessage,
    status,
  })
  if (arguments.length > 1) {
    attachHttpErrorResponseBody(error, responseBody, facts)
  }
  return error
}

export function isCallerAbortError(
  error: unknown,
  signal?: AbortSignal,
): boolean {
  if (signal?.aborted !== true) return false
  if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
    return error.name === 'AbortError'
  }
  return error instanceof Error && error.name === 'AbortError'
}

export async function readValedictorianResponseBody(
  response: Response,
  signal?: AbortSignal,
): Promise<unknown> {
  let text: string
  try {
    text = await response.text()
  } catch (error) {
    if (isCallerAbortError(error, signal)) throw error
    throw new ValedictorianTransportError({ cause: error })
  }

  if (!text) return undefined

  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

export function parseValedictorianContractValue<T>(
  schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false; error: unknown } },
  value: unknown,
): T {
  const parsed = schema.safeParse(value)
  if (!parsed.success) {
    throw new ValedictorianProtocolError({ cause: parsed.error })
  }
  return parsed.data
}
