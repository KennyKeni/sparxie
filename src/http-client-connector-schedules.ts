import { z } from 'zod'
import { valedictorianApiPaths } from './api.js'
import type { ValedictorianWorkspaceClient } from './client.js'
import {
  connectorScheduleAuditListResultSchema,
  connectorScheduleErrorBodySchema,
  connectorScheduleErrorCodes,
  connectorScheduleErrorKindByCode,
  connectorScheduleErrorStatusByCode,
  connectorScheduleHistoryListInputSchema,
  connectorScheduleOccurrenceListResultSchema,
  connectorScheduleSummarySchema,
  deleteConnectorScheduleInputSchema,
  dispatchConnectorScheduleDueInputSchema,
  dispatchConnectorScheduleDueResultSchema,
  pauseConnectorScheduleInputSchema,
  resumeConnectorScheduleInputSchema,
  upsertConnectorScheduleInputSchema,
  type ConnectorScheduleErrorBody,
  type ConnectorScheduleErrorCode,
} from './connector-schedule.js'
import {
  ValedictorianHttpError,
  ValedictorianProtocolError,
  createFailClosedHttpError,
  getHttpErrorResponseBody,
  parseValedictorianContractValue,
} from './http-client-error.js'
import {
  validateValedictorianEndpointError,
  type ValedictorianFailureKind,
} from './http-error-contract.js'

type ConnectorScheduleHttpRequest = <T>(
  path: string,
  options?: {
    body?: unknown
    method?: 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT'
    query?: URLSearchParams
  },
) => Promise<T>

export class ConnectorScheduleHttpError
  extends ValedictorianHttpError<ConnectorScheduleErrorBody> {
  readonly code: ConnectorScheduleErrorCode
  declare readonly kind: ValedictorianFailureKind

  constructor(body: ConnectorScheduleErrorBody, status: number) {
    super({
      body,
      message: body.message,
      status,
      kind: connectorScheduleErrorKindByCode[body.code],
    })
    this.name = 'ConnectorScheduleHttpError'
    this.code = body.code
  }
}

function isConnectorScheduleErrorCode(value: unknown): value is ConnectorScheduleErrorCode {
  return typeof value === 'string'
    && (connectorScheduleErrorCodes as readonly string[]).includes(value)
}

export function rethrowConnectorScheduleError(error: unknown): never {
  if (!(error instanceof ValedictorianHttpError)) throw error

  const responseBody = getHttpErrorResponseBody(error)
  const validated = validateValedictorianEndpointError({
    body: responseBody,
    status: error.status,
    spec: {
      bodySchema: connectorScheduleErrorBodySchema,
      statusByCode: connectorScheduleErrorStatusByCode,
      kindByCode: connectorScheduleErrorKindByCode,
    },
  })
  if (validated.ok) {
    throw new ConnectorScheduleHttpError(validated.body, validated.status)
  }

  if (
    typeof responseBody === 'object'
    && responseBody !== null
    && 'code' in responseBody
    && isConnectorScheduleErrorCode(responseBody.code)
  ) {
    throw new ValedictorianProtocolError()
  }

  throw createFailClosedHttpError(error.status)
}

function mapConnectorScheduleGetFailure(error: unknown): null {
  try {
    rethrowConnectorScheduleError(error)
  } catch (mapped) {
    if (
      mapped instanceof ValedictorianHttpError
      && !(mapped instanceof ConnectorScheduleHttpError)
      && mapped.status === 404
    ) {
      return null
    }
    throw mapped
  }
}

const connectorScheduleHistoryListQueryParamKeys = ['limit', 'offset'] as const

export function connectorScheduleHistoryListQueryToSearchParams(
  query: { limit?: number; offset?: number } = {},
) {
  const params = new URLSearchParams()

  for (const key of connectorScheduleHistoryListQueryParamKeys) {
    const value = query[key]

    if (value !== undefined) {
      params.set(key, String(value))
    }
  }

  return params
}

