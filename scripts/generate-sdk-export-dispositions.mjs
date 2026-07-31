import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { validatePermissionedOutput } from './generate-sdk-export-inventory.mjs'

export const EXPECTED_INPUT_SHA256 = '19ec526110f655244f0eb4947befad5273f2f6172cc011db69b20ef0d2a0bf97'
export const EXPECTED_PUBLIC_EVIDENCE_SHA256 = 'ed47ef2ae23b13db4d229c5aeccfcbd1d25431c8c388d71ed16e1ed2fdb83577'
export const EXPECTED_EXPORT_COUNT = 1091
export const EXPECTED_CONSUMER_COUNT = 1514
export const EXPECTED_KEY_COUNT = EXPECTED_EXPORT_COUNT + EXPECTED_CONSUMER_COUNT
export const EXPECTED_EXCEPTION_COUNT = 44

const CONSUMER_NAMES = ['app', 'cli', 'connectors']
const SDK_PACKAGE = '@sparxie/sdk'
const EXPECTED_CONSUMER_ROWS = { app: 1237, cli: 226, connectors: 51 }
const CONNECTOR_EXPORT_IDS = new Set([
  'export:src/connector/connector.ts:134:1:ConnectorHistoricalBackfillState',
  'export:src/connector/connector.ts:126:1:ConnectorNewestFrontierState',
  'export:src/connector/connector-capabilities.ts:659:1:ConnectorVersionedRendererSchema',
  'export:src/connector/connector-capabilities.ts:770:14:installedConnectorDescriptorSchema',
  'export:src/capture.ts:23:14:sourceAdapterKinds',
])
const APP_SOURCE_BOUNDARY_SYMBOLS = new Set([
  'SourceExecutionScopeId',
  'sourceExecutionScopeIdSchema',
  'SourceOperationOutcome',
  'sourceOperationOutcomeSchema',
])
const DESTINATIONS = {
  workspaceServer: 'packages/workspace/server',
  workspaceClient: 'packages/workspace/client',
  workspaceConformance: 'packages/workspace/conformance',
  productApp: 'apps/desktop',
  connectorApi: 'packages/connector-api',
  sourceClient: 'source-client',
  cli: 'packages/cli',
  connectorTestkit: 'packages/connector-testkit',
}
const OWNER_REPOSITORIES = {
  product: 'cravessant/valedictorian',
  source: 'cravessant/valedictorian-source',
}
const SUPPORT_WINDOW_ID = 'p01-two-releases-and-30-days'
const COMPATIBILITY_POLICY_ID = 'sdk-facade-until-maintained-consumers-migrate'
const MIGRATION_ORDER_POLICY_ID = 'expand-migrate-contract-producer-first'
const SUPPORT_WINDOW = {
  id: SUPPORT_WINDOW_ID,
  consecutiveProductReleases: 2,
  minimumDays: 30,
  exitCondition: 'all-maintained-consumers-migrated',
}
const MIGRATION_ORDERS = {
  producer: '01-producer-foundations',
  release: '02-successor-release',
  consumer: '03-consumer-migration',
  metadata: '03-consumer-metadata',
  contract: '04-facade-contraction',
}
const EXPORT_SCHEMA_CLASSES = new Set(['schema-named', 'not-schema-named'])
const EXPORT_COMPATIBILITY_CLASSES = new Set(['runtime-export', 'type-only-export'])
const CONSUMER_CATEGORIES = new Set(['artifact', 'installed', 'lockfile', 'manifest', 'source-import'])
const REFERENCE_KINDS = new Set([
  'artifact-import-specifier',
  'artifact-package-token',
  'installed-package-json',
  'lockfile-line',
  'package-manifest',
  'import-specifier',
  'export-specifier',
  'namespace-import',
  'namespace-property',
  'dynamic-import',
])
const UNRESOLVED_SYMBOLS = {
  'artifact-package-token': '<artifact>',
  'installed-package-json': SDK_PACKAGE,
  'lockfile-line': SDK_PACKAGE,
  'package-manifest': SDK_PACKAGE,
  'namespace-import': '<namespace>',
  'dynamic-import': '<dynamic>',
}
const VALID_DESTINATIONS = new Set(Object.values(DESTINATIONS))
const VALID_EXCEPTION_CODES = new Set([
  'consumer-artifact-package-token',
  'consumer-installed-package-metadata',
  'consumer-lockfile-metadata',
  'consumer-manifest-metadata',
  'consumer-namespace-import',
  'consumer-dynamic-import',
])

function digestBytes(value) {
  return createHash('sha256').update(value).digest('hex')
}

function fileDigest(filePath) {
  const bytes = fs.readFileSync(filePath)
  return { sha256: digestBytes(bytes), bytes: bytes.length }
}

function fail(message) {
  throw new Error(message)
}

