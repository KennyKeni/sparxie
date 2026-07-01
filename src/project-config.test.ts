import { describe, expect, it } from 'vitest'
import {
  defaultValedictorianProjectConfig,
  parseValedictorianProjectConfig,
} from './project-config'

describe('Valedictorian project config', () => {
  it('parses V1 project config for workspace defaults', () => {
    expect(
      parseValedictorianProjectConfig({
        version: 1,
        workspace: {
          name: '  Summer Search  ',
        },
      }),
    ).toEqual({
      version: 1,
      workspace: {
        name: 'Summer Search',
      },
    })
  })

  it('defaults a missing version to the current project config version', () => {
    expect(parseValedictorianProjectConfig({ workspace: {} })).toEqual(
      defaultValedictorianProjectConfig,
    )
  })

  it('rejects project config from a newer version', () => {
    expect(() => parseValedictorianProjectConfig({ version: 2 })).toThrow(
      'Project config version 2 is newer than this package supports.',
    )
  })

  it.each(['apiToken', 'token', 'secret', 'clientSecret'])(
    'rejects secret-looking project config key %s',
    (key) => {
      expect(() =>
        parseValedictorianProjectConfig({
          version: 1,
          workspace: {
            name: 'Summer Search',
          },
          [key]: 'do-not-store-this-here',
        }),
      ).toThrow(`Project config must not contain secret-like key: ${key}`)
    },
  )
})
