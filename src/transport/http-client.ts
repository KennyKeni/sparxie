import { defaultValedictorianApiBaseUrl, valedictorianApiPaths } from '../api.js'
import type { ValedictorianClient, ValedictorianWorkspaceClient } from '../client.js'
import { createScoreAndActionQueueHttpMethods } from './http-client-applications.js'
import { createLifecycleHttpMethods } from './http-client-lifecycle.js'
import { createCaptureResolutionHttpMethods } from './http-client-capture-resolution.js'
import { createCompanyHttpMethods } from './http-client-companies.js'
import { connectorScheduleHistoryListQueryToSearchParams } from './http-client-connector-schedules.js'
import { createConnectorHttpMethods } from './http-client-connectors.js'
import { createPolicyHttpMethods } from './http-client-policy.js'
import { createProfileHttpMethods } from './http-client-profile.js'
import { rethrowProfileDocumentError } from './http-client-capability-errors.js'
import {
  ValedictorianTransportError,
  createFailClosedHttpError,
  isCallerAbortError,
  parseValedictorianContractValue,
  readValedictorianResponseBody,
} from './http-client-error.js'
import {
  createLocalSecretResolveRequest,
  createSecretsHttpMethods,
} from './http-client-secrets.js'
import { createWorkflowRunsHttpMethods } from './http-client-workflow-runs.js'
import { valedictorianHealthSchema } from '../health.js'
import { workspaceListItemSchema, workspaceListResultSchema } from '../workspace.js'

export {
  ValedictorianHttpError,
  ValedictorianProtocolError,
  ValedictorianTransportError,
  parseValedictorianContractValue,
} from './http-client-error.js'
export { LocalSecretResolutionHttpError } from './http-client-secrets.js'
export { ConnectorScheduleHttpError } from './http-client-connector-schedules.js'
export {
  ConnectorCreateHttpError,
  ConnectorOptionQueryHttpError,
  ConnectorRetirementConflictError,
  ProfileDocumentHttpError,
} from './http-client-capability-errors.js'
export {
  connectorCheckpointListQueryToSearchParams,
  connectorObservationListQueryToSearchParams,
  connectorRunListQueryToSearchParams,
} from './http-client-connectors.js'
import { valedictorianCapabilitiesSchema } from '../capabilities.js'

export { connectorScheduleHistoryListQueryToSearchParams }
import type { PolicyEvidenceListInput } from '../policy.js'
import type { ActionQueueListQuery } from '../action-queue.js'
import type { WorkflowRunsListInput } from '../workflow-run.js'

export interface HttpValedictorianClientOptions {
  baseUrl?: string
  token?: string
  fetch?: typeof fetch
}

const actionQueueListQueryParamKeys = ['actionBucket', 'limit', 'offset'] as const
const workflowRunListQueryParamKeys = [
  'runType',
  'status',
  'sourceId',
  'source',
  'subjectApplicationId',
  'limit',
  'offset',
] as const
const policyEvidenceListQueryParamKeys = ['subjectType', 'subjectId', 'tag', 'limit', 'offset'] as const

export function actionQueueListQueryToSearchParams(query: ActionQueueListQuery = {}) {
  const params = new URLSearchParams()

  for (const key of actionQueueListQueryParamKeys) {
    const value = query[key]

    if (value !== undefined) {
      params.set(key, String(value))
    }
  }

  return params
}

export function workflowRunListQueryToSearchParams(query: WorkflowRunsListInput = {}) {
  const params = new URLSearchParams()

  for (const key of workflowRunListQueryParamKeys) {
    const value = query[key]

    if (value !== undefined) {
      params.set(key, String(value))
    }
  }

  return params
}

export function policyEvidenceListQueryToSearchParams(query: PolicyEvidenceListInput = {}) {
  const params = new URLSearchParams()

  for (const key of policyEvidenceListQueryParamKeys) {
    const value = query[key]

    if (value !== undefined) {
      params.set(key, String(value))
    }
  }

  return params
}

