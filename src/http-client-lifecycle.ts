import { z } from 'zod'
import { valedictorianApiPaths } from './api.js'
import {
  captureHistoryInputSchema, captureHistoryResultSchema, captureListInputSchema,
  captureListResultSchema, captureMutationResultSchema, captureSchema,
  correctCaptureInputSchema, createCaptureInputSchema,
} from './capture.js'
import type { LifecycleWorkspaceClient } from './lifecycle-client.js'
import {
  applicationAttemptsListResultSchema, applicationEventsListResultSchema,
  applicationMutationResultSchema, applicationSchema, applicationTechnicalListInputSchema,
  createApplicationInputSchema, createPursuitLinkInputSchema,
  lifecycleApplicationHistoryInputSchema, lifecycleApplicationHistoryResultSchema,
  lifecycleApplicationListInputSchema, lifecycleApplicationListResultSchema,
  refreshApplicationSnapshotInputSchema, removePursuitLinkInputSchema,
  updateApplicationCompanyInputSchema, updateApplicationSourceInputSchema,
  updatePursuitApplicationStatusInputSchema, updatePursuitLinkInputSchema,
} from './lifecycle-application.js'
import {
  promoteCaptureToJobInputSchema, promoteCaptureToJobResultSchema,
  promoteJobToOpportunityInputSchema, promoteJobToOpportunityResultSchema,
  promoteOpportunityToApplicationInputSchema, promoteOpportunityToApplicationResultSchema,
} from './lifecycle-promotions.js'
import {
  addJobExternalIdentityInputSchema, correctJobFactsInputSchema, createJobInputSchema, jobHistoryInputSchema,
  jobHistoryResultSchema, jobListInputSchema, jobListResultSchema, jobMutationResultSchema,
  jobIdSchema, jobSchema, removeJobExternalIdentityInputSchema, removeJobInputSchema, restoreJobInputSchema,
  updateJobAvailabilityInputSchema,
} from './job.js'
import { ValedictorianHttpError, ValedictorianProtocolError, parseValedictorianContractValue } from './http-client-error.js'
import {
  removalInputSchema, removalResultSchema,
  restoreInputSchema, restoreResultSchema,
} from './lifecycle-shared.js'
import {
  createOpportunityInputSchema, opportunityHistoryInputSchema, opportunityHistoryResultSchema, opportunityListInputSchema,
  opportunityListResultSchema, opportunityMutationResultSchema, opportunitySchema,
  updateOpportunityDispositionInputSchema, updateOpportunityEvaluationInputSchema,
} from './opportunity.js'

type LifecycleRequest = <T>(path: string, options?: {
  body?: unknown
  method?: 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT'
  query?: URLSearchParams
}) => Promise<T>

function queryFrom(input: object) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) query.set(key, String(value))
  }
  return query
}

function bodyWithout(input: Record<string, unknown>, ...keys: string[]) {
  const body = { ...input }
  for (const key of keys) delete body[key]
  return body
}