export function createConnectorScheduleHttpMethods({
  pathFor,
  request,
}: {
  pathFor: (path: string) => string
  request: ConnectorScheduleHttpRequest
}): ValedictorianWorkspaceClient['connectors']['schedules'] {
  return {
    async get(connectorInstanceId) {
      const id = z.string().min(1).parse(connectorInstanceId)

      try {
        return parseValedictorianContractValue(
          connectorScheduleSummarySchema,
          await request(pathFor(valedictorianApiPaths.connectorSchedule(id))),
        )
      } catch (error) {
        return mapConnectorScheduleGetFailure(error)
      }
    },
    async upsert(input) {
      const { connectorInstanceId, ...body } = upsertConnectorScheduleInputSchema.parse(input)

      try {
        return parseValedictorianContractValue(
          connectorScheduleSummarySchema,
          await request(pathFor(valedictorianApiPaths.connectorSchedule(connectorInstanceId)), {
            body,
            method: 'PUT',
          }),
        )
      } catch (error) {
        rethrowConnectorScheduleError(error)
      }
    },
    async pause(input) {
      const { connectorInstanceId, ...body } = pauseConnectorScheduleInputSchema.parse(input)

      try {
        return parseValedictorianContractValue(
          connectorScheduleSummarySchema,
          await request(pathFor(valedictorianApiPaths.connectorSchedulePause(connectorInstanceId)), {
            body,
            method: 'POST',
          }),
        )
      } catch (error) {
        rethrowConnectorScheduleError(error)
      }
    },
    async resume(input) {
      const { connectorInstanceId, ...body } = resumeConnectorScheduleInputSchema.parse(input)

      try {
        return parseValedictorianContractValue(
          connectorScheduleSummarySchema,
          await request(
            pathFor(valedictorianApiPaths.connectorScheduleResume(connectorInstanceId)),
            {
              body,
              method: 'POST',
            },
          ),
        )
      } catch (error) {
        rethrowConnectorScheduleError(error)
      }
    },
    async delete(input) {
      const { connectorInstanceId, ...body } = deleteConnectorScheduleInputSchema.parse(input)

      try {
        await request(pathFor(valedictorianApiPaths.connectorSchedule(connectorInstanceId)), {
          body,
          method: 'DELETE',
        })
      } catch (error) {
        rethrowConnectorScheduleError(error)
      }
    },
    async listAudit(input) {
      const { connectorInstanceId, ...query } = connectorScheduleHistoryListInputSchema.parse(input)

      try {
        return parseValedictorianContractValue(
          connectorScheduleAuditListResultSchema,
          await request(pathFor(valedictorianApiPaths.connectorScheduleAudit(connectorInstanceId)), {
            query: connectorScheduleHistoryListQueryToSearchParams(query),
          }),
        )
      } catch (error) {
        rethrowConnectorScheduleError(error)
      }
    },
    async listOccurrences(input) {
      const { connectorInstanceId, ...query } = connectorScheduleHistoryListInputSchema.parse(input)

      try {
        return parseValedictorianContractValue(
          connectorScheduleOccurrenceListResultSchema,
          await request(
            pathFor(valedictorianApiPaths.connectorScheduleOccurrences(connectorInstanceId)),
            { query: connectorScheduleHistoryListQueryToSearchParams(query) },
          ),
        )
      } catch (error) {
        rethrowConnectorScheduleError(error)
      }
    },
    async dispatchDue(input) {
      const { connectorInstanceId, ...body } = dispatchConnectorScheduleDueInputSchema.parse(input)

      try {
        return parseValedictorianContractValue(
          dispatchConnectorScheduleDueResultSchema,
          await request(
            pathFor(valedictorianApiPaths.connectorScheduleDispatchDue(connectorInstanceId)),
            {
              body,
              method: 'POST',
            },
          ),
        )
      } catch (error) {
        rethrowConnectorScheduleError(error)
      }
    },
  }
}
