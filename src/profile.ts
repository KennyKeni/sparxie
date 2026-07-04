export const profileSecretKinds = ['password', 'token', 'identity', 'other'] as const
export const profileEducationTypeOptions = [
  'High school',
  'College',
  'Graduate school',
  'Bootcamp',
  'Certificate',
  'Other',
] as const
export const profileClassStandingOptions = [
  'Freshman',
  'Sophomore',
  'Junior',
  'Senior',
  'Graduate student',
  'Recent graduate',
  'Other',
] as const
export const profilePhoneDeviceTypeOptions = ['Mobile', 'Home', 'Work', 'Other'] as const
export const profileWorkAuthorizationOptions = [
  'Authorized to work in the US.',
  'Authorized to work in the US for any employer.',
  'Authorized to work in the US with sponsorship.',
  'Not currently authorized to work in the US.',
  'Prefer not to answer',
] as const
export const profileCitizenshipStatusOptions = [
  'US Citizen',
  'US Permanent Resident',
  'Non-US Citizen',
  'Dual Citizen',
  'Other',
  'Prefer not to answer',
] as const
export const profileSponsorshipRequirementOptions = [
  'No',
  'Yes',
  'Unsure',
  'Prefer not to answer',
] as const
export const profileRaceEthnicityOptions = [
  'American Indian or Alaska Native',
  'Asian',
  'Black or African American',
  'Native Hawaiian or Other Pacific Islander',
  'White',
  'Two or more races',
  'Other',
  'Prefer not to answer',
] as const
export const profileGenderOptions = [
  'Woman',
  'Man',
  'Non-binary',
  'Other',
  'Prefer not to answer',
] as const
export const profileSelfIdResponseOptions = ['Yes', 'No', 'Prefer not to answer'] as const
export const profileVeteranStatusOptions = [
  'Protected veteran',
  'Not a protected veteran',
  'Prefer not to answer',
] as const

export type ProfileSecretKind = (typeof profileSecretKinds)[number]
export type ProfileClassStanding = (typeof profileClassStandingOptions)[number]
export type ProfilePhoneDeviceType = (typeof profilePhoneDeviceTypeOptions)[number]
export type ProfileWorkAuthorization = (typeof profileWorkAuthorizationOptions)[number]
export type ProfileCitizenshipStatus = (typeof profileCitizenshipStatusOptions)[number]
export type ProfileSponsorshipRequirement =
  (typeof profileSponsorshipRequirementOptions)[number]
export type ProfileRaceEthnicity = (typeof profileRaceEthnicityOptions)[number]
export type ProfileGender = (typeof profileGenderOptions)[number]
export type ProfileSelfIdResponse = (typeof profileSelfIdResponseOptions)[number]
export type ProfileVeteranStatus = (typeof profileVeteranStatusOptions)[number]

export interface ProfileEducation {
  classStanding: string | null
  degree: string | null
  educationType: string
  graduationDate: string | null
  id: string
  major: string | null
  notes: string | null
  satScore: string | null
  school: string
  transcriptPath: string | null
}

export interface ProfileEducationInput {
  classStanding?: string | null
  degree?: string | null
  educationType?: string | null
  graduationDate?: string | null
  id?: string | null
  major?: string | null
  notes?: string | null
  satScore?: string | null
  school?: string | null
  transcriptPath?: string | null
}

export interface ProfileAnswer {
  answer: string
  category: string | null
  includeInAgentContext: boolean
  key: string
  label: string
  questionPattern: string
}

export interface ProfileAnswerInput {
  answer?: string | null
  category?: string | null
  includeInAgentContext?: boolean
  key?: string | null
  label?: string | null
  questionPattern?: string | null
}

export interface UserProfile {
  addressLine1: string | null
  addressLine2: string | null
  answers: ProfileAnswer[]
  city: string | null
  country: string | null
  citizenship: string | null
  classStanding: string | null
  coverLetterPath: string | null
  degree: string | null
  education: ProfileEducation[]
  email: string | null
  fullName: string | null
  githubUrl: string | null
  graduationDate: string | null
  highSchool: string | null
  language: string | null
  linkedinUrl: string | null
  major: string | null
  phone: string | null
  phoneDeviceType: string | null
  portfolioUrl: string | null
  preferredName: string | null
  region: string | null
  relocation: string | null
  relocationNotes: string | null
  requireSponsorship: string | null
  requireSponsorshipFuture: string | null
  satScore: string | null
  school: string | null
  transcriptPath: string | null
  travel: string | null
  travelNotes: string | null
  willingToRelocate: boolean | null
  willingToTravel: boolean | null
  workAuthorization: string | null
}

