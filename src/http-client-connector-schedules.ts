import { z } from 'zod'
import { valedictorianApiPaths } from './api.js'
import type { ValedictorianWorkspaceClient } from './client.js'
import {
  connectorScheduleAuditListResultSchema,
  connectorScheduleHistoryListInputSchema,
  connectorScheduleOccurrenceListResultSchema,
  connectorScheduleSummarySchema,
  deleteConnectorScheduleInputSchema,
  dispatchConnectorScheduleDueInputSchema,
  dispatchConnectorScheduleDueResultSchema,
  pauseConnectorScheduleInputSchema,
  resumeConnectorScheduleInputSchema,
  upsertConnectorScheduleInputSchema,
} from './connector-schedule.js'

type ConnectorScheduleHttpRequest = <T>(
  path: string,
  options?: {
    body?: unknown
    method?: 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT'
    query?: URLSearchParams
  },
) => Promise<T>

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
  isNotFound,
  pathFor,
  request,
}: {
  isNotFound: (error: unknown) => boolean
  pathFor: (path: string) => string
  request: ConnectorScheduleHttpRequest
}): ValedictorianWorkspaceClient['connectors']['schedules'] {
  return {
    async get(connectorInstanceId) {
      const id = z.string().min(1).parse(connectorInstanceId)

      try {
        return connectorScheduleSummarySchema.parse(
          await request(pathFor(valedictorianApiPaths.connectorSchedule(id))),
        )
      } catch (error) {
        if (isNotFound(error)) {
          return null
        }

        throw error
      }
    },
    async upsert(input) {
      const { connectorInstanceId, ...body } = upsertConnectorScheduleInputSchema.parse(input)

      return connectorScheduleSummarySchema.parse(
        await request(pathFor(valedictorianApiPaths.connectorSchedule(connectorInstanceId)), {
          body,
          method: 'PUT',
        }),
      )
    },
    async pause(input) {
      const { connectorInstanceId, ...body } = pauseConnectorScheduleInputSchema.parse(input)

      return connectorScheduleSummarySchema.parse(
        await request(pathFor(valedictorianApiPaths.connectorSchedulePause(connectorInstanceId)), {
          body,
          method: 'POST',
        }),
      )
    },
    async resume(input) {
      const { connectorInstanceId, ...body } = resumeConnectorScheduleInputSchema.parse(input)

      return connectorScheduleSummarySchema.parse(
        await request(
          pathFor(valedictorianApiPaths.connectorScheduleResume(connectorInstanceId)),
          {
            body,
            method: 'POST',
          },
        ),
      )
    },
    async delete(input) {
      const { connectorInstanceId, ...body } = deleteConnectorScheduleInputSchema.parse(input)

      await request(pathFor(valedictorianApiPaths.connectorSchedule(connectorInstanceId)), {
        body,
        method: 'DELETE',
      })
    },
    async listAudit(input) {
      const { connectorInstanceId, ...query } = connectorScheduleHistoryListInputSchema.parse(input)

      return connectorScheduleAuditListResultSchema.parse(
        await request(pathFor(valedictorianApiPaths.connectorScheduleAudit(connectorInstanceId)), {
          query: connectorScheduleHistoryListQueryToSearchParams(query),
        }),
      )
    },
    async listOccurrences(input) {
      const { connectorInstanceId, ...query } = connectorScheduleHistoryListInputSchema.parse(input)

      return connectorScheduleOccurrenceListResultSchema.parse(
        await request(
          pathFor(valedictorianApiPaths.connectorScheduleOccurrences(connectorInstanceId)),
          { query: connectorScheduleHistoryListQueryToSearchParams(query) },
        ),
      )
    },
    async dispatchDue(input) {
      const { connectorInstanceId, ...body } = dispatchConnectorScheduleDueInputSchema.parse(input)

      return dispatchConnectorScheduleDueResultSchema.parse(
        await request(
          pathFor(valedictorianApiPaths.connectorScheduleDispatchDue(connectorInstanceId)),
          {
            body,
            method: 'POST',
          },
        ),
      )
    },
  }
}