function assert(condition, message) {
  if (!condition) fail(message)
}

function assertString(value, message) {
  assert(typeof value === 'string' && value.length > 0, message)
}

function assertOptionalLocation(value, message) {
  assert(value === null || (Number.isInteger(value) && value > 0), message)
}

function assertExportInputRow(row) {
  assert(row && typeof row === 'object', 'S01 export row is not an object')
  for (const field of ['id', 'symbol', 'source', 'declarationKind']) assertString(row[field], 'S01 export row has an invalid field')
  assert(row.category === 'export', 'S01 export category is invalid')
  assert(/^src\/.+\.tsx?$/u.test(row.source), 'S01 export source path is invalid')
  assert(Number.isInteger(row.sourceLine) && row.sourceLine > 0, 'S01 export row line is invalid')
  assert(Number.isInteger(row.sourceColumn) && row.sourceColumn > 0, 'S01 export row column is invalid')
  assert(EXPORT_SCHEMA_CLASSES.has(row.schemaClassification), 'S01 export schema classification is invalid')
  assert(EXPORT_COMPATIBILITY_CLASSES.has(row.compatibilityClassification), 'S01 export compatibility classification is invalid')
}

function assertConsumerInputRow(row) {
  assert(row && typeof row === 'object', 'S01 consumer row is not an object')
  for (const field of ['id', 'symbol', 'path', 'category', 'referenceKind']) assertString(row[field], 'S01 consumer row has an invalid field')
  assert(!row.path.startsWith('/') && !row.path.split('/').includes('..'), 'S01 consumer path shape is invalid')
  assert(CONSUMER_CATEGORIES.has(row.category), 'S01 consumer category is invalid')
  assert(REFERENCE_KINDS.has(row.referenceKind), 'S01 consumer reference kind is invalid')
  assert(typeof row.symbolKnown === 'boolean', 'S01 consumer symbol-known flag is invalid')
  assertOptionalLocation(row.line, 'S01 consumer line is invalid')
  assertOptionalLocation(row.column, 'S01 consumer column is invalid')
  if (!row.symbolKnown) assert(UNRESOLVED_SYMBOLS[row.referenceKind] === row.symbol, 'S01 unresolved consumer sentinel is invalid')
  if (row.symbolKnown) assert(!Object.values(UNRESOLVED_SYMBOLS).includes(row.symbol), 'S01 known consumer symbol is a sentinel')
  if (row.category === 'artifact') assert(row.referenceKind.startsWith('artifact-'), 'S01 artifact reference kind is invalid')
  if (row.category === 'installed') assert(row.referenceKind === 'installed-package-json', 'S01 installed reference kind is invalid')
  if (row.category === 'lockfile') assert(row.referenceKind === 'lockfile-line', 'S01 lockfile reference kind is invalid')
  if (row.category === 'manifest') assert(row.referenceKind === 'package-manifest', 'S01 manifest reference kind is invalid')
  if (row.category === 'source-import') assert(!row.referenceKind.startsWith('artifact-'), 'S01 source reference kind is invalid')
  if (!row.symbolKnown) {
    const unresolvedPair = `${row.category}:${row.referenceKind}`
    assert([
      'artifact:artifact-package-token',
      'installed:installed-package-json',
      'lockfile:lockfile-line',
      'manifest:package-manifest',
      'source-import:namespace-import',
      'source-import:dynamic-import',
    ].includes(unresolvedPair), 'S01 unresolved category/reference pair is invalid')
  }
}

function assertInputShape(evidence) {
  assert(evidence && typeof evidence === 'object', 'S01 evidence is not an object')
  assert(evidence.mode === 'permissioned', 'S01 evidence mode is not permissioned')
  assert(Array.isArray(evidence.exports?.rows), 'S01 export rows are missing')
  assert(evidence.exports.rows.length === EXPECTED_EXPORT_COUNT, 'S01 export count is not 1,091')
  assert(evidence.exports.coverage?.candidateCount === EXPECTED_EXPORT_COUNT, 'S01 export coverage is incomplete')
  assert(evidence.exports.coverage?.duplicateRowIds?.length === 0, 'S01 export rows contain duplicate IDs')
  evidence.exports.rows.forEach(assertExportInputRow)
  assert(Object.keys(evidence.consumers ?? {}).sort().join(',') === CONSUMER_NAMES.join(','), 'S01 consumer set is not app, cli, connectors')
  for (const name of CONSUMER_NAMES) {
    const consumer = evidence.consumers[name]
    assert(Array.isArray(consumer?.rows), 'S01 consumer rows are missing')
    assert(consumer.rows.length === EXPECTED_CONSUMER_ROWS[name], 'S01 consumer count is unexpected')
    assert(consumer.coverage?.candidateCount === EXPECTED_CONSUMER_ROWS[name], 'S01 consumer coverage is incomplete')
    assert(consumer.coverage?.duplicateRowIds?.length === 0, 'S01 consumer rows contain duplicate IDs')
    consumer.rows.forEach(assertConsumerInputRow)
  }
}