export function createLifecycleHttpMethods({
  pathFor,
  request,
  workspaceId,
}: {
  pathFor: (path: string) => string
  request: LifecycleRequest
  workspaceId: string
}): LifecycleWorkspaceClient {
  const parse = <T>(schema: z.ZodType<T>, value: unknown) =>
    parseValedictorianContractValue(schema, value)

  async function getOrNull<T>(schema: z.ZodType<T>, path: string) {
    try {
      return parse(schema, await request(pathFor(path)))
    } catch (error) {
      if (error instanceof ValedictorianHttpError && error.status === 404) return null
      throw error
    }
  }

  function requireResource<T extends { id: string; workspaceId: string }>(resource: T, expectedId?: string) {
    if (resource.workspaceId !== workspaceId || (expectedId !== undefined && resource.id !== expectedId)) {
      throw new ValedictorianProtocolError()
    }
    return resource
  }

  function requireMutation<T extends { status: string; resource?: { id: string; workspaceId: string } }>(result: T, expectedId?: string) {
    if (result.status === 'succeeded' && result.resource) requireResource(result.resource, expectedId)
    return result
  }

  function requireResultId<T extends { id: string }>(result: T, expectedId: string) {
    if (result.id !== expectedId) throw new ValedictorianProtocolError()
    return result
  }

  function requireCommandCorrelation<T extends {
    status: string
    resource?: { id: string }
    choice?: unknown
    duplicateResolution?: { targetResourceId: string } | null
    override?: unknown
    audit?: { actor?: unknown; override?: unknown }
  }>(
    result: T,
    input: object,
  ): T {
    if (!['succeeded', 'promoted', 'removed', 'restored'].includes(result.status)) return result
    const inputRecord = input as Record<string, unknown>
    if (inputRecord.actor !== undefined
      && JSON.stringify(result.audit?.actor) !== JSON.stringify(inputRecord.actor)) {
      throw new ValedictorianProtocolError()
    }
    if (result.status === 'removed' && result.choice !== inputRecord.choice) {
      throw new ValedictorianProtocolError()
    }
    if (result.status !== 'succeeded' && result.status !== 'promoted') return result
    const expectedDuplicate = inputRecord.duplicateResolution ?? null
    const expectedOverride = inputRecord.override ?? null
    const reportedOverride = 'override' in result ? result.override : result.audit?.override ?? null
    if (JSON.stringify(result.duplicateResolution ?? null) !== JSON.stringify(expectedDuplicate)
      || JSON.stringify(reportedOverride ?? null) !== JSON.stringify(expectedOverride)) {
      throw new ValedictorianProtocolError()
    }
    if (expectedDuplicate !== null
      && result.resource?.id !== (expectedDuplicate as { targetResourceId: string }).targetResourceId) {
      throw new ValedictorianProtocolError()
    }
    return result
  }

  return {
    captures: {
      async list(input = {}) {
        const query = captureListInputSchema.parse(input)
        const result = parse(captureListResultSchema, await request(pathFor(valedictorianApiPaths.captures), { query: queryFrom(query) }))
        result.items.forEach((item) => requireResource(item))
        return result
      },
      async get(captureId) {
        const resource = await getOrNull(captureSchema, valedictorianApiPaths.capture(captureId))
        return resource === null ? null : requireResource(resource, captureId)
      },
      async create(input) {
        const body = createCaptureInputSchema.parse(input)
        const result = requireMutation(parse(captureMutationResultSchema, await request(pathFor(valedictorianApiPaths.captures), { body, method: 'POST' })))
        return requireCommandCorrelation(result, body)
      },
      async correct(input) {
        const parsed = correctCaptureInputSchema.parse(input)
        const result = requireMutation(parse(captureMutationResultSchema, await request(pathFor(valedictorianApiPaths.capture(parsed.captureId)), {
          body: bodyWithout(parsed, 'captureId'), method: 'PATCH',
        })), parsed.captureId)
        return requireCommandCorrelation(result, parsed)
      },
      async remove(input) {
        const parsed = removalInputSchema.parse(input)
        const result = requireResultId(parse(removalResultSchema, await request(pathFor(valedictorianApiPaths.captureRemove(parsed.id)), {
          body: bodyWithout(parsed, 'id'), method: 'POST',
        })), parsed.id)
        return requireCommandCorrelation(result, parsed)
      },
      async restore(input) {
        const parsed = restoreInputSchema.parse(input)
        const result = requireResultId(parse(restoreResultSchema, await request(pathFor(valedictorianApiPaths.captureRestore(parsed.id)), {
          body: bodyWithout(parsed, 'id'), method: 'POST',
        })), parsed.id)
        return requireCommandCorrelation(result, parsed)
      },
      async history(input) {
        const parsed = captureHistoryInputSchema.parse(input)
        const result = parse(captureHistoryResultSchema, await request(pathFor(valedictorianApiPaths.captureHistory(parsed.id)), {
          query: queryFrom(bodyWithout(parsed, 'id')),
        }))
        result.items.forEach((item) => requireResource(item.snapshot, parsed.id))
        return result
      },
      async promoteToJob(input) {
        const parsed = promoteCaptureToJobInputSchema.parse(input)
        const result = parse(promoteCaptureToJobResultSchema, await request(pathFor(valedictorianApiPaths.capturePromoteToJob(parsed.captureId)), {
          body: bodyWithout(parsed, 'captureId'), method: 'POST',
        }))
        if (result.status === 'promoted') {
          requireResource(result.resource)
          if (!result.resource.captureEvidenceReferences.some((reference) =>
            reference.captureId === parsed.captureId && reference.captureRevision === parsed.captureRevision)) {
            throw new ValedictorianProtocolError()
          }
        }
        return requireCommandCorrelation(result, parsed)
      },
    },
    jobs: {
      async list(input = {}) {
        const query = jobListInputSchema.parse(input)
        const result = parse(jobListResultSchema, await request(pathFor(valedictorianApiPaths.jobs), { query: queryFrom(query) }))
        result.items.forEach((item) => requireResource(item))
        return result
      },
      async get(jobId) {
        const parsedId = jobIdSchema.parse(jobId)
        const resource = await getOrNull(jobSchema, valedictorianApiPaths.job(parsedId))
        return resource === null ? null : requireResource(resource, parsedId)
      },
      async create(input) {
        const body = createJobInputSchema.parse(input)
        const result = requireMutation(parse(jobMutationResultSchema, await request(pathFor(valedictorianApiPaths.jobs), { body, method: 'POST' })))
        if (result.status === 'succeeded' && body.evidenceReferences.some((requested) =>
          !result.resource.captureEvidenceReferences.some((reported) =>
            reported.captureId === requested.captureId && reported.captureRevision === requested.captureRevision))) {
          throw new ValedictorianProtocolError()
        }
        return requireCommandCorrelation(result, body)
      },
      async correctFacts(input) {
        const parsed = correctJobFactsInputSchema.parse(input)
        const result = requireMutation(parse(jobMutationResultSchema, await request(pathFor(valedictorianApiPaths.jobFacts(parsed.jobId)), {
          body: bodyWithout(parsed, 'jobId'), method: 'PATCH',
        })), parsed.jobId)
        return requireCommandCorrelation(result, parsed)
      },
      async updateAvailability(input) {
        const parsed = updateJobAvailabilityInputSchema.parse(input)
        const result = requireMutation(parse(jobMutationResultSchema, await request(pathFor(valedictorianApiPaths.jobAvailability(parsed.jobId)), {
          body: bodyWithout(parsed, 'jobId'), method: 'PATCH',
        })), parsed.jobId)
        return requireCommandCorrelation(result, parsed)
      },
      externalIdentities: {
        async add(input) {
          const parsed = addJobExternalIdentityInputSchema.parse(input)
          const result = requireMutation(parse(jobMutationResultSchema, await request(pathFor(valedictorianApiPaths.jobExternalIdentities(parsed.jobId)), {
            body: bodyWithout(parsed, 'jobId'), method: 'POST',
          })), parsed.jobId)
          return requireCommandCorrelation(result, parsed)
        },
        async remove(input) {
          const parsed = removeJobExternalIdentityInputSchema.parse(input)
          const result = requireMutation(parse(jobMutationResultSchema, await request(pathFor(valedictorianApiPaths.jobExternalIdentityRemove(parsed.jobId)), {
            body: bodyWithout(parsed, 'jobId'), method: 'POST',
          })), parsed.jobId)
          return requireCommandCorrelation(result, parsed)
        },
      },
      async remove(input) {
        const parsed = removeJobInputSchema.parse(input)
        const result = requireResultId(parse(removalResultSchema, await request(pathFor(valedictorianApiPaths.jobRemove(parsed.id)), {
          body: bodyWithout(parsed, 'id'), method: 'POST',
        })), parsed.id)
        return requireCommandCorrelation(result, parsed)
      },
      async restore(input) {
        const parsed = restoreJobInputSchema.parse(input)
        const result = requireResultId(parse(restoreResultSchema, await request(pathFor(valedictorianApiPaths.jobRestore(parsed.id)), {
          body: bodyWithout(parsed, 'id'), method: 'POST',
        })), parsed.id)
        return requireCommandCorrelation(result, parsed)
      },
      async history(input) {
        const parsed = jobHistoryInputSchema.parse(input)
        const result = parse(jobHistoryResultSchema, await request(pathFor(valedictorianApiPaths.jobHistory(parsed.id)), {
          query: queryFrom(bodyWithout(parsed, 'id')),
        }))
        result.items.forEach((item) => requireResource(item.snapshot, parsed.id))
        return result
      },
      async promoteToOpportunity(input) {
        const parsed = promoteJobToOpportunityInputSchema.parse(input)
        const result = parse(promoteJobToOpportunityResultSchema, await request(pathFor(valedictorianApiPaths.jobPromoteToOpportunity(parsed.jobId)), {
          body: bodyWithout(parsed, 'jobId'), method: 'POST',
        }))
        if (result.status === 'promoted') {
          requireResource(result.resource)
          if (result.resource.jobId !== parsed.jobId) throw new ValedictorianProtocolError()
        }
        return requireCommandCorrelation(result, parsed)
      },
    },
    opportunities: {
      async list(input = {}) {
        const query = opportunityListInputSchema.parse(input)
        const result = parse(opportunityListResultSchema, await request(pathFor(valedictorianApiPaths.opportunities), { query: queryFrom(query) }))
        result.items.forEach((item) => requireResource(item))
        return result
      },
      async get(opportunityId) {
        const resource = await getOrNull(opportunitySchema, valedictorianApiPaths.opportunity(opportunityId))
        return resource === null ? null : requireResource(resource, opportunityId)
      },
      async create(input) {
        const body = createOpportunityInputSchema.parse(input)
        const result = requireMutation(parse(opportunityMutationResultSchema, await request(pathFor(valedictorianApiPaths.opportunities), { body, method: 'POST' })))
        if (result.status === 'succeeded' && result.resource.jobId !== body.jobId) throw new ValedictorianProtocolError()
        return requireCommandCorrelation(result, body)
      },
      async updateEvaluation(input) {
        const parsed = updateOpportunityEvaluationInputSchema.parse(input)
        const result = requireMutation(parse(opportunityMutationResultSchema, await request(pathFor(valedictorianApiPaths.opportunityEvaluation(parsed.opportunityId)), {
          body: bodyWithout(parsed, 'opportunityId'), method: 'PATCH',
        })), parsed.opportunityId)
        return requireCommandCorrelation(result, parsed)
      },
      async updateDisposition(input) {
        const parsed = updateOpportunityDispositionInputSchema.parse(input)
        const result = requireMutation(parse(opportunityMutationResultSchema, await request(pathFor(valedictorianApiPaths.opportunityDisposition(parsed.opportunityId)), {
          body: bodyWithout(parsed, 'opportunityId'), method: 'PATCH',
        })), parsed.opportunityId)
        return requireCommandCorrelation(result, parsed)
      },
      async remove(input) {
        const parsed = removalInputSchema.parse(input)
        const result = requireResultId(parse(removalResultSchema, await request(pathFor(valedictorianApiPaths.opportunityRemove(parsed.id)), {
          body: bodyWithout(parsed, 'id'), method: 'POST',
        })), parsed.id)
        return requireCommandCorrelation(result, parsed)
      },
      async restore(input) {
        const parsed = restoreInputSchema.parse(input)
        const result = requireResultId(parse(restoreResultSchema, await request(pathFor(valedictorianApiPaths.opportunityRestore(parsed.id)), {
          body: bodyWithout(parsed, 'id'), method: 'POST',
        })), parsed.id)
        return requireCommandCorrelation(result, parsed)
      },
      async history(input) {
        const parsed = opportunityHistoryInputSchema.parse(input)
        const result = parse(opportunityHistoryResultSchema, await request(pathFor(valedictorianApiPaths.opportunityHistory(parsed.id)), {
          query: queryFrom(bodyWithout(parsed, 'id')),
        }))
        result.items.forEach((item) => requireResource(item.snapshot, parsed.id))
        return result
      },
      async promoteToApplication(input) {
        const parsed = promoteOpportunityToApplicationInputSchema.parse(input)
        const result = parse(promoteOpportunityToApplicationResultSchema, await request(pathFor(valedictorianApiPaths.opportunityPromoteToApplication(parsed.opportunityId)), {
          body: bodyWithout(parsed, 'opportunityId'), method: 'POST',
        }))
        if (result.status === 'promoted') {
          requireResource(result.resource)
          if (result.resource.opportunityId !== parsed.opportunityId || result.resource.jobId !== parsed.expectedJobId) throw new ValedictorianProtocolError()
        }
        return requireCommandCorrelation(result, parsed)
      },
    },
    applications: {
      async list(input = {}) {
        const query = lifecycleApplicationListInputSchema.parse(input)
        const result = parse(lifecycleApplicationListResultSchema, await request(pathFor(valedictorianApiPaths.applications), { query: queryFrom(query) }))
        result.items.forEach((item) => requireResource(item))
        return result
      },
      async get(applicationId) {
        const resource = await getOrNull(applicationSchema, valedictorianApiPaths.application(applicationId))
        return resource === null ? null : requireResource(resource, applicationId)
      },
      async create(input) {
        const body = createApplicationInputSchema.parse(input)
        const result = requireMutation(parse(applicationMutationResultSchema, await request(pathFor(valedictorianApiPaths.applications), { body, method: 'POST' })))
        if (result.status === 'succeeded'
          && (result.resource.opportunityId !== body.opportunityId
            || result.resource.jobId !== body.jobId
            || result.resource.snapshot.jobFactsRevision !== body.expectedJobFactsRevision)) {
          throw new ValedictorianProtocolError()
        }
        return requireCommandCorrelation(result, body)
      },
      async updateStatus(input) {
        const parsed = updatePursuitApplicationStatusInputSchema.parse(input)
        const result = requireMutation(parse(applicationMutationResultSchema, await request(pathFor(valedictorianApiPaths.applicationStatus(parsed.applicationId)), {
          body: bodyWithout(parsed, 'applicationId'), method: 'PATCH',
        })), parsed.applicationId)
        return requireCommandCorrelation(result, parsed)
      },
      async updateCompany(input) {
        const parsed = updateApplicationCompanyInputSchema.parse(input)
        const result = requireMutation(parse(applicationMutationResultSchema, await request(pathFor(valedictorianApiPaths.applicationCompany(parsed.applicationId)), {
          body: bodyWithout(parsed, 'applicationId'), method: 'PATCH',
        })), parsed.applicationId)
        return requireCommandCorrelation(result, parsed)
      },
      async updateSource(input) {
        const parsed = updateApplicationSourceInputSchema.parse(input)
        const result = requireMutation(parse(applicationMutationResultSchema, await request(pathFor(valedictorianApiPaths.applicationSource(parsed.applicationId)), {
          body: bodyWithout(parsed, 'applicationId'), method: 'PATCH',
        })), parsed.applicationId)
        return requireCommandCorrelation(result, parsed)
      },
      links: {
        async create(input) {
          const parsed = createPursuitLinkInputSchema.parse(input)
          const result = requireMutation(parse(applicationMutationResultSchema, await request(pathFor(valedictorianApiPaths.applicationLinks(parsed.applicationId)), {
            body: bodyWithout(parsed, 'applicationId'), method: 'POST',
          })), parsed.applicationId)
          return requireCommandCorrelation(result, parsed)
        },
        async update(input) {
          const parsed = updatePursuitLinkInputSchema.parse(input)
          const result = requireMutation(parse(applicationMutationResultSchema, await request(pathFor(valedictorianApiPaths.applicationLink(parsed.applicationId, parsed.linkId)), {
            body: bodyWithout(parsed, 'applicationId', 'linkId'), method: 'PATCH',
          })), parsed.applicationId)
          return requireCommandCorrelation(result, parsed)
        },
        async remove(input) {
          const parsed = removePursuitLinkInputSchema.parse(input)
          const result = requireMutation(parse(applicationMutationResultSchema, await request(pathFor(valedictorianApiPaths.applicationLinkRemove(parsed.applicationId, parsed.linkId)), {
            body: bodyWithout(parsed, 'applicationId', 'linkId'), method: 'POST',
          })), parsed.applicationId)
          return requireCommandCorrelation(result, parsed)
        },
      },
      async refreshSnapshot(input) {
        const parsed = refreshApplicationSnapshotInputSchema.parse(input)
        const result = requireMutation(parse(applicationMutationResultSchema, await request(pathFor(valedictorianApiPaths.applicationRefreshSnapshot(parsed.applicationId)), {
          body: bodyWithout(parsed, 'applicationId'), method: 'POST',
        })), parsed.applicationId)
        if (result.status === 'succeeded'
          && result.resource.snapshot.jobFactsRevision !== parsed.expectedJobFactsRevision) {
          throw new ValedictorianProtocolError()
        }
        return requireCommandCorrelation(result, parsed)
      },
      async remove(input) {
        const parsed = removalInputSchema.parse(input)
        const result = requireResultId(parse(removalResultSchema, await request(pathFor(valedictorianApiPaths.applicationRemove(parsed.id)), {
          body: bodyWithout(parsed, 'id'), method: 'POST',
        })), parsed.id)
        return requireCommandCorrelation(result, parsed)
      },
      async restore(input) {
        const parsed = restoreInputSchema.parse(input)
        const result = requireResultId(parse(restoreResultSchema, await request(pathFor(valedictorianApiPaths.applicationRestore(parsed.id)), {
          body: bodyWithout(parsed, 'id'), method: 'POST',
        })), parsed.id)
        return requireCommandCorrelation(result, parsed)
      },
      async history(input) {
        const parsed = lifecycleApplicationHistoryInputSchema.parse(input)
        const result = parse(lifecycleApplicationHistoryResultSchema, await request(pathFor(valedictorianApiPaths.applicationHistory(parsed.id)), {
          query: queryFrom(bodyWithout(parsed, 'id')),
        }))
        result.items.forEach((item) => requireResource(item.snapshot, parsed.id))
        return result
      },
      attempts: {
        async list(input) {
          const parsed = applicationTechnicalListInputSchema.parse(input)
          const result = parse(applicationAttemptsListResultSchema, await request(pathFor(valedictorianApiPaths.applicationAttempts(parsed.applicationId)), {
            query: queryFrom(bodyWithout(parsed, 'applicationId')),
          }))
          if (result.items.some((item) => item.workspaceId !== workspaceId || item.applicationId !== parsed.applicationId)) throw new ValedictorianProtocolError()
          return result
        },
      },
      events: {
        async list(input) {
          const parsed = applicationTechnicalListInputSchema.parse(input)
          const result = parse(applicationEventsListResultSchema, await request(pathFor(valedictorianApiPaths.applicationEvents(parsed.applicationId)), {
            query: queryFrom(bodyWithout(parsed, 'applicationId')),
          }))
          if (result.items.some((item) => item.workspaceId !== workspaceId || item.applicationId !== parsed.applicationId)) throw new ValedictorianProtocolError()
          return result
        },
      },
    },
  }
}
