import { valedictorianApiPaths } from '../api.js'
import type { ValedictorianWorkspaceClient } from '../client.js'
import { parseValedictorianContractValue } from './http-client-error.js'
import {
  profileDocumentFormatInputSchema,
  profileDocumentRestoreInputSchema,
  profileDocumentSchema,
  profileDocumentUpdateInputSchema,
  profileDocumentValidateResultSchema,
  profileUpdateInputSchema,
} from '../profile-document.js'
import { profileAgentContextSchema, userProfileSchema } from '../profile.js'
import { profileSensitiveDetailsSchema } from './http-response-contracts.js'

type ProfileHttpRequest = <T>(
  path: string,
  options?: {
    body?: unknown
    method?: 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT'
    query?: URLSearchParams
  },
) => Promise<T>

async function mapProfileDocumentRequest<T>(
  operation: () => Promise<T>,
  rethrowDocumentError: (error: unknown) => never,
): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    rethrowDocumentError(error)
  }
}

export function createProfileHttpMethods({
  pathFor,
  request,
  rethrowDocumentError,
}: {
  pathFor: (path: string) => string
  request: ProfileHttpRequest
  rethrowDocumentError: (error: unknown) => never
}): ValedictorianWorkspaceClient['profile'] {
  return {
    async get() {
      return parseValedictorianContractValue(
        userProfileSchema,
        await request(pathFor(valedictorianApiPaths.profile)),
      )
    },
    async update(input) {
      const body = profileUpdateInputSchema.parse(input)
      return parseValedictorianContractValue(
        userProfileSchema,
        await request(pathFor(valedictorianApiPaths.profile), {
          body,
          method: 'PATCH',
        }),
      )
    },
    agentContext: {
      async get() {
        return parseValedictorianContractValue(
          profileAgentContextSchema,
          await request(pathFor(valedictorianApiPaths.profileAgentContext)),
        )
      },
    },
    document: {
      get() {
        return mapProfileDocumentRequest(
          async () =>
            parseValedictorianContractValue(
              profileDocumentSchema,
              await request(pathFor(valedictorianApiPaths.profileDocument)),
            ),
          rethrowDocumentError,
        )
      },
      update(input) {
        const body = profileDocumentUpdateInputSchema.parse(input)
        return mapProfileDocumentRequest(
          async () =>
            parseValedictorianContractValue(
              profileDocumentSchema,
              await request(pathFor(valedictorianApiPaths.profileDocument), {
                body,
                method: 'PUT',
              }),
            ),
          rethrowDocumentError,
        )
      },
      validate() {
        return mapProfileDocumentRequest(
          async () =>
            parseValedictorianContractValue(
              profileDocumentValidateResultSchema,
              await request(pathFor(valedictorianApiPaths.profileDocumentValidate), {
                method: 'POST',
              }),
            ),
          rethrowDocumentError,
        )
      },
      format(input) {
        const body = profileDocumentFormatInputSchema.parse(input)
        return mapProfileDocumentRequest(
          async () =>
            parseValedictorianContractValue(
              profileDocumentSchema,
              await request(pathFor(valedictorianApiPaths.profileDocumentFormat), {
                body,
                method: 'POST',
              }),
            ),
          rethrowDocumentError,
        )
      },
      restore(input) {
        const body = profileDocumentRestoreInputSchema.parse(input)
        return mapProfileDocumentRequest(
          async () =>
            parseValedictorianContractValue(
              profileDocumentSchema,
              await request(pathFor(valedictorianApiPaths.profileDocumentRestore), {
                body,
                method: 'POST',
              }),
            ),
          rethrowDocumentError,
        )
      },
    },
    sensitive: {
      async get() {
        return parseValedictorianContractValue(
          profileSensitiveDetailsSchema,
          await request(pathFor(valedictorianApiPaths.profileSensitive)),
        )
      },
      async update(input) {
        return parseValedictorianContractValue(
          profileSensitiveDetailsSchema,
          await request(pathFor(valedictorianApiPaths.profileSensitive), {
            body: input,
            method: 'PATCH',
          }),
        )
      },
    },
  }
}
