import { z } from 'zod'
import { valedictorianApiPaths } from '../api.js'
import type {
  WorkspaceCompaniesClient,
  WorkspaceCompanyAssignmentsClient,
} from '../company-client.js'
import {
  companyDuplicateCandidateRowSchema,
  companyDuplicateListInputSchema,
  companyDuplicatePageSchema,
  markCompaniesDistinctInputSchema,
  markCompaniesDistinctResultSchema,
  mergeCompaniesInputSchema,
  mergeCompaniesResultSchema,
} from '../company-duplicates.js'
import {
  addCompanyAliasInputSchema,
  archiveCompanyInputSchema,
  archiveCompanyResultSchema,
  createCompanyInputSchema,
  createCompanyResultSchema,
  removeCompanyAliasInputSchema,
  restoreCompanyInputSchema,
  restoreCompanyResultSchema,
  updateCompanyAliasInputSchema,
  updateCompanyInputSchema,
  updateCompanyNotesInputSchema,
  updateCompanyNotesResultSchema,
  updateCompanyResultSchema,
} from '../company-mutations.js'
import {
  companyDetailSchema,
  companyDirectoryListInputSchema,
  companyDirectoryPageSchema,
  companyMatchPreviewInputSchema,
  companyMatchPreviewPageSchema,
  companySearchInputSchema,
  companySearchPageSchema,
  workspaceCompanyLookupSchema,
} from '../company-query.js'
import {
  companyCapabilitySchema,
  type CompanyCommandFailure,
} from '../company-shared.js'
import {
  companyHistoryListInputSchema,
  companyHistoryPageSchema,
} from '../company-history.js'
import {
  companyAssignedJobListInputSchema,
  companyAssignedJobPageSchema,
  jobCompanyAssignmentPresentationSchema,
  reassignJobCompanyInputSchema,
  reassignJobCompanyResultSchema,
} from '../job-company-assignment.js'
import {
  ValedictorianProtocolError,
  parseValedictorianContractValue,
} from './http-client-error.js'

