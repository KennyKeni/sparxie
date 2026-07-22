import { z } from 'zod'
import { valedictorianApiPaths } from '../api.js'
import type { ValedictorianWorkspaceClient } from '../client.js'
import {
  installedConnectorDescriptorSchema,
  installedConnectorDescriptorsListResultSchema,
} from '../connector/connector-capabilities.js'
import {
  connectorOptionQueryBodySchema,
  connectorOptionQueryResultSchema,
} from '../connector/connector-option-query.js'
import {
  ValedictorianProtocolError,
  parseValedictorianContractValue,
} from './http-client-error.js'

interface RequestOptions {
  body?: unknown
  method?: 'GET' | 'POST'
  signal?: AbortSignal
}

interface ConnectorCapabilityHttpDependencies {
  pathFor(path: string): string
  request<T>(path: string, options?: RequestOptions): Promise<T>
  rethrowOptionQueryError(error: unknown): never
}

type ConnectorCapabilityMethods = Pick<
  ValedictorianWorkspaceClient['connectors'],
  'descriptors' | 'options'
>

function requireIdentity<Result>(result: Result, actual: string, expected: string): Result {
  if (actual !== expected) {
    throw new ValedictorianProtocolError({ cause: new Error('response identity mismatch') })
  }
  return result
}

const expectedIdentitySchema = z.object({
  connectorId: z.string(),
  connectorVersion: z.string(),
  filterSchemaVersion: z.string(),
  catalogVersion: z.string(),
  sourceVersion: z.string(),
}).strict()

export function createConnectorCapabilityHttpMethods({
  pathFor,
  request,
  rethrowOptionQueryError,
}: ConnectorCapabilityHttpDependencies): ConnectorCapabilityMethods {
  return {
    descriptors: {
      async list() {
        return parseValedictorianContractValue(
          installedConnectorDescriptorsListResultSchema,
          await request(pathFor(valedictorianApiPaths.connectorDescriptors)),
        )
      },
      async get(connectorId, connectorVersion) {
        const inputIdentity = installedConnectorDescriptorSchema.parse({
          connectorId,
          connectorVersion,
          displayName: 'Requested connector',
        })
        const descriptor = parseValedictorianContractValue(
          installedConnectorDescriptorSchema,
          await request(pathFor(valedictorianApiPaths.connectorDescriptor(
            inputIdentity.connectorId,
            inputIdentity.connectorVersion,
          ))),
        )
        requireIdentity(descriptor, descriptor.connectorId, inputIdentity.connectorId)
        return requireIdentity(
          descriptor,
          descriptor.connectorVersion,
          inputIdentity.connectorVersion,
        )
      },
    },
    options: {
      async query(input, options = {}) {
        const body = connectorOptionQueryBodySchema.parse(input.body)
        const expectedIdentity = expectedIdentitySchema.parse(input.expectedIdentity)
        const expected = connectorOptionQueryResultSchema.parse({
          connectorInstanceId: input.connectorInstanceId,
          ...expectedIdentity,
          sourceId: body.sourceId,
          status: 'cancelled',
        })
        let response: unknown
        try {
          response = await request(
            pathFor(valedictorianApiPaths.connectorOptionQuery(expected.connectorInstanceId)),
            {
              body,
              method: 'POST',
              ...(options.signal === undefined ? {} : { signal: options.signal }),
            },
          )
        } catch (error) {
          rethrowOptionQueryError(error)
        }

        const result = parseValedictorianContractValue(connectorOptionQueryResultSchema, response)
        requireIdentity(result, result.connectorInstanceId, expected.connectorInstanceId)
        requireIdentity(result, result.connectorId, expected.connectorId)
        requireIdentity(result, result.connectorVersion, expected.connectorVersion)
        requireIdentity(result, result.filterSchemaVersion, expected.filterSchemaVersion)
        requireIdentity(result, result.catalogVersion, expected.catalogVersion)
        requireIdentity(result, result.sourceId, expected.sourceId)
        return requireIdentity(result, result.sourceVersion, expected.sourceVersion)
      },
    },
  }
}
