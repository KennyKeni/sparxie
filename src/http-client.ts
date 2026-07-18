import { defaultValedictorianApiBaseUrl, valedictorianApiPaths } from './api.js'
import type {
  ApplicationEventsListInput,
  ApplicationAttemptsListInput,
  ApplicationLinksListInput,
  ApplicationListQuery,
} from './application.js'
import type { ValedictorianClient, ValedictorianWorkspaceClient } from './client.js'
import type {
  ConnectorCheckpointsListInput,
  ConnectorObservationsListInput,
  ConnectorRunsListInput,
} from './connector.js'
import {
  connectorInstancesListResultSchema,
  connectorInstanceSummarySchema,
  connectorStatusSummarySchema,
  connectorRunsListResultSchema,
  connectorRunsListInputSchema,
  connectorRunSummarySchema,
  triggerConnectorRunInputSchema,
} from './connector.js'
import {
  connectorRetirementActiveWorkConflictSchema,
  connectorRetirementResultSchema,
  removeConnectorInstanceInputSchema,
} from './connector-retirement.js'
import {
  connectorOverviewListQuerySchema,
  connectorOverviewListQueryToSearchParams,
  connectorOverviewListResultSchema,
} from './connector-overview.js'
import { createApplicationsHttpMethods } from './http-client-applications.js'
import {
  createConnectorScheduleHttpMethods,
  connectorScheduleHistoryListQueryToSearchParams,
} from './http-client-connector-schedules.js'
import { createConnectorCapabilityHttpMethods } from './http-client-connector-capabilities.js'
import { createPolicyHttpMethods } from './http-client-policy.js'
import { createProfileHttpMethods } from './http-client-profile.js'
import {
  ConnectorRetirementConflictError,
  rethrowConnectorOptionQueryError,
  rethrowProfileDocumentError,
  rethrowRawRecordDetailError,
  requireResponseIdentity,
} from './http-client-capability-errors.js'
import {
  ValedictorianHttpError,
  ValedictorianProtocolError,
  ValedictorianTransportError,
  createFailClosedHttpError,
  getHttpErrorResponseBody,
  isCallerAbortError,
  parseValedictorianContractValue,
  readValedictorianResponseBody,
} from './http-client-error.js'
import {
  createLocalSecretResolveRequest,
  createSecretsHttpMethods,
} from './http-client-secrets.js'
import { createWorkflowRunsHttpMethods } from './http-client-workflow-runs.js'
import { valedictorianHealthSchema } from './health.js'
import {
  connectorCheckpointsListResultSchema,
  connectorObservationsListResultSchema,
} from './http-response-contracts.js'
import { workspaceListItemSchema, workspaceListResultSchema } from './workspace.js'

export {
  ValedictorianHttpError,
  ValedictorianProtocolError,
  ValedictorianTransportError,
  parseValedictorianContractValue,
} from './http-client-error.js'
export { LocalSecretResolutionHttpError } from './http-client-secrets.js'
export {
  ConnectorOptionQueryHttpError,
  ConnectorRetirementConflictError,
  InvalidPersistedRawDetailHttpError,
  ProfileDocumentHttpError,
} from './http-client-capability-errors.js'
import { valedictorianCapabilitiesSchema } from './capabilities.js'

export { connectorScheduleHistoryListQueryToSearchParams }
import type { PolicyEvidenceListInput } from './policy.js'
import type { ActionQueueListQuery } from './action-queue.js'
import {
  sourcingFindingSchema,
  sourcingFindingsListResultSchema,
  type SourcingFindingsListInput,
} from './sourcing.js'
import type { WorkflowRunsListInput } from './workflow-run.js'
import {
  batchRawSourceRecordsInputSchema,
  rawSourceRecordSchema,
  rawSourceNormalizationResultSchema,
  rawSourceReplayReceiptSchema,
} from './raw-sourcing.js'
import { createBoundBatchRawSourceRecordsResultSchema } from './raw-sourcing-bound.js'
import {
  rawSourceRecordsListQuerySchema,
  rawSourceRecordsListQueryToSearchParams,
  rawSourceRecordsListResultSchema,
} from './raw-sourcing-list.js'
import { rawSourceProjectionResultSchema } from './sourcing-projection.js'

export { rawSourceRecordsListQueryToSearchParams }

export interface HttpValedictorianClientOptions {
  baseUrl?: string
  token?: string
  fetch?: typeof fetch
}

