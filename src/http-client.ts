import { defaultJobAppApiBaseUrl, jobAppApiPaths } from './api.js'
import type {
  ApplicationEventsListInput,
  ApplicationAttemptsListInput,
  ApplicationLinksListInput,
  ApplicationListQuery,
  StatusUpdateInput,
} from './application.js'
import type { JobAppClient } from './client.js'
import type { PolicyEvidenceListInput } from './policy.js'
import type { QueueListQuery } from './queue.js'
import type { ScoreInput } from './scoring.js'
import type { SourcingFindingsListInput } from './sourcing.js'
import type { WorkflowRunsListInput } from './workflow-run.js'

export interface HttpJobAppClientOptions {
  baseUrl?: string
  token?: string
  fetch?: typeof fetch
}

export class JobAppHttpError extends Error {
  readonly status: number
  readonly body: unknown

  constructor({ body, message, status }: { body: unknown; message: string; status: number }) {
    super(message)
    this.name = 'JobAppHttpError'
    this.status = status
    this.body = body
  }
}

const applicationListQueryParamKeys = [
  'status',
  'hasApplied',
  'priorityBand',
  'minScore',
  'maxScore',
  'company',
  'role',
  'source',
  'search',
  'workMode',
  'createdFrom',
  'createdTo',
  'updatedFrom',
  'updatedTo',
  'sort',
  'limit',
  'offset',
] as const

const queueListQueryParamKeys = ['bucket', 'limit', 'offset'] as const
const workflowRunListQueryParamKeys = [
  'runType',
  'status',
  'sourceId',
  'source',
  'subjectApplicationId',
  'limit',
  'offset',
] as const
const sourcingFindingListQueryParamKeys = [
  'workflowRunId',
  'sourceId',
  'source',
  'mergeStatus',
  'limit',
  'offset',
] as const
const applicationEventsListQueryParamKeys = ['limit', 'offset'] as const
const applicationAttemptsListQueryParamKeys = ['limit', 'offset'] as const
const applicationLinksListQueryParamKeys = ['limit', 'offset'] as const
const policyEvidenceListQueryParamKeys = ['subjectType', 'subjectId', 'tag', 'limit', 'offset'] as const

export function applicationListQueryToSearchParams(query: ApplicationListQuery = {}) {
  const params = new URLSearchParams()

  for (const key of applicationListQueryParamKeys) {
    const value = query[key]

    if (value !== undefined) {
      params.set(key, String(value))
    }
  }

  return params
}

export function queueListQueryToSearchParams(query: QueueListQuery = {}) {
  const params = new URLSearchParams()

  for (const key of queueListQueryParamKeys) {
    const value = query[key]

    if (value !== undefined) {
      params.set(key, String(value))
    }
  }

  return params
}

export function workflowRunListQueryToSearchParams(query: WorkflowRunsListInput = {}) {
  const params = new URLSearchParams()

  for (const key of workflowRunListQueryParamKeys) {
    const value = query[key]

    if (value !== undefined) {
      params.set(key, String(value))
    }
  }

  return params
}

export function sourcingFindingListQueryToSearchParams(
  query: SourcingFindingsListInput = {},
) {
  const params = new URLSearchParams()

  for (const key of sourcingFindingListQueryParamKeys) {
    const value = query[key]

    if (value !== undefined) {
      params.set(key, String(value))
    }
  }

  return params
}

export function applicationEventsListQueryToSearchParams(
  query: Omit<ApplicationEventsListInput, 'applicationId'> = {},
) {
  const params = new URLSearchParams()

  for (const key of applicationEventsListQueryParamKeys) {
    const value = query[key]

    if (value !== undefined) {
      params.set(key, String(value))
    }
  }

  return params
}

export function applicationAttemptsListQueryToSearchParams(
  query: Omit<ApplicationAttemptsListInput, 'applicationId'> = {},
) {
  const params = new URLSearchParams()

  for (const key of applicationAttemptsListQueryParamKeys) {
    const value = query[key]

    if (value !== undefined) {
      params.set(key, String(value))
    }
  }

  return params
}

export function applicationLinksListQueryToSearchParams(
  query: Omit<ApplicationLinksListInput, 'applicationId'> = {},
) {
  const params = new URLSearchParams()

  for (const key of applicationLinksListQueryParamKeys) {
    const value = query[key]

    if (value !== undefined) {
      params.set(key, String(value))
    }
  }

  return params
}

