import {
  ValedictorianHttpError,
  ValedictorianProtocolError,
  ValedictorianTransportError,
  createFailClosedHttpError,
  isCallerAbortError,
  parseValedictorianContractValue,
  readValedictorianResponseBody,
} from '../transport/http-client-error.js'
import {
  validateSourceIngestionEndpointError,
  type SourceIngestionEndpoint,
  type SourceIngestionErrorBody,
  type SourceIngestionErrorCode,
} from './source-ingestion-errors.js'
import type {
  ValedictorianFailureKind,
  ValedictorianRetryAfter,
} from '../transport/http-error-contract.js'
import type {
  CareerSourceRegistrationResponse,
  CareerSourceLifecycleInput,
  CareerSourceLifecycleResponse,
  CareerSourcesListQuery,
  CareerSourcesListResponse,
  CreateCareerSourceInput,
  SourceConfidenceRuleAttachmentInput,
  SourceConfidenceRuleAttachmentResponse,
  SourceProbeUrlInput,
  SourceCompaniesListQuery,
  SourceCompaniesListResponse,
  SourceJobsListQuery,
  SourceJobsListResponse,
  SourceEffectiveConfidenceRulesResponse,
  SourceEvidenceArtifactResponse,
  SourceJobSnapshotResponse,
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
  sourceConfidenceRuleAttachmentInputSchema,
  sourceConfidenceRuleAttachmentResponseSchema,
  sourceEffectiveConfidenceRulesResponseSchema,
  sourceEvidenceArtifactResponseSchema,
  sourceJobSnapshotResponseSchema,
  sourceJobsListResponseSchema,
  sourceProbeResponseSchema,
  sourceRunOverrideResponseSchema,
  sourceRunRequestResponseSchema,
  sourceRunResponseSchema,
  sourceRunsListResponseSchema,
  sourceScheduleResponseSchema,
  sourceSchedulesListResponseSchema,
} from './source-ingestion-http-schemas.js'

export { ValedictorianHttpError } from '../transport/http-client-error.js'

export class SourceIngestionHttpError<
  Body extends SourceIngestionErrorBody = SourceIngestionErrorBody,
> extends ValedictorianHttpError<Body> {
  readonly code: SourceIngestionErrorCode
  declare readonly kind: ValedictorianFailureKind

  constructor(
    body: Body,
    status: number,
    options: {
      kind: ValedictorianFailureKind
      retryAfter?: ValedictorianRetryAfter
    },
  ) {
    super({
      body,
      kind: options.kind,
      message: body.message,
      requestId: 'requestId' in body ? body.requestId : undefined,
      retryAfter: options.retryAfter,
      status,
    })
    this.name = 'SourceIngestionHttpError'
    this.code = body.code
  }
}

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

function sourceEvidenceArtifactPath(path: string): string {
  const segments = path.split('/')
  if (
    segments.length === 0
    || segments.some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    throw new TypeError('Evidence artifact path must contain safe nonempty segments')
  }
  return segments.map((segment) => encodeURIComponent(segment)).join('/')
}

const invalidSourcePathSegmentMessage =
  'Source identifier must be a nonempty non-relative path segment'

