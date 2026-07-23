import { describe, expect, it } from 'vitest'
import config, { maintainedTestIncludes } from '../vitest.config'

describe('test discovery configuration', () => {
  it('limits discovery to maintained test roots', () => {
    expect(config.test?.include).toEqual(maintainedTestIncludes)
    expect(maintainedTestIncludes).toEqual([
      'scripts/**/*.test.mjs',
      'src/**/*.test.{ts,tsx}',
    ])
  })
})
