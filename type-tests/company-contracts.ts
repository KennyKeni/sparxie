import type {
  ArchiveCompanyResult,
  CompanyAssignedJobCursor,
  CompanyAssignedJobFilter,
  CompanyAssignedJobPage,
  CompanyAssignedJobSort,
  CompanyCapability,
  CompanyCommandFailure,
  CompanyDirectoryCursor,
  CompanyDirectoryFilter,
  CompanyDirectoryPage,
  CompanyDirectorySort,
  CompanyDirectoryStatus,
  CompanyDuplicateCursor,
  CompanyDuplicateFilter,
  CompanyDuplicatePage,
  CompanyDuplicateReviewDecision,
  CompanyDuplicateSort,
  CompanyDuplicateStatus,
  CompanyHistoryCursor,
  CompanyHistoryChangedField,
  CompanyHistoryEvent,
  CompanyHistoryEventKind,
  CompanyHistoryFilter,
  CompanyHistoryPage,
  CompanyHistorySort,
  CompanyMatchReasonCode,
  CompanySearchResult,
  CompanySearchScope,
  CompanyStaleGuard,
  CompanyStatus,
  CreateCompanyResult,
  MarkCompaniesDistinctResult,
  MergeCompaniesInput,
  MergeCompaniesResult,
  ReassignJobCompanyResult,
  RestoreCompanyResult,
  UpdateCompanyNotesResult,
  UpdateCompanyResult,
  ValedictorianWorkspaceClient,
  WorkspaceCompaniesClient,
  WorkspaceCompanyAssignmentsClient,
} from '../src/index.js'

