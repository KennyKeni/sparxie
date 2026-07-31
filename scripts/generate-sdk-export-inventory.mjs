import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { API, SymbolFlags } from 'typescript/unstable/sync'
import { SyntaxKind } from 'typescript/unstable/ast'
export const SDK_PACKAGE = '@sparxie/sdk'
const SOURCE_EXTENSIONS = /\.(?:[cm]?[jt]sx?|d\.ts)$/u
const EXCLUDED_SEGMENTS = new Set([
  '.git',
  '.local',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'out',
])
function shellQuote(value) {
  if (/^[A-Za-z0-9_./:@=+-]+$/u.test(String(value))) return String(value)
  return `'${String(value).replaceAll("'", "'\\''")}'`
}
function commandString(command, args) {
  return [command, ...args].map(shellQuote).join(' ')
}
function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}
function textAttestation(value) {
  const text = String(value ?? '')
  return {
    sha256: sha256(text),
    length: Buffer.byteLength(text, 'utf8'),
  }
}
function contentAttestation(value) {
  const attestation = textAttestation(value)
  return {
    rawSha256: attestation.sha256,
    rawLength: attestation.length,
  }
}
function commandEvidence(result) {
  const stdout = result.stdout ?? ''
  const stderr = result.stderr ?? ''
  return {
    command: result.command,
    cwd: '.',
    exitCode: result.exitCode,
    signal: result.signal,
    unavailable: result.unavailable,
    stdoutSha256: sha256(stdout),
    stdoutLength: Buffer.byteLength(stdout, 'utf8'),
    stderrSha256: sha256(stderr),
    stderrLength: Buffer.byteLength(stderr, 'utf8'),
  }
}
function permissionedCommandEvidence(result) {
  return {
    ...commandEvidence(result),
    cwd: result.cwd,
    privacy: 'permissioned-private-output',
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
}
export function runCommand(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  })
  return {
    command: commandString(command, args),
    cwd,
    exitCode: typeof result.status === 'number' ? result.status : null,
    signal: result.signal ?? null,
    stdout: result.stdout ?? '',
    stderr: result.error ? `${result.stderr ?? ''}${result.error.message}` : result.stderr ?? '',
    unavailable: Boolean(result.error),
  }
}
function relativePath(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join('/') || '.'
}
function normalizeAbsolute(root, filePath) {
  return path.resolve(root, filePath)
}
function isExcludedPath(filePath) {
  return filePath.split(path.sep).some((segment) => EXCLUDED_SEGMENTS.has(segment))
}
function isSourcePath(filePath) {
  return SOURCE_EXTENSIONS.test(filePath) && !isExcludedPath(filePath)
}
function listTrackedFiles(root, options = {}) {
  const result = runCommand('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], root)
  const evidence = options.retainRaw
    ? permissionedCommandEvidence(result)
    : commandEvidence(result)
  if (result.exitCode !== 0) return { files: [], command: evidence }
  return {
    files: result.stdout.split('\0').filter(Boolean).map((file) => normalizeAbsolute(root, file)),
    command: evidence,
  }
}
function lineLocation(text, offset) {
  const before = text.slice(0, offset)
  const line = before.split('\n').length
  const lineStart = before.lastIndexOf('\n') + 1
  return { line, column: offset - lineStart + 1 }
}
function syntaxKindName(kind) {
  return String(SyntaxKind[kind] ?? kind)
}
function declarationSource(root, declaration, fallback) {
  const node = declaration?.resolve?.()
  const sourceFile = node?.getSourceFile?.()
  if (!node || !sourceFile) return fallback
  const fileName = sourceFile.fileName
  const location = lineLocation(sourceFile.text, node.getStart(sourceFile))
  return {
    path: relativePath(root, fileName),
    line: location.line,
    column: location.column,
    kind: syntaxKindName(node.kind),
    raw: node.getText(sourceFile),
  }
}
function exportClassification(symbol, source) {
  const runtime = Boolean(symbol.flags & SymbolFlags.Value)
  const schemaClassification = symbol.name.endsWith('Schema')
    ? 'schema-named'
    : 'not-schema-named'
  const compatibilityClassification = runtime ? 'runtime-export' : 'type-only-export'
  return {
    boundary: 'package-root',
    schemaClassification,
    compatibilityClassification,
    schema: schemaClassification,
    compatibility: compatibilityClassification,
    declarationKind: source?.kind ?? 'unknown',
  }
}
export function collectSdkExports(root) {
  const api = new API({ cwd: root })
  try {
    const snapshot = api.updateSnapshot({ openProjects: ['tsconfig.json'] })
    try {
      const project = snapshot.getProjects().find((entry) => entry.configFileName.endsWith('/tsconfig.json'))
      if (!project) throw new Error(`No TypeScript project found in ${root}`)
      const entrypoint = project.program.getSourceFile('src/index.ts')
      if (!entrypoint) throw new Error(`SDK entrypoint src/index.ts is not in ${root}`)
      const moduleSymbol = project.checker.getSymbolAtLocation(entrypoint)
      if (!moduleSymbol) throw new Error('TypeScript checker did not resolve src/index.ts')
      const rows = project.checker
        .getExportsOfModule(moduleSymbol)
        .map((exportSymbol) => {
          const resolved = exportSymbol.flags & SymbolFlags.Alias
            ? project.checker.getAliasedSymbol(exportSymbol)
            : exportSymbol
          const declaration = resolved.declarations?.[0] ?? exportSymbol.declarations?.[0]
          const source = declarationSource(root, declaration, {
            path: 'unknown',
            line: null,
            column: null,
            kind: 'unknown',
            raw: '',
          })
          return {
            category: 'export',
            symbol: exportSymbol.name,
            source: source.path,
            sourceLine: source.line,
            sourceColumn: source.column,
            declarationKind: source.kind,
            declarationRaw: source.raw,
            ...exportClassification(resolved, source),
            consumer: null,
            owner: null,
            selector: 'typescript.checker.getExportsOfModule(src/index.ts)',
            disposition: 'recorded',
          }
        })
        .sort((left, right) => left.symbol.localeCompare(right.symbol))
      return {
        rows,
        candidateCount: rows.length,
        selector: {
          id: 'sdk-public-exports',
          command: 'node scripts/generate-sdk-export-inventory.mjs --output evidence/sdk-export-inventory.json',
          expression: 'checker.getExportsOfModule(symbolAtLocation(src/index.ts))',
          sourceSurface: 'src/index.ts plus transitive TypeScript re-exports',
          candidateCount: rows.length,
        },
      }
    } finally {
      snapshot.dispose()
    }
  } finally {
    api.close()
  }
}
function symbolFields(symbol, exportMap) {
  const known = exportMap.get(symbol)
  const schemaClassification = known?.schemaClassification ?? 'unknown'
  const compatibilityClassification = known?.compatibilityClassification ?? 'unknown'
  return {
    boundary: known?.boundary ?? 'unknown-consumer-boundary',
    schemaClassification,
    compatibilityClassification,
    schema: schemaClassification,
    compatibility: compatibilityClassification,
    owner: null,
    symbolKnown: Boolean(known),
  }
}
function addRow(rows, row, exportMap, options = {}) {
  const fields = symbolFields(row.symbol, exportMap)
  const { raw, ...withoutRaw } = row
  rows.push({
    ...withoutRaw,
    source: row.source ?? row.path ?? null,
    ...(options.retainRaw ? { raw, ...contentAttestation(raw) } : contentAttestation(raw)),
    ...fields,
    disposition: 'recorded',
  })
}

function specifierRows(declaration, sourceFile, root, exportMap, rows, namespaceNames, options) {
  const moduleSpecifier = declaration.moduleSpecifier
  if (moduleSpecifier?.text !== SDK_PACKAGE) return
  const location = lineLocation(sourceFile.text, declaration.getStart(sourceFile))
  const importClause = declaration.importClause
  const namedBindings = importClause?.namedBindings
  const exportClause = declaration.exportClause
  const elements = namedBindings?.kind === SyntaxKind.NamedImports
    ? namedBindings.elements
    : exportClause?.kind === SyntaxKind.NamedExports
      ? exportClause.elements
      : []
  const typeOnlyDeclaration = Boolean(declaration.isTypeOnly || importClause?.isTypeOnly)
  for (const element of elements) {
    const symbol = element.propertyName?.text ?? element.name.text
    addRow(rows, {
      category: 'source-import',
      referenceKind: declaration.kind === SyntaxKind.ExportDeclaration ? 'export-specifier' : 'import-specifier',
      selector: 'source-import.named-specifier',
      path: relativePath(root, sourceFile.fileName),
      line: lineLocation(sourceFile.text, element.getStart(sourceFile)).line,
      column: lineLocation(sourceFile.text, element.getStart(sourceFile)).column,
      symbol,
      localSymbol: element.name.text,
      typeOnly: Boolean(element.isTypeOnly || typeOnlyDeclaration),
      raw: element.getText(sourceFile),
      module: SDK_PACKAGE,
      historicalCountIncluded: true,
      declarationLine: location.line,
      declarationColumn: location.column,
    }, exportMap, options)
  }
  if (namedBindings?.kind === SyntaxKind.NamespaceImport) {
    const namespace = namedBindings.name.text
    namespaceNames.add(namespace)
    addRow(rows, {
      category: 'source-import',
      referenceKind: 'namespace-import',
      selector: 'source-import.namespace-specifier',
      path: relativePath(root, sourceFile.fileName),
      ...location,
      symbol: '<namespace>',
      localSymbol: namespace,
      typeOnly: typeOnlyDeclaration,
      raw: namedBindings.getText(sourceFile),
      module: SDK_PACKAGE,
      historicalCountIncluded: false,
    }, exportMap, options)
  }
}

function collectNamespacePropertyRows(sourceFile, root, exportMap, rows, namespaceNames, options) {
  sourceFile.forEachChild(function visit(node) {
    let expression = node.expression
    while (
      expression &&
      (expression.kind === SyntaxKind.AsExpression || expression.kind === SyntaxKind.ParenthesizedExpression)
    ) {
      expression = expression.expression
    }
    if (
      node.kind === SyntaxKind.PropertyAccessExpression &&
      expression?.kind === SyntaxKind.Identifier &&
      namespaceNames.has(expression.text)
    ) {
      const symbol = node.name?.text
      if (symbol) {
        const location = lineLocation(sourceFile.text, node.getStart(sourceFile))
        addRow(rows, {
          category: 'source-import',
          referenceKind: 'namespace-property',
          selector: 'source-import.namespace-property',
          path: relativePath(root, sourceFile.fileName),
          ...location,
          symbol,
          localSymbol: `${expression.text}.${symbol}`,
          typeOnly: false,
          raw: node.getText(sourceFile),
          module: SDK_PACKAGE,
          historicalCountIncluded: false,
        }, exportMap, options)
      }
    }
    node.forEachChild(visit)
  })
}

function collectDynamicRows(text, filePath, root, exportMap, rows, options) {
  const pattern = /\b(import|require)\s*\(\s*(['"])@sparxie\/sdk\2\s*\)/gu
  for (const match of text.matchAll(pattern)) {
    const location = lineLocation(text, match.index ?? 0)
    addRow(rows, {
      category: 'source-import',
      referenceKind: match[1] === 'import' ? 'dynamic-import' : 'require',
      selector: 'source-import.dynamic-or-require',
      path: relativePath(root, filePath),
      ...location,
      symbol: '<dynamic>',
      localSymbol: null,
      typeOnly: false,
      raw: match[0],
      module: SDK_PACKAGE,
      historicalCountIncluded: false,
    }, exportMap, options)
  }
}

export function collectSourceImportRows(root, exportRows, options = {}) {
  const exportMap = new Map(exportRows.map((row) => [row.symbol, row]))
  const tracked = listTrackedFiles(root, options)
  const rows = []
  const sourcePaths = tracked.files.filter(isSourcePath).sort()
  const api = new API({ cwd: root })
  try {
    const snapshot = api.updateSnapshot({ openFiles: sourcePaths })
    try {
      const unparsed = []
      for (const filePath of sourcePaths) {
        const project = snapshot.getDefaultProjectForFile(filePath)
        const sourceFile = project?.program.getSourceFile(filePath)
        if (!sourceFile) {
          unparsed.push(relativePath(root, filePath))
          continue
        }
        const namespaceNames = new Set()
        sourceFile.forEachChild(function visit(node) {
          if (node.kind === SyntaxKind.ImportDeclaration || node.kind === SyntaxKind.ExportDeclaration) {
            specifierRows(node, sourceFile, root, exportMap, rows, namespaceNames, options)
          }
          node.forEachChild(visit)
        })
        collectNamespacePropertyRows(sourceFile, root, exportMap, rows, namespaceNames, options)
        collectDynamicRows(sourceFile.text, filePath, root, exportMap, rows, options)
      }
      if (unparsed.length > 0) {
        throw new Error(`TypeScript parser did not load tracked source files: ${unparsed.join(', ')}`)
      }
    } finally {
      snapshot.dispose()
    }
  } finally {
    api.close()
  }
  return {
    rows: rows.sort(rowOrder),
    selector: {
      id: 'consumer-source-imports',
      command: "git ls-files --cached --others --exclude-standard -z",
      commandEvidence: tracked.command,
      expression: 'TypeScript ImportDeclaration/ExportDeclaration plus namespace and dynamic selectors parsed from every tracked source file',
      trackedFileCount: tracked.files.length,
      candidateCount: rows.length,
    },
  }
}

function walkValues(value, pointer, visit) {
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) {
    const childPointer = `${pointer}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`
    visit(key, child, childPointer)
    walkValues(child, childPointer, visit)
  }
}

export function collectManifestRows(root, exportRows, options = {}) {
  const exportMap = new Map(exportRows.map((row) => [row.symbol, row]))
  const tracked = listTrackedFiles(root, options)
  const rows = []
  for (const filePath of tracked.files.filter((file) => path.basename(file) === 'package.json').sort()) {
    if (isExcludedPath(filePath)) continue
    let value
    try {
      value = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    } catch {
      continue
    }
    walkValues(value, '', (key, child, pointer) => {
      if (key !== SDK_PACKAGE) return
      addRow(rows, {
        category: 'manifest',
        referenceKind: 'package-manifest',
        selector: 'consumer-manifest.exact-package-key',
        path: relativePath(root, filePath),
        line: null,
        column: null,
        symbol: SDK_PACKAGE,
        localSymbol: null,
        typeOnly: false,
        raw: JSON.stringify(child),
        module: SDK_PACKAGE,
        jsonPointer: pointer,
        requested: child,
        historicalCountIncluded: false,
      }, exportMap, options)
    })
  }
  return {
    rows: rows.sort(rowOrder),
    selector: {
      id: 'consumer-manifests',
      command: 'git ls-files --cached --others --exclude-standard -z',
      commandEvidence: tracked.command,
      expression: 'recursive JSON object keys equal to @sparxie/sdk',
      candidateCount: rows.length,
    },
  }
}

export function collectLockRows(root, exportRows, options = {}) {
  const exportMap = new Map(exportRows.map((row) => [row.symbol, row]))
  const tracked = listTrackedFiles(root, options)
  const rows = []
  for (const filePath of tracked.files
    .filter((file) => /(?:^|\/)(?:pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$/.test(file))
    .sort()) {
    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/u)
    lines.forEach((line, index) => {
      if (!/(?:^|["'])@sparxie\/sdk(?:["'@: ]|$)/u.test(line)) return
      addRow(rows, {
        category: 'lockfile',
        referenceKind: 'lockfile-line',
        selector: 'consumer-lockfiles.exact-package-token',
        path: relativePath(root, filePath),
        line: index + 1,
        column: line.indexOf('@sparxie/sdk') + 1,
        symbol: SDK_PACKAGE,
        localSymbol: null,
        typeOnly: false,
        raw: line,
        module: SDK_PACKAGE,
        historicalCountIncluded: false,
      }, exportMap, options)
    })
  }
  return {
    rows: rows.sort(rowOrder),
    selector: {
      id: 'consumer-lockfiles',
      command: 'git ls-files --cached --others --exclude-standard -z',
      commandEvidence: tracked.command,
      expression: 'line selector containing exact @sparxie/sdk package token',
      candidateCount: rows.length,
    },
  }
}

export function collectArtifactRows(root, exportRows, options = {}) {
  const exportMap = new Map(exportRows.map((row) => [row.symbol, row]))
  const tracked = listTrackedFiles(root, options)
  const rows = []
  for (const filePath of tracked.files
    .filter((file) => SOURCE_EXTENSIONS.test(file) && relativePath(root, file).split('/').includes('dist'))
    .sort()) {
    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/u)
    lines.forEach((line, index) => {
      if (!line.includes(SDK_PACKAGE)) return
      const importMatches = line.matchAll(/\{([^{}]*)\}\s+from\s+['"]@sparxie\/sdk['"]/gu)
      let matchedSpecifier = false
      for (const match of importMatches) {
        const body = match[1]
        for (const rawSpecifier of body.split(',')) {
          const raw = rawSpecifier.trim()
          if (!raw) continue
          const symbol = raw.replace(/^type\s+/u, '').split(/\s+as\s+/u)[0]
          const location = lineLocation(line, Math.max(0, line.indexOf(symbol)))
          addRow(rows, {
            category: 'artifact',
            referenceKind: 'artifact-import-specifier',
            selector: 'consumer-artifacts.dist-import-specifier',
            path: relativePath(root, filePath),
            line: index + 1,
            column: location.column,
            symbol,
            localSymbol: raw,
            typeOnly: raw.startsWith('type '),
            raw: line,
            module: SDK_PACKAGE,
            historicalCountIncluded: false,
          }, exportMap, options)
          matchedSpecifier = true
        }
      }
      if (!matchedSpecifier) {
        addRow(rows, {
          category: 'artifact',
          referenceKind: 'artifact-package-token',
          selector: 'consumer-artifacts.dist-package-token',
          path: relativePath(root, filePath),
          line: index + 1,
          column: line.indexOf(SDK_PACKAGE) + 1,
          symbol: '<artifact>',
          localSymbol: null,
          typeOnly: false,
          raw: line,
          module: SDK_PACKAGE,
          historicalCountIncluded: false,
        }, exportMap, options)
      }
    })
  }
  return {
    rows: rows.sort(rowOrder),
    selector: {
      id: 'consumer-built-artifacts',
      command: 'git ls-files --cached --others --exclude-standard -z',
      commandEvidence: tracked.command,
      expression: 'tracked dist files containing @sparxie/sdk, with import specifiers split into rows',
      candidateCount: rows.length,
    },
  }
}

function walkNodeModules(root, callback) {
  const queue = [root]
  const seen = new Set()
  while (queue.length) {
    const current = queue.shift()
    let real
    try {
      real = fs.realpathSync(current)
    } catch {
      continue
    }
    if (seen.has(real)) continue
    seen.add(real)
    let entries
    try {
      entries = fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))
    } catch {
      continue
    }
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name)
      if (
        entry.name === 'package.json' &&
        current.endsWith(`${path.sep}@sparxie${path.sep}sdk`)
      ) callback(entryPath)
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue
      if (entry.isSymbolicLink()) {
        if (current.endsWith(`${path.sep}@sparxie`) && entry.name === 'sdk') {
          callback(path.join(entryPath, 'package.json'))
        }
        continue
      }
      const canDescend =
        path.basename(current) === 'node_modules' ||
        path.basename(current) === '.pnpm' ||
        current.includes(`${path.sep}.pnpm${path.sep}`)
      if (canDescend) queue.push(entryPath)
    }
  }
}

export function collectInstalledRows(root, exportRows, options = {}) {
  const exportMap = new Map(exportRows.map((row) => [row.symbol, row]))
  const rows = []
  const installedCommand = runCommand('find', ['node_modules', '-path', '*/@sparxie/sdk/package.json'], root)
  const moduleRoots = []
  if (fs.existsSync(path.join(root, 'node_modules'))) moduleRoots.push(path.join(root, 'node_modules'))
  if (path.basename(root) === 'node_modules') moduleRoots.push(root)
  for (const moduleRoot of moduleRoots) walkNodeModules(moduleRoot, (filePath) => {
    let packageJson
    try {
      packageJson = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    } catch {
      return
    }
    if (packageJson.name !== SDK_PACKAGE) return
    addRow(rows, {
      category: 'installed',
      referenceKind: 'installed-package-json',
      selector: 'consumer-installed.node-modules-package-json',
      path: relativePath(root, filePath),
      line: null,
      column: null,
      symbol: SDK_PACKAGE,
      localSymbol: null,
      typeOnly: false,
      raw: fs.readFileSync(filePath, 'utf8'),
      module: SDK_PACKAGE,
      installedVersion: packageJson.version ?? null,
      realpath: relativePath(root, fs.realpathSync(filePath)),
      historicalCountIncluded: false,
    }, exportMap, options)
  })
  return {
    rows: rows.sort(rowOrder),
    selector: {
      id: 'consumer-installed-references',
      command: 'find node_modules -path */@sparxie/sdk/package.json',
      commandEvidence: options.retainRaw
        ? permissionedCommandEvidence(installedCommand)
        : commandEvidence(installedCommand),
      expression: 'package.json name exactly @sparxie/sdk; symlink targets are resolved',
      candidateCount: rows.length,
    },
  }
}

function rowOrder(left, right) {
  const leftContentKey = left.raw ?? left.rawSha256 ?? ''
  const rightContentKey = right.raw ?? right.rawSha256 ?? ''
  return [left.category, left.path, left.line ?? 0, left.column ?? 0, left.symbol, leftContentKey]
    .map(String)
    .join('\u0000')
    .localeCompare([right.category, right.path, right.line ?? 0, right.column ?? 0, right.symbol, rightContentKey]
      .map(String)
      .join('\u0000'))
}

export function reconcileRows(rows, selectorIds) {
  const sorted = [...rows].sort(rowOrder)
  const ids = new Set()
  const duplicateRowIds = []
  const dispositions = {}
  sorted.forEach((row) => {
    const sourcePath = row.path ?? row.source ?? '.'
    const line = row.line ?? row.sourceLine ?? 0
    const column = row.column ?? row.sourceColumn ?? 0
    const id = `${row.category}:${sourcePath}:${line}:${column}:${row.symbol}`
    row.id = id
    if (ids.has(id)) duplicateRowIds.push(id)
    ids.add(id)
    dispositions[row.disposition] = (dispositions[row.disposition] ?? 0) + 1
  })
  return {
    rows: sorted,
    selectorIds,
    candidateCount: sorted.length,
    dispositionCounts: dispositions,
    duplicateRowIds,
    everyCandidateHasDisposition: sorted.every((row) => typeof row.disposition === 'string'),
  }
}

function coverageSummary(reconciliation) {
  return {
    selectorIds: reconciliation.selectorIds,
    candidateCount: reconciliation.candidateCount,
    dispositionCounts: reconciliation.dispositionCounts,
    unresolvedCandidateCount: reconciliation.rows.filter((row) => row.symbolKnown === false).length,
    duplicateRowIds: reconciliation.duplicateRowIds,
    everyCandidateHasDisposition: reconciliation.everyCandidateHasDisposition,
  }
}

function historicalSymbolCount(rows) {
  return new Set(rows.filter((row) => row.historicalCountIncluded).map((row) => row.symbol)).size
}

function gitSha(root) {
  const result = runCommand('git', ['rev-parse', 'HEAD'], root)
  return result.exitCode === 0 ? result.stdout.trim() : null
}

function repositorySlug(packageJson) {
  const repository = typeof packageJson.repository === 'object'
    ? packageJson.repository.url
    : packageJson.repository
  const match = String(repository ?? '').match(/github\.com[:/]([^/]+\/[^/.]+)(?:\.git)?$/u)
  return match?.[1] ?? null
}

function publicRegistryEvidence(root) {
  const result = runCommand('npm', ['view', SDK_PACKAGE, '--json'], root)
  return {
    endpoint: `https://registry.npmjs.org/${encodeURIComponent(SDK_PACKAGE)}`,
    command: result.command,
    status: result.exitCode === 0 ? 'available' : 'unavailable',
  }
}

function externalEvidence(root, packageJson) {
  const registry = runCommand('npm', ['view', SDK_PACKAGE, '--json'], root)
  const slug = repositorySlug(packageJson)
  const github = slug
    ? runCommand('gh', ['api', `repos/${slug}`, '--jq', '{name,default_branch,updated_at}'], root)
    : null
  const output = (result) => result
    ? {
      ...permissionedCommandEvidence(result),
      status: result.exitCode === 0 ? 'available' : 'unavailable',
    }
    : { status: 'unavailable', reason: 'package repository URL was not a GitHub repository' }
  return { registry: output(registry), github: output(github) }
}

function countExclusions(root, trackedFiles) {
  const counts = new Map()
  for (const file of trackedFiles) {
    const relative = relativePath(root, file)
    const segment = relative.split('/').find((part) => EXCLUDED_SEGMENTS.has(part))
    if (segment) counts.set(segment, (counts.get(segment) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([rule, count]) => ({ rule: `excluded path segment ${rule}`, count }))
}

function validatePermissionedConfig({ consumerRoots, baselines, historicalChecks }) {
  if (!consumerRoots || Object.keys(consumerRoots).length === 0) {
    throw new Error('Permissioned evidence requires explicit consumerRoots in --consumer-config')
  }
  for (const name of ['sparxie', ...Object.keys(consumerRoots)]) {
    if (!/^[0-9a-f]{40}$/u.test(baselines?.[name] ?? '')) throw new Error(`Invalid baseline SHA for ${name}`)
  }
  for (const name of ['exports', ...Object.keys(consumerRoots)]) {
    if (!Number.isInteger(historicalChecks?.[name]) || historicalChecks[name] < 0) {
      throw new Error(`Invalid historical count for ${name}`)
    }
  }
}

export function buildPermissionedEvidence({
  root,
  consumerRoots,
  baselines,
  historicalChecks,
  includeExternalEvidence = true,
  retainRaw = true,
  invocation = null,
}) {
  baselines ??= {}
  historicalChecks ??= {}
  validatePermissionedConfig({ consumerRoots, baselines, historicalChecks })
  const sdk = collectSdkExports(root)
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  const consumers = {}
  for (const [name, consumerRoot] of Object.entries(consumerRoots)) {
    const options = { retainRaw }
    const source = collectSourceImportRows(consumerRoot, sdk.rows, options)
    const manifests = collectManifestRows(consumerRoot, sdk.rows, options)
    const locks = collectLockRows(consumerRoot, sdk.rows, options)
    const artifacts = collectArtifactRows(consumerRoot, sdk.rows, options)
    const installed = collectInstalledRows(consumerRoot, sdk.rows, options)
    const tracked = listTrackedFiles(consumerRoot, options)
    const reconciliation = reconcileRows(
      [...source.rows, ...manifests.rows, ...locks.rows, ...artifacts.rows, ...installed.rows],
      [source.selector.id, manifests.selector.id, locks.selector.id, artifacts.selector.id, installed.selector.id],
    )
    const evidenceRows = reconciliation.rows.map((row) => ({ ...row, consumer: name }))
    const count = historicalSymbolCount(reconciliation.rows)
    const selectors = [
      { ...source.selector, candidateCount: source.rows.length },
      { ...manifests.selector, candidateCount: manifests.rows.length },
      { ...locks.selector, candidateCount: locks.rows.length },
      { ...artifacts.selector, candidateCount: artifacts.rows.length },
      { ...installed.selector, candidateCount: installed.rows.length },
    ]
    consumers[name] = {
      baselineSha: baselines[name] ?? null,
      observedSha: gitSha(consumerRoot),
      historicalCheck: historicalChecks[name] ?? null,
      remeasuredNamedSymbols: count,
      drift: historicalChecks[name] === undefined ? null : count - historicalChecks[name],
      rows: evidenceRows,
      selectors,
      exclusions: countExclusions(consumerRoot, tracked.files),
      coverage: coverageSummary(reconciliation),
    }
  }
  const exportCoverage = reconcileRows(sdk.rows, [sdk.selector.id])
  return {
    schemaVersion: 1,
    mode: 'permissioned',
    package: {
      name: SDK_PACKAGE,
      version: packageJson.version,
      baselineSha: baselines.sparxie ?? null,
      observedSha: gitSha(root),
      publicSurface: {
        packageExports: packageJson.exports,
        packageFiles: packageJson.files,
        types: packageJson.types,
        entrypoint: 'src/index.ts',
      },
    },
    baselines,
    historicalChecks,
    exports: {
      historicalCheck: historicalChecks.exports ?? null,
      remeasured: sdk.candidateCount,
      drift: historicalChecks.exports === undefined ? null : sdk.candidateCount - historicalChecks.exports,
      rows: exportCoverage.rows,
      selector: sdk.selector,
      exclusions: [],
      coverage: coverageSummary(exportCoverage),
    },
    consumers,
    externalEvidence: includeExternalEvidence ? externalEvidence(root, packageJson) : null,
    scope: {
      visibility: 'permissioned-private',
      included: ['public SDK exports', 'source imports and re-exports', 'tracked built artifacts', 'package manifests', 'lockfiles', 'installed node_modules package metadata'],
      excluded: ['ownership decisions', 'SDK API changes', 'consumer edits', 'publication', 'migration implementation'],
      ownerField: 'Every row carries owner: null; no ownership is inferred.',
      privacyBoundary: {
        consumerRows: 'This permissioned artifact retains raw source, manifest, lockfile, built-artifact, and installed-package text for private review; do not publish it.',
        privateCommandOutput: 'Private command output is retained verbatim in this permissioned artifact for reconciliation; do not publish it.',
        externalEvidence: 'Registry and GitHub command output is retained because these endpoints are public; this artifact is permissioned and must not be published.',
      },
      invocation,
    },
  }
}
export function buildEvidence(options) {
  return buildPermissionedEvidence(options)
}
export function buildPublicEvidence({ root, registryEvidence = null }) {
  return {
    schemaVersion: 2,
    mode: 'public',
    visibility: 'public-safe',
    package: {
      name: SDK_PACKAGE,
      registry: 'https://registry.npmjs.org',
    },
    registry: registryEvidence ?? publicRegistryEvidence(root),
    scope: {
      included: ['public SDK package boundary', 'public registry reachability'],
      excluded: [
        'consumer identities, repository names, commit identities, measurements, filenames, symbols, topology, and versions',
        'consumer source, manifests, lockfiles, built artifacts, installed references, and command output',
        'ownership or compatibility inferences',
      ],
      privateEvidence: 'Permissioned consumer evidence requires an explicit --consumer-config and must be written outside tracked files.',
    },
  }
}
function loadPermissionedConfig(configPath) {
  const absolute = path.resolve(configPath)
  const parsed = JSON.parse(fs.readFileSync(absolute, 'utf8'))
  const roots = parsed.consumerRoots ?? parsed.consumers
  if (!roots || typeof roots !== 'object') throw new Error('consumer config requires consumerRoots')
  const base = path.dirname(absolute)
  return {
    baselines: parsed.baselines,
    historicalChecks: parsed.historicalChecks,
    consumerRoots: Object.fromEntries(Object.entries(roots).map(([name, value]) => [name, path.resolve(base, value)])),
  }
}
function outputDigest(outputPath) {
  const bytes = fs.readFileSync(outputPath)
  return { sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length }
}
function optionValue(args, name) {
  const index = args.indexOf(name)
  if (index < 0) return { index, value: null }
  const value = args[index + 1]
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a path`)
  return { index, value }
}
function pathContains(parent, target) {
  const relative = path.relative(parent, target)
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
}
function canonicalExistingPrefix(filePath) {
  const missing = []; let current = path.resolve(filePath)
  while (true) {
    try { return path.join(fs.realpathSync(current), ...missing) } catch (error) {
      if (error?.code !== 'ENOENT' && error?.code !== 'ENOTDIR') throw error
      const parent = path.dirname(current)
      if (parent === current) return current
      missing.unshift(path.basename(current)); current = parent
    }
  }
}
function canonicalPath(filePath) {
  let current = canonicalExistingPrefix(filePath)
  const seen = new Set()
  for (let depth = 0; depth < 64; depth += 1) {
    const root = path.parse(current).root; const parts = current.slice(root.length).split(path.sep).filter(Boolean)
    let prefix = root; let redirected = false
    for (let index = 0; index < parts.length; index += 1) {
      const candidate = path.join(prefix, parts[index]); let stat
      try { stat = fs.lstatSync(candidate) } catch (error) {
        if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') return path.join(prefix, ...parts.slice(index))
        throw new Error(`Unable to resolve path ${candidate}: ${error.message}`)
      }
      if (!stat.isSymbolicLink()) { prefix = candidate; continue }
      if (seen.has(candidate)) throw new Error(`Symlink resolution cycle at ${candidate}`)
      seen.add(candidate)
      const target = fs.readlinkSync(candidate)
      current = canonicalExistingPrefix(path.join(path.isAbsolute(target) ? target : path.resolve(prefix, target), ...parts.slice(index + 1)))
      redirected = true
      break
    }
    if (!redirected) return prefix
  }
  throw new Error(`Symlink resolution depth exceeded for ${filePath}`)
}
function gitWorktreeRoots(root) {
  const result = runCommand('git', ['worktree', 'list', '--porcelain'], root)
  const roots = result.exitCode === 0
    ? result.stdout.split(/\n\n+/u).flatMap((block) => {
      if (/^bare$/mu.test(block)) return []
      const match = /^worktree (.+)$/mu.exec(block)
      return match ? [canonicalPath(path.resolve(match[1]))] : []
    })
    : []
  if (roots.length === 0) throw new Error(`Unable to enumerate git worktrees: ${result.stderr.trim()}`)
  return roots
}
function gitPathStatus(root, target) {
  const relative = path.relative(root, target) || '.'
  return {
    tracked: runCommand('git', ['ls-files', '--error-unmatch', '--', relative], root).exitCode === 0,
    ignored: runCommand('git', ['check-ignore', '--no-index', '-q', '--', relative], root).exitCode === 0,
  }
}
export function validatePermissionedOutput(root, outputPath) {
  const resolvedOutput = path.resolve(outputPath)
  const candidates = [...new Set([resolvedOutput, canonicalPath(resolvedOutput)])]
  const worktrees = gitWorktreeRoots(root)
  for (const candidate of candidates) {
    for (const worktree of worktrees.filter((entry) => pathContains(entry, candidate))) {
      const status = gitPathStatus(worktree, candidate)
      if (status.tracked) throw new Error(`Permissioned output resolves to a tracked path: ${candidate}`)
      if (!status.ignored) throw new Error(`Permissioned output must be ignored inside a worktree: ${candidate}`)
    }
  }
  return resolvedOutput
}
function invocationEvidence({ argv, configPath, outputPath, cwd, execPath, scriptPath }) {
  const fullArgv = [execPath, scriptPath, ...argv]
  return {
    argv: fullArgv,
    command: fullArgv.map(shellQuote).join(' '),
    cwd,
    consumerConfig: configPath,
    output: outputPath,
  }
}
export function runCli({
  root = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..'),
  argv = process.argv.slice(2),
  includeExternalEvidence = true,
  registryEvidence = null,
  cwd = process.cwd(),
  execPath = process.execPath,
  scriptPath = process.argv[1] ?? fileURLToPath(import.meta.url),
} = {}) {
  const outputOption = optionValue(argv, '--output')
  const configOption = optionValue(argv, '--consumer-config')
  const configPath = configOption.value ? path.resolve(configOption.value) : null
  if (configPath && outputOption.index < 0) {
    throw new Error('Permissioned evidence requires an explicit --output outside the git worktree')
  }
  const output = outputOption.value ?? 'evidence/sdk-export-inventory.json'
  const outputPath = path.resolve(root, output)
  if (configPath) validatePermissionedOutput(root, outputPath)
  const evidence = configPath
    ? buildPermissionedEvidence({
      root,
      ...loadPermissionedConfig(configPath),
      includeExternalEvidence,
      retainRaw: true,
      invocation: invocationEvidence({
        argv,
        configPath,
        outputPath,
        cwd,
        execPath,
        scriptPath,
      }),
    })
    : buildPublicEvidence({ root, registryEvidence })
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`)
  process.stdout.write(`${JSON.stringify({ mode: evidence.mode ?? 'permissioned', output: outputPath, ...outputDigest(outputPath) })}\n`)
  return { evidence, outputPath }
}
function main() {
  runCli()
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) main()
