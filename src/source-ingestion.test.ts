import { describe, expect, it } from 'vitest'
import {
  careerSourceLifecycleStatuses,
  isCareerSourceLifecycleStatus,
  isSourceRunStatus,
  sourceRunStatuses,
} from './index'

describe('source ingestion contract', () => {
  it('exports source run and career source lifecycle status guards', () => {
    expect(sourceRunStatuses).toEqual([
      'queued',
      'locked',
      'extracting',
      'continued',
      'normalizing',
      'validating',
      'publishing',
      'blocked',
      'failed',
      'no_change',
      'published',
      'suspect',
    ])
    expect(isSourceRunStatus('published')).toBe(true)
    expect(isSourceRunStatus('completed')).toBe(false)

    expect(careerSourceLifecycleStatuses).toEqual([
      'candidate',
      'discovering',
      'ready',
      'active',
      'suspect',
      'paused',
      'retired',
      'blocked_by_policy',
      'blocked_by_waf',
    ])
    expect(isCareerSourceLifecycleStatus('active')).toBe(true)
    expect(isCareerSourceLifecycleStatus('disabled')).toBe(false)
  })
})
