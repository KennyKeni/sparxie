import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import {
  EXPECTED_EXCEPTION_COUNT,
  EXPECTED_EXPORT_COUNT,
  EXPECTED_INPUT_SHA256,
  EXPECTED_KEY_COUNT,
  buildAdjudication,
  buildPublicAggregate,
  readS01Evidence,
  validateAdjudication,
} from './generate-sdk-export-dispositions.mjs'
import { validatePermissionedOutput } from './generate-sdk-export-inventory.mjs'

const ACTUAL_EVIDENCE_PATH = process.env.S01_EVIDENCE_PATH ?? ''
const actualEvidenceAvailable = fs.existsSync(ACTUAL_EVIDENCE_PATH)
const temporaryRoots = []

function digest(value) {
  return createHash('sha256').update(value).digest('hex')
}

function sourceRow(id, symbol, source, schema = symbol.endsWith('Schema')) {
  return {
    id,
    category: 'export',
    symbol,
    source,
    sourceLine: 1,
    sourceColumn: 1,
    declarationKind: 'VariableDeclaration',
    schemaClassification: schema ? 'schema-named' : 'not-schema-named',
    compatibilityClassification: symbol.endsWith('Type') ? 'type-only-export' : 'runtime-export',
  }
}

function consumerRow(consumer, index, symbol, unresolved = false, referenceKind = 'import-specifier') {
  const unresolvedSymbols = {
    'artifact-package-token': '<artifact>',
    'installed-package-json': '@sparxie/sdk',
    'lockfile-line': '@sparxie/sdk',
    'package-manifest': '@sparxie/sdk',
    'namespace-import': '<namespace>',
    'dynamic-import': '<dynamic>',
  }
  let rowPath = consumer === 'app' ? `src/app/app-${index}.ts` : consumer === 'cli' ? `src/valedictorian-cli-${index}.ts` : `packages/core/src/connector-${index}.ts`
  if (unresolved) {
    if (consumer === 'app') {
      rowPath = referenceKind === 'artifact-package-token'
        ? `vendor/valedictorian-cli/dist/synthetic-${index}.d.ts`
        : referenceKind === 'installed-package-json'
          ? 'node_modules/@sparxie/sdk/package.json'
          : referenceKind === 'lockfile-line'
            ? 'pnpm-lock.yaml'
            : referenceKind === 'package-manifest'
              ? 'package.json'
              : 'src/workspace/synthetic.test.ts'
    } else if (consumer === 'cli') {
      rowPath = referenceKind === 'installed-package-json'
        ? 'node_modules/@sparxie/sdk/package.json'
        : referenceKind === 'lockfile-line'
          ? 'pnpm-lock.yaml'
          : referenceKind === 'package-manifest'
            ? 'package.json'
            : `src/valedictorian-cli-synthetic.test.ts`
    } else {
      rowPath = referenceKind === 'installed-package-json'
        ? 'node_modules/@sparxie/sdk/package.json'
        : referenceKind === 'lockfile-line'
          ? 'pnpm-lock.yaml'
          : index % 2 === 0 ? 'packages/core/package.json' : 'packages/test-harness/package.json'
    }
  }
  return {
    id: `source-import:${rowPath}:${index + 1}:1:${unresolved ? unresolvedSymbols[referenceKind] : symbol}`,
    category: unresolved ? (referenceKind === 'artifact-package-token' ? 'artifact' : referenceKind === 'installed-package-json' ? 'installed' : referenceKind === 'lockfile-line' ? 'lockfile' : referenceKind === 'package-manifest' ? 'manifest' : 'source-import') : 'source-import',
    referenceKind,
    symbol: unresolved ? unresolvedSymbols[referenceKind] : symbol,
    symbolKnown: !unresolved,
    path: rowPath,
    line: index + 1,
    column: 1,
  }
}