export function readS01Evidence(inputPath, expectedHash = EXPECTED_INPUT_SHA256) {
  const bytes = fs.readFileSync(inputPath)
  const input = { sha256: digestBytes(bytes), bytes: bytes.length }
  assert(input.sha256 === expectedHash, 'S01 evidence SHA-256 does not match the approved attachment')
  let evidence
  try {
    evidence = JSON.parse(bytes.toString('utf8'))
  } catch {
    fail('S01 evidence is not valid JSON')
  }
  assertInputShape(evidence)
  return { evidence, input }
}

function isSourceExport(row) {
  return row.source.startsWith('src/sourcing/') && !APP_SOURCE_BOUNDARY_SYMBOLS.has(row.symbol)
}

function isWorkspaceClientSource(source) {
  return source === 'src/api.ts'
    || source === 'src/client.ts'
    || source === 'src/company-client.ts'
    || source === 'src/lifecycle-client.ts'
    || source === 'src/capture-resolution-client.ts'
    || source.startsWith('src/transport/')
    || /(?:^|\/)[^/]*client[^/]*\.tsx?$/u.test(source)
}

function isConformanceConsumerPath(consumer, filePath) {
  return consumer === 'app' && (
    filePath.startsWith('src/conformance/')
    || filePath.startsWith('tests/conformance/')
    || filePath.startsWith('tests/contract/')
  )
}

function isProductAppSurfacePath(filePath) {
  return filePath === 'src/App.test-helpers.ts'
    || filePath.startsWith('electron/')
    || filePath.startsWith('src/app/')
    || filePath.startsWith('src/ipc/')
    || filePath.startsWith('src/settings/')
    || filePath.startsWith('src/modules/lifecycle-table/')
    || filePath.startsWith('src/modules/workspace-resources/')
    || /^src\/modules\/profile\/Profile[^/]*\.tsx?$/u.test(filePath)
    || /^src\/modules\/connectors\/public\/connector\.(?:renderer|run-presentation|status-view)/u.test(filePath)
}

function isWorkspaceClientConsumerPath(filePath) {
  return filePath === 'src/app/renderer-http-client.ts'
    || filePath === 'src/modules/connectors/adapters/connector.workspace-client.ts'
}

function isVendoredCliPath(filePath) {
  return filePath.startsWith('vendor/valedictorian-cli/')
    || filePath.includes('/@sparxie+valedictorian-cli@')
}

function isConnectorCorePath(filePath) {
  return filePath.startsWith('packages/core/')
    || filePath.includes('/@sparxie+valedictorian-connectors-core@')
}

function isConnectorTestkitPath(filePath) {
  return filePath.startsWith('packages/test-harness/')
    || filePath.includes('/@sparxie+valedictorian-connectors-test-harness@')
}

function isSdkInstalledPath(filePath) {
  return filePath.endsWith('/@sparxie/sdk/package.json')
    || filePath.includes('/@sparxie+sdk@')
}

function isApprovedAppSourcePath(filePath) {
  return filePath === 'src/App.test-helpers.ts'
    || ['src/app/', 'src/conformance/', 'src/ipc/', 'src/modules/', 'src/runtime/', 'src/server/', 'src/settings/', 'src/workspace/']
      .some((prefix) => filePath.startsWith(prefix))
}

function workspaceDestinationForConsumer(row) {
  if (isConformanceConsumerPath('app', row.path)) return DESTINATIONS.workspaceConformance
  if (isWorkspaceClientConsumerPath(row.path)) return DESTINATIONS.workspaceClient
  if (isProductAppSurfacePath(row.path)) return DESTINATIONS.productApp
  return DESTINATIONS.workspaceServer
}

function exportOwner(row) {
  if (CONNECTOR_EXPORT_IDS.has(row.id)) {
    return { group: 'connectorApi', ownerRepository: OWNER_REPOSITORIES.product, destinationPath: DESTINATIONS.connectorApi }
  }
  if (isSourceExport(row)) {
    return { group: 'sourceClient', ownerRepository: OWNER_REPOSITORIES.source, destinationPath: DESTINATIONS.sourceClient }
  }
  const destinationPath = isWorkspaceClientSource(row.source)
    ? DESTINATIONS.workspaceClient
    : DESTINATIONS.workspaceServer
  return { group: 'workspace', ownerRepository: OWNER_REPOSITORIES.product, destinationPath }
}

function exportRuntimeSchema(row, owner) {
  if (row.compatibilityClassification === 'type-only-export') return 'typescript-type'
  if (row.schemaClassification === 'schema-named') {
    return owner.group === 'sourceClient' ? 'generated-openapi-schema' : 'authored-runtime-schema'
  }
  return 'none-runtime-value'
}

