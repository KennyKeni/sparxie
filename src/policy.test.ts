import { describe, expect, it } from 'vitest'
import {
  defaultPolicyConfig,
  isPolicyEvidenceTag,
  isPolicySubjectType,
  normalizePolicyConfig,
  policyEvidenceTags,
  policySubjectTypes,
} from './index'

describe('policy contract', () => {
  it('exports stable defaults and evidence tags for external harnesses', () => {
    expect(defaultPolicyConfig).toMatchObject({
      version: 2,
      scoring: {
        applyCutoff: 6,
      },
      actionQueue: {
        staleLockHours: 2,
      },
      manualReview: {
        pickupDelayHours: 6,
        daytimeWindow: {
          start: '12:00',
          end: '23:59',
          timezone: 'local',
        },
      },
      sourcing: {
        overlapMinutes: 30,
        weekdayNormalCadenceHours: 1,
        weekdayOvernightCadenceHours: 3,
        weekendCadenceHours: 6,
      },
    })
    expect(policyEvidenceTags).toEqual(
      expect.arrayContaining([
        'apply_cutoff_override',
        'explicit_user_approval',
        'official_path_verified',
        'profile_retry_completed',
        'second_pass_verified',
        'yc_company',
      ]),
    )
    expect(policySubjectTypes).toEqual([
      'application',
      'sourcing_finding',
      'workflow_run',
      'global',
    ])
    expect(isPolicyEvidenceTag('explicit_user_approval')).toBe(true)
    expect(isPolicyEvidenceTag('approval')).toBe(false)
    expect(isPolicySubjectType('application')).toBe(true)
    expect(isPolicySubjectType('candidate')).toBe(false)
  })

  it('normalizes partial config overrides without mutating defaults', () => {
    const normalized = normalizePolicyConfig({
      scoring: {
        applyCutoff: 7,
      },
      manualReview: {
        pickupDelayHours: 8,
      },
    })

    expect(normalized.scoring.applyCutoff).toBe(7)
    expect(normalized.manualReview.pickupDelayHours).toBe(8)
    expect(normalized.actionQueue.staleLockHours).toBe(defaultPolicyConfig.actionQueue.staleLockHours)
    expect(defaultPolicyConfig.scoring.applyCutoff).toBe(6)
  })

  it('normalizes legacy queue config into action queue config', () => {
    const normalized = normalizePolicyConfig({
      version: 1,
      queue: {
        staleLockHours: 4,
      },
    })

    expect(normalized.version).toBe(2)
    expect(normalized.actionQueue.staleLockHours).toBe(4)
    expect(normalized).not.toHaveProperty('queue')
  })
})
