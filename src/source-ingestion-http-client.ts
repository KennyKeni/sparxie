import {
  ValedictorianTransportError,
  createFailClosedHttpError,
  isCallerAbortError,
  parseValedictorianContractValue,
  readValedictorianResponseBody,
} from './http-client-error.js'
import type {
  CareerSourceRegistrationResponse,
  CareerSourceLifecycleInput,
  CareerSourceLifecycleResponse,
  CareerSourcesListQuery,
  CareerSourcesListResponse,
  CreateCareerSourceInput,
  SourceProbeUrlInput,
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
import {
  careerSourceLifecycleResponseSchema,
  careerSourceRegistrationResponseSchema,
  careerSourcesListResponseSchema,
  sourceCompaniesListResponseSchema,
  sourceJobsListResponseSchema,
  sourceProbeResponseSchema,
  sourceRunOverrideResponseSchema,
  sourceRunRequestResponseSchema,
  sourceRunResponseSchema,
  sourceRunsListResponseSchema,
  sourceScheduleResponseSchema,
  sourceSchedulesListResponseSchema,
} from './source-ingestion-http-schemas.js'

export { ValedictorianHttpError } from './http-client-error.js'

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
  'companyRef',
  'sourceId',
  'sourceRef',
  'search',
  'staleBefore',
  'sort',
] as const
const sourceCompaniesListQueryParamKeys = ['limit', 'offset', 'search', 'sort'] as const
const sourceRunsListQueryParamKeys = [
  'sourceId',
  'sourceRef',
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
  'companyRef',
  'sourceId',
  'sourceRef',
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

  async listJobs(query?: SourceJobsListQuery): Promise<SourceJobsListResponse> {
    return parseValedictorianContractValue(
      sourceJobsListResponseSchema,
      await this.request('/jobs', {
        query: sourceJobsListQueryToSearchParams(query),
      }),
    )
  }

  async listCompanies(query?: SourceCompaniesListQuery): Promise<SourceCompaniesListResponse> {
    return parseValedictorianContractValue(
      sourceCompaniesListResponseSchema,
      await this.request('/companies', {
        query: sourceCompaniesListQueryToSearchParams(query),
      }),
    )
  }

  async listRuns(query?: SourceRunsListQuery): Promise<SourceRunsListResponse> {
    return parseValedictorianContractValue(
      sourceRunsListResponseSchema,
      await this.request('/runs', {
        query: sourceRunsListQueryToSearchParams(query),
      }),
    )
  }

  async getRun(id: string): Promise<SourceRunResponse> {
    return parseValedictorianContractValue(
      sourceRunResponseSchema,
      await this.request(`/runs/${encodeURIComponent(id)}`),
    )
  }

  async listSources(query?: CareerSourcesListQuery): Promise<CareerSourcesListResponse> {
    return parseValedictorianContractValue(
      careerSourcesListResponseSchema,
      await this.request('/sources', {
        query: careerSourcesListQueryToSearchParams(query),
      }),
    )
  }

  async listSchedules(query?: SourceSchedulesListQuery): Promise<SourceSchedulesListResponse> {
    return parseValedictorianContractValue(
      sourceSchedulesListResponseSchema,
      await this.request('/schedules', {
        query: sourceSchedulesListQueryToSearchParams(query),
      }),
    )
  }

  async createSource(input: CreateCareerSourceInput): Promise<CareerSourceRegistrationResponse> {
    const { templateKey, ...body } = input

    return parseValedictorianContractValue(
      careerSourceRegistrationResponseSchema,
      await this.request('/sources', {
        body: {
          ...body,
          ...(templateKey ? { template: templateKey } : {}),
        },
        method: 'POST',
      }),
    )
  }

  async probeSource(id: string): Promise<SourceProbeResponse> {
    return parseValedictorianContractValue(
      sourceProbeResponseSchema,
      await this.request(`/sources/${encodeURIComponent(id)}/probe`, {
        body: {},
        method: 'POST',
      }),
    )
  }

  async probeCareerUrl(input: SourceProbeUrlInput): Promise<SourceProbeResponse> {
    return parseValedictorianContractValue(
      sourceProbeResponseSchema,
      await this.request('/source-probes', {
        body: input,
        method: 'POST',
      }),
    )
  }

  async updateSourceLifecycle(
    id: string,
    input: CareerSourceLifecycleInput,
  ): Promise<CareerSourceLifecycleResponse> {
    return parseValedictorianContractValue(
      careerSourceLifecycleResponseSchema,
      await this.request(`/sources/${encodeURIComponent(id)}/lifecycle`, {
        body: input,
        method: 'POST',
      }),
    )
  }

  pauseSource(id: string): Promise<CareerSourceLifecycleResponse> {
    return this.updateSourceLifecycle(id, { status: 'paused' })
  }

  resumeSource(id: string): Promise<CareerSourceLifecycleResponse> {
    return this.updateSourceLifecycle(id, { status: 'active' })
  }

  async getSchedule(id: string): Promise<SourceScheduleResponse> {
    return parseValedictorianContractValue(
      sourceScheduleResponseSchema,
      await this.request(`/sources/${encodeURIComponent(id)}/schedule`),
    )
  }

  async setSchedule(id: string, input: SourceScheduleInput): Promise<SourceScheduleResponse> {
    return parseValedictorianContractValue(
      sourceScheduleResponseSchema,
      await this.request(`/sources/${encodeURIComponent(id)}/schedule`, {
        body: input,
        method: 'POST',
      }),
    )
  }

  async disableSchedule(id: string): Promise<SourceScheduleResponse> {
    return parseValedictorianContractValue(
      sourceScheduleResponseSchema,
      await this.request(`/sources/${encodeURIComponent(id)}/schedule`, {
        method: 'DELETE',
      }),
    )
  }

  async requestRun(
    id: string,
    input: SourceRunRequestInput = {},
  ): Promise<SourceRunRequestResponse> {
    return parseValedictorianContractValue(
      sourceRunRequestResponseSchema,
      await this.request(`/sources/${encodeURIComponent(id)}/run-requests`, {
        body: input,
        method: 'POST',
      }),
    )
  }

  async acceptBaseline(runId: string, reason: string): Promise<SourceRunOverrideResponse> {
    return parseValedictorianContractValue(
      sourceRunOverrideResponseSchema,
      await this.request(`/runs/${encodeURIComponent(runId)}/accept-baseline`, {
        body: { reason },
        method: 'POST',
      }),
    )
  }

  async forcePublish(runId: string, reason: string): Promise<SourceRunOverrideResponse> {
    return parseValedictorianContractValue(
      sourceRunOverrideResponseSchema,
      await this.request(`/runs/${encodeURIComponent(runId)}/force-publish`, {
        body: { reason },
        method: 'POST',
      }),
    )
  }

  private async request(
    path: string,
    options: {
      body?: unknown
      method?: 'DELETE' | 'GET' | 'POST'
      query?: URLSearchParams
    } = {},
  ): Promise<unknown> {
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

    let response: Response
    try {
      response = await this.fetchImplementation(url.toString(), init)
    } catch (error) {
      if (isCallerAbortError(error)) throw error
      throw new ValedictorianTransportError({ cause: error })
    }

    const body = await readValedictorianResponseBody(response)

    if (!response.ok) {
      throw createFailClosedHttpError(response.status, body, {
        retryAfterHeader: response.headers.get('retry-after'),
      })
    }

    return body
  }
}