function compatibilityObligation() {
  return COMPATIBILITY_POLICY_ID
}

function baseDisposition(owner, migrationOrder) {
  return {
    ownerRepository: owner.ownerRepository,
    destinationPath: owner.destinationPath,
    internalDisposition: 'move',
    compatibilityObligation: compatibilityObligation(),
    supportWindow: SUPPORT_WINDOW_ID,
    migrationOrder,
  }
}

function exportRecord(row) {
  const owner = exportOwner(row)
  return {
    evidenceKey: row.id,
    evidenceKeys: [row.id],
    rowKind: 'export',
    category: row.category,
    symbol: row.symbol,
    source: row.source,
    sourceLine: row.sourceLine,
    sourceColumn: row.sourceColumn,
    ownerGroup: owner.group,
    ...baseDisposition(owner, MIGRATION_ORDERS.producer),
    runtimeSchema: exportRuntimeSchema(row, owner),
  }
}

function exceptionCode(row) {
  if (row.category === 'artifact' && row.referenceKind === 'artifact-package-token') return 'consumer-artifact-package-token'
  if (row.category === 'installed') return 'consumer-installed-package-metadata'
  if (row.category === 'lockfile') return 'consumer-lockfile-metadata'
  if (row.category === 'manifest') return 'consumer-manifest-metadata'
  if (row.referenceKind === 'namespace-import') return 'consumer-namespace-import'
  if (row.referenceKind === 'dynamic-import') return 'consumer-dynamic-import'
  return 'consumer-unresolved-boundary'
}

function consumerOwner(consumer, row) {
  if (consumer === 'cli') {
    assert(row.path === 'package.json' || row.path === 'pnpm-lock.yaml' || row.path.startsWith('src/') || row.path.startsWith('node_modules/'), 'CLI consumer path is outside the approved surface')
    if (row.path.startsWith('node_modules/')) assert(isSdkInstalledPath(row.path), 'CLI installed path is outside the approved surface')
    return { ownerRepository: OWNER_REPOSITORIES.product, destinationPath: DESTINATIONS.cli }
  }
  if (consumer === 'connectors') {
    assert(row.path === 'pnpm-lock.yaml' || row.path.startsWith('node_modules/') || isConnectorCorePath(row.path) || isConnectorTestkitPath(row.path), 'Connector consumer path is outside the approved surface')
    if (row.path.startsWith('node_modules/')) assert(isSdkInstalledPath(row.path), 'Connector installed path is outside the approved surface')
    return {
      ownerRepository: OWNER_REPOSITORIES.product,
      destinationPath: isConnectorTestkitPath(row.path) ? DESTINATIONS.connectorTestkit : DESTINATIONS.connectorApi,
    }
  }
  assert(
    row.path === 'package.json'
      || row.path === 'pnpm-lock.yaml'
      || isApprovedAppSourcePath(row.path)
      || row.path.startsWith('tests/')
      || row.path.startsWith('electron/')
      || row.path.startsWith('vendor/valedictorian-cli/')
      || row.path.startsWith('node_modules/'),
    'App consumer path is outside the approved surface',
  )
  if (row.path.startsWith('node_modules/')) {
    assert(isSdkInstalledPath(row.path) || isVendoredCliPath(row.path) || isConnectorCorePath(row.path) || isConnectorTestkitPath(row.path), 'App installed path is outside the approved surface')
  }
  if (isVendoredCliPath(row.path)) return { ownerRepository: OWNER_REPOSITORIES.product, destinationPath: DESTINATIONS.cli }
  if (isConnectorTestkitPath(row.path)) return { ownerRepository: OWNER_REPOSITORIES.product, destinationPath: DESTINATIONS.connectorTestkit }
  if (isConnectorCorePath(row.path)) return { ownerRepository: OWNER_REPOSITORIES.product, destinationPath: DESTINATIONS.connectorApi }
  if (row.category !== 'source-import') return { ownerRepository: OWNER_REPOSITORIES.product, destinationPath: DESTINATIONS.productApp }
  return { ownerRepository: OWNER_REPOSITORIES.product, destinationPath: workspaceDestinationForConsumer(row) }
}

function consumerDisposition(consumer, row, exception, destinationPath) {
  if (exception) {
    if (row.category === 'artifact') return 'regenerate-artifact'
    if (row.category === 'installed') return 'regenerate-installed-state'
    if (row.category === 'lockfile') return 'regenerate-lockfile'
    if (row.category === 'manifest') return 'rewrite-dependency'
    if (row.referenceKind === 'namespace-import' || row.referenceKind === 'dynamic-import') return 'rewrite-reference'
    fail('Unknown consumer exception classification')
  }
  if (row.category === 'artifact') return 'regenerate-artifact'
  if (row.category === 'installed') return 'regenerate-installed-state'
  if (row.category === 'lockfile') return 'regenerate-lockfile'
  if (row.category === 'manifest') return 'rewrite-dependency'
  if (consumer === 'app' && destinationPath === DESTINATIONS.workspaceClient) return 'replace-with-generated-client'
  return 'rewrite-reference'
}

