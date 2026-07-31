import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  SDK_PACKAGE,
  buildPermissionedEvidence,
  buildPublicEvidence,
  collectSdkExports,
  collectSourceImportRows,
  reconcileRows,
  runCli,
} from './generate-sdk-export-inventory.mjs'

const parentGitEnvironment = Object.fromEntries(Object.entries(process.env).filter(([name]) => name.startsWith('GIT_')))

function clearGitEnvironment() {
  for (const name of Object.keys(process.env)) {
    if (name.startsWith('GIT_')) delete process.env[name]
  }
}

function restoreParentGitEnvironment() {
  clearGitEnvironment()
  Object.assign(process.env, parentGitEnvironment)
}

function sanitizedGitEnv() {
  // Hooks export repository-scoped GIT_* variables; never let them retarget a fixture repo.
  return Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')))
}

function runGit(cwd, args, label) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', env: sanitizedGitEnv() })
  if (result.error || result.status !== 0) {
    const detail = result.stderr?.trim() || result.error?.message || `exit status ${String(result.status)}`
    throw new Error(`${label} ${args.join(' ')} failed: ${detail}`)
  }
  return result
}

function runFixtureGit(cwd, args) {
  return runGit(cwd, args, 'Fixture git')
}

function runRepositoryGit(cwd, args) {
  return runGit(cwd, args, 'Repository git')
}

function withHookEnvironment(callback) {
  const names = new Set(['LEFTHOOK', ...Object.keys(parentGitEnvironment), 'GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES', 'GIT_PREFIX'])
  const saved = new Map([...names].map((name) => [name, process.env[name]]))
  const repoRoot = process.cwd()
  const gitDir = path.resolve(repoRoot, runRepositoryGit(repoRoot, ['rev-parse', '--git-dir']).stdout.trim())
  const commonDir = path.resolve(repoRoot, runRepositoryGit(repoRoot, ['rev-parse', '--git-common-dir']).stdout.trim())
  Object.assign(process.env, parentGitEnvironment, {
    LEFTHOOK: '1',
    GIT_DIR: gitDir,
    GIT_WORK_TREE: repoRoot,
    GIT_COMMON_DIR: commonDir,
    GIT_INDEX_FILE: path.join(gitDir, 'index'),
    GIT_OBJECT_DIRECTORY: path.join(commonDir, 'objects'),
    GIT_PREFIX: '',
  })
  try {
    return callback()
  } finally {
    for (const [name, value] of saved) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  }
}

