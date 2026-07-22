import { valedictorianApiPaths } from '../api.js'
import type { ValedictorianWorkspaceClient } from '../client.js'
import { parseValedictorianContractValue } from './http-client-error.js'
import {
  workflowRunSchema,
  workflowRunStepSchema,
  workflowRunsListResultSchema,
} from './http-response-contracts.js'
import type { WorkflowRunsListInput } from '../workflow-run.js'

type RunsHttpRequest = <T>(
  path: string,
  options?: {
    body?: unknown
    method?: 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT'
    query?: URLSearchParams
  },
) => Promise<T>

export function createWorkflowRunsHttpMethods({
  pathFor,
  request,
  workflowRunListQueryToSearchParams,
}: {
  pathFor: (path: string) => string
  request: RunsHttpRequest
  workflowRunListQueryToSearchParams: (query?: WorkflowRunsListInput) => URLSearchParams
}): ValedictorianWorkspaceClient['runs'] {
  return {
    async list(query) {
      return parseValedictorianContractValue(
        workflowRunsListResultSchema,
        await request(pathFor(valedictorianApiPaths.runs), {
          query: workflowRunListQueryToSearchParams(query),
        }),
      )
    },
    async start(input) {
      return parseValedictorianContractValue(
        workflowRunSchema,
        await request(pathFor(valedictorianApiPaths.runs), {
          body: input,
          method: 'POST',
        }),
      )
    },
    async step(input) {
      const { workflowRunId, ...body } = input
      return parseValedictorianContractValue(
        workflowRunStepSchema,
        await request(pathFor(valedictorianApiPaths.runSteps(workflowRunId)), {
          body,
          method: 'POST',
        }),
      )
    },
    async complete(input) {
      const { workflowRunId, ...body } = input
      return parseValedictorianContractValue(
        workflowRunSchema,
        await request(pathFor(valedictorianApiPaths.runComplete(workflowRunId)), {
          body,
          method: 'PATCH',
        }),
      )
    },
  }
}
