import type {
  Application,
  Capture,
  Job,
  Opportunity,
  PromoteCaptureToJobInput,
  ValedictorianWorkspaceClient,
} from '../src/index.js'

type Assert<T extends true> = T
type IsExactly<A, B> = (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false

type PublicExports = keyof typeof import('../src/index.js')
type NoRawRecordAlias = Assert<IsExactly<Extract<PublicExports, 'RawSourceRecord'>, never>>
type NoCandidateAlias = Assert<IsExactly<Extract<PublicExports, 'CanonicalCandidate'>, never>>
type NoFindingAlias = Assert<IsExactly<Extract<PublicExports, 'SourcingFinding'>, never>>
type NoSourcingWorkspaceAlias = Assert<IsExactly<Extract<keyof ValedictorianWorkspaceClient, 'sourcing'>, never>>
type CaptureMethodsAreComplete = Assert<IsExactly<
  keyof ValedictorianWorkspaceClient['captures'],
  'list' | 'get' | 'create' | 'correct' | 'remove' | 'restore' | 'history' | 'promoteToJob'
>>
type JobMethodsAreComplete = Assert<IsExactly<
  keyof ValedictorianWorkspaceClient['jobs'],
  'list' | 'get' | 'correctFacts' | 'updateAvailability' | 'externalIdentities' |
  'remove' | 'restore' | 'history' | 'promoteToOpportunity'
>>
type OpportunityMethodsAreComplete = Assert<IsExactly<
  keyof ValedictorianWorkspaceClient['opportunities'],
  'list' | 'get' | 'updateEvaluation' | 'updateDisposition' | 'remove' | 'restore' |
  'history' | 'promoteToApplication'
>>
type ApplicationMethodsAreComplete = Assert<IsExactly<
  keyof ValedictorianWorkspaceClient['applications'],
  'list' | 'get' | 'updateStatus' | 'updateCompany' | 'updateSource' | 'links' |
  'refreshSnapshot' | 'remove' | 'restore' | 'history'
>>

declare const workspace: ValedictorianWorkspaceClient

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

void appConsumer
void cliConsumer
void (null as unknown as NoRawRecordAlias)
void (null as unknown as NoCandidateAlias)
void (null as unknown as NoFindingAlias)
void (null as unknown as NoSourcingWorkspaceAlias)
void (null as unknown as CaptureMethodsAreComplete)
void (null as unknown as JobMethodsAreComplete)
void (null as unknown as OpportunityMethodsAreComplete)
void (null as unknown as ApplicationMethodsAreComplete)
