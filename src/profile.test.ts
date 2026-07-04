import { describe, expect, it } from 'vitest'
import {
  defaultUserProfile,
  normalizeProfileEducationInput,
  normalizeProfileAnswerInput,
  profileCitizenshipStatusOptions,
  profileClassStandingOptions,
  profileEducationTypeOptions,
  profileGenderOptions,
  profilePhoneDeviceTypeOptions,
  profileRaceEthnicityOptions,
  profileSecretKinds,
  profileSelfIdResponseOptions,
  profileSponsorshipRequirementOptions,
  profileVeteranStatusOptions,
  profileWorkAuthorizationOptions,
  toProfileAgentContext,
  type UserProfile,
} from './index'

describe('profile contracts', () => {
  it('normalizes reusable answers and builds agent context without secrets', () => {
    const answer = normalizeProfileAnswerInput({
      answer: 'LinkedIn',
      category: 'source',
      includeInAgentContext: true,
      key: ' how heard ',
      label: ' How I heard about the role ',
      questionPattern: ' How did you hear about us? ',
    })
    const secretAnswer = normalizeProfileAnswerInput({
      answer: 'Do not send this to an LLM.',
      includeInAgentContext: false,
      key: 'ssn',
      label: 'SSN',
      questionPattern: 'Social security number',
    })
    const profile: UserProfile = {
      ...defaultUserProfile,
      answers: [answer, secretAnswer],
      addressLine1: '470 Mockingbird Lane',
      city: 'Southold',
      citizenship: 'US Citizen',
      country: 'US',
      coverLetterPath: '~/Downloads/Kenny_Lin_Cover_Letter.docx',
      education: [
        normalizeProfileEducationInput({
          classStanding: 'Senior',
          degree: 'BS Computer Science',
          educationType: ' College ',
          graduationDate: 'December 2027',
          id: ' cu-boulder ',
          major: 'Computer Science',
          school: ' University of Colorado Boulder ',
          transcriptPath: 'transcripts/Kenny_Lin_S26_Transcript.pdf',
        }),
        normalizeProfileEducationInput({
          educationType: 'High school',
          id: 'southold-high-school',
          notes: 'National Honor Society.',
          satScore: '1510',
          school: 'Southold JR/SR High School',
        }),
      ],
      email: 'kenny@example.com',
      fullName: 'Kenny Lin',
      githubUrl: 'https://github.com/kenny',
      language: 'English',
      linkedinUrl: 'https://linkedin.com/in/kenny',
      phone: '555-0100',
      phoneDeviceType: 'Mobile',
      portfolioUrl: 'https://kennykeni.com',
      preferredName: 'Kenny',
      region: 'NY',
      relocationNotes: 'Open to NYC, Denver, or Bay Area roles.',
      requireSponsorship: 'No',
      requireSponsorshipFuture: 'No',
      travelNotes: 'Prefer under 25%.',
      willingToRelocate: true,
      willingToTravel: false,
      workAuthorization: 'Authorized to work in the US; does not require sponsorship.',
    }

    expect(answer).toMatchObject({
      answer: 'LinkedIn',
      category: 'source',
      includeInAgentContext: true,
      key: 'how_heard',
      label: 'How I heard about the role',
      questionPattern: 'How did you hear about us?',
    })
    expect(profileEducationTypeOptions).toEqual([
      'High school',
      'College',
      'Graduate school',
      'Bootcamp',
      'Certificate',
      'Other',
    ])
    expect(profileClassStandingOptions).toEqual([
      'Freshman',
      'Sophomore',
      'Junior',
      'Senior',
      'Graduate student',
      'Recent graduate',
      'Other',
    ])
    expect(profilePhoneDeviceTypeOptions).toEqual(['Mobile', 'Home', 'Work', 'Other'])
    expect(profileWorkAuthorizationOptions).toEqual([
      'Authorized to work in the US.',
      'Authorized to work in the US for any employer.',
      'Authorized to work in the US with sponsorship.',
      'Not currently authorized to work in the US.',
      'Prefer not to answer',
    ])
    expect(profileCitizenshipStatusOptions).toEqual([
      'US Citizen',
      'US Permanent Resident',
      'Non-US Citizen',
      'Dual Citizen',
      'Other',
      'Prefer not to answer',
    ])
    expect(profileSponsorshipRequirementOptions).toEqual([
      'No',
      'Yes',
      'Unsure',
      'Prefer not to answer',
    ])
    expect(profileRaceEthnicityOptions).toEqual([
      'American Indian or Alaska Native',
      'Asian',
      'Black or African American',
      'Native Hawaiian or Other Pacific Islander',
      'White',
      'Two or more races',
      'Other',
      'Prefer not to answer',
    ])
    expect(profileGenderOptions).toEqual([
      'Woman',
      'Man',
      'Non-binary',
      'Other',
      'Prefer not to answer',
    ])
    expect(profileSelfIdResponseOptions).toEqual(['Yes', 'No', 'Prefer not to answer'])
    expect(profileVeteranStatusOptions).toEqual([
      'Protected veteran',
      'Not a protected veteran',
      'Prefer not to answer',
    ])
    expect(profileSecretKinds).toEqual(['password', 'token', 'identity', 'other'])
    expect(toProfileAgentContext(profile)).toEqual({
      answers: [answer],
      basics: {
        addressLine1: '470 Mockingbird Lane',
        city: 'Southold',
        citizenship: 'US Citizen',
        country: 'US',
        coverLetterPath: '~/Downloads/Kenny_Lin_Cover_Letter.docx',
        email: 'kenny@example.com',
        fullName: 'Kenny Lin',
        githubUrl: 'https://github.com/kenny',
        language: 'English',
        linkedinUrl: 'https://linkedin.com/in/kenny',
        phone: '555-0100',
        phoneDeviceType: 'Mobile',
        portfolioUrl: 'https://kennykeni.com',
        preferredName: 'Kenny',
        region: 'NY',
        relocationNotes: 'Open to NYC, Denver, or Bay Area roles.',
        requireSponsorship: 'No',
        requireSponsorshipFuture: 'No',
        travelNotes: 'Prefer under 25%.',
        willingToRelocate: true,
        willingToTravel: false,
        workAuthorization: 'Authorized to work in the US; does not require sponsorship.',
      },
      education: [
        {
          classStanding: 'Senior',
          degree: 'BS Computer Science',
          educationType: 'College',
          graduationDate: 'December 2027',
          id: 'cu-boulder',
          major: 'Computer Science',
          notes: null,
          satScore: null,
          school: 'University of Colorado Boulder',
          transcriptPath: 'transcripts/Kenny_Lin_S26_Transcript.pdf',
        },
        {
          classStanding: null,
          degree: null,
          educationType: 'High school',
          graduationDate: null,
          id: 'southold-high-school',
          major: null,
          notes: 'National Honor Society.',
          satScore: '1510',
          school: 'Southold JR/SR High School',
          transcriptPath: null,
        },
      ],
    })
  })
})