function syntheticEvidence() {
  const rows = []
  for (let index = 0; index < 956; index += 1) {
    rows.push(sourceRow(`export:src/workspace-${index}.ts:${index + 1}:1:WorkspaceExport${index}`, `WorkspaceExport${index}`, `src/workspace-${index}.ts`, false))
  }
  for (let index = 0; index < 4; index += 1) {
    const symbol = ['SourceExecutionScopeId', 'sourceExecutionScopeIdSchema', 'SourceOperationOutcome', 'sourceOperationOutcomeSchema'][index]
    rows.push(sourceRow(`export:src/sourcing/source-execution.ts:${index + 1}:1:${symbol}`, symbol, 'src/sourcing/source-execution.ts'))
  }
  for (let index = 0; index < 126; index += 1) {
    const symbol = index === 0 ? 'sourceThingSchema' : `SourceThing${index}`
    rows.push(sourceRow(`export:src/sourcing/source-ingestion.ts:${index + 1}:1:${symbol}`, symbol, 'src/sourcing/source-ingestion.ts'))
  }
  rows.push(sourceRow('export:src/connector/connector.ts:134:1:ConnectorHistoricalBackfillState', 'ConnectorHistoricalBackfillState', 'src/connector/connector.ts', false))
  rows.push(sourceRow('export:src/connector/connector.ts:126:1:ConnectorNewestFrontierState', 'ConnectorNewestFrontierState', 'src/connector/connector.ts', false))
  rows.push(sourceRow('export:src/connector/connector-capabilities.ts:659:1:ConnectorVersionedRendererSchema', 'ConnectorVersionedRendererSchema', 'src/connector/connector-capabilities.ts'))
  rows.push(sourceRow('export:src/connector/connector-capabilities.ts:770:14:installedConnectorDescriptorSchema', 'installedConnectorDescriptorSchema', 'src/connector/connector-capabilities.ts'))
  rows.push(sourceRow('export:src/capture.ts:23:14:sourceAdapterKinds', 'sourceAdapterKinds', 'src/capture.ts', false))
  expect(rows).toHaveLength(EXPECTED_EXPORT_COUNT)
  const symbols = rows.map((row) => row.symbol)
  const consumers = {}
  const rowsByName = { app: 1237, cli: 226, connectors: 51 }
  const unresolvedByName = { app: 25, cli: 11, connectors: 8 }
  for (const [name, count] of Object.entries(rowsByName)) {
    const consumerRows = []
    for (let index = 0; index < count; index += 1) {
      if (index < unresolvedByName[name]) {
        const kinds = ['artifact-package-token', 'installed-package-json', 'lockfile-line', 'package-manifest', 'namespace-import', 'dynamic-import']
        consumerRows.push(consumerRow(name, index, null, true, kinds[index % kinds.length]))
      } else {
        consumerRows.push(consumerRow(name, index, symbols[index % symbols.length]))
      }
    }
    consumers[name] = {
      rows: consumerRows,
      coverage: { candidateCount: count, duplicateRowIds: [] },
    }
  }
  return {
    mode: 'permissioned',
    exports: {
      rows,
      coverage: { candidateCount: EXPECTED_EXPORT_COUNT, duplicateRowIds: [] },
    },
    consumers,
  }
}

function privateDigest(adjudication) {
  const bytes = Buffer.from(`${JSON.stringify(adjudication, null, 2)}\n`)
  return { sha256: digest(bytes), bytes: bytes.length }
}

function allRecords(adjudication) {
  return [
    ...adjudication.exports.rows,
    ...Object.values(adjudication.consumers).flatMap((consumer) => consumer.rows),
  ]
}

function publicBytes(aggregate) {
  return `${JSON.stringify(aggregate, null, 2)}\n`
}

function forbiddenVocabulary(evidence) {
  const values = [
    ...Object.keys(evidence.consumers),
    evidence.package?.name,
    ...Object.keys(evidence.baselines ?? {}),
    ...evidence.exports.rows.flatMap((row) => [row.symbol, row.source]),
    ...Object.values(evidence.consumers).flatMap((consumer) => consumer.rows.flatMap((row) => [row.symbol, row.path])),
  ]
  return [...new Set(values.filter((value) => typeof value === 'string' && value.length > 1))]
}

function publicStrings(value) {
  if (typeof value === 'string') return [value]
  if (!value || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([key, child]) => [key, ...publicStrings(child)])
}

function runGit(cwd, args) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')))
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', env })
  if (result.error || result.status !== 0) {
    throw new Error(result.stderr || result.error?.message || `git exited ${String(result.status)}`)
  }
  return result.stdout.trim()
}

