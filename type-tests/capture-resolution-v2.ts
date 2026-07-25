import {
  createHttpValedictorianClient,
  type CaptureResolutionV2WorkspaceClient,
  type JobDestinationV2,
  type JobFactsV2,
  type ValedictorianClient,
  type ValedictorianClientV2,
  type ValedictorianWorkspaceClient,
  type ValedictorianWorkspaceClientV2,
} from '../src/index.js'

type Assert<T extends true> = T
type IsExactly<A, B> = (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false
type PublicSdk = typeof import('../src/index.js')

type VersionIsTwo = Assert<IsExactly<PublicSdk['captureResolutionV2ContractVersion'], 2>>
type V2ClientMethods = Assert<IsExactly<
  keyof CaptureResolutionV2WorkspaceClient,
  'list' | 'get' | 'complete'
>>
type LegacyWorkspaceHasNoV2Member = Assert<IsExactly<
  Extract<keyof ValedictorianWorkspaceClient, 'captureResolutionV2'>,
  never
>>
type WorkspacePublishesV2Client = Assert<IsExactly<
  ValedictorianWorkspaceClientV2['captureResolutionV2'],
  CaptureResolutionV2WorkspaceClient
>>
type V2AddsOnlyV2Client = Assert<IsExactly<
  Exclude<keyof ValedictorianWorkspaceClientV2, keyof ValedictorianWorkspaceClient>,
  'captureResolutionV2'
>>
type V2ClientNarrowsWorkspace = Assert<IsExactly<
  ReturnType<ValedictorianClientV2['forWorkspace']>,
  ValedictorianWorkspaceClientV2
>>
type HttpFactoryReturnsV2Client = Assert<IsExactly<
  ReturnType<typeof createHttpValedictorianClient>,
  ValedictorianClientV2
>>

const destination: JobDestinationV2 = { url: 'https://jobs.example/search/448' }
const classifiedDestination: JobDestinationV2 = {
  // @ts-expect-error URL-only destinations do not accept an ownership class.
  class: 'employer_or_ats',
  url: 'https://jobs.example/search/448',
}

declare const facts: JobFactsV2
declare const client: CaptureResolutionV2WorkspaceClient
declare const legacyWorkspaceImplementer:
  Omit<ValedictorianWorkspaceClientV2, 'captureResolutionV2'>
declare const legacyRootImplementer: ValedictorianClient
declare const factoryClient: ReturnType<typeof createHttpValedictorianClient>

const legacyWorkspaceStillImplementsV1: ValedictorianWorkspaceClient = legacyWorkspaceImplementer
const legacyRootStillImplementsV1: ValedictorianClient = legacyRootImplementer
const factoryV2Client: CaptureResolutionV2WorkspaceClient =
  factoryClient.forWorkspace('workspace-1').captureResolutionV2

// @ts-expect-error Existing v1 client implementers are not widened with v2.
void legacyWorkspaceStillImplementsV1.captureResolutionV2

void destination
void classifiedDestination
void facts
void client
void legacyRootStillImplementsV1
void factoryV2Client
void (null as unknown as VersionIsTwo)
void (null as unknown as V2ClientMethods)
void (null as unknown as LegacyWorkspaceHasNoV2Member)
void (null as unknown as WorkspacePublishesV2Client)
void (null as unknown as V2AddsOnlyV2Client)
void (null as unknown as V2ClientNarrowsWorkspace)
void (null as unknown as HttpFactoryReturnsV2Client)