type Assert<T extends true> = T
type IsExactly<A, B> = (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false
type IsAssignable<A, B> = A extends B ? true : false
type PublicSdk = typeof import('../src/index.js')

type CompanyVersionIsOne = Assert<IsExactly<
  PublicSdk['workspaceCompanyContractVersion'],
  1
>>
type AssignmentVersionIsOne = Assert<IsExactly<
  PublicSdk['jobCompanyAssignmentContractVersion'],
  1
>>
type HistoryVersionIsOne = Assert<IsExactly<
  PublicSdk['companyHistoryContractVersion'],
  1
>>
type CapabilityStatusesAreClosed = Assert<IsExactly<
  CompanyCapability['status'],
  'migrating' | 'blocked' | 'ready'
>>
type CompanyStatusesAreClosed = Assert<IsExactly<
  CompanyStatus,
  'active' | 'archived' | 'merged'
>>
type SearchScopesAreClosed = Assert<IsExactly<
  CompanySearchScope,
  'active' | 'active_and_archived'
>>
type SearchStatusesAreClosed = Assert<IsExactly<
  CompanySearchResult['status'],
  'active' | 'archived'
>>
type MatchReasonsAreClosed = Assert<IsExactly<
  CompanyMatchReasonCode,
  'normalized_name_similarity' | 'alias_similarity' | 'same_declared_domain'
>>
type DirectoryFiltersAreClosed = Assert<IsExactly<
  CompanyDirectoryFilter,
  'all' | 'active' | 'archived' | 'merged'
>>
type DirectorySortsAreClosed = Assert<IsExactly<
  CompanyDirectorySort,
  'display_name_asc'
>>
type DirectoryStatusesAreClosed = Assert<IsExactly<
  CompanyDirectoryStatus,
  'active' | 'archived' | 'merged'
>>
type DuplicateFiltersAreClosed = Assert<IsExactly<
  CompanyDuplicateFilter,
  'open' | 'all'
>>
type DuplicateSortsAreClosed = Assert<IsExactly<
  CompanyDuplicateSort,
  'score_desc'
>>
type DuplicateStatusesAreClosed = Assert<IsExactly<
  CompanyDuplicateStatus,
  'open' | 'marked_distinct' | 'resolved_by_merge'
>>
type DuplicateReviewDecisionsAreClosed = Assert<IsExactly<
  CompanyDuplicateReviewDecision,
  'mark_distinct' | 'merge'
>>
type AssignedJobFiltersAreClosed = Assert<IsExactly<
  CompanyAssignedJobFilter,
  'all'
>>
type AssignedJobSortsAreClosed = Assert<IsExactly<
  CompanyAssignedJobSort,
  'role_title_asc'
>>
type HistoryKindsAreClosed = Assert<IsExactly<
  CompanyHistoryEventKind,
  'created' | 'updated' | 'alias_added' | 'alias_updated' | 'alias_removed' |
  'archived' | 'restored' | 'merged'
>>
type HistoryFiltersAreClosed = Assert<IsExactly<
  CompanyHistoryFilter,
  'all'
>>
type HistorySortsAreClosed = Assert<IsExactly<
  CompanyHistorySort,
  'occurred_desc'
>>
type HistoryChangedFieldsAreClosed = Assert<IsExactly<
  CompanyHistoryChangedField,
  'display_name' | 'website_url' | 'notes' | 'aliases' | 'status' |
  'canonical_company'
>>
type FailureKindsAreClosed = Assert<IsExactly<
  CompanyCommandFailure['kind'],
  'stale_guard' | 'lifecycle_failure'
>>
type StaleGuardKindsAreClosed = Assert<IsExactly<
  CompanyStaleGuard['kind'],
  'company_revision' | 'assignment_revision' | 'duplicate_candidate_revision'
>>
type CreateStatusesAreClosed = Assert<IsExactly<
  CreateCompanyResult['status'],
  'created' | 'blocked'
>>
type UpdateStatusesAreClosed = Assert<IsExactly<
  UpdateCompanyResult['status'],
  'updated' | 'blocked'
>>
type NotesStatusesAreClosed = Assert<IsExactly<
  UpdateCompanyNotesResult['status'],
  'updated' | 'blocked'
>>
type ArchiveStatusesAreClosed = Assert<IsExactly<
  ArchiveCompanyResult['status'],
  'archived' | 'blocked'
>>
type RestoreStatusesAreClosed = Assert<IsExactly<
  RestoreCompanyResult['status'],
  'restored' | 'blocked'
>>
type DistinctStatusesAreClosed = Assert<IsExactly<
  MarkCompaniesDistinctResult['status'],
  'marked_distinct' | 'blocked'
>>
type MergeStatusesAreClosed = Assert<IsExactly<
  MergeCompaniesResult['status'],
  'merged' | 'blocked'
>>
type ReassignmentStatusesAreClosed = Assert<IsExactly<
  ReassignJobCompanyResult['status'],
  'reassigned' | 'blocked'
>>
type MergeAcknowledgementIsClosed = Assert<IsExactly<
  MergeCompaniesInput['acknowledgeNoUndo'],
  true
>>

type CompanyClientMethodsAreComplete = Assert<IsExactly<
  keyof WorkspaceCompaniesClient,
  'capability' | 'create' | 'get' | 'lookup' | 'search' | 'previewMatches' |
  'directory' | 'update' | 'notes' | 'aliases' | 'archive' | 'restore' |
  'duplicates' | 'assignedJobs' | 'history'
>>
type AliasMethodsAreComplete = Assert<IsExactly<
  keyof WorkspaceCompaniesClient['aliases'],
  'add' | 'update' | 'remove'
>>
type CapabilityMethodsAreComplete = Assert<IsExactly<
  keyof WorkspaceCompaniesClient['capability'],
  'get'
>>
type DirectoryMethodsAreComplete = Assert<IsExactly<
  keyof WorkspaceCompaniesClient['directory'],
  'list'
>>
type NotesMethodsAreComplete = Assert<IsExactly<
  keyof WorkspaceCompaniesClient['notes'],
  'update'
>>
type DuplicateMethodsAreComplete = Assert<IsExactly<
  keyof WorkspaceCompaniesClient['duplicates'],
  'list' | 'get' | 'markDistinct' | 'merge'
>>
type AssignmentMethodsAreComplete = Assert<IsExactly<
  keyof WorkspaceCompanyAssignmentsClient,
  'get' | 'reassign'
>>
type AssignedJobMethodsAreComplete = Assert<IsExactly<
  keyof WorkspaceCompaniesClient['assignedJobs'],
  'list'
>>
type HistoryMethodsAreComplete = Assert<IsExactly<
  keyof WorkspaceCompaniesClient['history'],
  'list'
>>
type WorkspacePublishesCompanies = Assert<IsExactly<
  ValedictorianWorkspaceClient['companies'],
  WorkspaceCompaniesClient
>>
type WorkspacePublishesAssignments = Assert<IsExactly<
  ValedictorianWorkspaceClient['companyAssignments'],
  WorkspaceCompanyAssignmentsClient
>>

type DirectoryIsNotDuplicate = Assert<IsExactly<
  IsAssignable<CompanyDirectoryCursor, CompanyDuplicateCursor>,
  false
>>
type DirectoryIsNotAssignedJob = Assert<IsExactly<
  IsAssignable<CompanyDirectoryCursor, CompanyAssignedJobCursor>,
  false
>>
type DirectoryIsNotHistory = Assert<IsExactly<
  IsAssignable<CompanyDirectoryCursor, CompanyHistoryCursor>,
  false
>>
type DuplicateIsNotAssignedJob = Assert<IsExactly<
  IsAssignable<CompanyDuplicateCursor, CompanyAssignedJobCursor>,
  false
>>
type DuplicateIsNotHistory = Assert<IsExactly<
  IsAssignable<CompanyDuplicateCursor, CompanyHistoryCursor>,
  false
>>
type AssignedJobIsNotHistory = Assert<IsExactly<
  IsAssignable<CompanyAssignedJobCursor, CompanyHistoryCursor>,
  false
>>
type DirectoryPageUsesDirectoryCursor = Assert<IsExactly<
  CompanyDirectoryPage['pageInfo']['startCursor'],
  CompanyDirectoryCursor | null
>>
type HistoryPageUsesHistoryCursor = Assert<IsExactly<
  CompanyHistoryPage['pageInfo']['startCursor'],
  CompanyHistoryCursor | null
>>
type DuplicatePageUsesDuplicateCursor = Assert<IsExactly<
  CompanyDuplicatePage['pageInfo']['startCursor'],
  CompanyDuplicateCursor | null
>>
type AssignedJobPageUsesAssignedJobCursor = Assert<IsExactly<
  CompanyAssignedJobPage['pageInfo']['startCursor'],
  CompanyAssignedJobCursor | null
>>

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`)
}

function handleCapability(value: CompanyCapability): string {
  switch (value.status) {
    case 'migrating': return String(value.completed)
    case 'blocked': return value.reason
    case 'ready': return value.status
    default: return assertNever(value)
  }
}

function handleCompanyStatus(value: CompanyStatus): string {
  switch (value) {
    case 'active':
    case 'archived':
    case 'merged': return value
    default: return assertNever(value)
  }
}

function handleSearchScope(value: CompanySearchScope): string {
  switch (value) {
    case 'active':
    case 'active_and_archived': return value
    default: return assertNever(value)
  }
}

function handleSearchStatus(value: CompanySearchResult['status']): string {
  switch (value) {
    case 'active':
    case 'archived': return value
    default: return assertNever(value)
  }
}

function handleMatchReason(value: CompanyMatchReasonCode): string {
  switch (value) {
    case 'normalized_name_similarity':
    case 'alias_similarity':
    case 'same_declared_domain': return value
    default: return assertNever(value)
  }
}

function handleDirectoryFilter(value: CompanyDirectoryFilter): string {
  switch (value) {
    case 'all':
    case 'active':
    case 'archived':
    case 'merged': return value
    default: return assertNever(value)
  }
}

function handleDirectorySort(value: CompanyDirectorySort): string {
  switch (value) {
    case 'display_name_asc': return value
    default: return assertNever(value)
  }
}

function handleDirectoryStatus(value: CompanyDirectoryStatus): string {
  switch (value) {
    case 'active':
    case 'archived':
    case 'merged': return value
    default: return assertNever(value)
  }
}

function handleDuplicateFilter(value: CompanyDuplicateFilter): string {
  switch (value) {
    case 'open':
    case 'all': return value
    default: return assertNever(value)
  }
}

function handleDuplicateSort(value: CompanyDuplicateSort): string {
  switch (value) {
    case 'score_desc': return value
    default: return assertNever(value)
  }
}

function handleDuplicateStatus(value: CompanyDuplicateStatus): string {
  switch (value) {
    case 'open':
    case 'marked_distinct':
    case 'resolved_by_merge': return value
    default: return assertNever(value)
  }
}

function handleDuplicateReviewDecision(value: CompanyDuplicateReviewDecision): string {
  switch (value) {
    case 'mark_distinct':
    case 'merge': return value
    default: return assertNever(value)
  }
}

function handleAssignedJobFilter(value: CompanyAssignedJobFilter): string {
  switch (value) {
    case 'all': return value
    default: return assertNever(value)
  }
}

function handleAssignedJobSort(value: CompanyAssignedJobSort): string {
  switch (value) {
    case 'role_title_asc': return value
    default: return assertNever(value)
  }
}

function handleHistoryFilter(value: CompanyHistoryFilter): string {
  switch (value) {
    case 'all': return value
    default: return assertNever(value)
  }
}

function handleHistorySort(value: CompanyHistorySort): string {
  switch (value) {
    case 'occurred_desc': return value
    default: return assertNever(value)
  }
}

function handleHistory(event: CompanyHistoryEvent): string {
  const kind = event.kind
  switch (kind) {
    case 'created':
    case 'updated':
    case 'alias_added':
    case 'alias_updated':
    case 'alias_removed':
    case 'archived':
    case 'restored':
    case 'merged': return kind
    default: return assertNever(kind)
  }
}

function handleHistoryChangedField(value: CompanyHistoryChangedField): string {
  switch (value) {
    case 'display_name':
    case 'website_url':
    case 'notes':
    case 'aliases':
    case 'status':
    case 'canonical_company': return value
    default: return assertNever(value)
  }
}

function handleFailure(value: CompanyCommandFailure): string {
  switch (value.kind) {
    case 'stale_guard': return value.recovery.action
    case 'lifecycle_failure': return value.blocker.code
    default: return assertNever(value)
  }
}

function handleStaleGuard(value: CompanyStaleGuard): string {
  switch (value.kind) {
    case 'company_revision': return value.companyId
    case 'assignment_revision': return value.jobId
    case 'duplicate_candidate_revision': return value.candidateId
    default: return assertNever(value)
  }
}

function handleCreate(value: CreateCompanyResult): string {
  switch (value.status) {
    case 'created': return value.companyId
    case 'blocked': return value.failure.kind
    default: return assertNever(value)
  }
}

function handleUpdate(value: UpdateCompanyResult | UpdateCompanyNotesResult): string {
  switch (value.status) {
    case 'updated': return value.companyId
    case 'blocked': return value.failure.kind
    default: return assertNever(value)
  }
}

function handleArchive(value: ArchiveCompanyResult): string {
  switch (value.status) {
    case 'archived': return value.companyId
    case 'blocked': return value.failure.kind
    default: return assertNever(value)
  }
}

function handleRestore(value: RestoreCompanyResult): string {
  switch (value.status) {
    case 'restored': return value.companyId
    case 'blocked': return value.failure.kind
    default: return assertNever(value)
  }
}

function handleDistinct(value: MarkCompaniesDistinctResult): string {
  switch (value.status) {
    case 'marked_distinct': return value.candidateId
    case 'blocked': return value.failure.kind
    default: return assertNever(value)
  }
}

function handleMerge(value: MergeCompaniesResult): string {
  switch (value.status) {
    case 'merged': return value.canonical.id
    case 'blocked': return value.failure.kind
    default: return assertNever(value)
  }
}

function handleReassignment(value: ReassignJobCompanyResult): string {
  switch (value.status) {
    case 'reassigned': return value.jobId
    case 'blocked': return value.failure.kind
    default: return assertNever(value)
  }
}

declare const companies: WorkspaceCompaniesClient
declare const directoryCursor: CompanyDirectoryCursor
declare const duplicateCursor: CompanyDuplicateCursor
declare const assignedJobCursor: CompanyAssignedJobCursor
declare const historyCursor: CompanyHistoryCursor
companies.directory.list({ after: directoryCursor })
companies.duplicates.list({ after: duplicateCursor })
companies.assignedJobs.list('company-1', { after: assignedJobCursor })
companies.history.list('company-1', { after: historyCursor })
// @ts-expect-error Directory cursors cannot page duplicate candidates.
companies.duplicates.list({ after: directoryCursor })
// @ts-expect-error Duplicate cursors cannot page assigned Jobs.
companies.assignedJobs.list('company-1', { after: duplicateCursor })
// @ts-expect-error Assigned-Job cursors cannot page Company history.
companies.history.list('company-1', { after: assignedJobCursor })
// @ts-expect-error History cursors cannot page the Company directory.
companies.directory.list({ after: historyCursor })

void [
  handleCapability,
  handleCompanyStatus,
  handleSearchScope,
  handleSearchStatus,
  handleMatchReason,
  handleDirectoryFilter,
  handleDirectorySort,
  handleDirectoryStatus,
  handleDuplicateFilter,
  handleDuplicateSort,
  handleDuplicateStatus,
  handleDuplicateReviewDecision,
  handleAssignedJobFilter,
  handleAssignedJobSort,
  handleHistoryFilter,
  handleHistorySort,
  handleHistory,
  handleHistoryChangedField,
  handleFailure,
  handleStaleGuard,
  handleCreate,
  handleUpdate,
  handleArchive,
  handleRestore,
  handleDistinct,
  handleMerge,
  handleReassignment,
]
void (null as unknown as CompanyVersionIsOne)
void (null as unknown as AssignmentVersionIsOne)
void (null as unknown as HistoryVersionIsOne)
void (null as unknown as CapabilityStatusesAreClosed)
void (null as unknown as CompanyStatusesAreClosed)
void (null as unknown as SearchScopesAreClosed)
void (null as unknown as SearchStatusesAreClosed)
void (null as unknown as MatchReasonsAreClosed)
void (null as unknown as DirectoryFiltersAreClosed)
void (null as unknown as DirectorySortsAreClosed)
void (null as unknown as DirectoryStatusesAreClosed)
void (null as unknown as DuplicateFiltersAreClosed)
void (null as unknown as DuplicateSortsAreClosed)
void (null as unknown as DuplicateStatusesAreClosed)
void (null as unknown as DuplicateReviewDecisionsAreClosed)
void (null as unknown as AssignedJobFiltersAreClosed)
void (null as unknown as AssignedJobSortsAreClosed)
void (null as unknown as HistoryKindsAreClosed)
void (null as unknown as HistoryFiltersAreClosed)
void (null as unknown as HistorySortsAreClosed)
void (null as unknown as HistoryChangedFieldsAreClosed)
void (null as unknown as FailureKindsAreClosed)
void (null as unknown as StaleGuardKindsAreClosed)
void (null as unknown as CreateStatusesAreClosed)
void (null as unknown as UpdateStatusesAreClosed)
void (null as unknown as NotesStatusesAreClosed)
void (null as unknown as ArchiveStatusesAreClosed)
void (null as unknown as RestoreStatusesAreClosed)
void (null as unknown as DistinctStatusesAreClosed)
void (null as unknown as MergeStatusesAreClosed)
void (null as unknown as ReassignmentStatusesAreClosed)
void (null as unknown as MergeAcknowledgementIsClosed)
void (null as unknown as CompanyClientMethodsAreComplete)
void (null as unknown as AliasMethodsAreComplete)
void (null as unknown as CapabilityMethodsAreComplete)
void (null as unknown as DirectoryMethodsAreComplete)
void (null as unknown as NotesMethodsAreComplete)
void (null as unknown as DuplicateMethodsAreComplete)
void (null as unknown as AssignmentMethodsAreComplete)
void (null as unknown as AssignedJobMethodsAreComplete)
void (null as unknown as HistoryMethodsAreComplete)
void (null as unknown as WorkspacePublishesCompanies)
void (null as unknown as WorkspacePublishesAssignments)
void (null as unknown as DirectoryIsNotDuplicate)
void (null as unknown as DirectoryIsNotAssignedJob)
void (null as unknown as DirectoryIsNotHistory)
void (null as unknown as DuplicateIsNotAssignedJob)
void (null as unknown as DuplicateIsNotHistory)
void (null as unknown as AssignedJobIsNotHistory)
void (null as unknown as DirectoryPageUsesDirectoryCursor)
void (null as unknown as HistoryPageUsesHistoryCursor)
void (null as unknown as DuplicatePageUsesDuplicateCursor)
void (null as unknown as AssignedJobPageUsesAssignedJobCursor)
