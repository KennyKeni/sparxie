import { defaultValedictorianApiBaseUrl, valedictorianApiPaths } from './api.js'
import type {
  ApplicationEventsListInput,
  ApplicationAttemptsListInput,
  ApplicationLinksListInput,
  ApplicationListQuery,
  StatusUpdateInput,
} from './application.js'
import type { ValedictorianClient, ValedictorianWorkspaceClient } from './client.js'
import type { PolicyEvidenceListInput } from './policy.js'
import type { ActionQueueListQuery } from './action-queue.js'
import type { ScoreInput } from './scoring.js'
import type { SourcingFindingsListInput } from './sourcing.js'
import type { WorkflowRunsListInput } from './workflow-run.js'

export interface HttpValedictorianClientOptions {
  baseUrl?: string
  token?: string
  fetch?: typeof fetch
}

export class ValedictorianHttpError extends Error {
  readonly status: number
  readonly body: unknown

  constructor({ body, message, status }: { body: unknown; message: string; status: number }) {
    super(message)
    this.name = 'ValedictorianHttpError'
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

const actionQueueListQueryParamKeys = ['actionBucket', 'limit', 'offset'] as const
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

export function actionQueueListQueryToSearchParams(query: ActionQueueListQuery = {}) {
  const params = new URLSearchParams()

  for (const key of actionQueueListQueryParamKeys) {
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

export function createHttpValedictorianClient({
  baseUrl = defaultValedictorianApiBaseUrl,
  fetch: fetchImplementation = fetch,
  token,
}: HttpValedictorianClientOptions = {}): ValedictorianClient {
  async function request<T>(
    path: string,
    options: {
      body?: unknown
      method?: 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT'
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
      throw new ValedictorianHttpError({
        body,
        message: responseMessage(body, response.statusText),
        status: response.status,
      })
    }

    return body as T
  }

  function workspacePath(workspaceId: string, path: string) {
    return `/v1/workspaces/${encodeURIComponent(workspaceId)}${path.slice('/v1'.length)}`
  }

  function createWorkspaceClient(workspaceId: string): ValedictorianWorkspaceClient {
    const pathFor = (path: string) => workspacePath(workspaceId, path)

    return {
    applications: {
      list(query) {
        return request(pathFor(valedictorianApiPaths.applications), {
          query: applicationListQueryToSearchParams(query),
        })
      },
      async get(id) {
        try {
          return await request(pathFor(valedictorianApiPaths.application(id)))
        } catch (error) {
          if (error instanceof ValedictorianHttpError && error.status === 404) {
            return null
          }

          throw error
        }
      },
      create(input) {
        return request(pathFor(valedictorianApiPaths.applications), {
          body: input,
          method: 'POST',
        })
      },
      update(input) {
        const { applicationId, ...body } = input

        return request(pathFor(valedictorianApiPaths.application(applicationId)), {
          body,
          method: 'PATCH',
        })
      },
      updateStatus(input: StatusUpdateInput) {
        return request(pathFor(valedictorianApiPaths.applicationStatus(input.applicationId)), {
          body: {
            status: input.status,
            notes: input.notes,
          },
          method: 'PATCH',
        })
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
        update(input) {
          const { applicationId, ...body } = input

          return request(pathFor(valedictorianApiPaths.applicationWorkflow(applicationId)), {
            body,
            method: 'PATCH',
          })
        },
      },
      notes: {
        append(input) {
          return request(pathFor(valedictorianApiPaths.applicationNotes(input.applicationId)), {
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

          return request(pathFor(valedictorianApiPaths.applicationLinks(applicationId)), {
            query: applicationLinksListQueryToSearchParams(query),
          })
        },
        create(input) {
          const { applicationId, ...body } = input

          return request(pathFor(valedictorianApiPaths.applicationLinks(applicationId)), {
            body,
            method: 'POST',
          })
        },
        update(input) {
          const { applicationId, linkId, ...body } = input

          return request(pathFor(valedictorianApiPaths.applicationLink(applicationId, linkId)), {
            body,
            method: 'PATCH',
          })
        },
      },
      events: {
        list(input) {
          const { applicationId, ...query } = input

          return request(pathFor(valedictorianApiPaths.applicationEvents(applicationId)), {
            query: applicationEventsListQueryToSearchParams(query),
          })
        },
      },
      attempts: {
        list(input) {
          const { applicationId, ...query } = input

          return request(pathFor(valedictorianApiPaths.applicationAttempts(applicationId)), {
            query: applicationAttemptsListQueryToSearchParams(query),
          })
        },
        start(input) {
          const { applicationId, ...body } = input

          return request(pathFor(valedictorianApiPaths.applicationAttempts(applicationId)), {
            body,
            method: 'POST',
          })
        },
        step(input) {
          const { applicationId, attemptId, ...body } = input

          return request(pathFor(valedictorianApiPaths.applicationAttemptSteps(applicationId, attemptId)), {
            body,
            method: 'POST',
          })
        },
        complete(input) {
          const { applicationId, attemptId, ...body } = input

          return request(pathFor(valedictorianApiPaths.applicationAttemptComplete(applicationId, attemptId)), {
            body,
            method: 'PATCH',
          })
        },
      },
    },
    scores: {
      record(input: ScoreInput) {
        return request(pathFor(valedictorianApiPaths.scores), {
          body: input,
          method: 'POST',
        })
      },
    },
    actionQueue: {
      list(query) {
        return request(pathFor(valedictorianApiPaths.actionQueue), {
          query: actionQueueListQueryToSearchParams(query),
        })
      },
    },
    policy: {
      config: {
        get() {
          return request(pathFor(valedictorianApiPaths.policyConfig))
        },
        reset() {
          return request(pathFor(valedictorianApiPaths.policyConfigReset), {
            body: {},
            method: 'POST',
          })
        },
        update(patch) {
          return request(pathFor(valedictorianApiPaths.policyConfig), {
            body: patch,
            method: 'PATCH',
          })
        },
      },
      evidence: {
        list(query) {
          return request(pathFor(valedictorianApiPaths.policyEvidence), {
            query: policyEvidenceListQueryToSearchParams(query),
          })
        },
        record(input) {
          return request(pathFor(valedictorianApiPaths.policyEvidence), {
            body: input,
            method: 'POST',
          })
        },
      },
      evaluate: {
        application(input) {
          return request(pathFor(valedictorianApiPaths.policyEvaluateApplication), {
            body: input,
            method: 'POST',
          })
        },
        sourcingCandidate(input) {
          return request(pathFor(valedictorianApiPaths.policyEvaluateSourcingCandidate), {
            body: input,
            method: 'POST',
          })
        },
        runWindow(input) {
          return request(pathFor(valedictorianApiPaths.policyEvaluateRunWindow), {
            body: input,
            method: 'POST',
          })
        },
      },
    },
    profile: {
      get() {
        return request(pathFor(valedictorianApiPaths.profile))
      },
      update(input) {
        return request(pathFor(valedictorianApiPaths.profile), {
          body: input,
          method: 'PATCH',
        })
      },
      agentContext: {
        get() {
          return request(pathFor(valedictorianApiPaths.profileAgentContext))
        },
      },
      sensitive: {
        get() {
          return request(pathFor(valedictorianApiPaths.profileSensitive))
        },
        update(input) {
          return request(pathFor(valedictorianApiPaths.profileSensitive), {
            body: input,
            method: 'PATCH',
          })
        },
      },
    },
    secrets: {
      delete(key) {
        return request(pathFor(valedictorianApiPaths.secret(key)), {
          method: 'DELETE',
        })
      },
      list() {
        return request(pathFor(valedictorianApiPaths.secrets))
      },
      upsert(input) {
        const { key, ...body } = input

        return request(pathFor(valedictorianApiPaths.secret(key)), {
          body,
          method: 'PUT',
        })
      },
    },
    runs: {
      list(query) {
        return request(pathFor(valedictorianApiPaths.runs), {
          query: workflowRunListQueryToSearchParams(query),
        })
      },
      start(input) {
        return request(pathFor(valedictorianApiPaths.runs), {
          body: input,
          method: 'POST',
        })
      },
      step(input) {
        const { workflowRunId, ...body } = input

        return request(pathFor(valedictorianApiPaths.runSteps(workflowRunId)), {
          body,
          method: 'POST',
        })
      },
      complete(input) {
        const { workflowRunId, ...body } = input

        return request(pathFor(valedictorianApiPaths.runComplete(workflowRunId)), {
          body,
          method: 'PATCH',
        })
      },
    },
    sourcing: {
      candidates: {
        process(input) {
          return request(pathFor(valedictorianApiPaths.sourcingCandidatesProcess), {
            body: input,
            method: 'POST',
          })
        },
      },
      findings: {
        list(query) {
          return request(pathFor(valedictorianApiPaths.sourcingFindings), {
            query: sourcingFindingListQueryToSearchParams(query),
          })
        },
        create(input) {
          return request(pathFor(valedictorianApiPaths.sourcingFindings), {
            body: input,
            method: 'POST',
          })
        },
        update(input) {
          const { findingId, ...body } = input

          return request(pathFor(valedictorianApiPaths.sourcingFinding(findingId)), {
            body,
            method: 'PATCH',
          })
        },
        decide(input) {
          const { findingId, ...body } = input

          return request(pathFor(valedictorianApiPaths.sourcingFindingDecide(findingId)), {
            body,
            method: 'POST',
          })
        },
        promote(input) {
          return request(pathFor(valedictorianApiPaths.sourcingFindingPromote(input.findingId)), {
            body: {},
            method: 'POST',
          })
        },
      },
    },
  }
  }

  return {
    capabilities: {
      get() {
        return request(valedictorianApiPaths.capabilities)
      },
    },
    forWorkspace(workspaceId) {
      return createWorkspaceClient(workspaceId)
    },
    health: {
      get() {
        return request(valedictorianApiPaths.health)
      },
    },
    workspaces: {
      create(input) {
        return request(valedictorianApiPaths.workspaceCreate, {
          body: input,
          method: 'POST',
        })
      },
      list() {
        return request(valedictorianApiPaths.workspaces)
      },
      open(input) {
        return request(valedictorianApiPaths.workspaceOpen, {
          body: input,
          method: 'POST',
        })
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

  return fallback || 'Valedictorian request failed'
}
