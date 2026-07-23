import { z } from 'zod'
import { valedictorianApiPaths } from '../api.js'
import {
  captureCompletionDetailSchema,
  captureProcessingStartResultSchema,
  captureResolutionListInputSchema,
  captureResolutionListResultSchema,
  completeCaptureManuallyInputSchema,
  completeCaptureManuallyResultSchema,
  correctCaptureResolutionInputSchema,
  correctCaptureResolutionResultSchema,
  replayCaptureRevisionInputSchema,
  retryCaptureProcessingInputSchema,
} from '../capture-resolution.js'
import type { CaptureResolutionWorkspaceClient } from '../capture-resolution-client.js'
import {
  ValedictorianProtocolError,
  parseValedictorianContractValue,
} from './http-client-error.js'

type CaptureResolutionRequest = <T>(path: string, options?: {
  body?: unknown
  method?: 'GET' | 'PATCH' | 'POST'
  query?: URLSearchParams
}) => Promise<T>

function bodyWithout(input: Record<string, unknown>, ...keys: string[]) {
  const body = { ...input }
  for (const key of keys) delete body[key]
  return body
}

function listQuery(input: Record<string, unknown>) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) query.set(key, String(value))
  }
  return query
}

export function createCaptureResolutionHttpMethods({
  pathFor,
  request,
}: {
  pathFor: (path: string) => string
  request: CaptureResolutionRequest
}): CaptureResolutionWorkspaceClient {
  const parse = <T>(schema: z.ZodType<T>, value: unknown) =>
    parseValedictorianContractValue(schema, value)

  return {
    async list(input) {
      const parsed = captureResolutionListInputSchema.parse(input)
      return parse(
        captureResolutionListResultSchema,
        await request(pathFor(valedictorianApiPaths.captureResolution), {
          query: listQuery(parsed),
        }),
      )
    },
    async get(captureId) {
      const detail = parse(
        captureCompletionDetailSchema,
        await request(pathFor(valedictorianApiPaths.captureResolutionDetail(captureId))),
      )
      if (detail.captureId !== captureId) throw new ValedictorianProtocolError()
      return detail
    },
    async retry(input) {
      const parsed = retryCaptureProcessingInputSchema.parse(input)
      const result = parse(
        captureProcessingStartResultSchema,
        await request(pathFor(valedictorianApiPaths.captureResolutionRetry(parsed.captureId)), {
          body: bodyWithout(parsed, 'captureId'),
          method: 'POST',
        }),
      )
      if (result.captureId !== parsed.captureId
        || result.requestCaptureRevision !== parsed.expectedCaptureRevision
        || result.requestGenerationId !== parsed.expectedGenerationId
        || result.idempotencyKey !== parsed.idempotencyKey) {
        throw new ValedictorianProtocolError()
      }
      return result
    },
    async replay(input) {
      const parsed = replayCaptureRevisionInputSchema.parse(input)
      const result = parse(
        captureProcessingStartResultSchema,
        await request(pathFor(valedictorianApiPaths.captureResolutionReplay(parsed.captureId)), {
          body: bodyWithout(parsed, 'captureId'),
          method: 'POST',
        }),
      )
      if (result.captureId !== parsed.captureId
        || result.requestCaptureRevision !== parsed.expectedCaptureRevision
        || result.requestGenerationId !== parsed.expectedGenerationId
        || result.idempotencyKey !== parsed.idempotencyKey) {
        throw new ValedictorianProtocolError()
      }
      return result
    },
    async correct(input) {
      const parsed = correctCaptureResolutionInputSchema.parse(input)
      const result = parse(
        correctCaptureResolutionResultSchema,
        await request(pathFor(valedictorianApiPaths.captureResolutionCorrection(parsed.captureId)), {
          body: bodyWithout(parsed, 'captureId'),
          method: 'PATCH',
        }),
      )
      if (result.captureId !== parsed.captureId
        || result.requestCaptureRevision !== parsed.expectedCaptureRevision
        || result.requestGenerationId !== parsed.expectedGenerationId
        || result.idempotencyKey !== parsed.idempotencyKey) {
        throw new ValedictorianProtocolError()
      }
      return result
    },
    async complete(input) {
      const parsed = completeCaptureManuallyInputSchema.parse(input)
      const result = parse(
        completeCaptureManuallyResultSchema,
        await request(pathFor(valedictorianApiPaths.captureResolutionCompletion(parsed.captureId)), {
          body: bodyWithout(parsed, 'captureId'),
          method: 'POST',
        }),
      )
      if (result.status === 'created'
        && parsed.companyResolution.action === 'use_local'
        && result.companyId !== parsed.companyResolution.companyId) {
        throw new ValedictorianProtocolError()
      }
      if (result.status === 'blocked' && result.failure.kind === 'stale_guard') {
        const guardsCorrelate = result.failure.recovery.guards.every((guard) => {
          if (guard.kind === 'capture_revision') {
            return guard.expectedRevision === parsed.expectedCaptureRevision
          }
          if (guard.kind === 'generation') {
            return guard.expectedGenerationId === parsed.expectedGenerationId
          }
          if (guard.kind === 'company_revision') {
            return parsed.companyResolution.action === 'use_local'
              && guard.companyId === parsed.companyResolution.companyId
              && guard.expectedRevision === parsed.companyResolution.expectedCompanyRevision
          }
          return parsed.duplicateResolution !== undefined
            && guard.jobId === parsed.duplicateResolution.targetJobId
            && guard.expectedRevision === parsed.duplicateResolution.expectedAssignmentRevision
        })
        if (!guardsCorrelate) throw new ValedictorianProtocolError()
      }
      return result
    },
  }
}
