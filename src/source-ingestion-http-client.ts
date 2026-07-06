import { ValedictorianHttpError } from './http-client.js'
import type {
  CareerSourceRegistrationResponse,
  CareerSourceLifecycleInput,
  CareerSourceLifecycleResponse,
  CareerSourcesListQuery,
  CareerSourcesListResponse,
  CreateCareerSourceInput,
  SourceCompaniesListQuery,
  SourceCompaniesListResponse,
  SourceJobsListQuery,
  SourceJobsListResponse,
  SourceProbeResponse,
  SourceRunOverrideResponse,
  SourceRunResponse,
  SourceRunRequestInput,
  SourceRunRequestResponse,
  SourceRunsListQuery,
  SourceRunsListResponse,
  SourceScheduleInput,
  SourceScheduleResponse,
  SourceSchedulesListQuery,
  SourceSchedulesListResponse,
} from './source-ingestion.js'

export interface ValedictorianSourceHttpClientOptions {
  baseUrl: string
  token: string
  fetch?: typeof fetch
}

const sourceJobsListQueryParamKeys = [
  'limit',
  'offset',
  'active',
  'companyId',
  'sourceId',
  'search',
  'staleBefore',
  'sort',
] as const
const sourceCompaniesListQueryParamKeys = ['limit', 'offset', 'search', 'sort'] as const
const sourceRunsListQueryParamKeys = [
  'sourceId',
  'limit',
  'offset',
  'status',
  'outcome',
  'sort',
] as const
const careerSourcesListQueryParamKeys = [
  'limit',
  'offset',
  'search',
  'status',
  'observedProvider',
  'sourceType',
  'scheduleEnabled',
  'sort',
] as const
const sourceSchedulesListQueryParamKeys = [
  'limit',
  'offset',
  'search',
  'enabled',
  'cadence',
  'companyId',
  'sourceId',
  'sort',
] as const

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

export function sourceCompaniesListQueryToSearchParams(
  query: SourceCompaniesListQuery = {},
) {
  const params = new URLSearchParams()

  for (const key of sourceCompaniesListQueryParamKeys) {
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

export function careerSourcesListQueryToSearchParams(query: CareerSourcesListQuery = {}) {
  const params = new URLSearchParams()

  for (const key of careerSourcesListQueryParamKeys) {
    const value = query[key]

    if (value !== undefined) {
      params.set(key, String(value))
    }
  }

  return params
}

export function sourceSchedulesListQueryToSearchParams(
  query: SourceSchedulesListQuery = {},
) {
  const params = new URLSearchParams()

  for (const key of sourceSchedulesListQueryParamKeys) {
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

  listCompanies(query?: SourceCompaniesListQuery): Promise<SourceCompaniesListResponse> {
    return this.request('/companies', {
      query: sourceCompaniesListQueryToSearchParams(query),
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

  listSources(query?: CareerSourcesListQuery): Promise<CareerSourcesListResponse> {
    return this.request('/sources', {
      query: careerSourcesListQueryToSearchParams(query),
    })
  }

  listSchedules(query?: SourceSchedulesListQuery): Promise<SourceSchedulesListResponse> {
    return this.request('/schedules', {
      query: sourceSchedulesListQueryToSearchParams(query),
    })
  }

  createSource(input: CreateCareerSourceInput): Promise<CareerSourceRegistrationResponse> {
    const { templateKey, ...body } = input

    return this.request('/sources', {
      body: {
        ...body,
        ...(templateKey ? { template: templateKey } : {}),
      },
      method: 'POST',
    })
  }

  probeSource(id: string): Promise<SourceProbeResponse> {
    return this.request(`/sources/${encodeURIComponent(id)}/probe`, {
      body: {},
      method: 'POST',
    })
  }

  updateSourceLifecycle(
    id: string,
    input: CareerSourceLifecycleInput,
  ): Promise<CareerSourceLifecycleResponse> {
    return this.request(`/sources/${encodeURIComponent(id)}/lifecycle`, {
      body: input,
      method: 'POST',
    })
  }

  pauseSource(id: string): Promise<CareerSourceLifecycleResponse> {
    return this.updateSourceLifecycle(id, { status: 'paused' })
  }

  resumeSource(id: string): Promise<CareerSourceLifecycleResponse> {
    return this.updateSourceLifecycle(id, { status: 'active' })
  }

  getSchedule(id: string): Promise<SourceScheduleResponse> {
    return this.request(`/sources/${encodeURIComponent(id)}/schedule`)
  }

  setSchedule(id: string, input: SourceScheduleInput): Promise<SourceScheduleResponse> {
    return this.request(`/sources/${encodeURIComponent(id)}/schedule`, {
      body: input,
      method: 'POST',
    })
  }

  disableSchedule(id: string): Promise<SourceScheduleResponse> {
    return this.request(`/sources/${encodeURIComponent(id)}/schedule`, {
      method: 'DELETE',
    })
  }

  requestRun(
    id: string,
    input: SourceRunRequestInput = {},
  ): Promise<SourceRunRequestResponse> {
    return this.request(`/sources/${encodeURIComponent(id)}/run-requests`, {
      body: input,
      method: 'POST',
    })
  }

  acceptBaseline(runId: string, reason: string): Promise<SourceRunOverrideResponse> {
    return this.request(`/runs/${encodeURIComponent(runId)}/accept-baseline`, {
      body: { reason },
      method: 'POST',
    })
  }

  forcePublish(runId: string, reason: string): Promise<SourceRunOverrideResponse> {
    return this.request(`/runs/${encodeURIComponent(runId)}/force-publish`, {
      body: { reason },
      method: 'POST',
    })
  }

  private async request<T>(
    path: string,
    options: {
      body?: unknown
      method?: 'DELETE' | 'GET' | 'POST'
      query?: URLSearchParams
    } = {},
  ): Promise<T> {
    const url = new URL(path, this.baseUrl)

    if (options.query) {
      url.search = options.query.toString()
    }

    const headers: Record<string, string> = {
      accept: 'application/json',
      authorization: `Bearer ${this.token}`,
    }
    const init: RequestInit = {
      headers,
      method: options.method ?? 'GET',
    }

    if (options.body !== undefined) {
      headers['content-type'] = 'application/json'
      init.body = JSON.stringify(options.body)
    }

    const response = await this.fetchImplementation(url.toString(), init)
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

  if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
    return body.error
  }

  return fallback || 'Valedictorian source request failed'
}
