import { valedictorianApiPaths } from '../api.js'
import type { ActionQueueListQuery } from '../action-queue.js'
import type { ValedictorianWorkspaceClient } from '../client.js'
import { parseValedictorianContractValue } from './http-client-error.js'
import { actionQueueListResultSchema, scoreRecordSchema } from './http-response-contracts.js'
import type { ScoreInput } from '../scoring.js'

type SupportingRequest = <T>(path: string, options?: {
  body?: unknown
  method?: 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT'
  query?: URLSearchParams
}) => Promise<T>

export function createScoreAndActionQueueHttpMethods({
  pathFor,
  request,
  actionQueueListQueryToSearchParams,
}: {
  pathFor: (path: string) => string
  request: SupportingRequest
  actionQueueListQueryToSearchParams: (query?: ActionQueueListQuery) => URLSearchParams
}): Pick<ValedictorianWorkspaceClient, 'scores' | 'actionQueue'> {
  return {
    scores: {
      async record(input: ScoreInput) {
        return parseValedictorianContractValue(
          scoreRecordSchema,
          await request(pathFor(valedictorianApiPaths.scores), { body: input, method: 'POST' }),
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