function successorRuntimeSchema(disposition, referencedRuntimeSchema, referencedExport) {
  const hasAuthoredSchema = referencedRuntimeSchema === 'authored-runtime-schema'
    || referencedExport?.schemaClassification === 'schema-named'
  return disposition === 'replace-with-generated-client' && hasAuthoredSchema
    ? 'generated-openapi-schema'
    : referencedRuntimeSchema
}

function exceptionRationale(consumer, row, destinationPath, code, evidenceKey) {
  const expectedCode = exceptionCode(row)
  assert(code === expectedCode, 'Consumer exception code drifted')
  const reason = {
    'consumer-artifact-package-token': 'built artifact contains a package token without a named export; regenerate the artifact at its owning package',
    'consumer-installed-package-metadata': 'installed package metadata records a transitive SDK copy; regenerate node_modules state from the owning manifest',
    'consumer-lockfile-metadata': 'lockfile line records dependency resolution without a symbol join; regenerate the lockfile for the owning package',
    'consumer-manifest-metadata': 'manifest dependency has no symbol join; rewrite the dependency in the owning package manifest',
    'consumer-namespace-import': 'namespace import has no statically named export join; rewrite the reference against the successor surface',
    'consumer-dynamic-import': 'dynamic import has no statically named export join; rewrite the reference against the successor surface',
  }[code]
  assert(reason, 'Unknown consumer exception rationale')
  return `${consumer} ${row.category}/${row.referenceKind} at ${row.path} [${evidenceKey}]: ${reason} (${destinationPath})`
}

function consumerRecord(consumer, row, exportMap) {
  const evidenceKey = `${consumer}:${row.id}`
  const known = row.symbolKnown === true
  const joined = known ? exportMap.get(row.symbol) : null
  if (known) assert(joined, 'S01 known-symbol consumer row does not join an export')
  const owner = consumerOwner(consumer, row)
  const referenced = joined ? exportOwner(joined) : null
  const exception = known ? null : exceptionCode(row)
  const disposition = consumerDisposition(consumer, row, exception, owner.destinationPath)
  const referencedRuntimeSchema = joined ? exportRuntimeSchema(joined, referenced) : 'metadata-none'
  const record = {
    evidenceKey,
    evidenceKeys: [evidenceKey],
    rowKind: 'consumer',
    consumer,
    category: row.category,
    referenceKind: row.referenceKind,
    symbol: row.symbol,
    path: row.path,
    ...(row.line === null || row.line === undefined ? {} : { line: row.line }),
    ...(row.column === null || row.column === undefined ? {} : { column: row.column }),
    ...baseDisposition(owner, exception ? MIGRATION_ORDERS.metadata : MIGRATION_ORDERS.consumer),
    internalDisposition: disposition,
    runtimeSchema: successorRuntimeSchema(disposition, referencedRuntimeSchema, joined),
  }
  if (referenced) {
    record.referencedOwnerRepository = referenced.ownerRepository
    record.referencedDestinationPath = referenced.destinationPath
    record.referencedRuntimeSchema = referencedRuntimeSchema
  }
  if (exception) {
    record.exceptionCode = exception
    record.exceptionRationale = exceptionRationale(consumer, row, owner.destinationPath, exception, evidenceKey)
  }
  return record
}

function countBy(values) {
  return values.reduce((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1
    return counts
  }, {})
}

function validateUniqueKeys(keys) {
  const unique = new Set(keys)
  assert(unique.size === keys.length, 'S01 evidence contains duplicate adjudication keys')
  assert(unique.size === EXPECTED_KEY_COUNT, 'S01 adjudication key count is not 2,605')
}

function evidenceKeys(evidence) {
  return [
    ...evidence.exports.rows.map((row) => row.id),
    ...CONSUMER_NAMES.flatMap((name) => evidence.consumers[name].rows.map((row) => `${name}:${row.id}`)),
  ]
}

function assertKeySetEqual(expected, actual) {
  validateUniqueKeys(expected)
  validateUniqueKeys(actual)
  assert(expected.length === actual.length && expected.every((key) => actual.includes(key)), 'Adjudication keys do not exactly match S01 evidence')
}