function sourcePathSegment(value: string): string {
  if (!value || value === '.' || value === '..') {
    throw new TypeError(invalidSourcePathSegmentMessage)
  }
  return encodeURIComponent(value)
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
      await this.request('/jobs', 'listJobs', {
        query: sourceJobsListQueryToSearchParams(query),
      }),
    )
  }

  async listCompanies(query?: SourceCompaniesListQuery): Promise<SourceCompaniesListResponse> {
    return parseValedictorianContractValue(
      sourceCompaniesListResponseSchema,
      await this.request('/companies', 'listCompanies', {
        query: sourceCompaniesListQueryToSearchParams(query),
      }),
    )
  }

  async listRuns(query?: SourceRunsListQuery): Promise<SourceRunsListResponse> {
    return parseValedictorianContractValue(
      sourceRunsListResponseSchema,
      await this.request('/runs', 'listRuns', {
        query: sourceRunsListQueryToSearchParams(query),
      }),
    )
  }

  async getRun(id: string): Promise<SourceRunResponse> {
    return parseValedictorianContractValue(
      sourceRunResponseSchema,
      await this.request(`/runs/${sourcePathSegment(id)}`, 'getRun'),
    )
  }

  async getRunEvidenceArtifact(
    runId: string,
    artifactPath: string,
  ): Promise<SourceEvidenceArtifactResponse> {
    return parseValedictorianContractValue(
      sourceEvidenceArtifactResponseSchema,
      await this.request(
        `/runs/${sourcePathSegment(runId)}/evidence/${sourceEvidenceArtifactPath(artifactPath)}`,
        'getRunEvidenceArtifact',
        { responseType: 'binary' },
      ),
    )
  }

  async getSnapshot(id: string): Promise<SourceJobSnapshotResponse> {
    return parseValedictorianContractValue(
      sourceJobSnapshotResponseSchema,
      await this.request(`/snapshots/${sourcePathSegment(id)}`, 'getSnapshot'),
    )
  }

  async listSources(query?: CareerSourcesListQuery): Promise<CareerSourcesListResponse> {
    return parseValedictorianContractValue(
      careerSourcesListResponseSchema,
      await this.request('/sources', 'listSources', {
        query: careerSourcesListQueryToSearchParams(query),
      }),
    )
  }

  async getEffectiveRules(id: string): Promise<SourceEffectiveConfidenceRulesResponse> {
    return parseValedictorianContractValue(
      sourceEffectiveConfidenceRulesResponseSchema,
      await this.request(
        `/sources/${sourcePathSegment(id)}/effective-rules`,
        'getEffectiveRules',
      ),
    )
  }

  async putRuleAttachment(
    input: SourceConfidenceRuleAttachmentInput,
  ): Promise<SourceConfidenceRuleAttachmentResponse> {
    const body = sourceConfidenceRuleAttachmentInputSchema.parse(input)
    return parseValedictorianContractValue(
      sourceConfidenceRuleAttachmentResponseSchema,
      await this.request('/rules/attachments', 'putRuleAttachment', {
        body,
        method: 'PUT',
      }),
    )
  }

  async deleteRuleAttachment(id: string): Promise<SourceConfidenceRuleAttachmentResponse> {
    return parseValedictorianContractValue(
      sourceConfidenceRuleAttachmentResponseSchema,
      await this.request(
        `/rules/attachments/${sourcePathSegment(id)}`,
        'deleteRuleAttachment',
        { method: 'DELETE' },
      ),
    )
  }

  async listSchedules(query?: SourceSchedulesListQuery): Promise<SourceSchedulesListResponse> {
    return parseValedictorianContractValue(
      sourceSchedulesListResponseSchema,
      await this.request('/schedules', 'listSchedules', {
        query: sourceSchedulesListQueryToSearchParams(query),
      }),
    )
  }

  async createSource(input: CreateCareerSourceInput): Promise<CareerSourceRegistrationResponse> {
    const { templateKey, ...body } = input

    return parseValedictorianContractValue(
      careerSourceRegistrationResponseSchema,
      await this.request('/sources', 'createSource', {
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
      await this.request(`/sources/${sourcePathSegment(id)}/probe`, 'probeSource', {
        body: {},
        method: 'POST',
      }),
    )
  }

  async probeCareerUrl(input: SourceProbeUrlInput): Promise<SourceProbeResponse> {
    return parseValedictorianContractValue(
      sourceProbeResponseSchema,
      await this.request('/source-probes', 'probeCareerUrl', {
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
      await this.request(`/sources/${sourcePathSegment(id)}/lifecycle`, 'updateSourceLifecycle', {
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
      await this.request(`/sources/${sourcePathSegment(id)}/schedule`, 'getSchedule'),
    )
  }

  async setSchedule(id: string, input: SourceScheduleInput): Promise<SourceScheduleResponse> {
    return parseValedictorianContractValue(
      sourceScheduleResponseSchema,
      await this.request(`/sources/${sourcePathSegment(id)}/schedule`, 'setSchedule', {
        body: input,
        method: 'POST',
      }),
    )
  }

  async disableSchedule(id: string): Promise<SourceScheduleResponse> {
    return parseValedictorianContractValue(
      sourceScheduleResponseSchema,
      await this.request(`/sources/${sourcePathSegment(id)}/schedule`, 'disableSchedule', {
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
      await this.request(`/sources/${sourcePathSegment(id)}/run-requests`, 'requestRun', {
        body: input,
        method: 'POST',
      }),
    )
  }

  async acceptBaseline(runId: string, reason: string): Promise<SourceRunOverrideResponse> {
    return parseValedictorianContractValue(
      sourceRunOverrideResponseSchema,
      await this.request(`/runs/${sourcePathSegment(runId)}/accept-baseline`, 'acceptBaseline', {
        body: { reason },
        method: 'POST',
      }),
    )
  }

  async forcePublish(runId: string, reason: string): Promise<SourceRunOverrideResponse> {
    return parseValedictorianContractValue(
      sourceRunOverrideResponseSchema,
      await this.request(`/runs/${sourcePathSegment(runId)}/force-publish`, 'forcePublish', {
        body: { reason },
        method: 'POST',
      }),
    )
  }

  private async request(
    path: string,
    endpoint: SourceIngestionEndpoint,
    options: {
      body?: unknown
      method?: 'DELETE' | 'GET' | 'POST' | 'PUT'
      query?: URLSearchParams
      responseType?: 'binary'
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

    if (response.ok && options.responseType === 'binary') {
      let bytes: Uint8Array
      try {
        bytes = new Uint8Array(await response.arrayBuffer())
      } catch (error) {
        throw new ValedictorianTransportError({ cause: error })
      }
      return {
        bytes,
        contentType: response.headers.get('content-type'),
      }
    }

    const body = await readValedictorianResponseBody(response)

    if (!response.ok) {
      const validated = validateSourceIngestionEndpointError({
        body,
        endpoint,
        retryAfterHeader: response.headers.get('retry-after'),
        status: response.status,
      })
      if (validated.ok) {
        throw new SourceIngestionHttpError(validated.body, validated.status, {
          kind: validated.kind,
          retryAfter: validated.retryAfter,
        })
      }
      if (validated.reason !== 'unknown_code') {
        throw new ValedictorianProtocolError()
      }
      throw createFailClosedHttpError(response.status, body, {
        retryAfterHeader: response.headers.get('retry-after'),
      })
    }

    return body
  }
}
