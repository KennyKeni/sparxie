import { valedictorianApiPaths } from './api.js'
import type { ValedictorianWorkspaceClient } from './client.js'
import { ValedictorianHttpError } from './http-client-error.js'
import {
  localSecretResolutionErrorBodySchema,
  localSecretResolutionErrorStatusByCode,
  localSecretResolutionInputSchema,
  localSecretResolutionResultSchema,
  type LocalSecretResolutionErrorBody,
  type LocalSecretResolutionErrorCode,
} from './secret-use.js'

export class LocalSecretResolutionHttpError
  extends ValedictorianHttpError<LocalSecretResolutionErrorBody> {
  readonly code: LocalSecretResolutionErrorCode

  constructor(body: LocalSecretResolutionErrorBody, status: number) {
    super({ body, message: body.message, status })
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

  const parsed = localSecretResolutionErrorBodySchema.safeParse(error.body)
  if (parsed.success) {
    if (localSecretResolutionErrorStatusByCode[parsed.data.code] === error.status) {
      throw new LocalSecretResolutionHttpError(parsed.data, error.status)
    }
  }

  throw new ValedictorianHttpError({ body: null, message: 'Request failed', status: error.status })
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
    list() {
      return request(pathFor(valedictorianApiPaths.secrets))
    },
    upsert(input) {
      const { key, ...body } = input

      return request(pathFor(valedictorianApiPaths.secret(key)), {
        body,
        method: 'PUT',
      })
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
          const parsed = localSecretResolutionResultSchema.safeParse(payload)
          if (!parsed.success) {
            throw new Error('Local secret resolution response is invalid')
          }
          return parsed.data
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
  responseMessage,
}: {
  baseUrl: string
  fetchImplementation: typeof fetch
  token?: string
  readResponseBody: (response: Response) => Promise<unknown>
  responseMessage: (body: unknown, fallback: string) => string
}): SecretsHttpResolve {
  return async (path, options) => {
    const url = new URL(path, baseUrl)
    const headers: Record<string, string> = {
      accept: 'application/json',
      'content-type': 'application/json',
      ...options.headers,
    }
    if (token) headers.authorization = `Bearer ${token}`

    const response = await fetchImplementation(url.toString(), {
      body: JSON.stringify(options.body),
      headers,
      method: options.method,
    })

    if (!response.ok) {
      const body = await readResponseBody(response)
      throw new ValedictorianHttpError({
        body,
        message: responseMessage(body, response.statusText),
        status: response.status,
      })
    }

    if (!cacheControlIncludesNoStore(response.headers.get('cache-control'))) {
      response.body?.cancel()
      throw new Error('Sensitive response is missing Cache-Control: no-store')
    }

    const body = await readResponseBody(response)
    const closedError = localSecretResolutionErrorBodySchema.safeParse(body)
    if (closedError.success) {
      throw new ValedictorianHttpError({
        body: closedError.data,
        message: closedError.data.message,
        status: response.status,
      })
    }

    return body
  }
}