function validateRecord(record) {
  for (const field of [
    'evidenceKey',
    'ownerRepository',
    'destinationPath',
    'internalDisposition',
    'runtimeSchema',
    'compatibilityObligation',
    'supportWindow',
    'migrationOrder',
  ]) assertString(record[field], `Adjudication record is missing ${field}`)
  assert(Array.isArray(record.evidenceKeys) && record.evidenceKeys.length > 0, 'Adjudication record is missing evidence keys')
  assert(record.rowKind === 'export' || record.rowKind === 'consumer', 'Adjudication row kind is invalid')
  assert([
    'move',
    'internalize',
    'retire',
    'compat-facade',
    'replace-with-generated-client',
    'rewrite-reference',
    'regenerate-artifact',
    'regenerate-lockfile',
    'regenerate-installed-state',
    'rewrite-dependency',
  ].includes(record.internalDisposition), 'Adjudication disposition is invalid')
  assert(['authored-runtime-schema', 'generated-openapi-schema', 'typescript-type', 'none-runtime-value', 'metadata-none'].includes(record.runtimeSchema), 'Adjudication schema classification is invalid')
  assert(VALID_DESTINATIONS.has(record.destinationPath), 'Adjudication destination is invalid')
  if (record.rowKind === 'export') {
    assert(record.internalDisposition === 'move', 'Export disposition is invalid')
    assertString(record.ownerGroup, 'Export owner group is missing')
    assert(record.exceptionCode === undefined && record.exceptionRationale === undefined, 'Export has an unexpected exception')
    assert(!record.referencedOwnerRepository && !record.referencedDestinationPath, 'Export has an unexpected referenced owner')
    return
  }
  for (const field of ['consumer', 'category', 'referenceKind', 'symbol', 'path']) assertString(record[field], `Consumer record is missing ${field}`)
  assert(CONSUMER_NAMES.includes(record.consumer), 'Consumer record name is invalid')
  assert(CONSUMER_CATEGORIES.has(record.category), 'Consumer record category is invalid')
  assert(REFERENCE_KINDS.has(record.referenceKind), 'Consumer record reference kind is invalid')
  const exception = record.exceptionCode !== undefined
  if (exception) {
    assertString(record.exceptionCode, 'Adjudication exception code is invalid')
    assert(VALID_EXCEPTION_CODES.has(record.exceptionCode), 'Adjudication exception code is unknown')
    assertString(record.exceptionRationale, 'Adjudication exception rationale is missing')
    assert(record.exceptionRationale.includes(record.evidenceKey), 'Adjudication exception rationale is not row-specific')
    assert(record.exceptionRationale.includes(`${record.category}/${record.referenceKind}`), 'Adjudication exception rationale is not tied to category and reference')
    assert(record.exceptionRationale.includes(` at ${record.path} `), 'Adjudication exception rationale is not tied to path')
    const expectedException = record.category === 'artifact' && record.referenceKind === 'artifact-package-token'
      ? 'consumer-artifact-package-token'
      : record.category === 'installed'
        ? 'consumer-installed-package-metadata'
        : record.category === 'lockfile'
          ? 'consumer-lockfile-metadata'
          : record.category === 'manifest'
            ? 'consumer-manifest-metadata'
            : record.referenceKind === 'namespace-import'
              ? 'consumer-namespace-import'
              : record.referenceKind === 'dynamic-import'
                ? 'consumer-dynamic-import'
                : null
    assert(record.exceptionCode === expectedException, 'Adjudication exception code does not match category and reference')
    assert(!record.referencedOwnerRepository && !record.referencedDestinationPath, 'Exception has an unexpected referenced owner')
    assert(record.runtimeSchema === 'metadata-none', 'Exception schema classification is invalid')
    return
  }
  assertString(record.referencedOwnerRepository, 'Known consumer referenced owner is missing')
  assertString(record.referencedDestinationPath, 'Known consumer referenced destination is missing')
  assertString(record.referencedRuntimeSchema, 'Known consumer referenced schema is missing')
  if (record.internalDisposition === 'replace-with-generated-client') {
    assert(record.destinationPath === DESTINATIONS.workspaceClient, 'Generated client replacement has an invalid destination')
    assert(record.referencedRuntimeSchema !== 'metadata-none', 'Generated client replacement has metadata-only linkage')
    const expectedRuntimeSchema = record.referencedRuntimeSchema === 'authored-runtime-schema'
      ? 'generated-openapi-schema'
      : record.referencedRuntimeSchema
    assert(record.runtimeSchema === expectedRuntimeSchema, 'Generated client replacement schema is invalid')
    return
  }
  assert(record.referencedRuntimeSchema === record.runtimeSchema, 'Known consumer schema linkage is inconsistent')
}