function validatePermissionedOutputUnderHookEnvironment(root, outputPath) {
  const repoRoot = process.cwd()
  const gitDir = path.resolve(repoRoot, runGit(repoRoot, ['rev-parse', '--git-dir']))
  const inventoryScript = path.resolve(process.cwd(), 'scripts/generate-sdk-export-inventory.mjs')
  const moduleUrl = pathToFileURL(inventoryScript).href
  const source = [
    `import { validatePermissionedOutput } from ${JSON.stringify(moduleUrl)}`,
    `validatePermissionedOutput(${JSON.stringify(root)}, ${JSON.stringify(outputPath)})`,
  ].join(';')
  return spawnSync(process.execPath, ['--input-type=module', '--eval', source], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env, LEFTHOOK: '1', GIT_DIR: gitDir, GIT_WORK_TREE: repoRoot },
  })
}

function safetyFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdk-dispositions-safety-'))
  temporaryRoots.push(root)
  fs.writeFileSync(path.join(root, '.gitignore'), 'scratch/\n')
  fs.writeFileSync(path.join(root, 'tracked.json'), '{}\n')
  fs.mkdirSync(path.join(root, 'scratch'))
  runGit(root, ['init', '-q'])
  runGit(root, ['config', 'user.email', 'fixture@example.test'])
  runGit(root, ['config', 'user.name', 'Fixture'])
  runGit(root, ['add', '.'])
  runGit(root, ['commit', '-qm', 'fixture'])
  const nested = path.join(root, 'nested-worktree')
  runGit(root, ['worktree', 'add', '-q', '--detach', nested])
  return { root, nested }
}

afterEach(() => {
  while (temporaryRoots.length > 0) fs.rmSync(temporaryRoots.pop(), { recursive: true, force: true })
})