export function policyEvidenceListQueryToSearchParams(query: PolicyEvidenceListInput = {}) {
  const params = new URLSearchParams()

  for (const key of policyEvidenceListQueryParamKeys) {
    const value = query[key]

    if (value !== undefined) {
      params.set(key, String(value))
    }
  }

  return params
}

export function createHttpJobAppClient({
  baseUrl = defaultJobAppApiBaseUrl,
  fetch: fetchImplementation = fetch,
  token,
}: HttpJobAppClientOptions = {}): JobAppClient {
  async function request<T>(
    path: string,
    options: {
      body?: unknown
      method?: 'GET' | 'PATCH' | 'POST'
      query?: URLSearchParams
    } = {},
  ): Promise<T> {
    const url = new URL(path, baseUrl)

    if (options.query) {
      url.search = options.query.toString()
    }

    const headers: Record<string, string> = {
      accept: 'application/json',
    }

    if (token) {
      headers.authorization = `Bearer ${token}`
    }

    const init: RequestInit = {
      headers,
      method: options.method ?? 'GET',
    }

    if (options.body !== undefined) {
      headers['content-type'] = 'application/json'
      init.body = JSON.stringify(options.body)
    }

    const response = await fetchImplementation(url.toString(), init)
    const body = await readResponseBody(response)

    if (!response.ok) {
      throw new JobAppHttpError({
        body,
        message: responseMessage(body, response.statusText),
        status: response.status,
      })
    }

    return body as T
  }

  return {
    applications: {
      list(query) {
        return request(jobAppApiPaths.applications, {
          query: applicationListQueryToSearchParams(query),
        })
      },
      async get(id) {
        try {
          return await request(jobAppApiPaths.application(id))
        } catch (error) {
          if (error instanceof JobAppHttpError && error.status === 404) {
            return null
          }

          throw error
        }
      },
      create(input) {
        return request(jobAppApiPaths.applications, {
          body: input,
          method: 'POST',
        })
      },
      update(input) {
        const { applicationId, ...body } = input

        return request(jobAppApiPaths.application(applicationId), {
          body,
          method: 'PATCH',
        })
      },
      updateStatus(input: StatusUpdateInput) {
        return request(jobAppApiPaths.applicationStatus(input.applicationId), {
          body: {
            status: input.status,
            notes: input.notes,
          },
          method: 'PATCH',
        })
      },
      archive(input) {
        return request(jobAppApiPaths.applicationArchive(input.applicationId), {
          body: {
            note: input.note,
          },
          method: 'PATCH',
        })
      },
      workflow: {
        update(input) {
          const { applicationId, ...body } = input

          return request(jobAppApiPaths.applicationWorkflow(applicationId), {
            body,
            method: 'PATCH',
          })
        },
      },
      notes: {
        append(input) {
          return request(jobAppApiPaths.applicationNotes(input.applicationId), {
            body: {
              message: input.message,
            },
            method: 'POST',
          })
        },
      },
      links: {
        list(input) {
          const { applicationId, ...query } = input

          return request(jobAppApiPaths.applicationLinks(applicationId), {
            query: applicationLinksListQueryToSearchParams(query),
          })
        },
        create(input) {
          const { applicationId, ...body } = input

          return request(jobAppApiPaths.applicationLinks(applicationId), {
            body,
            method: 'POST',
          })
        },
        update(input) {
          const { applicationId, linkId, ...body } = input

          return request(jobAppApiPaths.applicationLink(applicationId, linkId), {
            body,
            method: 'PATCH',
          })
        },
      },
      events: {
        list(input) {
          const { applicationId, ...query } = input

          return request(jobAppApiPaths.applicationEvents(applicationId), {
            query: applicationEventsListQueryToSearchParams(query),
          })
        },
      },
      attempts: {
        list(input) {
          const { applicationId, ...query } = input

          return request(jobAppApiPaths.applicationAttempts(applicationId), {
            query: applicationAttemptsListQueryToSearchParams(query),
          })
        },
        start(input) {
          const { applicationId, ...body } = input

          return request(jobAppApiPaths.applicationAttempts(applicationId), {
            body,
            method: 'POST',
          })
        },
        step(input) {
          const { applicationId, attemptId, ...body } = input

          return request(jobAppApiPaths.applicationAttemptSteps(applicationId, attemptId), {
            body,
            method: 'POST',
          })
        },
        complete(input) {
          const { applicationId, attemptId, ...body } = input

          return request(jobAppApiPaths.applicationAttemptComplete(applicationId, attemptId), {
            body,
            method: 'PATCH',
          })
        },
      },
    },
    scores: {
      record(input: ScoreInput) {
        return request(jobAppApiPaths.scores, {
          body: input,
          method: 'POST',
        })
      },
    },
    queue: {
      list(query) {
        return request(jobAppApiPaths.queue, {
          query: queueListQueryToSearchParams(query),
        })
      },
    },
    policy: {
      config: {
        get() {
          return request(jobAppApiPaths.policyConfig)
        },
        reset() {
          return request(jobAppApiPaths.policyConfigReset, {
            body: {},
            method: 'POST',
          })
        },
        update(patch) {
          return request(jobAppApiPaths.policyConfig, {
            body: patch,
            method: 'PATCH',
          })
        },
      },
      evidence: {
        list(query) {
          return request(jobAppApiPaths.policyEvidence, {
            query: policyEvidenceListQueryToSearchParams(query),
          })
        },
        record(input) {
          return request(jobAppApiPaths.policyEvidence, {
            body: input,
            method: 'POST',
          })
        },
      },
      evaluate: {
        application(input) {
          return request(jobAppApiPaths.policyEvaluateApplication, {
            body: input,
            method: 'POST',
          })
        },
        sourcingCandidate(input) {
          return request(jobAppApiPaths.policyEvaluateSourcingCandidate, {
            body: input,
            method: 'POST',
          })
        },
        runWindow(input) {
          return request(jobAppApiPaths.policyEvaluateRunWindow, {
            body: input,
            method: 'POST',
          })
        },
      },
    },
    profile: {
      get() {
        return request(jobAppApiPaths.profile)
      },
      update(input) {
        return request(jobAppApiPaths.profile, {
          body: input,
          method: 'PATCH',
        })
      },
      agentContext: {
        get() {
          return request(jobAppApiPaths.profileAgentContext)
        },
      },
    },
    runs: {
      list(query) {
        return request(jobAppApiPaths.runs, {
          query: workflowRunListQueryToSearchParams(query),
        })
      },
      start(input) {
        return request(jobAppApiPaths.runs, {
          body: input,
          method: 'POST',
        })
      },
      step(input) {
        const { workflowRunId, ...body } = input

        return request(jobAppApiPaths.runSteps(workflowRunId), {
          body,
          method: 'POST',
        })
      },
      complete(input) {
        const { workflowRunId, ...body } = input

        return request(jobAppApiPaths.runComplete(workflowRunId), {
          body,
          method: 'PATCH',
        })
      },
    },
    sourcing: {
      candidates: {
        process(input) {
          return request(jobAppApiPaths.sourcingCandidatesProcess, {
            body: input,
            method: 'POST',
          })
        },
      },
      findings: {
        list(query) {
          return request(jobAppApiPaths.sourcingFindings, {
            query: sourcingFindingListQueryToSearchParams(query),
          })
        },
        create(input) {
          return request(jobAppApiPaths.sourcingFindings, {
            body: input,
            method: 'POST',
          })
        },
        update(input) {
          const { findingId, ...body } = input

          return request(jobAppApiPaths.sourcingFinding(findingId), {
            body,
            method: 'PATCH',
          })
        },
        decide(input) {
          const { findingId, ...body } = input

          return request(jobAppApiPaths.sourcingFindingDecide(findingId), {
            body,
            method: 'POST',
          })
        },
        promote(input) {
          return request(jobAppApiPaths.sourcingFindingPromote(input.findingId), {
            body: {},
            method: 'POST',
          })
        },
      },
    },
  }
}

async function readResponseBody(response: Response) {
  const text = await response.text()

  if (!text) {
    return undefined
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

function responseMessage(body: unknown, fallback: string) {
  if (body && typeof body === 'object' && 'message' in body && typeof body.message === 'string') {
    return body.message
  }

  return fallback || 'Job App request failed'
}
