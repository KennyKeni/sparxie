import { ValedictorianHttpError } from './http-client.js'
import type {
  SourceJobsListQuery,
  SourceJobsListResponse,
  SourceRunResponse,
  SourceRunsListQuery,
  SourceRunsListResponse,
} from './source-ingestion.js'

export interface ValedictorianSourceHttpClientOptions {
  baseUrl: string
  token: string
  fetch?: typeof fetch
}

const sourceJobsListQueryParamKeys = ['limit', 'offset'] as const
const sourceRunsListQueryParamKeys = ['sourceId', 'limit'] as const

export function sourceJobsListQueryToSearchParams(query: SourceJobsListQuery = {}) {
  const params = new URLSearchParams()

  for (const key of sourceJobsListQueryParamKeys) {
    const value = query[key]

    if (value !== undefined) {
      params.set(key, String(value))
    }
  }

  return params
}

export function sourceRunsListQueryToSearchParams(query: SourceRunsListQuery = {}) {
  const params = new URLSearchParams()

  for (const key of sourceRunsListQueryParamKeys) {
    const value = query[key]

    if (value !== undefined) {
      params.set(key, String(value))
    }
  }

  return params
}

export class ValedictorianSourceHttpClient {
  private readonly baseUrl: string
  private readonly fetchImplementation: typeof fetch
  private readonly token: string

  constructor({
    baseUrl,
    fetch: fetchImplementation = fetch,
    token,
  }: ValedictorianSourceHttpClientOptions) {
    this.baseUrl = baseUrl
    this.fetchImplementation = fetchImplementation
    this.token = token
  }

  listJobs(query?: SourceJobsListQuery): Promise<SourceJobsListResponse> {
    return this.request('/jobs', {
      query: sourceJobsListQueryToSearchParams(query),
    })
  }

  listRuns(query?: SourceRunsListQuery): Promise<SourceRunsListResponse> {
    return this.request('/runs', {
      query: sourceRunsListQueryToSearchParams(query),
    })
  }

  getRun(id: string): Promise<SourceRunResponse> {
    return this.request(`/runs/${encodeURIComponent(id)}`)
  }

  private async request<T>(
    path: string,
    options: {
      query?: URLSearchParams
    } = {},
  ): Promise<T> {
    const url = new URL(path, this.baseUrl)

    if (options.query) {
      url.search = options.query.toString()
    }

    const response = await this.fetchImplementation(url.toString(), {
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${this.token}`,
      },
      method: 'GET',
    })
    const body = await readResponseBody(response)

    if (!response.ok) {
      throw new ValedictorianHttpError({
        body,
        message: responseMessage(body, response.statusText),
        status: response.status,
      })
    }

    return body as T
  }
}

async function readResponseBody(response: Response) {
  const text = await response.text()

  if (!text) {
    return undefined
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

function responseMessage(body: unknown, fallback: string) {
  if (body && typeof body === 'object' && 'message' in body && typeof body.message === 'string') {
    return body.message
  }

  return fallback || 'Valedictorian source request failed'
}