export interface ProfileUpdateInput extends Partial<Omit<UserProfile, 'answers' | 'education'>> {
  answers?: ProfileAnswerInput[]
  education?: ProfileEducationInput[]
}

export interface ProfileAgentContext {
  answers: ProfileAnswer[]
  basics: Partial<Omit<UserProfile, 'answers' | 'education'>>
  education: ProfileEducation[]
}

export interface ProfileSecretSummary {
  key: string
  kind: ProfileSecretKind
  label: string
  updatedAt: string
}

export interface ProfileSecretsListResult {
  items: ProfileSecretSummary[]
}

export interface UpsertProfileSecretInput {
  key: string
  kind: ProfileSecretKind
  label: string
  value: string
}

export interface ProfileSensitiveDetails {
  birthDay: string | null
  birthMonth: string | null
  birthYear: string | null
  dateOfBirth?: string | null
  disabilityStatus: string | null
  gender: string | null
  hispanicLatino: string | null
  raceEthnicity: string | null
  ssnLast4: string | null
  veteranStatus: string | null
}

export type ProfileSensitiveDetailsInput = Partial<ProfileSensitiveDetails>

export const defaultUserProfile: UserProfile = {
  addressLine1: null,
  addressLine2: null,
  answers: [],
  city: null,
  country: null,
  citizenship: null,
  classStanding: null,
  coverLetterPath: null,
  degree: null,
  education: [],
  email: null,
  fullName: null,
  githubUrl: null,
  graduationDate: null,
  highSchool: null,
  language: null,
  linkedinUrl: null,
  major: null,
  phone: null,
  phoneDeviceType: null,
  portfolioUrl: null,
  preferredName: null,
  region: null,
  relocation: null,
  relocationNotes: null,
  requireSponsorship: null,
  requireSponsorshipFuture: null,
  satScore: null,
  school: null,
  transcriptPath: null,
  travel: null,
  travelNotes: null,
  willingToRelocate: null,
  willingToTravel: null,
  workAuthorization: null,
}

const profileAgentContextFields = [
  'addressLine1',
  'addressLine2',
  'city',
  'country',
  'citizenship',
  'coverLetterPath',
  'email',
  'fullName',
  'githubUrl',
  'language',
  'linkedinUrl',
  'phone',
  'phoneDeviceType',
  'portfolioUrl',
  'preferredName',
  'region',
  'relocationNotes',
  'requireSponsorship',
  'requireSponsorshipFuture',
  'travelNotes',
  'willingToRelocate',
  'willingToTravel',
  'workAuthorization',
] as const

export function normalizeProfileEducationInput(input: ProfileEducationInput): ProfileEducation {
  const educationType = requiredText(input.educationType, 'education type')
  const school = requiredText(input.school, 'school')

  return {
    classStanding: nullableText(input.classStanding),
    degree: nullableText(input.degree),
    educationType,
    graduationDate: nullableText(input.graduationDate),
    id: normalizeProfileEducationId(input.id ?? school),
    major: nullableText(input.major),
    notes: nullableText(input.notes),
    satScore: nullableText(input.satScore),
    school,
    transcriptPath: nullableText(input.transcriptPath),
  }
}

export function normalizeProfileEducationId(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '')

  if (!normalized) {
    throw new Error('education id is required')
  }

  return normalized
}

export function normalizeProfileAnswerInput(input: ProfileAnswerInput): ProfileAnswer {
  const label = requiredText(input.label, 'answer label')
  const key = normalizeProfileAnswerKey(input.key ?? label)

  return {
    answer: requiredText(input.answer, 'answer'),
    category: nullableText(input.category),
    includeInAgentContext: input.includeInAgentContext === true,
    key,
    label,
    questionPattern: requiredText(input.questionPattern, 'question pattern'),
  }
}

export function normalizeProfileAnswerKey(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

  if (!normalized) {
    throw new Error('answer key is required')
  }

  return normalized
}

export function toProfileAgentContext(profile: UserProfile): ProfileAgentContext {
  const basics: Record<string, string | boolean> = {}

  for (const field of profileAgentContextFields) {
    const value = profile[field]

    if (value !== null && value !== undefined && value !== '') {
      basics[field] = value
    }
  }

  return {
    answers: profile.answers.filter((answer) => answer.includeInAgentContext),
    basics: basics as ProfileAgentContext['basics'],
    education: profile.education,
  }
}

function nullableText(value: string | null | undefined) {
  if (value === null || value === undefined) {
    return null
  }

  const trimmed = value.trim()
  return trimmed || null
}

function requiredText(value: string | null | undefined, field: string) {
  const trimmed = nullableText(value)

  if (!trimmed) {
    throw new Error(`${field} is required`)
  }

  return trimmed
}
