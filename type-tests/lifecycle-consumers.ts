import type {
  Application,
  Capture,
  CorrectCaptureInput,
  CorrectJobFactsInput,
  CreateApplicationInput,
  CreateCaptureInput,
  CreateJobInput,
  CreateOpportunityInput,
  Job,
  Opportunity,
  PromoteCaptureToJobInput,
  UpdateOpportunityDispositionInput,
  UpdatePursuitApplicationStatusInput,
  ValedictorianWorkspaceClient,
} from '../src/index.js'
import { jobIdSchema } from '../src/index.js'
import { applicationIdSchema, opportunityIdSchema } from '../src/index.js'

type Assert<T extends true> = T
type IsExactly<A, B> = (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false

type PublicExports = keyof typeof import('../src/index.js')
type NoRawRecordAlias = Assert<IsExactly<Extract<PublicExports, 'RawSourceRecord'>, never>>
type NoCandidateAlias = Assert<IsExactly<Extract<PublicExports, 'CanonicalCandidate'>, never>>
type NoFindingAlias = Assert<IsExactly<Extract<PublicExports, 'SourcingFinding'>, never>>
type NoRawDetailErrorCode = Assert<IsExactly<
  Extract<PublicExports, 'invalidPersistedRawDetailErrorCode'>,
  never
>>
type NoRawDetailErrorBody = Assert<IsExactly<
  Extract<PublicExports, 'InvalidPersistedRawDetailErrorBody'>,
  never
>>
type NoNormalizationAttempt = Assert<IsExactly<
  Extract<PublicExports, 'NormalizationAttempt'>,
  never
>>
type NoSourcingWorkspaceAlias = Assert<IsExactly<Extract<keyof ValedictorianWorkspaceClient, 'sourcing'>, never>>
type CaptureMethodsAreComplete = Assert<IsExactly<
  keyof ValedictorianWorkspaceClient['captures'],
  'list' | 'get' | 'create' | 'correct' | 'remove' | 'restore' | 'history' | 'promoteToJob'
>>
type JobMethodsAreComplete = Assert<IsExactly<
  keyof ValedictorianWorkspaceClient['jobs'],
  'list' | 'get' | 'create' | 'correctFacts' | 'updateAvailability' | 'externalIdentities' |
  'remove' | 'restore' | 'history' | 'promoteToOpportunity'
>>
type OpportunityMethodsAreComplete = Assert<IsExactly<
  keyof ValedictorianWorkspaceClient['opportunities'],
  'list' | 'get' | 'create' | 'updateEvaluation' | 'updateDisposition' | 'remove' | 'restore' |
  'history' | 'promoteToApplication'
>>
type ApplicationMethodsAreComplete = Assert<IsExactly<
  keyof ValedictorianWorkspaceClient['applications'],
  'list' | 'get' | 'create' | 'updateStatus' | 'updateCompany' | 'updateSource' | 'links' |
  'refreshSnapshot' | 'remove' | 'restore' | 'history' | 'attempts' | 'events'
>>

declare const workspace: ValedictorianWorkspaceClient
declare const createCaptureInput: CreateCaptureInput
declare const correctCaptureInput: CorrectCaptureInput
declare const createJobInput: CreateJobInput
declare const correctJobFactsInput: CorrectJobFactsInput
declare const createOpportunityInput: CreateOpportunityInput
declare const updateOpportunityDispositionInput: UpdateOpportunityDispositionInput
declare const createApplicationInput: CreateApplicationInput
declare const updateApplicationStatusInput: UpdatePursuitApplicationStatusInput

async function appConsumer() {
  const opportunities: Opportunity[] = (await workspace.opportunities.list({ disposition: 'reviewing' })).items
  const pursuit: Application | null = await workspace.applications.get(
    '018f6f88-4c35-7a62-9f2e-318dd8e164c7',
  )
  await workspace.applications.updateCompany({
    applicationId: '018f6f88-4c35-7a62-9f2e-318dd8e164c7',
    expectedRevision: 1,
    actor: { id: 'user-7', type: 'user' },
    companyName: 'Northstar Robotics, Inc.',
    rationale: 'Use the legal employer name shown in the application portal.',
  })
  return { opportunities, pursuit }
}

async function cliConsumer(input: PromoteCaptureToJobInput) {
  const captures: Capture[] = (await workspace.captures.list({ limit: 25 })).items
  const promotion = await workspace.captures.promoteToJob(input)
  const job: Job | null = promotion.status === 'promoted' ? promotion.resource : null
  return { captures, job }
}

async function directCreateConsumers() {
  const jobId = jobIdSchema.parse('018f6f88-4c35-7a62-9f2e-318dd8e164c5')
  const opportunityId = opportunityIdSchema.parse('opportunity-1')
  const applicationId = applicationIdSchema.parse('application-1')
  const actor = { id: 'user-7', type: 'user' as const }
  const jobDuplicate: CreateJobInput['duplicateResolution'] = { action: 'attach', targetResourceId: jobId }
  const opportunityDuplicate: CreateOpportunityInput['duplicateResolution'] = {
    action: 'attach', targetResourceId: opportunityId,
  }
  const applicationDuplicate: CreateApplicationInput['duplicateResolution'] = {
    action: 'attach', targetResourceId: applicationId,
  }
  // @ts-expect-error Job duplicate targets require a parsed UUIDv7 JobId.
  const invalidJobDuplicate: CreateJobInput['duplicateResolution'] = { action: 'attach', targetResourceId: 'job-1' }
  // @ts-expect-error Opportunity duplicate targets require a parsed OpportunityId.
  const invalidOpportunityDuplicate: CreateOpportunityInput['duplicateResolution'] = { action: 'attach', targetResourceId: 'opportunity-1' }
  // @ts-expect-error Application duplicate targets require a parsed ApplicationId.
  const invalidApplicationDuplicate: CreateApplicationInput['duplicateResolution'] = { action: 'attach', targetResourceId: 'application-1' }

  await workspace.captures.get('capture-1')
  await workspace.captures.create(createCaptureInput)
  await workspace.captures.correct(correctCaptureInput)
  await workspace.captures.remove({ id: 'capture-1', choice: 'reject_if_dependents', actor, rationale: 'Duplicate.' })
  await workspace.captures.restore({ id: 'capture-1', actor, rationale: 'Removal was mistaken.' })
  await workspace.captures.history({ id: 'capture-1' })

  await workspace.jobs.get(jobId)
  await workspace.jobs.create(createJobInput)
  await workspace.jobs.correctFacts(correctJobFactsInput)
  await workspace.jobs.remove({ id: jobId, choice: 'reject_if_dependents', actor, rationale: 'Duplicate.' })
  await workspace.jobs.restore({ id: jobId, actor, rationale: 'Removal was mistaken.' })
  await workspace.jobs.history({ id: jobId })

  await workspace.opportunities.get('opportunity-1')
  await workspace.opportunities.create(createOpportunityInput)
  await workspace.opportunities.updateDisposition(updateOpportunityDispositionInput)
  await workspace.opportunities.remove({ id: 'opportunity-1', choice: 'reject_if_dependents', actor, rationale: 'Duplicate.' })
  await workspace.opportunities.restore({ id: 'opportunity-1', actor, rationale: 'Removal was mistaken.' })
  await workspace.opportunities.history({ id: 'opportunity-1' })

  await workspace.applications.get('application-1')
  await workspace.applications.create(createApplicationInput)
  await workspace.applications.updateStatus(updateApplicationStatusInput)
  await workspace.applications.remove({ id: 'application-1', choice: 'reject_if_dependents', actor, rationale: 'Duplicate.' })
  await workspace.applications.restore({ id: 'application-1', actor, rationale: 'Removal was mistaken.' })
  await workspace.applications.history({ id: 'application-1' })
  await workspace.applications.attempts.list({ applicationId: 'application-1' })
  await workspace.applications.events.list({ applicationId: 'application-1' })
  // @ts-expect-error Public Job reads require a parsed UUIDv7 JobId.
  await workspace.jobs.get('job-1')
  void jobDuplicate
  void opportunityDuplicate
  void applicationDuplicate
  void invalidJobDuplicate
  void invalidOpportunityDuplicate
  void invalidApplicationDuplicate
}

void appConsumer
void cliConsumer
void directCreateConsumers
void (null as unknown as NoRawRecordAlias)
void (null as unknown as NoCandidateAlias)
void (null as unknown as NoFindingAlias)
void (null as unknown as NoRawDetailErrorCode)
void (null as unknown as NoRawDetailErrorBody)
void (null as unknown as NoNormalizationAttempt)
void (null as unknown as NoSourcingWorkspaceAlias)
void (null as unknown as CaptureMethodsAreComplete)
void (null as unknown as JobMethodsAreComplete)
void (null as unknown as OpportunityMethodsAreComplete)
void (null as unknown as ApplicationMethodsAreComplete)