export function validateAdjudication(adjudication) {
  const records = [
    ...adjudication.exports.rows,
    ...CONSUMER_NAMES.flatMap((name) => adjudication.consumers[name].rows),
  ]
  const keys = records.map((record) => record.evidenceKey)
  validateUniqueKeys(keys)
  for (const record of records) validateRecord(record)
  const exportGroups = countBy(adjudication.exports.rows.map((record) => record.ownerGroup))
  const exportDestinations = countBy(adjudication.exports.rows.map((record) => record.destinationPath))
  assert(exportGroups.workspace === 960, 'Workspace export ownership count is not 960')
  assert(exportGroups.sourceClient === 126, 'Source export ownership count is not 126')
  assert(exportGroups.connectorApi === 5, 'Connector export ownership count is not 5')
  assert((exportDestinations[DESTINATIONS.workspaceServer] ?? 0) + (exportDestinations[DESTINATIONS.workspaceClient] ?? 0) === 960, 'Workspace subdestination count is invalid')
  const exceptions = records.filter((record) => record.exceptionCode !== undefined)
  assert(exceptions.length === EXPECTED_EXCEPTION_COUNT, 'Explicit metadata exception count is not 44')
  assert(exceptions.every((record) => record.runtimeSchema === 'metadata-none'), 'Metadata exception schema classification is invalid')
  assert(new Set(exceptions.map((record) => record.exceptionRationale)).size === EXPECTED_EXCEPTION_COUNT, 'Exception rationales are not row-specific')
  assert(adjudication.counts.exports === EXPECTED_EXPORT_COUNT, 'Adjudication export count is invalid')
  assert(adjudication.counts.consumerRows === EXPECTED_CONSUMER_COUNT, 'Adjudication consumer count is invalid')
  assert(adjudication.counts.keys === EXPECTED_KEY_COUNT, 'Adjudication key count is invalid')
  assert(JSON.stringify(adjudication.counts.exportGroups) === JSON.stringify(exportGroups), 'Export owner aggregate is inconsistent')
  assert(JSON.stringify(adjudication.counts.exportDestinations) === JSON.stringify(exportDestinations), 'Export destination aggregate is inconsistent')
  const consumerDestinations = countBy(records.filter((record) => record.rowKind === 'consumer').map((record) => record.destinationPath))
  const dispositions = countBy(records.map((record) => record.internalDisposition))
  assert(JSON.stringify(adjudication.counts.consumerDestinations) === JSON.stringify(consumerDestinations), 'Consumer destination aggregate is inconsistent')
  assert(JSON.stringify(adjudication.counts.dispositions) === JSON.stringify(dispositions), 'Disposition aggregate is inconsistent')
  assert(adjudication.outOfScopeFindings.fleetIndexReconciliation.status === 'resolved', 'Fleet index reconciliation is not resolved')
  return {
    keys,
    exportGroups,
    exportDestinations,
    exceptionCount: exceptions.length,
    exceptionCodes: countBy(exceptions.map((record) => record.exceptionCode)),
  }
}

function projectExportRows(evidence) {
  return evidence.exports.rows.map(exportRecord)
}

function projectConsumerRows(evidence, exportMap) {
  return Object.fromEntries(CONSUMER_NAMES.map((name) => [
    name,
    evidence.consumers[name].rows.map((row) => consumerRecord(name, row, exportMap)),
  ]))
}

export function buildAdjudication({ evidence, input }) {
  assertInputShape(evidence)
  const expectedKeys = evidenceKeys(evidence)
  validateUniqueKeys(expectedKeys)
  const exports = projectExportRows(evidence)
  const exportMap = new Map(evidence.exports.rows.map((row) => [row.symbol, row]))
  const consumers = projectConsumerRows(evidence, exportMap)
  const records = [...exports, ...CONSUMER_NAMES.flatMap((name) => consumers[name])]
  const adjudication = {
    schemaVersion: 1,
    mode: 'permissioned-adjudication',
    input: {
      sha256: input.sha256,
      bytes: input.bytes,
      publicEvidenceSha256: EXPECTED_PUBLIC_EVIDENCE_SHA256,
    },
    policies: {
      compatibility: COMPATIBILITY_POLICY_ID,
      supportWindow: SUPPORT_WINDOW,
      migrationOrder: {
        id: MIGRATION_ORDER_POLICY_ID,
        phases: MIGRATION_ORDERS,
      },
    },
    counts: {
      exports: exports.length,
      consumerRows: CONSUMER_NAMES.reduce((sum, name) => sum + consumers[name].length, 0),
      keys: records.length,
      exportGroups: countBy(exports.map((record) => record.ownerGroup)),
      exportDestinations: countBy(exports.map((record) => record.destinationPath)),
      consumerDestinations: countBy(records.filter((record) => record.rowKind === 'consumer').map((record) => record.destinationPath)),
      dispositions: countBy(records.map((record) => record.internalDisposition)),
      consumerRowsByName: Object.fromEntries(CONSUMER_NAMES.map((name) => [name, consumers[name].length])),
    },
    exports: { rows: exports },
    consumers: Object.fromEntries(CONSUMER_NAMES.map((name) => [name, { rows: consumers[name] }])),
    exceptions: {
      count: records.filter((record) => record.exceptionCode !== undefined).length,
      byCode: countBy(records.filter((record) => record.exceptionCode !== undefined).map((record) => record.exceptionCode)),
    },
    outOfScopeFindings: {
      retiredConsumerExceptions: 2,
      maintainedMemberReposWithoutDirectS01Rows: 3,
      fleetIndexReconciliation: {
        previousRootIndexMemberCount: 7,
        currentRootIndexMemberCount: 8,
        workspaceManifestMemberCount: 8,
        status: 'resolved',
      },
    },
  }
  assertKeySetEqual(expectedKeys, records.map((record) => record.evidenceKey))
  validateAdjudication(adjudication)
  return adjudication
}

