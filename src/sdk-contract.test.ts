import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  defaultValedictorianApiBaseUrl,
  lifecycleBlockerCodes,
  lifecycleWarningCodes,
  removalChoices,
  valedictorianApiPaths,
} from './index.js'

function readPackageJson() {
  return JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8')) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
    exports?: Record<string, unknown>
    files?: string[]
    name?: string
    types?: string
    version?: string
  }
}

const retiredLifecycleModuleFiles = [
  'raw-sourcing-bound.ts',
  'raw-sourcing-list-summary.ts',
  'raw-sourcing-list.test.ts',
  'raw-sourcing-list.ts',
  'raw-sourcing-replay.ts',
  'raw-sourcing.ts',
  'sourcing-projection.ts',
  'sourcing.ts',
] as const

const retiredLifecycleRuntimeExports = [
  'rawSourceRecordSchema',
  'canonicalCandidateSchema',
  'sourcingFindingSchema',
  'invalidPersistedRawDetailErrorBody',
  'invalidPersistedRawDetailErrorBodySchema',
  'invalidPersistedRawDetailErrorCode',
  'invalidPersistedRawDetailErrorMessage',
  'NormalizationAttempt',
] as const

describe('SDK public contract', () => {
  it('exports the closed lifecycle decision vocabulary', () => {
    expect(lifecycleBlockerCodes).toHaveLength(9)
    expect(lifecycleWarningCodes).toEqual([
      'fit', 'rank', 'cutoff', 'missing_optional_facts',
      'third_party_destination', 'weak_possible_match',
    ])
    expect(removalChoices).toEqual([
      'reject_if_dependents', 'preserve_historical_lineage',
      'unlink_dependents', 'cascade_tombstone',
    ])
  })

  it('exports clean lifecycle API paths without legacy sourcing routes', () => {
    expect(defaultValedictorianApiBaseUrl).toBe('http://127.0.0.1:4317')
    expect(valedictorianApiPaths.captures).toBe('/v1/captures')
    expect(valedictorianApiPaths.jobs).toBe('/v1/jobs')
    expect(valedictorianApiPaths.opportunities).toBe('/v1/opportunities')
    expect(valedictorianApiPaths.applications).toBe('/v1/applications')
    expect(valedictorianApiPaths.capturePromoteToJob('capture 1'))
      .toBe('/v1/captures/capture%201/promote-to-job')
    expect(valedictorianApiPaths.jobPromoteToOpportunity('job 1'))
      .toBe('/v1/jobs/job%201/promote-to-opportunity')
    expect(valedictorianApiPaths.opportunityPromoteToApplication('opportunity 1'))
      .toBe('/v1/opportunities/opportunity%201/promote-to-application')
    expect(valedictorianApiPaths).not.toHaveProperty('sourcingRawRecords')
    expect(valedictorianApiPaths).not.toHaveProperty('sourcingCandidatesProcess')
    expect(valedictorianApiPaths).not.toHaveProperty('sourcingFindings')
  })

  it('does not export legacy sourcing resources at runtime', async () => {
    const sdk = await import('./index.js')
    for (const exportName of retiredLifecycleRuntimeExports) {
      expect(sdk).not.toHaveProperty(exportName)
    }
  })

  it('does not compile retired lifecycle implementation modules', () => {
    const sourceFiles = new Set(fs.readdirSync(path.resolve('src')))
    for (const file of retiredLifecycleModuleFiles) {
      expect(sourceFiles).not.toContain(file)
    }
  })

  it('has no Electron, React, SQLite, or native database dependencies', () => {
    const packageJson = readPackageJson()
    const dependencyNames = Object.keys({
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    })

    expect(packageJson.name).toBe('@sparxie/sdk')
    expect(packageJson.version).toBe('0.29.1')
    expect(packageJson.types).toBe('./dist/index.d.ts')
    expect(packageJson.files).toEqual(['dist'])
    expect(packageJson.exports).toBeDefined()
    expect(dependencyNames).not.toEqual(
      expect.arrayContaining([
        'better-sqlite3', 'electron', 'react', 'react-dom', 'sqlite3',
        '@libsql/client', '@sqlite.org/sqlite-wasm',
      ]),
    )
  })
})