type CompanyRequest = <T>(path: string, options?: {
  body?: unknown
  method?: 'DELETE' | 'GET' | 'PATCH' | 'POST'
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

function assertWorkspace(inputWorkspaceId: string, workspaceId: string) {
  if (inputWorkspaceId !== workspaceId) throw new ValedictorianProtocolError()
}

function assertMutationCorrelation(
  result: { workspaceId: string; idempotencyKey: string },
  input: { workspaceId: string; idempotencyKey: string },
) {
  if (result.workspaceId !== input.workspaceId
    || result.idempotencyKey !== input.idempotencyKey) {
    throw new ValedictorianProtocolError()
  }
}

function assertStaleGuards(
  failure: CompanyCommandFailure,
  expected: {
    companies?: ReadonlyMap<string, number>
    assignment?: { jobId: string; revision: number }
    candidate?: { candidateId: string; revision: number }
  },
) {
  if (failure.kind !== 'stale_guard') return
  for (const guard of failure.recovery.guards) {
    if (guard.kind === 'company_revision') {
      if (expected.companies?.get(guard.companyId) !== guard.expectedRevision) {
        throw new ValedictorianProtocolError()
      }
    } else if (guard.kind === 'assignment_revision') {
      if (expected.assignment?.jobId !== guard.jobId
        || expected.assignment.revision !== guard.expectedRevision) {
        throw new ValedictorianProtocolError()
      }
    } else if (guard.kind === 'duplicate_candidate_revision') {
      if (expected.candidate?.candidateId !== guard.candidateId
        || expected.candidate.revision !== guard.expectedRevision) {
        throw new ValedictorianProtocolError()
      }
    }
  }
}

export function createCompanyHttpMethods({
  pathFor,
  request,
  workspaceId,
}: {
  pathFor: (path: string) => string
  request: CompanyRequest
  workspaceId: string
}): {
  companies: WorkspaceCompaniesClient
  companyAssignments: WorkspaceCompanyAssignmentsClient
} {
  const parse = <T>(schema: z.ZodType<T>, value: unknown) =>
    parseValedictorianContractValue(schema, value)

  async function companyMutation<
    Input extends {
      workspaceId: string
      companyId: string
      expectedCompanyRevision: number
      idempotencyKey: string
    },
    Result extends {
      workspaceId: string
      idempotencyKey: string
      status: string
      companyId?: string
      requestCompanyRevision?: number | null
      failure?: CompanyCommandFailure
    },
  >(
    input: Input,
    schema: z.ZodType<Result>,
    path: string,
    method: 'DELETE' | 'PATCH' | 'POST',
    omitted: string[] = ['workspaceId', 'companyId'],
  ) {
    assertWorkspace(input.workspaceId, workspaceId)
    const result = parse(schema, await request(pathFor(path), {
      body: bodyWithout(input, ...omitted),
      method,
    }))
    assertMutationCorrelation(result, input)
    if (result.companyId !== input.companyId
      || result.requestCompanyRevision !== input.expectedCompanyRevision) {
      throw new ValedictorianProtocolError()
    }
    if (result.status === 'blocked') {
      if (result.failure === undefined) throw new ValedictorianProtocolError()
      assertStaleGuards(result.failure, {
        companies: new Map([[input.companyId, input.expectedCompanyRevision]]),
      })
    }
    return result
  }

  const companies: WorkspaceCompaniesClient = {
    capability: {
      async get() {
        return parse(
          companyCapabilitySchema,
          await request(pathFor(valedictorianApiPaths.companyCapability)),
        )
      },
    },
    async create(input) {
      const parsed = createCompanyInputSchema.parse(input)
      assertWorkspace(parsed.workspaceId, workspaceId)
      const result = parse(
        createCompanyResultSchema,
        await request(pathFor(valedictorianApiPaths.companies), {
          body: bodyWithout(parsed, 'workspaceId'),
          method: 'POST',
        }),
      )
      assertMutationCorrelation(result, parsed)
      if (result.status === 'created') {
        if (result.requestCompanyRevision !== null
          || result.company.workspaceId !== parsed.workspaceId
          || result.company.displayName !== parsed.displayName
          || result.company.websiteUrl !== parsed.websiteUrl
          || result.company.notes !== parsed.notes) {
          throw new ValedictorianProtocolError()
        }
      }
      return result
    },
    async get(companyId) {
      const detail = parse(
        companyDetailSchema,
        await request(pathFor(valedictorianApiPaths.company(companyId))),
      )
      if (detail.lookup.requested.id !== companyId) throw new ValedictorianProtocolError()
      if (detail.lookup.requested.workspaceId !== workspaceId
        || detail.lookup.canonical.workspaceId !== workspaceId) {
        throw new ValedictorianProtocolError()
      }
      return detail
    },
    async lookup(companyId) {
      const lookup = parse(
        workspaceCompanyLookupSchema,
        await request(pathFor(valedictorianApiPaths.companyLookup(companyId))),
      )
      if (lookup.requested.id !== companyId) throw new ValedictorianProtocolError()
      if (lookup.requested.workspaceId !== workspaceId
        || lookup.canonical.workspaceId !== workspaceId) {
        throw new ValedictorianProtocolError()
      }
      return lookup
    },
    async search(input) {
      const parsed = companySearchInputSchema.parse(input)
      const result = parse(
        companySearchPageSchema,
        await request(pathFor(valedictorianApiPaths.companySearch), {
          query: listQuery(parsed),
        }),
      )
      if (parsed.scope === 'active'
        && result.items.some((company) => company.status !== 'active')) {
        throw new ValedictorianProtocolError()
      }
      return result
    },
    async previewMatches(input) {
      const parsed = companyMatchPreviewInputSchema.parse(input)
      return parse(
        companyMatchPreviewPageSchema,
        await request(pathFor(valedictorianApiPaths.companyMatchPreview), {
          body: parsed,
          method: 'POST',
        }),
      )
    },
    directory: {
      async list(input) {
        const parsed = companyDirectoryListInputSchema.parse(input)
        return parse(
          companyDirectoryPageSchema,
          await request(pathFor(valedictorianApiPaths.companies), {
            query: listQuery(parsed),
          }),
        )
      },
    },
    async update(input) {
      const parsed = updateCompanyInputSchema.parse(input)
      const result = await companyMutation(
        parsed,
        updateCompanyResultSchema,
        valedictorianApiPaths.company(parsed.companyId),
        'PATCH',
      )
      if (result.status === 'updated'
        && ((parsed.displayName !== undefined
          && result.company.displayName !== parsed.displayName)
          || (parsed.websiteUrl !== undefined
            && result.company.websiteUrl !== parsed.websiteUrl))) {
        throw new ValedictorianProtocolError()
      }
      return result
    },
    notes: {
      async update(input) {
        const parsed = updateCompanyNotesInputSchema.parse(input)
        const result = await companyMutation(
          parsed,
          updateCompanyNotesResultSchema,
          valedictorianApiPaths.companyNotes(parsed.companyId),
          'PATCH',
        )
        if (result.status === 'updated' && result.company.notes !== parsed.notes) {
          throw new ValedictorianProtocolError()
        }
        return result
      },
    },
    aliases: {
      async add(input) {
        const parsed = addCompanyAliasInputSchema.parse(input)
        const result = await companyMutation(
          parsed,
          updateCompanyResultSchema,
          valedictorianApiPaths.companyAliases(parsed.companyId),
          'POST',
        )
        if (result.status === 'updated'
          && !result.company.aliases.some((alias) => alias.value === parsed.value)) {
          throw new ValedictorianProtocolError()
        }
        return result
      },
      async update(input) {
        const parsed = updateCompanyAliasInputSchema.parse(input)
        const result = await companyMutation(
          parsed,
          updateCompanyResultSchema,
          valedictorianApiPaths.companyAlias(parsed.companyId, parsed.aliasId),
          'PATCH',
          ['workspaceId', 'companyId', 'aliasId'],
        )
        if (result.status === 'updated'
          && !result.company.aliases.some((alias) =>
            alias.id === parsed.aliasId && alias.value === parsed.value)) {
          throw new ValedictorianProtocolError()
        }
        return result
      },
      async remove(input) {
        const parsed = removeCompanyAliasInputSchema.parse(input)
        const result = await companyMutation(
          parsed,
          updateCompanyResultSchema,
          valedictorianApiPaths.companyAlias(parsed.companyId, parsed.aliasId),
          'DELETE',
          ['workspaceId', 'companyId', 'aliasId'],
        )
        if (result.status === 'updated'
          && result.company.aliases.some((alias) => alias.id === parsed.aliasId)) {
          throw new ValedictorianProtocolError()
        }
        return result
      },
    },
    async archive(input) {
      const parsed = archiveCompanyInputSchema.parse(input)
      return companyMutation(
        parsed,
        archiveCompanyResultSchema,
        valedictorianApiPaths.companyArchive(parsed.companyId),
        'POST',
      )
    },
    async restore(input) {
      const parsed = restoreCompanyInputSchema.parse(input)
      return companyMutation(
        parsed,
        restoreCompanyResultSchema,
        valedictorianApiPaths.companyRestore(parsed.companyId),
        'POST',
      )
    },
    duplicates: {
      async list(input) {
        const parsed = companyDuplicateListInputSchema.parse(input)
        return parse(
          companyDuplicatePageSchema,
          await request(pathFor(valedictorianApiPaths.companyDuplicates), {
            query: listQuery(parsed),
          }),
        )
      },
      async get(candidateId) {
        const candidate = parse(
          companyDuplicateCandidateRowSchema,
          await request(pathFor(valedictorianApiPaths.companyDuplicate(candidateId))),
        )
        if (candidate.candidateId !== candidateId) throw new ValedictorianProtocolError()
        return candidate
      },
      async markDistinct(input) {
        const parsed = markCompaniesDistinctInputSchema.parse(input)
        assertWorkspace(parsed.workspaceId, workspaceId)
        const result = parse(
          markCompaniesDistinctResultSchema,
          await request(pathFor(
            valedictorianApiPaths.companyDuplicateMarkDistinct(parsed.candidateId),
          ), {
            body: bodyWithout(parsed, 'workspaceId', 'candidateId'),
            method: 'POST',
          }),
        )
        assertMutationCorrelation(result, parsed)
        if (result.candidateId !== parsed.candidateId
          || result.requestCandidateRevision !== parsed.expectedCandidateRevision
          || result.leftCompanyId !== parsed.leftCompanyId
          || result.requestLeftCompanyRevision !== parsed.expectedLeftCompanyRevision
          || result.rightCompanyId !== parsed.rightCompanyId
          || result.requestRightCompanyRevision !== parsed.expectedRightCompanyRevision) {
          throw new ValedictorianProtocolError()
        }
        if (result.status === 'blocked') {
          assertStaleGuards(result.failure, {
            candidate: {
              candidateId: parsed.candidateId,
              revision: parsed.expectedCandidateRevision,
            },
            companies: new Map([
              [parsed.leftCompanyId, parsed.expectedLeftCompanyRevision],
              [parsed.rightCompanyId, parsed.expectedRightCompanyRevision],
            ]),
          })
        }
        return result
      },
      async merge(input) {
        const parsed = mergeCompaniesInputSchema.parse(input)
        assertWorkspace(parsed.workspaceId, workspaceId)
        const result = parse(
          mergeCompaniesResultSchema,
          await request(pathFor(valedictorianApiPaths.companyMerge), {
            body: bodyWithout(parsed, 'workspaceId'),
            method: 'POST',
          }),
        )
        assertMutationCorrelation(result, parsed)
        const winnerId = result.status === 'merged'
          ? result.canonical.id : result.winnerCompanyId
        const loserId = result.status === 'merged' ? result.merged.id : result.loserCompanyId
        if (winnerId !== parsed.winnerCompanyId
          || loserId !== parsed.loserCompanyId
          || result.requestWinnerCompanyRevision !== parsed.expectedWinnerCompanyRevision
          || result.requestLoserCompanyRevision !== parsed.expectedLoserCompanyRevision) {
          throw new ValedictorianProtocolError()
        }
        if (result.status === 'blocked') {
          assertStaleGuards(result.failure, {
            companies: new Map([
              [parsed.winnerCompanyId, parsed.expectedWinnerCompanyRevision],
              [parsed.loserCompanyId, parsed.expectedLoserCompanyRevision],
            ]),
          })
        }
        return result
      },
    },
    assignedJobs: {
      async list(companyId, input) {
        const parsed = companyAssignedJobListInputSchema.parse(input)
        const page = parse(
          companyAssignedJobPageSchema,
          await request(pathFor(valedictorianApiPaths.companyAssignedJobs(companyId)), {
            query: listQuery(parsed),
          }),
        )
        if (page.items.some((item) => item.workspaceCompany.companyId !== companyId)) {
          throw new ValedictorianProtocolError()
        }
        return page
      },
    },
    history: {
      async list(companyId, input) {
        const parsed = companyHistoryListInputSchema.parse(input)
        const page = parse(
          companyHistoryPageSchema,
          await request(pathFor(valedictorianApiPaths.companyHistory(companyId)), {
            query: listQuery(parsed),
          }),
        )
        if (page.items.some((event) =>
          event.companyId !== companyId || event.workspaceId !== workspaceId)) {
          throw new ValedictorianProtocolError()
        }
        return page
      },
    },
  }

  const companyAssignments: WorkspaceCompanyAssignmentsClient = {
    async get(jobId) {
      const assignment = parse(
        jobCompanyAssignmentPresentationSchema,
        await request(pathFor(valedictorianApiPaths.jobCompanyAssignment(jobId))),
      )
      if (assignment.jobId !== jobId) throw new ValedictorianProtocolError()
      return assignment
    },
    async reassign(input) {
      const parsed = reassignJobCompanyInputSchema.parse(input)
      assertWorkspace(parsed.workspaceId, workspaceId)
      const result = parse(
        reassignJobCompanyResultSchema,
        await request(pathFor(valedictorianApiPaths.jobCompanyReassignment(parsed.jobId)), {
          body: bodyWithout(parsed, 'workspaceId', 'jobId'),
          method: 'POST',
        }),
      )
      assertMutationCorrelation(result, parsed)
      if (result.jobId !== parsed.jobId
        || result.requestAssignmentRevision !== parsed.expectedAssignmentRevision
        || result.requestDestinationCompanyRevision !== parsed.expectedDestinationCompanyRevision
        || (result.status === 'reassigned'
          ? result.assignment.workspaceCompany.companyId !== parsed.destinationCompanyId
            || result.assignment.workspaceCompany.revision
              !== parsed.expectedDestinationCompanyRevision
          : result.destinationCompanyId !== parsed.destinationCompanyId)) {
        throw new ValedictorianProtocolError()
      }
      if (result.status === 'blocked') {
        assertStaleGuards(result.failure, {
          assignment: {
            jobId: parsed.jobId,
            revision: parsed.expectedAssignmentRevision,
          },
          companies: new Map([[
            parsed.destinationCompanyId,
            parsed.expectedDestinationCompanyRevision,
          ]]),
        })
      }
      return result
    },
  }

  return { companies, companyAssignments }
}