const applicationListQueryParamKeys = [
  'status',
  'hasApplied',
  'priorityBand',
  'minScore',
  'maxScore',
  'company',
  'role',
  'source',
  'search',
  'workMode',
  'createdFrom',
  'createdTo',
  'updatedFrom',
  'updatedTo',
  'sort',
  'limit',
  'offset',
] as const

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
const sourcingFindingListQueryParamKeys = [
  'workflowRunId',
  'sourceId',
  'source',
  'mergeStatus',
  'destinationClass',
  'usability',
  'limit',
  'offset',
] as const
const sourcingProjectionOwnedFieldKeys = [
  'destinationClass',
  'destinationUrl',
  'intermediaryUrl',
  'usability',
] as const
const applicationEventsListQueryParamKeys = ['limit', 'offset'] as const
const applicationAttemptsListQueryParamKeys = ['limit', 'offset'] as const
const applicationLinksListQueryParamKeys = ['limit', 'offset'] as const
const policyEvidenceListQueryParamKeys = ['subjectType', 'subjectId', 'tag', 'limit', 'offset'] as const
const connectorRunListQueryParamKeys = ['status', 'mode', 'limit', 'offset'] as const
const connectorCheckpointListQueryParamKeys = ['filterSignature'] as const
const connectorObservationListQueryParamKeys = ['connectorRunId', 'limit', 'offset'] as const

export function applicationListQueryToSearchParams(query: ApplicationListQuery = {}) {
  const params = new URLSearchParams()

  for (const key of applicationListQueryParamKeys) {
    const value = query[key]

    if (value !== undefined) {
      params.set(key, String(value))
    }
  }

  return params
}

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

export function sourcingFindingListQueryToSearchParams(
  query: SourcingFindingsListInput = {},
) {
  const params = new URLSearchParams()

  for (const key of sourcingFindingListQueryParamKeys) {
    const value = query[key]

    if (value !== undefined) {
      params.set(key, String(value))
    }
  }

  return params
}

function sourcingMutationBody(input: object) {
  const body = { ...input } as Record<string, unknown>

  for (const key of sourcingProjectionOwnedFieldKeys) {
    delete body[key]
  }

  return body
}

export function applicationEventsListQueryToSearchParams(
  query: Omit<ApplicationEventsListInput, 'applicationId'> = {},
) {
  const params = new URLSearchParams()

  for (const key of applicationEventsListQueryParamKeys) {
    const value = query[key]

    if (value !== undefined) {
      params.set(key, String(value))
    }
  }

  return params
}

export function applicationAttemptsListQueryToSearchParams(
  query: Omit<ApplicationAttemptsListInput, 'applicationId'> = {},
) {
  const params = new URLSearchParams()

  for (const key of applicationAttemptsListQueryParamKeys) {
    const value = query[key]

    if (value !== undefined) {
      params.set(key, String(value))
    }
  }

  return params
}

