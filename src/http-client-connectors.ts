import { valedictorianApiPaths } from './api.js'
import type { ValedictorianWorkspaceClient } from './client.js'
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
import {
  ConnectorRetirementConflictError,
  rethrowConnectorCreateError,
  rethrowConnectorOptionQueryError,
  requireResponseIdentity,
} from './http-client-capability-errors.js'
import { createConnectorCapabilityHttpMethods } from './http-client-connector-capabilities.js'
import { createConnectorScheduleHttpMethods } from './http-client-connector-schedules.js'
import {
  ValedictorianHttpError,
  ValedictorianProtocolError,
  getHttpErrorResponseBody,
  parseValedictorianContractValue,
} from './http-client-error.js'
import {
  connectorCheckpointsListResultSchema,
  connectorObservationsListResultSchema,
} from './http-response-contracts.js'

type SupportingRequest = <T>(path: string, options?: {
  body?: unknown
  method?: 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT'
  query?: URLSearchParams
}) => Promise<T>

const connectorRunListQueryParamKeys = ['status', 'mode', 'limit', 'offset'] as const
const connectorCheckpointListQueryParamKeys = ['filterSignature'] as const
const connectorObservationListQueryParamKeys = ['connectorRunId', 'limit', 'offset'] as const

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

export function createConnectorHttpMethods({
  pathFor,
  request,
}: {
  pathFor: (path: string) => string
  request: SupportingRequest
}): ValedictorianWorkspaceClient['connectors'] {
  return {
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
      try {
        const summary = parseValedictorianContractValue(
          connectorInstanceSummarySchema,
          await request(pathFor(valedictorianApiPaths.connectors), {
            body: input,
            method: 'POST',
          }),
        )
        return requireResponseIdentity(summary, summary.id, input.id)
      } catch (error) {
        rethrowConnectorCreateError(error)
      }
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
      pathFor,
      request,
    }),
  }
}
