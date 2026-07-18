import { valedictorianApiPaths } from './api.js'
import type { ValedictorianWorkspaceClient } from './client.js'
import {
  ValedictorianHttpError,
  ValedictorianProtocolError,
  ValedictorianTransportError,
  createFailClosedHttpError,
  getHttpErrorResponseBody,
  getHttpErrorRetryAfterHeader,
  isCallerAbortError,
  parseValedictorianContractValue,
} from './http-client-error.js'
import {
  validateValedictorianEndpointError,
  type ValedictorianFailureKind,
  type ValedictorianRetryAfter,
} from './http-error-contract.js'
import {
  profileSecretSummarySchema,
  profileSecretsListResultSchema,
} from './http-response-contracts.js'
import {
  localSecretResolutionErrorBodySchema,
  localSecretResolutionErrorCodes,
  localSecretResolutionErrorKindByCode,
  localSecretResolutionErrorStatusByCode,
  localSecretResolutionInputSchema,
  localSecretResolutionResultSchema,
  type LocalSecretResolutionErrorBody,
  type LocalSecretResolutionErrorCode,
} from './secret-use.js'

export class LocalSecretResolutionHttpError
  extends ValedictorianHttpError<LocalSecretResolutionErrorBody> {
  readonly code: LocalSecretResolutionErrorCode
  declare readonly kind: ValedictorianFailureKind

  constructor(
    body: LocalSecretResolutionErrorBody,
    status: number,
    options: { retryAfter?: ValedictorianRetryAfter } = {},
  ) {
    super({
      body,
      message: body.message,
      status,
      kind: localSecretResolutionErrorKindByCode[body.code],
      retryAfter: options.retryAfter,
    })
    this.name = 'LocalSecretResolutionHttpError'
    this.code = body.code
  }
}

type SecretsHttpRequest = <T>(
  path: string,
  options?: {
    body?: unknown
    headers?: Record<string, string>
    method?: 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT'
    query?: URLSearchParams
  },
) => Promise<T>

type SecretsHttpResolve = (
  path: string,
  options: {
    body: unknown
    headers: Record<string, string>
    method: 'POST'
  },
) => Promise<unknown>

export function rethrowLocalSecretResolutionError(error: unknown): never {
  if (!(error instanceof ValedictorianHttpError)) throw error

  const responseBody = getHttpErrorResponseBody(error)
  const validated = validateValedictorianEndpointError({
    body: responseBody,
    status: error.status,
    retryAfterHeader: getHttpErrorRetryAfterHeader(error),
    spec: {
      bodySchema: localSecretResolutionErrorBodySchema,
      statusByCode: localSecretResolutionErrorStatusByCode,
      kindByCode: localSecretResolutionErrorKindByCode,
      supportsRetryAfter: true,
    },
  })
  if (validated.ok) {
    throw new LocalSecretResolutionHttpError(validated.body, validated.status, {
      retryAfter: validated.retryAfter,
    })
  }

  if (validated.reason === 'invalid_retry_after' || validated.reason === 'status_mismatch') {
    throw new ValedictorianProtocolError()
  }

  if (
    typeof responseBody === 'object'
    && responseBody !== null
    && 'code' in responseBody
    && typeof responseBody.code === 'string'
    && (localSecretResolutionErrorCodes as readonly string[]).includes(responseBody.code)
  ) {
    throw new ValedictorianProtocolError()
  }

  throw createFailClosedHttpError(error.status)
}

function splitCacheControlDirectives(header: string): string[] | null {
  const directives: string[] = []
  let current = ''
  let inQuotes = false
  let escaped = false

  for (const character of header) {
    if (escaped) {
      current += character
      escaped = false
      continue
    }
    if (inQuotes) {
      if (character === '\\') {
        current += character
        escaped = true
        continue
      }
      current += character
      if (character === '"') inQuotes = false
      continue
    }
    if (character === '"') {
      current += character
      inQuotes = true
      continue
    }
    if (character === ',') {
      directives.push(current)
      current = ''
      continue
    }
    current += character
  }

  if (inQuotes || escaped) return null
  directives.push(current)
  return directives
}

function cacheControlIncludesNoStore(header: string | null): boolean {
  if (header === null || header.trim().length === 0) return false
  const directives = splitCacheControlDirectives(header)
  if (directives === null) return false
  return directives.some((directive) => directive.trim().toLowerCase() === 'no-store')
}

export function createSecretsHttpMethods({
  pathFor,
  request,
  resolveRequest,
}: {
  pathFor: (path: string) => string
  request: SecretsHttpRequest
  resolveRequest: SecretsHttpResolve
}): ValedictorianWorkspaceClient['secrets'] {
  return {
    delete(key) {
      return request(pathFor(valedictorianApiPaths.secret(key)), {
        method: 'DELETE',
      })
    },
    async list() {
      return parseValedictorianContractValue(
        profileSecretsListResultSchema,
        await request(pathFor(valedictorianApiPaths.secrets)),
      )
    },
    async upsert(input) {
      const { key, ...body } = input
      return parseValedictorianContractValue(
        profileSecretSummarySchema,
        await request(pathFor(valedictorianApiPaths.secret(key)), {
          body,
          method: 'PUT',
        }),
      )
    },
    local: {
      async resolve(input) {
        const body = localSecretResolutionInputSchema.parse(input)
        try {
          const payload = await resolveRequest(
            pathFor(valedictorianApiPaths.secretsLocalResolve),
            {
              body,
              headers: { 'cache-control': 'no-store' },
              method: 'POST',
            },
          )
          return parseValedictorianContractValue(localSecretResolutionResultSchema, payload)
        } catch (error) {
          rethrowLocalSecretResolutionError(error)
        }
      },
    },
  }
}

export function createLocalSecretResolveRequest({
  baseUrl,
  fetchImplementation,
  token,
  readResponseBody,
}: {
  baseUrl: string
  fetchImplementation: typeof fetch
  token?: string
  readResponseBody: (response: Response) => Promise<unknown>
}): SecretsHttpResolve {
  return async (path, options) => {
    const url = new URL(path, baseUrl)
    const headers: Record<string, string> = {
      accept: 'application/json',
      'content-type': 'application/json',
      ...options.headers,
    }
    if (token) headers.authorization = `Bearer ${token}`

    let response: Response
    try {
      response = await fetchImplementation(url.toString(), {
        body: JSON.stringify(options.body),
        headers,
        method: options.method,
      })
    } catch (error) {
      if (isCallerAbortError(error)) throw error
      throw new ValedictorianTransportError({ cause: error })
    }

    if (!response.ok) {
      const body = await readResponseBody(response)
      throw createFailClosedHttpError(response.status, body, {
        retryAfterHeader: response.headers.get('retry-after'),
      })
    }

    if (!cacheControlIncludesNoStore(response.headers.get('cache-control'))) {
      response.body?.cancel()
      throw new ValedictorianProtocolError({
        cause: new Error('Sensitive response is missing Cache-Control: no-store'),
      })
    }

    const body = await readResponseBody(response)
    const closedError = localSecretResolutionErrorBodySchema.safeParse(body)
    if (closedError.success) {
      throw createFailClosedHttpError(response.status, closedError.data)
    }

    return body
  }
}