export function applicationLinksListQueryToSearchParams(
  query: Omit<ApplicationLinksListInput, 'applicationId'> = {},
) {
  const params = new URLSearchParams()

  for (const key of applicationLinksListQueryParamKeys) {
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

export function connectorRunListQueryToSearchParams(
  query: Omit<ConnectorRunsListInput, 'connectorInstanceId'> = {},
) {
  const params = new URLSearchParams()

  for (const key of connectorRunListQueryParamKeys) {
    const value = query[key]

    if (value !== undefined) {
      params.set(key, String(value))
    }
  }

  return params
}

export function connectorCheckpointListQueryToSearchParams(
  query: Omit<ConnectorCheckpointsListInput, 'connectorInstanceId'> = {},
) {
  const params = new URLSearchParams()

  for (const key of connectorCheckpointListQueryParamKeys) {
    const value = query[key]

    if (value !== undefined) {
      params.set(key, String(value))
    }
  }

  return params
}

export function connectorObservationListQueryToSearchParams(
  query: Omit<ConnectorObservationsListInput, 'connectorInstanceId'> = {},
) {
  const params = new URLSearchParams()

  for (const key of connectorObservationListQueryParamKeys) {
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

    return {
    ...createApplicationsHttpMethods({
      pathFor,
      request,
      applicationListQueryToSearchParams,
      applicationLinksListQueryToSearchParams,
      applicationEventsListQueryToSearchParams,
      applicationAttemptsListQueryToSearchParams,
      actionQueueListQueryToSearchParams,
    }),
    connectors: {
      ...createConnectorCapabilityHttpMethods({
        pathFor,
        request,
        rethrowOptionQueryError: rethrowConnectorOptionQueryError,
      }),
      async list() {
        return parseValedictorianContractValue(
          connectorInstancesListResultSchema,
          await request(pathFor(valedictorianApiPaths.connectors)),
        )
      },
      async create(input) {
        const summary = parseValedictorianContractValue(
          connectorInstanceSummarySchema,
          await request(pathFor(valedictorianApiPaths.connectors), {
            body: input,
            method: 'POST',
          }),
        )
        return requireResponseIdentity(summary, summary.id, input.id)
      },
      async update(input) {
        const { connectorInstanceId, ...body } = input

        const summary = parseValedictorianContractValue(
          connectorInstanceSummarySchema,
          await request(pathFor(valedictorianApiPaths.connector(connectorInstanceId)), {
            body,
            method: 'PATCH',
          }),
        )
        return requireResponseIdentity(summary, summary.id, connectorInstanceId)
      },
      async remove(input) {
        const { connectorInstanceId } = removeConnectorInstanceInputSchema.parse(input)
        let response: unknown
        try {
          response = await request(
            pathFor(valedictorianApiPaths.connector(connectorInstanceId)),
            { method: 'DELETE' },
          )
        } catch (error) {
          if (!(error instanceof ValedictorianHttpError)) throw error
          const responseBody = getHttpErrorResponseBody(error)
          if (
            typeof responseBody === 'object'
            && responseBody !== null
            && 'code' in responseBody
            && responseBody.code === 'connector_retirement_active_work_conflict'
          ) {
            if (error.status !== 409) {
              throw new ValedictorianProtocolError()
            }
            const conflict = parseValedictorianContractValue(
              connectorRetirementActiveWorkConflictSchema,
              responseBody,
            )
            requireResponseIdentity(
              conflict,
              conflict.connectorInstanceId,
              connectorInstanceId,
            )
            throw new ConnectorRetirementConflictError(conflict)
          }
          throw error
        }
        const result = parseValedictorianContractValue(connectorRetirementResultSchema, response)
        return requireResponseIdentity(
          result,
          result.connectorInstanceId,
          connectorInstanceId,
        )
      },
      async inspect(connectorInstanceId) {
        const summary = parseValedictorianContractValue(
          connectorStatusSummarySchema,
          await request(pathFor(valedictorianApiPaths.connectorStatus(connectorInstanceId))),
        )
        return requireResponseIdentity(summary, summary.id, connectorInstanceId)
      },
      overview: {
        async list(query = {}) {
          const parsedQuery = connectorOverviewListQuerySchema.parse(query)
          return parseValedictorianContractValue(
            connectorOverviewListResultSchema,
            await request(pathFor(valedictorianApiPaths.connectorOverview), {
              query: connectorOverviewListQueryToSearchParams(parsedQuery),
            }),
          )
        },
      },
      runs: {
        async list(input) {
          const { connectorInstanceId, ...query } = connectorRunsListInputSchema.parse(input)

          const result = parseValedictorianContractValue(
            connectorRunsListResultSchema,
            await request(
              pathFor(valedictorianApiPaths.connectorRuns(connectorInstanceId)),
              { query: connectorRunListQueryToSearchParams(query) },
            ),
          )
          result.items.forEach((run) => requireResponseIdentity(run, run.connectorInstanceId, connectorInstanceId))
          return result
        },
        async trigger(input) {
          const { connectorInstanceId, ...body } = triggerConnectorRunInputSchema.parse(input)

          const run = parseValedictorianContractValue(
            connectorRunSummarySchema,
            await request(
              pathFor(valedictorianApiPaths.connectorRuns(connectorInstanceId)),
              {
                body,
                method: 'POST',
              },
            ),
          )
          return requireResponseIdentity(run, run.connectorInstanceId, connectorInstanceId)
        },
      },
      checkpoints: {
        async list(input) {
          const { connectorInstanceId, ...query } = input
          return parseValedictorianContractValue(
            connectorCheckpointsListResultSchema,
            await request(pathFor(valedictorianApiPaths.connectorCheckpoints(connectorInstanceId)), {
              query: connectorCheckpointListQueryToSearchParams(query),
            }),
          )
        },
      },
      observations: {
        async list(input) {
          const { connectorInstanceId, ...query } = input
          return parseValedictorianContractValue(
            connectorObservationsListResultSchema,
            await request(pathFor(valedictorianApiPaths.connectorObservations(connectorInstanceId)), {
              query: connectorObservationListQueryToSearchParams(query),
            }),
          )
        },
      },
      schedules: createConnectorScheduleHttpMethods({
        isNotFound: (error) =>
          error instanceof ValedictorianHttpError && error.status === 404,
        pathFor,
        request,
      }),
    },
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
    sourcing: {
      rawRevisions: {
        projection: {
          async get(rawRevisionId) {
            const projection = parseValedictorianContractValue(
              rawSourceProjectionResultSchema,
              await request(
                pathFor(valedictorianApiPaths.sourcingRawRevisionProjection(rawRevisionId)),
              ),
            )
            return requireResponseIdentity(projection, projection.rawRevisionId, rawRevisionId)
          },
        },
      },
      rawRecords: {
        async list(query) {
          const parsedQuery = rawSourceRecordsListQuerySchema.parse(query ?? {})
          return parseValedictorianContractValue(
            rawSourceRecordsListResultSchema,
            await request(pathFor(valedictorianApiPaths.sourcingRawRecords), {
              query: rawSourceRecordsListQueryToSearchParams(parsedQuery),
            }),
          )
        },
        async ingestBatch(input) {
          const body = batchRawSourceRecordsInputSchema.parse(input)
          return parseValedictorianContractValue(
            createBoundBatchRawSourceRecordsResultSchema(body),
            await request(pathFor(valedictorianApiPaths.sourcingRawRecordsBatch), {
              body,
              method: 'POST',
            }),
          )
        },
        async get(rawRecordId) {
          let body: unknown

          try {
            body = await request(pathFor(valedictorianApiPaths.sourcingRawRecord(rawRecordId)))
          } catch (error) {
            rethrowRawRecordDetailError(error)
          }

          return parseValedictorianContractValue(
            rawSourceRecordSchema.refine((record) => record.id === rawRecordId, {
              message: 'raw record response must match the requested id', path: ['id'],
            }),
            body,
          )
        },
        async replay(input) {
          const receipt = await request(
            pathFor(valedictorianApiPaths.sourcingRawRecordsReplay),
            {
              body: input,
              method: 'POST',
            },
          )

          return parseValedictorianContractValue(rawSourceReplayReceiptSchema, receipt)
        },
        normalization: {
          async get(rawRecordId) {
            return parseValedictorianContractValue(
              rawSourceNormalizationResultSchema.refine(
                (result) => result.rawRecordId === rawRecordId,
                { message: 'normalization response must match the requested raw record', path: ['rawRecordId'] },
              ),
              await request(
                pathFor(
                  valedictorianApiPaths.sourcingRawRecordNormalization(rawRecordId),
                ),
              ),
            )
          },
        },
      },
      candidates: {
        /**
         * @deprecated Compatibility entry point for already-canonical producers.
         * New producers should submit source-neutral records through rawRecords.ingestBatch.
         */
        async process(input) {
          return parseValedictorianContractValue(
            sourcingFindingSchema,
            await request(pathFor(valedictorianApiPaths.sourcingCandidatesProcess), {
              body: sourcingMutationBody(input),
              method: 'POST',
            }),
          )
        },
      },
      findings: {
        async list(query) {
          const result = await request(pathFor(valedictorianApiPaths.sourcingFindings), {
            query: sourcingFindingListQueryToSearchParams(query),
          })

          return parseValedictorianContractValue(sourcingFindingsListResultSchema, result)
        },
        async create(input) {
          const finding = await request(pathFor(valedictorianApiPaths.sourcingFindings), {
            body: sourcingMutationBody(input),
            method: 'POST',
          })

          return parseValedictorianContractValue(sourcingFindingSchema, finding)
        },
        async update(input) {
          const { findingId, ...body } = input

          const finding = await request(pathFor(valedictorianApiPaths.sourcingFinding(findingId)), {
            body: sourcingMutationBody(body),
            method: 'PATCH',
          })

          return parseValedictorianContractValue(sourcingFindingSchema, finding)
        },
        async decide(input) {
          const { findingId, ...body } = input

          const finding = await request(pathFor(valedictorianApiPaths.sourcingFindingDecide(findingId)), {
            body: sourcingMutationBody(body),
            method: 'POST',
          })

          return parseValedictorianContractValue(sourcingFindingSchema, finding)
        },
        async promote(input) {
          const finding = await request(
            pathFor(valedictorianApiPaths.sourcingFindingPromote(input.findingId)),
            {
              body: {},
              method: 'POST',
            },
          )

          return parseValedictorianContractValue(sourcingFindingSchema, finding)
        },
      },
    },
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