describe('SDK export disposition adjudication', () => {
  it('builds the exact synthetic 2,605-key contract with 960/126/5 ownership', () => {
    const evidence = syntheticEvidence()
    const input = { sha256: EXPECTED_INPUT_SHA256, bytes: 3433242 }
    const adjudication = buildAdjudication({ evidence, input })
    const result = validateAdjudication(adjudication)
    expect(result.keys).toHaveLength(EXPECTED_KEY_COUNT)
    expect(result.exportGroups).toEqual({ workspace: 960, sourceClient: 126, connectorApi: 5 })
    expect(result.exportDestinations).toEqual({ 'packages/workspace/server': 960, 'source-client': 126, 'packages/connector-api': 5 })
    expect(result.exceptionCount).toBe(EXPECTED_EXCEPTION_COUNT)
  })

  it('joins every known consumer symbol to its export owner and isolates all exceptions', () => {
    const adjudication = buildAdjudication({ evidence: syntheticEvidence(), input: { sha256: EXPECTED_INPUT_SHA256, bytes: 3433242 } })
    const exportsBySymbol = new Map(adjudication.exports.rows.map((row) => [row.symbol, row]))
    const records = allRecords(adjudication)
    for (const record of records.filter((candidate) => candidate.rowKind === 'consumer')) {
      if (record.exceptionCode) {
        expect(record.runtimeSchema).toBe('metadata-none')
        expect(record.evidenceKeys).toEqual([record.evidenceKey])
        continue
      }
      const joined = exportsBySymbol.get(record.symbol)
      expect(joined).toBeDefined()
      expect(record.referencedOwnerRepository).toBe(joined.ownerRepository)
      expect(record.referencedDestinationPath).toBe(joined.destinationPath)
      expect(record.runtimeSchema).toBe(joined.runtimeSchema)
      expect(record.exceptionCode).toBeUndefined()
    }
  })

  it('has no missing required values, is deterministic, and projects only safe public fields', () => {
    const first = buildAdjudication({ evidence: syntheticEvidence(), input: { sha256: EXPECTED_INPUT_SHA256, bytes: 3433242 } })
    const second = buildAdjudication({ evidence: syntheticEvidence(), input: { sha256: EXPECTED_INPUT_SHA256, bytes: 3433242 } })
    const firstBytes = `${JSON.stringify(first, null, 2)}\n`
    const secondBytes = `${JSON.stringify(second, null, 2)}\n`
    expect(firstBytes).toBe(secondBytes)
    expect(privateDigest(first)).toEqual(privateDigest(second))
    for (const record of allRecords(first)) {
      for (const field of ['evidenceKey', 'ownerRepository', 'destinationPath', 'internalDisposition', 'runtimeSchema', 'compatibilityObligation', 'supportWindow', 'migrationOrder']) {
        expect(record[field]).not.toBeNull()
        expect(record[field]).not.toBeUndefined()
      }
    }
    const aggregate = buildPublicAggregate({ adjudication: first, privateDigest: privateDigest(first) })
    const publicText = publicBytes(aggregate)
    expect(publicText).not.toContain('"symbol"')
    expect(publicText).not.toContain('"path"')
    expect(publicText).not.toContain('"raw"')
    expect(publicText).not.toContain('src/')
    expect(publicText).not.toContain('@sparxie')
    expect(publicText).not.toContain('cravessant/')
    expect(aggregate.counts.exports).toBe(first.counts.exports)
    expect(aggregate.counts.consumerRows).toBe(first.counts.consumerRows)
    expect(aggregate.counts.keys).toBe(first.counts.keys)
    expect(aggregate.counts.exportGroups).toEqual({ workspace: 960, sourceClient: 126, connectorApi: 5 })
    expect(aggregate.counts.exportDestinations).toEqual({ workspaceServer: 960, sourceClient: 126, connectorApi: 5 })
    expect(aggregate.counts.dispositions).toEqual(first.counts.dispositions)
    expect(aggregate.exceptions.count).toBe(EXPECTED_EXCEPTION_COUNT)
    expect(aggregate.outOfScope.fleetIndexReconciliation).toEqual({
      previousRootIndexMemberCount: 7,
      currentRootIndexMemberCount: 8,
      workspaceManifestMemberCount: 8,
      status: 'resolved',
    })
  })

  it('fails closed on unknown S01 categories and path shapes', () => {
    const unknownExportCategory = syntheticEvidence()
    unknownExportCategory.exports.rows[0].category = 'unknown'
    expect(() => buildAdjudication({ evidence: unknownExportCategory, input: { sha256: EXPECTED_INPUT_SHA256, bytes: 3433242 } })).toThrow(/export category/u)
    const invalidExportPath = syntheticEvidence()
    invalidExportPath.exports.rows[0].source = '../escape.ts'
    expect(() => buildAdjudication({ evidence: invalidExportPath, input: { sha256: EXPECTED_INPUT_SHA256, bytes: 3433242 } })).toThrow(/export source path/u)
    const invalidConsumerPath = syntheticEvidence()
    invalidConsumerPath.consumers.app.rows[0].path = 'src/../escape.ts'
    expect(() => buildAdjudication({ evidence: invalidConsumerPath, input: { sha256: EXPECTED_INPUT_SHA256, bytes: 3433242 } })).toThrow(/consumer path shape/u)
    const unknownAppPath = syntheticEvidence()
    unknownAppPath.consumers.app.rows[30].path = 'src/unknown-surface.ts'
    expect(() => buildAdjudication({ evidence: unknownAppPath, input: { sha256: EXPECTED_INPUT_SHA256, bytes: 3433242 } })).toThrow(/App consumer path/u)
    const implementationTest = syntheticEvidence()
    implementationTest.consumers.app.rows[30].path = 'src/app/product.test.ts'
    const implementationAdjudication = buildAdjudication({ evidence: implementationTest, input: { sha256: EXPECTED_INPUT_SHA256, bytes: 3433242 } })
    expect(implementationAdjudication.consumers.app.rows[30].destinationPath).toBe('apps/desktop')
    const serverTest = syntheticEvidence()
    serverTest.consumers.app.rows[30].path = 'src/server/local-server.contract.test.ts'
    const serverAdjudication = buildAdjudication({ evidence: serverTest, input: { sha256: EXPECTED_INPUT_SHA256, bytes: 3433242 } })
    expect(serverAdjudication.consumers.app.rows[30].destinationPath).toBe('packages/workspace/server')
    const generatedClient = syntheticEvidence()
    generatedClient.consumers.app.rows[30].path = 'src/app/renderer-http-client.ts'
    const generatedClientAdjudication = buildAdjudication({ evidence: generatedClient, input: { sha256: EXPECTED_INPUT_SHA256, bytes: 3433242 } })
    expect(generatedClientAdjudication.consumers.app.rows[30].destinationPath).toBe('packages/workspace/client')
    expect(generatedClientAdjudication.consumers.app.rows[30].internalDisposition).toBe('replace-with-generated-client')
    expect(generatedClientAdjudication.consumers.app.rows[30].runtimeSchema).toBe('none-runtime-value')
    const portableConformance = syntheticEvidence()
    portableConformance.consumers.app.rows[30].path = 'src/conformance/workspace.test.ts'
    const conformanceAdjudication = buildAdjudication({ evidence: portableConformance, input: { sha256: EXPECTED_INPUT_SHA256, bytes: 3433242 } })
    expect(conformanceAdjudication.consumers.app.rows[30].destinationPath).toBe('packages/workspace/conformance')
  })

  it.skipIf(!actualEvidenceAvailable)('attests the approved S01 bytes and exact real key universe', () => {
    const { evidence, input } = readS01Evidence(ACTUAL_EVIDENCE_PATH)
    expect(input.sha256).toBe(EXPECTED_INPUT_SHA256)
    expect(evidence.exports.rows).toHaveLength(1091)
    expect(Object.values(evidence.consumers).reduce((sum, consumer) => sum + consumer.rows.length, 0)).toBe(1514)
    const adjudication = buildAdjudication({ evidence, input })
    const keys = allRecords(adjudication).map((record) => record.evidenceKey)
    expect(new Set(keys).size).toBe(EXPECTED_KEY_COUNT)
    const validation = validateAdjudication(adjudication)
    expect(validation.exceptionCount).toBe(44)
    const records = allRecords(adjudication)
    for (const record of records) {
      for (const value of Object.values(record)) {
        expect(value).not.toBeNull()
        expect(value).not.toBeUndefined()
      }
    }
    expect(new Set(adjudication.exports.rows.map((record) => record.runtimeSchema))).toEqual(new Set([
      'authored-runtime-schema',
      'generated-openapi-schema',
      'typescript-type',
      'none-runtime-value',
    ]))
    expect(new Set(records.map((record) => record.internalDisposition))).toEqual(new Set([
      'move',
      'regenerate-artifact',
      'regenerate-installed-state',
      'regenerate-lockfile',
      'rewrite-dependency',
      'rewrite-reference',
      'replace-with-generated-client',
    ]))
    expect(adjudication.counts.exportGroups).toEqual({ workspace: 960, sourceClient: 126, connectorApi: 5 })
    expect(adjudication.counts.exportDestinations).toEqual({
      'packages/workspace/server': 910,
      'packages/workspace/client': 50,
      'source-client': 126,
      'packages/connector-api': 5,
    })
    expect(adjudication.counts.consumerDestinations).toEqual({
      'packages/cli': 410,
      'apps/desktop': 389,
      'packages/connector-api': 47,
      'packages/connector-testkit': 8,
      'packages/workspace/client': 6,
      'packages/workspace/server': 654,
    })
    expect(adjudication.counts.dispositions).toEqual({
      move: 1091,
      'regenerate-artifact': 182,
      'regenerate-installed-state': 14,
      'regenerate-lockfile': 15,
      'rewrite-dependency': 5,
      'rewrite-reference': 1292,
      'replace-with-generated-client': 6,
    })
    expect(adjudication.exceptions.byCode).toEqual({
      'consumer-artifact-package-token': 4,
      'consumer-installed-package-metadata': 14,
      'consumer-lockfile-metadata': 15,
      'consumer-manifest-metadata': 5,
      'consumer-namespace-import': 2,
      'consumer-dynamic-import': 4,
    })
    expect(records.reduce((counts, record) => ({ ...counts, [record.runtimeSchema]: (counts[record.runtimeSchema] ?? 0) + 1 }), {})).toEqual({
      'typescript-type': 1220,
      'none-runtime-value': 640,
      'authored-runtime-schema': 674,
      'generated-openapi-schema': 27,
      'metadata-none': 44,
    })
    expect(new Set(allRecords(adjudication).filter((record) => record.exceptionCode).map((record) => record.exceptionRationale)).size).toBe(44)
    const exportsBySymbol = new Map(adjudication.exports.rows.map((record) => [record.symbol, record]))
    for (const record of records.filter((candidate) => candidate.rowKind === 'consumer' && !candidate.exceptionCode)) {
      const referenced = exportsBySymbol.get(record.symbol)
      expect(record.referencedOwnerRepository).toBe(referenced.ownerRepository)
      expect(record.referencedDestinationPath).toBe(referenced.destinationPath)
      expect(record.referencedRuntimeSchema).toBe(referenced.runtimeSchema)
    }
    const representatives = [
      'export:src/connector/connector.ts:134:1:ConnectorHistoricalBackfillState',
      'export:src/connector/connector-capabilities.ts:770:14:installedConnectorDescriptorSchema',
      'export:src/sourcing/source-execution.ts:9:1:SourceExecutionScopeId',
      'export:src/sourcing/source-ingestion-errors.ts:414:14:careerSourceErrorBodySchema',
      'export:src/transport/http-client.ts:119:1:createHttpValedictorianClient',
    ]
    for (const key of representatives) expect(adjudication.exports.rows.some((record) => record.evidenceKey === key)).toBe(true)
    const representativeRows = [
      ['app', 'src/App.test-helpers.ts', 'apps/desktop', 'rewrite-reference'],
      ['app', 'src/modules/lifecycle-table/CaptureCompletionModal.test.tsx', 'apps/desktop', 'rewrite-reference'],
      ['app', 'src/modules/profile/profile.composition.test.ts', 'packages/workspace/server', 'rewrite-reference'],
      ['app', 'src/runtime/local-lifecycle-methods.applications.pglite.test.ts', 'packages/workspace/server', 'rewrite-reference'],
      ['app', 'src/server/local-server.workspace-routing.test.ts', 'packages/workspace/server', 'rewrite-reference'],
      ['app', 'src/server/local-server.http-test-harness.ts', 'packages/workspace/server', 'rewrite-reference'],
      ['app', 'src/modules/connectors/public/connector.renderer-schema-validation.test.ts', 'apps/desktop', 'rewrite-reference'],
      ['app', 'src/app/renderer-http-client.ts', 'packages/workspace/client', 'replace-with-generated-client'],
      ['app', 'vendor/valedictorian-cli/dist/valedictorian-cli.js', 'packages/cli', 'regenerate-artifact'],
      ['cli', 'src/valedictorian-cli.application-commands.ts', 'packages/cli', 'rewrite-reference'],
      ['connectors', 'packages/core/src/capture.ts', 'packages/connector-api', 'rewrite-reference'],
    ]
    for (const [consumer, rowPath, destination, disposition] of representativeRows) {
      const source = evidence.consumers[consumer].rows.find((row) => row.path === rowPath)
      expect(source).toBeDefined()
      const record = adjudication.consumers[consumer].rows.find((candidate) => candidate.evidenceKey === `${consumer}:${source.id}`)
      expect(record.destinationPath).toBe(destination)
      expect(record.internalDisposition).toBe(disposition)
    }
    const generatedClientExpectations = {
      connectorOverviewListQuerySchema: { referencedRuntimeSchema: 'authored-runtime-schema', runtimeSchema: 'generated-openapi-schema' },
      connectorOverviewListResultSchema: { referencedRuntimeSchema: 'authored-runtime-schema', runtimeSchema: 'generated-openapi-schema' },
      ValedictorianClientV2: { referencedRuntimeSchema: 'typescript-type', runtimeSchema: 'typescript-type' },
      ConnectorSchedulingCapability: { referencedRuntimeSchema: 'typescript-type', runtimeSchema: 'typescript-type' },
      createHttpValedictorianClient: { referencedRuntimeSchema: 'none-runtime-value', runtimeSchema: 'none-runtime-value' },
      DEFAULT_CONNECTOR_OVERVIEW_LIST_LIMIT: { referencedRuntimeSchema: 'none-runtime-value', runtimeSchema: 'none-runtime-value' },
    }
    const generatedClientRecords = records.filter((record) => record.internalDisposition === 'replace-with-generated-client')
    expect(generatedClientRecords).toHaveLength(6)
    expect(new Set(generatedClientRecords.map((record) => record.symbol))).toEqual(new Set(Object.keys(generatedClientExpectations)))
    for (const [symbol, expected] of Object.entries(generatedClientExpectations)) {
      const source = evidence.consumers.app.rows.find((row) => row.path === (symbol.startsWith('connectorOverview') || symbol === 'DEFAULT_CONNECTOR_OVERVIEW_LIST_LIMIT' || symbol === 'ConnectorSchedulingCapability' ? 'src/modules/connectors/adapters/connector.workspace-client.ts' : 'src/app/renderer-http-client.ts') && row.symbol === symbol)
      expect(source).toBeDefined()
      const record = adjudication.consumers.app.rows.find((candidate) => candidate.evidenceKey === `app:${source.id}`)
      expect(record.destinationPath).toBe('packages/workspace/client')
      expect(record.internalDisposition).toBe('replace-with-generated-client')
      expect(record.runtimeSchema).toBe(expected.runtimeSchema)
      expect(record.referencedRuntimeSchema).toBe(expected.referencedRuntimeSchema)
    }
    const generatedPrivate = privateDigest(adjudication)
    const privateOutputPath = process.env.S01_PRIVATE_OUTPUT_PATH
    if (privateOutputPath) {
      const checkedPrivate = fs.readFileSync(privateOutputPath, 'utf8')
      expect(checkedPrivate).toBe(`${JSON.stringify(adjudication, null, 2)}\n`)
      expect(privateDigest(adjudication)).toEqual({ sha256: digest(checkedPrivate), bytes: Buffer.byteLength(checkedPrivate) })
    }
    const generatedPublic = buildPublicAggregate({ adjudication, privateDigest: generatedPrivate })
    const checkedInPublic = fs.readFileSync(path.resolve(process.cwd(), 'evidence/sdk-export-dispositions.json'), 'utf8')
    expect(publicBytes(generatedPublic)).toBe(checkedInPublic)
    const publicText = checkedInPublic
    const publicValues = publicStrings(JSON.parse(checkedInPublic))
    for (const token of forbiddenVocabulary(evidence)) expect(publicValues).not.toContain(token)
    expect(publicText).not.toContain('consumerRowsByName')
    expect(publicText).not.toContain('commit')
    expect(publicText).not.toContain('raw')
    const driftedCategory = JSON.parse(JSON.stringify(evidence))
    driftedCategory.consumers.app.rows[0].category = 'unknown'
    expect(() => buildAdjudication({ evidence: driftedCategory, input })).toThrow(/consumer category/u)
    const driftedPath = JSON.parse(JSON.stringify(evidence))
    driftedPath.consumers.cli.rows[0].path = 'unapproved/path.ts'
    expect(() => buildAdjudication({ evidence: driftedPath, input })).toThrow(/CLI consumer path/u)
  })
})