export function createHttpValedictorianClient({
  baseUrl = defaultValedictorianApiBaseUrl,
  fetch: fetchImplementation = fetch,
  token,
}: HttpValedictorianClientOptions = {}): ValedictorianClient {
  async function request<T>(
    path: string,
    options: {
      body?: unknown
      headers?: Record<string, string>
      method?: 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT'
      query?: URLSearchParams
      signal?: AbortSignal
    } = {},
  ): Promise<T> {
    const url = new URL(path, baseUrl)

    if (options.query) {
      url.search = options.query.toString()
    }

    const headers: Record<string, string> = {
      accept: 'application/json',
      ...options.headers,
    }

    if (token) {
      headers.authorization = `Bearer ${token}`
    }

    const init: RequestInit = {
      headers,
      method: options.method ?? 'GET',
    }

    if (options.body !== undefined) {
      headers['content-type'] = 'application/json'
      init.body = JSON.stringify(options.body)
    }

    if (options.signal !== undefined) init.signal = options.signal

    let response: Response
    try {
      response = await fetchImplementation(url.toString(), init)
    } catch (error) {
      if (isCallerAbortError(error, options.signal)) throw error
      throw new ValedictorianTransportError({ cause: error })
    }

    const body = await readValedictorianResponseBody(response, options.signal)

    if (!response.ok) {
      throw createFailClosedHttpError(response.status, body, {
        retryAfterHeader: response.headers.get('retry-after'),
      })
    }

    return body as T
  }

  const resolveLocalSecret = createLocalSecretResolveRequest({
    baseUrl,
    fetchImplementation,
    token,
    readResponseBody: readValedictorianResponseBody,
  })

  function workspacePath(workspaceId: string, path: string) {
    return `/v1/workspaces/${encodeURIComponent(workspaceId)}${path.slice('/v1'.length)}`
  }

  function createWorkspaceClient(workspaceId: string): ValedictorianWorkspaceClient {
    const pathFor = (path: string) => workspacePath(workspaceId, path)
    const companyMethods = createCompanyHttpMethods({ pathFor, request, workspaceId })

    return {
      ...createScoreAndActionQueueHttpMethods({
        pathFor,
        request,
        actionQueueListQueryToSearchParams,
      }),
      ...createLifecycleHttpMethods({ pathFor, request, workspaceId }),
      captureResolution: createCaptureResolutionHttpMethods({ pathFor, request }),
      ...companyMethods,
      connectors: createConnectorHttpMethods({ pathFor, request }),
      policy: createPolicyHttpMethods({
        pathFor,
        request,
        policyEvidenceListQueryToSearchParams,
      }),
      profile: createProfileHttpMethods({
        pathFor,
        request,
        rethrowDocumentError: rethrowProfileDocumentError,
      }),
      secrets: createSecretsHttpMethods({
        pathFor,
        request,
        resolveRequest: resolveLocalSecret,
      }),
      runs: createWorkflowRunsHttpMethods({
        pathFor,
        request,
        workflowRunListQueryToSearchParams,
      }),
    }
  }

  return {
    capabilities: {
      async get() {
        return parseValedictorianContractValue(
          valedictorianCapabilitiesSchema,
          await request(valedictorianApiPaths.capabilities),
        )
      },
    },
    forWorkspace(workspaceId) {
      return createWorkspaceClient(workspaceId)
    },
    health: {
      async get() {
        return parseValedictorianContractValue(
          valedictorianHealthSchema,
          await request(valedictorianApiPaths.health),
        )
      },
    },
    workspaces: {
      async create(input) {
        return parseValedictorianContractValue(
          workspaceListItemSchema,
          await request(valedictorianApiPaths.workspaceCreate, {
            body: input,
            method: 'POST',
          }),
        )
      },
      async list() {
        return parseValedictorianContractValue(
          workspaceListResultSchema,
          await request(valedictorianApiPaths.workspaces),
        )
      },
      async open(input) {
        return parseValedictorianContractValue(
          workspaceListItemSchema,
          await request(valedictorianApiPaths.workspaceOpen, {
            body: input,
            method: 'POST',
          }),
        )
      },
    },
  }
}
