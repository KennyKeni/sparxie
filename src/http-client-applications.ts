import { valedictorianApiPaths } from './api.js'
import type { StatusUpdateInput } from './application.js'
import {
  applicationAttemptSchema,
  applicationAttemptStepSchema,
  applicationAttemptsListResultSchema,
  applicationDetailSchema,
  applicationEventsListResultSchema,
  applicationLinkRecordSchema,
  applicationLinksListResultSchema,
  applicationListResultSchema,
} from './application-http-schemas.js'
import type { ValedictorianWorkspaceClient } from './client.js'
import { ValedictorianHttpError, parseValedictorianContractValue } from './http-client-error.js'
import {
  actionQueueListResultSchema,
  scoreRecordSchema,
} from './http-response-contracts.js'
import type { ScoreInput } from './scoring.js'

type ApplicationsHttpRequest = <T>(
  path: string,
  options?: {
    body?: unknown
    method?: 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT'
    query?: URLSearchParams
  },
) => Promise<T>

export function createApplicationsHttpMethods({
  pathFor,
  request,
  applicationListQueryToSearchParams,
  applicationLinksListQueryToSearchParams,
  applicationEventsListQueryToSearchParams,
  applicationAttemptsListQueryToSearchParams,
  actionQueueListQueryToSearchParams,
}: {
  pathFor: (path: string) => string
  request: ApplicationsHttpRequest
  applicationListQueryToSearchParams: (
    query?: Parameters<ValedictorianWorkspaceClient['applications']['list']>[0],
  ) => URLSearchParams
  applicationLinksListQueryToSearchParams: (query: {
    limit?: number
    offset?: number
  }) => URLSearchParams
  applicationEventsListQueryToSearchParams: (query: {
    limit?: number
    offset?: number
  }) => URLSearchParams
  applicationAttemptsListQueryToSearchParams: (query: {
    limit?: number
    offset?: number
  }) => URLSearchParams
  actionQueueListQueryToSearchParams: (
    query?: Parameters<ValedictorianWorkspaceClient['actionQueue']['list']>[0],
  ) => URLSearchParams
}): Pick<ValedictorianWorkspaceClient, 'applications' | 'scores' | 'actionQueue'> {
  return {
    applications: {
      async list(query) {
        return parseValedictorianContractValue(
          applicationListResultSchema,
          await request(pathFor(valedictorianApiPaths.applications), {
            query: applicationListQueryToSearchParams(query),
          }),
        )
      },
      async get(id) {
        try {
          return parseValedictorianContractValue(
            applicationDetailSchema,
            await request(pathFor(valedictorianApiPaths.application(id))),
          )
        } catch (error) {
          if (error instanceof ValedictorianHttpError && error.status === 404) {
            return null
          }
          throw error
        }
      },
      async create(input) {
        return parseValedictorianContractValue(
          applicationDetailSchema,
          await request(pathFor(valedictorianApiPaths.applications), {
            body: input,
            method: 'POST',
          }),
        )
      },
      async update(input) {
        const { applicationId, ...body } = input
        return parseValedictorianContractValue(
          applicationDetailSchema,
          await request(pathFor(valedictorianApiPaths.application(applicationId)), {
            body,
            method: 'PATCH',
          }),
        )
      },
      async updateStatus(input: StatusUpdateInput) {
        return parseValedictorianContractValue(
          applicationDetailSchema,
          await request(pathFor(valedictorianApiPaths.applicationStatus(input.applicationId)), {
            body: {
              status: input.status,
              notes: input.notes,
            },
            method: 'PATCH',
          }),
        )
      },
      archive(input) {
        return request(pathFor(valedictorianApiPaths.applicationArchive(input.applicationId)), {
          body: {
            note: input.note,
          },
          method: 'PATCH',
        })
      },
      workflow: {
        async update(input) {
          const { applicationId, ...body } = input
          return parseValedictorianContractValue(
            applicationDetailSchema,
            await request(pathFor(valedictorianApiPaths.applicationWorkflow(applicationId)), {
              body,
              method: 'PATCH',
            }),
          )
        },
      },
      notes: {
        async append(input) {
          return parseValedictorianContractValue(
            applicationDetailSchema,
            await request(pathFor(valedictorianApiPaths.applicationNotes(input.applicationId)), {
              body: {
                message: input.message,
              },
              method: 'POST',
            }),
          )
        },
      },
      links: {
        async list(input) {
          const { applicationId, ...query } = input
          return parseValedictorianContractValue(
            applicationLinksListResultSchema,
            await request(pathFor(valedictorianApiPaths.applicationLinks(applicationId)), {
              query: applicationLinksListQueryToSearchParams(query),
            }),
          )
        },
        async create(input) {
          const { applicationId, ...body } = input
          return parseValedictorianContractValue(
            applicationLinkRecordSchema,
            await request(pathFor(valedictorianApiPaths.applicationLinks(applicationId)), {
              body,
              method: 'POST',
            }),
          )
        },
        async update(input) {
          const { applicationId, linkId, ...body } = input
          return parseValedictorianContractValue(
            applicationLinkRecordSchema,
            await request(pathFor(valedictorianApiPaths.applicationLink(applicationId, linkId)), {
              body,
              method: 'PATCH',
            }),
          )
        },
      },
      events: {
        async list(input) {
          const { applicationId, ...query } = input
          return parseValedictorianContractValue(
            applicationEventsListResultSchema,
            await request(pathFor(valedictorianApiPaths.applicationEvents(applicationId)), {
              query: applicationEventsListQueryToSearchParams(query),
            }),
          )
        },
      },
      attempts: {
        async list(input) {
          const { applicationId, ...query } = input
          return parseValedictorianContractValue(
            applicationAttemptsListResultSchema,
            await request(pathFor(valedictorianApiPaths.applicationAttempts(applicationId)), {
              query: applicationAttemptsListQueryToSearchParams(query),
            }),
          )
        },
        async start(input) {
          const { applicationId, ...body } = input
          return parseValedictorianContractValue(
            applicationAttemptSchema,
            await request(pathFor(valedictorianApiPaths.applicationAttempts(applicationId)), {
              body,
              method: 'POST',
            }),
          )
        },
        async step(input) {
          const { applicationId, attemptId, ...body } = input
          return parseValedictorianContractValue(
            applicationAttemptStepSchema,
            await request(
              pathFor(valedictorianApiPaths.applicationAttemptSteps(applicationId, attemptId)),
              {
                body,
                method: 'POST',
              },
            ),
          )
        },
        async complete(input) {
          const { applicationId, attemptId, ...body } = input
          return parseValedictorianContractValue(
            applicationAttemptSchema,
            await request(
              pathFor(valedictorianApiPaths.applicationAttemptComplete(applicationId, attemptId)),
              {
                body,
                method: 'PATCH',
              },
            ),
          )
        },
      },
    },
    scores: {
      async record(input: ScoreInput) {
        return parseValedictorianContractValue(
          scoreRecordSchema,
          await request(pathFor(valedictorianApiPaths.scores), {
            body: input,
            method: 'POST',
          }),
        )
      },
    },
    actionQueue: {
      async list(query) {
        return parseValedictorianContractValue(
          actionQueueListResultSchema,
          await request(pathFor(valedictorianApiPaths.actionQueue), {
            query: actionQueueListQueryToSearchParams(query),
          }),
        )
      },
    },
  }
}