describe('permissioned disposition output safety', () => {
  it('rejects tracked, nonignored, nested-worktree, and symlink escape targets', () => {
    const fixture = safetyFixture()
    expect(() => validatePermissionedOutput(fixture.root, path.join(fixture.root, 'tracked.json'))).toThrow(/tracked path/u)
    expect(() => validatePermissionedOutput(fixture.root, path.join(fixture.root, 'plain-output.json'))).toThrow(/ignored inside a worktree/u)
    expect(() => validatePermissionedOutput(fixture.root, path.join(fixture.nested, 'nested-output.json'))).toThrow(/ignored inside a worktree/u)
    const trackedLink = path.join(fixture.root, 'tracked-link.json')
    fs.symlinkSync(path.join(fixture.root, 'tracked.json'), trackedLink)
    expect(() => validatePermissionedOutput(fixture.root, trackedLink)).toThrow(/tracked path/u)
    const nestedLink = path.join(fixture.root, 'nested-link.json')
    fs.symlinkSync(path.join(fixture.nested, 'nested-output.json'), nestedLink)
    expect(() => validatePermissionedOutput(fixture.root, nestedLink)).toThrow(/ignored inside a worktree/u)
    expect(validatePermissionedOutput(fixture.root, path.join(fixture.root, 'scratch', 'private.json'))).toBe(path.join(fixture.root, 'scratch', 'private.json'))
  })

  it('roots git safety checks to the explicit fixture under hook git variables', () => {
    const fixture = safetyFixture()
    const result = validatePermissionedOutputUnderHookEnvironment(fixture.root, path.join(fixture.root, 'tracked.json'))
    expect(result.status).not.toBe(0)
    expect(`${result.stdout}${result.stderr}`).toMatch(/tracked path/u)
  })

  it('refuses an input with the wrong attachment hash before parsing it', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdk-dispositions-hash-'))
    temporaryRoots.push(root)
    const inputPath = path.join(root, 'evidence.json')
    fs.writeFileSync(inputPath, '{}\n')
    expect(() => readS01Evidence(inputPath)).toThrow(/SHA-256/u)
  })
})
