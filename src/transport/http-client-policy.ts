import { valedictorianApiPaths } from '../api.js'
import type { ValedictorianWorkspaceClient } from '../client.js'
import { parseValedictorianContractValue } from './http-client-error.js'
import {
  policyConfigSchema,
  policyDecisionSchema,
  policyEvidenceListResultSchema,
  policyEvidenceRecordSchema,
  policyRunWindowDecisionSchema,
} from './http-response-contracts.js'
import type { PolicyEvidenceListInput } from '../policy.js'

type PolicyHttpRequest = <T>(
  path: string,
  options?: {
    body?: unknown
    method?: 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT'
    query?: URLSearchParams
  },
) => Promise<T>

export function createPolicyHttpMethods({
  pathFor,
  request,
  policyEvidenceListQueryToSearchParams,
}: {
  pathFor: (path: string) => string
  request: PolicyHttpRequest
  policyEvidenceListQueryToSearchParams: (query?: PolicyEvidenceListInput) => URLSearchParams
}): ValedictorianWorkspaceClient['policy'] {
  return {
    config: {
      async get() {
        return parseValedictorianContractValue(
          policyConfigSchema,
          await request(pathFor(valedictorianApiPaths.policyConfig)),
        )
      },
      async reset() {
        return parseValedictorianContractValue(
          policyConfigSchema,
          await request(pathFor(valedictorianApiPaths.policyConfigReset), {
            body: {},
            method: 'POST',
          }),
        )
      },
      async update(patch) {
        return parseValedictorianContractValue(
          policyConfigSchema,
          await request(pathFor(valedictorianApiPaths.policyConfig), {
            body: patch,
            method: 'PATCH',
          }),
        )
      },
    },
    evidence: {
      async list(query) {
        return parseValedictorianContractValue(
          policyEvidenceListResultSchema,
          await request(pathFor(valedictorianApiPaths.policyEvidence), {
            query: policyEvidenceListQueryToSearchParams(query),
          }),
        )
      },
      async record(input) {
        return parseValedictorianContractValue(
          policyEvidenceRecordSchema,
          await request(pathFor(valedictorianApiPaths.policyEvidence), {
            body: input,
            method: 'POST',
          }),
        )
      },
    },
    evaluate: {
      async application(input) {
        return parseValedictorianContractValue(
          policyDecisionSchema,
          await request(pathFor(valedictorianApiPaths.policyEvaluateApplication), {
            body: input,
            method: 'POST',
          }),
        )
      },
      async opportunity(input) {
        return parseValedictorianContractValue(
          policyDecisionSchema,
          await request(pathFor(valedictorianApiPaths.policyEvaluateOpportunity), {
            body: input,
            method: 'POST',
          }),
        )
      },
      async runWindow(input) {
        return parseValedictorianContractValue(
          policyRunWindowDecisionSchema,
          await request(pathFor(valedictorianApiPaths.policyEvaluateRunWindow), {
            body: input,
            method: 'POST',
          }),
        )
      },
    },
  }
}