function fixtureTree() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdk-export-inventory-'))
  const sdkRoot = path.join(root, 'sdk')
  const linkedRoot = path.join(sdkRoot, '.local', 'worktrees', 'linked-sdk')
  const consumerRoot = path.join(root, 'consumer')
  const fixtureHooks = path.join(root, 'fixture-hooks')
  fs.mkdirSync(path.join(sdkRoot, 'src'), { recursive: true })
  fs.mkdirSync(path.dirname(linkedRoot), { recursive: true })
  fs.mkdirSync(fixtureHooks)
  fs.mkdirSync(path.join(consumerRoot, 'src'), { recursive: true })
  fs.mkdirSync(path.join(consumerRoot, 'dist'), { recursive: true })
  fs.mkdirSync(path.join(consumerRoot, 'node_modules', '@sparxie', 'sdk'), { recursive: true })
  fs.writeFileSync(path.join(sdkRoot, 'package.json'), JSON.stringify({ name: SDK_PACKAGE, version: '0.0.0' }))
  fs.writeFileSync(path.join(sdkRoot, '.gitignore'), 'scratch/\n')
  fs.writeFileSync(path.join(sdkRoot, 'tsconfig.json'), JSON.stringify({ compilerOptions: { module: 'NodeNext', moduleResolution: 'NodeNext', target: 'ES2022' }, include: ['src/index.ts'] }))
  fs.writeFileSync(path.join(sdkRoot, 'src/index.ts'), 'export const fixtureExport = 1\nexport const anotherExport = 2\n')
  fs.writeFileSync(path.join(consumerRoot, '.gitignore'), 'node_modules\n')
  fs.writeFileSync(path.join(consumerRoot, 'package.json'), JSON.stringify({ dependencies: { [SDK_PACKAGE]: '0.0.0' } }))
  fs.writeFileSync(path.join(consumerRoot, 'pnpm-lock.yaml'), `lockfileVersion: 9\npackages:\n  ${SDK_PACKAGE}: 0.0.0\n`)
  fs.writeFileSync(path.join(consumerRoot, 'src/multiline.ts'), `import {\n  fixtureExport,\n  anotherExport as localExport,\n} from '${SDK_PACKAGE}'\nvoid fixtureExport\nvoid localExport\n`)
  fs.writeFileSync(path.join(consumerRoot, 'src/namespace.js'), `import * as sdk from '${SDK_PACKAGE}'\nvoid sdk.fixtureExport\n`)
  fs.writeFileSync(path.join(consumerRoot, 'dist/bundle.js'), `import { fixtureExport } from '${SDK_PACKAGE}'\nvoid fixtureExport\n`)
  fs.writeFileSync(path.join(consumerRoot, 'node_modules', '@sparxie', 'sdk', 'package.json'), JSON.stringify({ name: SDK_PACKAGE, version: '0.0.0' }))
  runFixtureGit(sdkRoot, ['init', '-q'])
  const fixtureTop = fs.realpathSync(runFixtureGit(sdkRoot, ['rev-parse', '--show-toplevel']).stdout.trim())
  if (fixtureTop !== fs.realpathSync(sdkRoot)) throw new Error(`Fixture Git root escaped fixture: ${fixtureTop}`)
  const commonDir = path.resolve(sdkRoot, runFixtureGit(sdkRoot, ['rev-parse', '--git-common-dir']).stdout.trim())
  if (fs.realpathSync(commonDir) !== fs.realpathSync(path.join(sdkRoot, '.git'))) {
    throw new Error(`Fixture Git common dir escaped fixture: ${commonDir}`)
  }
  const excludePath = path.join(commonDir, 'info', 'exclude')
  fs.mkdirSync(path.dirname(excludePath), { recursive: true })
  fs.appendFileSync(excludePath, '.local/\n')
  for (const [key, value] of [['user.email', 'fixture@example.test'], ['user.name', 'Fixture']]) {
    runFixtureGit(sdkRoot, ['config', key, value])
  }
  runFixtureGit(sdkRoot, ['config', '--local', 'core.hooksPath', fixtureHooks])
  const hooksPath = runFixtureGit(sdkRoot, ['config', '--local', '--get', 'core.hooksPath']).stdout.trim()
  if (hooksPath !== fixtureHooks) throw new Error(`Fixture hooks path was not isolated: ${hooksPath}`)
  runFixtureGit(sdkRoot, ['add', '.'])
  runFixtureGit(sdkRoot, ['commit', '-qm', 'fixture'])
  runFixtureGit(sdkRoot, ['worktree', 'add', '-q', '--detach', linkedRoot])
  runFixtureGit(consumerRoot, ['init', '-q'])
  return { root, sdkRoot, linkedRoot, consumerRoot }
}

function exportRows() {
  const fixture = fixtureTree()
  return { fixture, exports: collectSdkExports(fixture.sdkRoot).rows }
}

function permissionedConfig(fixture) {
  const configPath = path.join(fixture.root, 'consumer-config.json')
  fs.writeFileSync(configPath, JSON.stringify({
    consumerRoots: { fixture: fixture.consumerRoot },
    baselines: { sparxie: 'a'.repeat(40), fixture: 'b'.repeat(40) },
    historicalChecks: { exports: 2, fixture: 2 },
  }))
  return configPath
}