export function buildPublicAggregate({ adjudication, privateDigest }) {
  validateAdjudication(adjudication)
  assert(privateDigest && /^[0-9a-f]{64}$/u.test(privateDigest.sha256), 'Private output digest is invalid')
  assert(Number.isInteger(privateDigest.bytes) && privateDigest.bytes > 0, 'Private output byte count is invalid')
  return {
    schemaVersion: 1,
    mode: 'public-safe',
    input: adjudication.input,
    counts: {
      exports: adjudication.counts.exports,
      consumerRows: adjudication.counts.consumerRows,
      keys: adjudication.counts.keys,
      exportGroups: adjudication.counts.exportGroups,
      exportDestinations: {
        workspaceServer: adjudication.counts.exportDestinations[DESTINATIONS.workspaceServer],
        workspaceClient: adjudication.counts.exportDestinations[DESTINATIONS.workspaceClient],
        sourceClient: adjudication.counts.exportDestinations[DESTINATIONS.sourceClient],
        connectorApi: adjudication.counts.exportDestinations[DESTINATIONS.connectorApi],
      },
      dispositions: adjudication.counts.dispositions,
    },
    exceptions: adjudication.exceptions,
    outOfScope: {
      retiredConsumerCount: adjudication.outOfScopeFindings.retiredConsumerExceptions,
      noDirectS01RowCount: adjudication.outOfScopeFindings.maintainedMemberReposWithoutDirectS01Rows,
      fleetIndexReconciliation: adjudication.outOfScopeFindings.fleetIndexReconciliation,
    },
    policies: {
      compatibility: adjudication.policies.compatibility,
      supportWindow: adjudication.policies.supportWindow.id,
      migrationOrder: adjudication.policies.migrationOrder.id,
    },
    outputDigest: privateDigest,
  }
}

function optionValue(args, name) {
  const index = args.indexOf(name)
  if (index < 0) return { index, value: null }
  const value = args[index + 1]
  if (!value || value.startsWith('--')) fail(`${name} requires a path`)
  return { index, value }
}

function outputDigest(outputPath) {
  return fileDigest(outputPath)
}

export function runCli({
  root = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..'),
  argv = process.argv.slice(2),
  cwd = process.cwd(),
  execPath = process.execPath,
  scriptPath = process.argv[1] ?? fileURLToPath(import.meta.url),
} = {}) {
  const inputOption = optionValue(argv, '--input')
  const privateOption = optionValue(argv, '--private-output')
  const publicOption = optionValue(argv, '--public-output')
  assert(inputOption.value, 'Adjudication requires an explicit --input')
  assert(privateOption.value, 'Adjudication requires an explicit --private-output')
  const inputPath = path.resolve(inputOption.value)
  const privateOutputPath = path.resolve(privateOption.value)
  const publicOutputPath = path.resolve(root, publicOption.value ?? 'evidence/sdk-export-dispositions.json')
  validatePermissionedOutput(root, privateOutputPath)
  const { evidence, input } = readS01Evidence(inputPath)
  const adjudication = buildAdjudication({ evidence, input })
  fs.mkdirSync(path.dirname(privateOutputPath), { recursive: true })
  fs.writeFileSync(privateOutputPath, `${JSON.stringify(adjudication, null, 2)}\n`)
  const privateDigest = outputDigest(privateOutputPath)
  const publicAggregate = buildPublicAggregate({ adjudication, privateDigest })
  fs.mkdirSync(path.dirname(publicOutputPath), { recursive: true })
  fs.writeFileSync(publicOutputPath, `${JSON.stringify(publicAggregate, null, 2)}\n`)
  const publicDigest = outputDigest(publicOutputPath)
  const invocation = { cwd, execPath, scriptPath, input: inputPath, privateOutput: privateOutputPath, publicOutput: publicOutputPath }
  return { adjudication, publicAggregate, input, privateOutputPath, privateDigest, publicOutputPath, publicDigest, invocation }
}

function main() {
  const result = runCli()
  process.stdout.write(`${JSON.stringify({ mode: result.publicAggregate.mode, publicOutput: result.publicOutputPath, ...result.publicDigest })}\n`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main()
