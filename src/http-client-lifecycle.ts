import { z } from 'zod'
import { valedictorianApiPaths } from './api.js'
import {
  captureHistoryInputSchema, captureHistoryResultSchema, captureListInputSchema,
  captureListResultSchema, captureMutationResultSchema, captureSchema,
  correctCaptureInputSchema, createCaptureInputSchema,
} from './capture.js'
import type { LifecycleWorkspaceClient } from './lifecycle-client.js'
import {
  applicationMutationResultSchema, applicationSchema, createPursuitLinkInputSchema,
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
  addJobExternalIdentityInputSchema, correctJobFactsInputSchema, jobHistoryInputSchema,
  jobHistoryResultSchema, jobListInputSchema, jobListResultSchema, jobMutationResultSchema,
  jobSchema, removeJobExternalIdentityInputSchema, updateJobAvailabilityInputSchema,
} from './job.js'
import { ValedictorianHttpError, parseValedictorianContractValue } from './http-client-error.js'
import {
  removalInputSchema, removalResultSchema,
  restoreInputSchema, restoreResultSchema,
} from './lifecycle-shared.js'
import {
  opportunityHistoryInputSchema, opportunityHistoryResultSchema, opportunityListInputSchema,
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
}: {
  pathFor: (path: string) => string
  request: LifecycleRequest
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

  return {
    captures: {
      async list(input = {}) {
        const query = captureListInputSchema.parse(input)
        return parse(captureListResultSchema, await request(pathFor(valedictorianApiPaths.captures), { query: queryFrom(query) }))
      },
      get(captureId) {
        return getOrNull(captureSchema, valedictorianApiPaths.capture(captureId))
      },
      async create(input) {
        const body = createCaptureInputSchema.parse(input)
        return parse(captureMutationResultSchema, await request(pathFor(valedictorianApiPaths.captures), { body, method: 'POST' }))
      },
      async correct(input) {
        const parsed = correctCaptureInputSchema.parse(input)
        return parse(captureMutationResultSchema, await request(pathFor(valedictorianApiPaths.capture(parsed.captureId)), {
          body: bodyWithout(parsed, 'captureId'), method: 'PATCH',
        }))
      },
      async remove(input) {
        const parsed = removalInputSchema.parse(input)
        return parse(removalResultSchema, await request(pathFor(valedictorianApiPaths.captureRemove(parsed.id)), {
          body: bodyWithout(parsed, 'id'), method: 'POST',
        }))
      },
      async restore(input) {
        const parsed = restoreInputSchema.parse(input)
        return parse(restoreResultSchema, await request(pathFor(valedictorianApiPaths.captureRestore(parsed.id)), {
          body: bodyWithout(parsed, 'id'), method: 'POST',
        }))
      },
      async history(input) {
        const parsed = captureHistoryInputSchema.parse(input)
        return parse(captureHistoryResultSchema, await request(pathFor(valedictorianApiPaths.captureHistory(parsed.id)), {
          query: queryFrom(bodyWithout(parsed, 'id')),
        }))
      },
      async promoteToJob(input) {
        const parsed = promoteCaptureToJobInputSchema.parse(input)
        return parse(promoteCaptureToJobResultSchema, await request(pathFor(valedictorianApiPaths.capturePromoteToJob(parsed.captureId)), {
          body: bodyWithout(parsed, 'captureId'), method: 'POST',
        }))
      },
    },
    jobs: {
      async list(input = {}) {
        const query = jobListInputSchema.parse(input)
        return parse(jobListResultSchema, await request(pathFor(valedictorianApiPaths.jobs), { query: queryFrom(query) }))
      },
      get(jobId) {
        return getOrNull(jobSchema, valedictorianApiPaths.job(jobId))
      },
      async correctFacts(input) {
        const parsed = correctJobFactsInputSchema.parse(input)
        return parse(jobMutationResultSchema, await request(pathFor(valedictorianApiPaths.jobFacts(parsed.jobId)), {
          body: bodyWithout(parsed, 'jobId'), method: 'PATCH',
        }))
      },
      async updateAvailability(input) {
        const parsed = updateJobAvailabilityInputSchema.parse(input)
        return parse(jobMutationResultSchema, await request(pathFor(valedictorianApiPaths.jobAvailability(parsed.jobId)), {
          body: bodyWithout(parsed, 'jobId'), method: 'PATCH',
        }))
      },
      externalIdentities: {
        async add(input) {
          const parsed = addJobExternalIdentityInputSchema.parse(input)
          return parse(jobMutationResultSchema, await request(pathFor(valedictorianApiPaths.jobExternalIdentities(parsed.jobId)), {
            body: bodyWithout(parsed, 'jobId'), method: 'POST',
          }))
        },
        async remove(input) {
          const parsed = removeJobExternalIdentityInputSchema.parse(input)
          return parse(jobMutationResultSchema, await request(pathFor(valedictorianApiPaths.jobExternalIdentityRemove(parsed.jobId)), {
            body: bodyWithout(parsed, 'jobId'), method: 'POST',
          }))
        },
      },
      async remove(input) {
        const parsed = removalInputSchema.parse(input)
        return parse(removalResultSchema, await request(pathFor(valedictorianApiPaths.jobRemove(parsed.id)), {
          body: bodyWithout(parsed, 'id'), method: 'POST',
        }))
      },
      async restore(input) {
        const parsed = restoreInputSchema.parse(input)
        return parse(restoreResultSchema, await request(pathFor(valedictorianApiPaths.jobRestore(parsed.id)), {
          body: bodyWithout(parsed, 'id'), method: 'POST',
        }))
      },
      async history(input) {
        const parsed = jobHistoryInputSchema.parse(input)
        return parse(jobHistoryResultSchema, await request(pathFor(valedictorianApiPaths.jobHistory(parsed.id)), {
          query: queryFrom(bodyWithout(parsed, 'id')),
        }))
      },
      async promoteToOpportunity(input) {
        const parsed = promoteJobToOpportunityInputSchema.parse(input)
        return parse(promoteJobToOpportunityResultSchema, await request(pathFor(valedictorianApiPaths.jobPromoteToOpportunity(parsed.jobId)), {
          body: bodyWithout(parsed, 'jobId'), method: 'POST',
        }))
      },
    },
    opportunities: {
      async list(input = {}) {
        const query = opportunityListInputSchema.parse(input)
        return parse(opportunityListResultSchema, await request(pathFor(valedictorianApiPaths.opportunities), { query: queryFrom(query) }))
      },
      get(opportunityId) {
        return getOrNull(opportunitySchema, valedictorianApiPaths.opportunity(opportunityId))
      },
      async updateEvaluation(input) {
        const parsed = updateOpportunityEvaluationInputSchema.parse(input)
        return parse(opportunityMutationResultSchema, await request(pathFor(valedictorianApiPaths.opportunityEvaluation(parsed.opportunityId)), {
          body: bodyWithout(parsed, 'opportunityId'), method: 'PATCH',
        }))
      },
      async updateDisposition(input) {
        const parsed = updateOpportunityDispositionInputSchema.parse(input)
        return parse(opportunityMutationResultSchema, await request(pathFor(valedictorianApiPaths.opportunityDisposition(parsed.opportunityId)), {
          body: bodyWithout(parsed, 'opportunityId'), method: 'PATCH',
        }))
      },
      async remove(input) {
        const parsed = removalInputSchema.parse(input)
        return parse(removalResultSchema, await request(pathFor(valedictorianApiPaths.opportunityRemove(parsed.id)), {
          body: bodyWithout(parsed, 'id'), method: 'POST',
        }))
      },
      async restore(input) {
        const parsed = restoreInputSchema.parse(input)
        return parse(restoreResultSchema, await request(pathFor(valedictorianApiPaths.opportunityRestore(parsed.id)), {
          body: bodyWithout(parsed, 'id'), method: 'POST',
        }))
      },
      async history(input) {
        const parsed = opportunityHistoryInputSchema.parse(input)
        return parse(opportunityHistoryResultSchema, await request(pathFor(valedictorianApiPaths.opportunityHistory(parsed.id)), {
          query: queryFrom(bodyWithout(parsed, 'id')),
        }))
      },
      async promoteToApplication(input) {
        const parsed = promoteOpportunityToApplicationInputSchema.parse(input)
        return parse(promoteOpportunityToApplicationResultSchema, await request(pathFor(valedictorianApiPaths.opportunityPromoteToApplication(parsed.opportunityId)), {
          body: bodyWithout(parsed, 'opportunityId'), method: 'POST',
        }))
      },
    },
    applications: {
      async list(input = {}) {
        const query = lifecycleApplicationListInputSchema.parse(input)
        return parse(lifecycleApplicationListResultSchema, await request(pathFor(valedictorianApiPaths.applications), { query: queryFrom(query) }))
      },
      get(applicationId) {
        return getOrNull(applicationSchema, valedictorianApiPaths.application(applicationId))
      },
      async updateStatus(input) {
        const parsed = updatePursuitApplicationStatusInputSchema.parse(input)
        return parse(applicationMutationResultSchema, await request(pathFor(valedictorianApiPaths.applicationStatus(parsed.applicationId)), {
          body: bodyWithout(parsed, 'applicationId'), method: 'PATCH',
        }))
      },
      async updateCompany(input) {
        const parsed = updateApplicationCompanyInputSchema.parse(input)
        return parse(applicationMutationResultSchema, await request(pathFor(valedictorianApiPaths.applicationCompany(parsed.applicationId)), {
          body: bodyWithout(parsed, 'applicationId'), method: 'PATCH',
        }))
      },
      async updateSource(input) {
        const parsed = updateApplicationSourceInputSchema.parse(input)
        return parse(applicationMutationResultSchema, await request(pathFor(valedictorianApiPaths.applicationSource(parsed.applicationId)), {
          body: bodyWithout(parsed, 'applicationId'), method: 'PATCH',
        }))
      },
      links: {
        async create(input) {
          const parsed = createPursuitLinkInputSchema.parse(input)
          return parse(applicationMutationResultSchema, await request(pathFor(valedictorianApiPaths.applicationLinks(parsed.applicationId)), {
            body: bodyWithout(parsed, 'applicationId'), method: 'POST',
          }))
        },
        async update(input) {
          const parsed = updatePursuitLinkInputSchema.parse(input)
          return parse(applicationMutationResultSchema, await request(pathFor(valedictorianApiPaths.applicationLink(parsed.applicationId, parsed.linkId)), {
            body: bodyWithout(parsed, 'applicationId', 'linkId'), method: 'PATCH',
          }))
        },
        async remove(input) {
          const parsed = removePursuitLinkInputSchema.parse(input)
          return parse(applicationMutationResultSchema, await request(pathFor(valedictorianApiPaths.applicationLinkRemove(parsed.applicationId, parsed.linkId)), {
            body: bodyWithout(parsed, 'applicationId', 'linkId'), method: 'POST',
          }))
        },
      },
      async refreshSnapshot(input) {
        const parsed = refreshApplicationSnapshotInputSchema.parse(input)
        return parse(applicationMutationResultSchema, await request(pathFor(valedictorianApiPaths.applicationRefreshSnapshot(parsed.applicationId)), {
          body: bodyWithout(parsed, 'applicationId'), method: 'POST',
        }))
      },
      async remove(input) {
        const parsed = removalInputSchema.parse(input)
        return parse(removalResultSchema, await request(pathFor(valedictorianApiPaths.applicationRemove(parsed.id)), {
          body: bodyWithout(parsed, 'id'), method: 'POST',
        }))
      },
      async restore(input) {
        const parsed = restoreInputSchema.parse(input)
        return parse(restoreResultSchema, await request(pathFor(valedictorianApiPaths.applicationRestore(parsed.id)), {
          body: bodyWithout(parsed, 'id'), method: 'POST',
        }))
      },
      async history(input) {
        const parsed = lifecycleApplicationHistoryInputSchema.parse(input)
        return parse(lifecycleApplicationHistoryResultSchema, await request(pathFor(valedictorianApiPaths.applicationHistory(parsed.id)), {
          query: queryFrom(bodyWithout(parsed, 'id')),
        }))
      },
    },
  }
}