describe('SDK export inventory selectors', () => {
  beforeAll(() => {
    clearGitEnvironment()
  })

  afterAll(() => {
    restoreParentGitEnvironment()
  })

  it('measures exports deterministically without private checkout assumptions', () => {
    const repoRoot = process.cwd()
    const beforeHead = runRepositoryGit(repoRoot, ['rev-parse', 'HEAD']).stdout.trim()
    const beforeWorktrees = runRepositoryGit(repoRoot, ['worktree', 'list', '--porcelain']).stdout
    const result = withHookEnvironment(() => {
      const fixture = fixtureTree()
      const first = collectSdkExports(fixture.sdkRoot)
      const second = collectSdkExports(fixture.sdkRoot)
      const fixtureTop = fs.realpathSync(runFixtureGit(fixture.sdkRoot, ['rev-parse', '--show-toplevel']).stdout.trim())
      const fixtureCommon = path.resolve(fixture.sdkRoot, runFixtureGit(fixture.sdkRoot, ['rev-parse', '--git-common-dir']).stdout.trim())
      const fixtureHooks = runFixtureGit(fixture.sdkRoot, ['config', '--local', '--get', 'core.hooksPath']).stdout.trim()
      return { fixture, first, second, fixtureTop, fixtureCommon, fixtureHooks }
    })
    const afterHead = runRepositoryGit(repoRoot, ['rev-parse', 'HEAD']).stdout.trim()
    const afterWorktrees = runRepositoryGit(repoRoot, ['worktree', 'list', '--porcelain']).stdout

    expect(result.first.candidateCount).toBe(2)
    expect(result.first.rows).toEqual(result.second.rows)
    expect(result.first.rows.map((row) => row.symbol)).toEqual(['anotherExport', 'fixtureExport'])
    expect(afterHead).toBe(beforeHead)
    expect(afterWorktrees).toBe(beforeWorktrees)
    expect(result.fixtureTop).toBe(fs.realpathSync(result.fixture.sdkRoot))
    expect(fs.realpathSync(result.fixtureCommon)).toBe(fs.realpathSync(path.join(result.fixture.sdkRoot, '.git')))
    expect(fs.realpathSync(result.fixtureHooks)).toBe(fs.realpathSync(path.join(result.fixture.root, 'fixture-hooks')))
  })

  it('parses every tracked source file, including multiline imports outside tsconfig', () => {
    const { fixture, exports } = exportRows()
    const first = collectSourceImportRows(fixture.consumerRoot, exports)
    const second = collectSourceImportRows(fixture.consumerRoot, exports)
    const rows = reconcileRows(first.rows, [first.selector.id])
    const multiline = rows.rows.filter((row) => row.path === 'src/multiline.ts')

    expect(rows.rows).toEqual(reconcileRows(second.rows, [second.selector.id]).rows)
    expect(multiline.map((row) => row.symbol)).toEqual(['fixtureExport', 'anotherExport'])
    expect(multiline.every((row) => row.referenceKind === 'import-specifier')).toBe(true)
    expect(rows.rows.some((row) => row.referenceKind === 'namespace-property')).toBe(true)
    expect(rows.rows.some((row) => row.referenceKind === 'artifact-import-specifier')).toBe(false)
    expect(rows.everyCandidateHasDisposition).toBe(true)
  })

  it('keeps permissioned evidence explicit and public output hermetic', () => {
    const { fixture, exports } = exportRows()
    const permissioned = buildPermissionedEvidence({
      root: fixture.sdkRoot,
      consumerRoots: { fixture: fixture.consumerRoot },
      baselines: { sparxie: 'a'.repeat(40), fixture: 'b'.repeat(40) },
      historicalChecks: { exports: exports.length, fixture: 2 },
      includeExternalEvidence: false,
      retainRaw: true,
    })
    const publicEvidence = buildPublicEvidence({
      root: fixture.sdkRoot,
      registryEvidence: {
        endpoint: 'https://registry.npmjs.org/%40sparxie%2Fsdk',
        command: 'npm view @sparxie/sdk --json',
        status: 'available',
      },
    })
    const publicText = JSON.stringify(publicEvidence)
    const rows = permissioned.consumers.fixture.rows

    expect(rows.some((row) => typeof row.raw === 'string')).toBe(true)
    expect(permissioned.baselines.sparxie).toHaveLength(40)
    expect(permissioned.consumers.fixture.coverage.everyCandidateHasDisposition).toBe(true)
    expect(publicEvidence.visibility).toBe('public-safe')
    expect(publicEvidence).not.toHaveProperty('consumers')
    expect(publicText).not.toContain('fixture')
    expect(publicText).not.toContain('anotherExport')
    expect(publicText).not.toContain('historicalChecks')
    expect(publicText).not.toContain('sha256')
  })

  it('keeps reconciliations stable and uniquely disposed', () => {
    const result = reconcileRows(
      [
        { category: 'test', path: 'b.ts', line: 2, column: 1, symbol: 'B', raw: 'B', disposition: 'recorded' },
        { category: 'test', path: 'a.ts', line: 1, column: 1, symbol: 'A', raw: 'A', disposition: 'recorded' },
      ],
      ['test-selector'],
    )

    expect(result.rows.map((row) => row.symbol)).toEqual(['A', 'B'])
    expect(result.duplicateRowIds).toEqual([])
    expect(result.everyCandidateHasDisposition).toBe(true)
  })

  it('requires permissioned output to be explicit and external', () => {
    const fixture = fixtureTree()
    const configPath = permissionedConfig(fixture)

    expect(() => runCli({
      root: fixture.sdkRoot,
      argv: ['--consumer-config', configPath],
      includeExternalEvidence: false,
    })).toThrow(/explicit --output/u)

    expect(() => runCli({
      root: fixture.sdkRoot,
      argv: ['--consumer-config', configPath, '--output', path.join(fixture.sdkRoot, 'unsafe.json')],
      includeExternalEvidence: false,
    })).toThrow(/ignored inside a worktree/u)
    expect(fs.existsSync(path.join(fixture.sdkRoot, 'unsafe.json'))).toBe(false)

    expect(() => runCli({
      root: fixture.sdkRoot,
      argv: ['--consumer-config', configPath, '--output', path.join(fixture.linkedRoot, 'package.json')],
      includeExternalEvidence: false,
    })).toThrow(/tracked path/u)

    const untrackedPath = path.join(fixture.linkedRoot, 'untracked-private.json')
    expect(() => runCli({
      root: fixture.sdkRoot,
      argv: ['--consumer-config', configPath, '--output', untrackedPath],
      includeExternalEvidence: false,
    })).toThrow(/ignored inside a worktree/u)
    expect(fs.existsSync(untrackedPath)).toBe(false)

    const symlinkPath = path.join(fixture.root, 'tracked-link.json')
    fs.symlinkSync(path.join(fixture.linkedRoot, 'package.json'), symlinkPath)
    expect(() => runCli({
      root: fixture.sdkRoot,
      argv: ['--consumer-config', configPath, '--output', symlinkPath],
      includeExternalEvidence: false,
    })).toThrow(/tracked path/u)

    const nestedDanglingTarget = path.join(fixture.linkedRoot, 'nested-dangling-target.json')
    const nestedDanglingPath = path.join(fixture.root, 'nested-dangling-output.json')
    fs.symlinkSync(nestedDanglingTarget, nestedDanglingPath)
    expect(() => runCli({
      root: fixture.sdkRoot,
      argv: ['--consumer-config', configPath, '--output', nestedDanglingPath],
      includeExternalEvidence: false,
    })).toThrow(/ignored inside a worktree/u)
    expect(fs.lstatSync(nestedDanglingPath).isSymbolicLink()).toBe(true)
    expect(fs.existsSync(nestedDanglingTarget)).toBe(false)

    const danglingTarget = path.join(fixture.sdkRoot, 'dangling-target.json')
    const danglingPath = path.join(fixture.root, 'dangling-output.json')
    fs.symlinkSync(danglingTarget, danglingPath)
    expect(() => runCli({
      root: fixture.sdkRoot,
      argv: ['--consumer-config', configPath, '--output', danglingPath],
      includeExternalEvidence: false,
    })).toThrow(/ignored inside a worktree/u)
    expect(fs.lstatSync(danglingPath).isSymbolicLink()).toBe(true)
    expect(fs.existsSync(danglingTarget)).toBe(false)

    const relativeDir = path.join(fixture.root, 'relative-links')
    fs.mkdirSync(relativeDir)
    const relativePath = path.join(relativeDir, 'dangling-output.json')
    fs.symlinkSync(path.relative(relativeDir, path.join(fixture.sdkRoot, 'relative-target.json')), relativePath)
    expect(() => runCli({
      root: fixture.sdkRoot,
      argv: ['--consumer-config', configPath, '--output', relativePath],
      includeExternalEvidence: false,
    })).toThrow(/ignored inside a worktree/u)

    const cycleDir = path.join(fixture.root, 'cycles')
    fs.mkdirSync(cycleDir)
    const cycleA = path.join(cycleDir, 'a.json')
    const cycleB = path.join(cycleDir, 'b.json')
    fs.symlinkSync('b.json', cycleA)
    fs.symlinkSync('a.json', cycleB)
    expect(() => runCli({
      root: fixture.sdkRoot,
      argv: ['--consumer-config', configPath, '--output', cycleA],
      includeExternalEvidence: false,
    })).toThrow(/cycle|depth|ELOOP/u)
    expect(fs.lstatSync(cycleA).isSymbolicLink()).toBe(true)

    const ignoredPath = path.join(fixture.sdkRoot, '.local', 'work', 'consumer-evidence.json')
    const ignored = runCli({
      root: fixture.sdkRoot,
      argv: ['--consumer-config', configPath, '--output', ignoredPath],
      includeExternalEvidence: false,
    })
    expect(ignored.outputPath).toBe(ignoredPath)
    expect(fs.existsSync(ignoredPath)).toBe(true)
  })

  it('writes safe permissioned output with a complete invocation and leaves public defaults unchanged', () => {
    const fixture = fixtureTree()
    const configPath = permissionedConfig(fixture)
    const outputPath = path.join(fixture.root, 'scratch', 'consumer-evidence.json')
    const permissioned = runCli({
      root: fixture.sdkRoot,
      argv: ['--consumer-config', configPath, '--output', outputPath],
      includeExternalEvidence: false,
      cwd: fixture.root,
      execPath: '/usr/bin/node',
      scriptPath: '/tmp/generate-sdk-export-inventory.mjs',
    })
    const invocation = permissioned.evidence.scope.invocation

    expect(fs.existsSync(outputPath)).toBe(true)
    expect(invocation.consumerConfig).toBe(configPath)
    expect(invocation.output).toBe(outputPath)
    expect(invocation.argv).toEqual([
      '/usr/bin/node',
      '/tmp/generate-sdk-export-inventory.mjs',
      '--consumer-config',
      configPath,
      '--output',
      outputPath,
    ])
    expect(invocation.command).toContain(`--consumer-config ${configPath}`)
    expect(invocation.command).toContain(`--output ${outputPath}`)

    const publicOutputPath = path.join(fixture.root, 'public.json')
    const publicEvidence = runCli({
      root: fixture.sdkRoot,
      argv: ['--output', publicOutputPath],
      registryEvidence: {
        endpoint: 'https://registry.npmjs.org/%40sparxie%2Fsdk',
        command: 'npm view @sparxie/sdk --json',
        status: 'available',
      },
    }).evidence
    expect(publicEvidence.mode).toBe('public')
    expect(publicEvidence).not.toHaveProperty('scope.invocation')
  })
})
