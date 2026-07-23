import type {
  CompanyDetail,
  CompanyDirectoryListInput,
  CompanyDirectoryPage,
  CompanyMatchPreviewInput,
  CompanyMatchPreviewPage,
  CompanySearchInput,
  CompanySearchPage,
  WorkspaceCompanyLookup,
} from './company-query.js'
import type {
  CompanyDuplicateCandidateRow,
  CompanyDuplicateListInput,
  CompanyDuplicatePage,
  MarkCompaniesDistinctInput,
  MarkCompaniesDistinctResult,
  MergeCompaniesInput,
  MergeCompaniesResult,
} from './company-duplicates.js'
import type {
  AddCompanyAliasInput,
  ArchiveCompanyInput,
  ArchiveCompanyResult,
  CreateCompanyInput,
  CreateCompanyResult,
  RemoveCompanyAliasInput,
  RestoreCompanyInput,
  RestoreCompanyResult,
  UpdateCompanyAliasInput,
  UpdateCompanyInput,
  UpdateCompanyNotesInput,
  UpdateCompanyNotesResult,
  UpdateCompanyResult,
} from './company-mutations.js'
import type { CompanyCapability } from './company-shared.js'
import type {
  CompanyHistoryListInput,
  CompanyHistoryPage,
} from './company-history.js'
import type {
  CompanyAssignedJobListInput,
  CompanyAssignedJobPage,
  JobCompanyAssignmentPresentation,
  ReassignJobCompanyInput,
  ReassignJobCompanyResult,
} from './job-company-assignment.js'

export interface WorkspaceCompaniesClient {
  capability: { get(): Promise<CompanyCapability> }
  create(input: CreateCompanyInput): Promise<CreateCompanyResult>
  get(companyId: string): Promise<CompanyDetail>
  lookup(companyId: string): Promise<WorkspaceCompanyLookup>
  search(input: CompanySearchInput): Promise<CompanySearchPage>
  previewMatches(input: CompanyMatchPreviewInput): Promise<CompanyMatchPreviewPage>
  directory: {
    list(input: CompanyDirectoryListInput): Promise<CompanyDirectoryPage>
  }
  update(input: UpdateCompanyInput): Promise<UpdateCompanyResult>
  notes: {
    update(input: UpdateCompanyNotesInput): Promise<UpdateCompanyNotesResult>
  }
  aliases: {
    add(input: AddCompanyAliasInput): Promise<UpdateCompanyResult>
    update(input: UpdateCompanyAliasInput): Promise<UpdateCompanyResult>
    remove(input: RemoveCompanyAliasInput): Promise<UpdateCompanyResult>
  }
  archive(input: ArchiveCompanyInput): Promise<ArchiveCompanyResult>
  restore(input: RestoreCompanyInput): Promise<RestoreCompanyResult>
  duplicates: {
    list(input: CompanyDuplicateListInput): Promise<CompanyDuplicatePage>
    get(candidateId: string): Promise<CompanyDuplicateCandidateRow>
    markDistinct(input: MarkCompaniesDistinctInput): Promise<MarkCompaniesDistinctResult>
    merge(input: MergeCompaniesInput): Promise<MergeCompaniesResult>
  }
  assignedJobs: {
    list(companyId: string, input: CompanyAssignedJobListInput): Promise<CompanyAssignedJobPage>
  }
  history: {
    list(companyId: string, input: CompanyHistoryListInput): Promise<CompanyHistoryPage>
  }
}

export interface WorkspaceCompanyAssignmentsClient {
  get(jobId: string): Promise<JobCompanyAssignmentPresentation>
  reassign(input: ReassignJobCompanyInput): Promise<ReassignJobCompanyResult>
}
