import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  applicationAttemptActorTypes,
  applicationAttemptStepTypes,
  applicationListSorts,
  applicationStatuses,
  actionQueueBuckets,
  canonicalizeApplicationUrl,
  connectorActionRequiredKinds,
  connectorAuthModes,
  connectorRunModes,
  connectorRunStatuses,
  connectorStatusSeverities,
  connectorStatusStates,
  defaultValedictorianApiBaseUrl,
  defaultPolicyConfig,
  defaultLocalCapabilities,
  isApplicationAttemptActorType,
  isApplicationAttemptStepType,
  isJobTimingMode,
  isManualReviewKind,
  isRoleKind,
  isRunStatus,
  isRunType,
  isSourcingDestinationClass,
  isSourcingMergeStatus,
  isSourcingUsability,
  isWritableSourcingMergeStatus,
  isWorkMode,
  manualSourcingDecisionStatuses,
  jobSeasons,
  jobTimingModes,
  normalizeApplicationUrlPreservingQuery,
  valedictorianApiPaths,
  MAX_APPLICATION_LIST_LIMIT,
  manualReviewKinds,
  normalizeApplicationLinkKind,
  roleKinds,
  runStatuses,
  runTypes,
  sourcingMergeStatuses,
  sourcingDestinationClasses,
  sourcingUsabilities,
  writableSourcingMergeStatuses,
  workModes,
} from './index'
import type { VerificationReceiptPayload } from './index'

function readPackageJson() {
  return JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8')) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
    exports?: Record<string, unknown>
    files?: string[]
    name?: string
    types?: string
  }
}

describe('SDK public contract', () => {
  it('exports application status and sorting contracts', () => {
    expect(applicationStatuses).toContain('needs_user_info')
    expect(applicationStatuses).toContain('not_pursued')
    expect(applicationListSorts).toContain('company_asc')
    expect(applicationListSorts).toContain('updated_desc')
    expect(MAX_APPLICATION_LIST_LIMIT).toBe(200)
  })

  it('exports mutation validation contracts', () => {
    expect(roleKinds).toEqual([
      'internship',
      'new_grad',
      'full_time',
      'contract',
      'part_time',
      'other',
    ])
    expect(workModes).toEqual(['remote', 'onsite', 'hybrid', 'unclear'])
    expect(jobSeasons).toEqual(['spring', 'summer', 'fall'])
    expect(jobTimingModes).toEqual(['unknown', 'terms', 'dates'])
    expect(manualReviewKinds).toEqual(['overridable', 'non_overridable'])
    expect(applicationAttemptActorTypes).toEqual(['agent', 'automation', 'user', 'system'])
    expect(applicationAttemptStepTypes).toEqual([
      'attempt_started',
      'resume_created',
      'resume_uploaded',
      'page_verified',
      'verification_receipt',
      'manual_review_hold_created',
      'blocked',
      'submitted',
      'confirmation_verified',
      'attempt_completed',
      'note',
    ])
    expect(isRoleKind('internship')).toBe(true)
    expect(isRoleKind('intern')).toBe(false)
    expect(isWorkMode('remote')).toBe(true)
    expect(isWorkMode('distributed')).toBe(false)
    expect(isJobTimingMode('dates')).toBe(true)
    expect(isJobTimingMode('semester')).toBe(false)
    expect(isManualReviewKind('overridable')).toBe(true)
    expect(isManualReviewKind('manual')).toBe(false)
    expect(isApplicationAttemptActorType('agent')).toBe(true)
    expect(isApplicationAttemptActorType('robot')).toBe(false)
    expect(isApplicationAttemptStepType('page_verified')).toBe(true)
    expect(isApplicationAttemptStepType('verification_receipt')).toBe(true)
    expect(isApplicationAttemptStepType('field_verified')).toBe(false)

    const receiptPayload: VerificationReceiptPayload = {
      version: 1,
      scope: 'final_review',
      status: 'passed',
      verified: ['resume_attachment'],
      unresolved: [],
      evidence: 'Final review page showed the tailored resume filename.',
    }

    expect(receiptPayload.status).toBe('passed')
  })

  it('exports workflow run and sourcing finding contracts', () => {
    expect(runTypes).toEqual([
      'application_attempt',
      'sourcing',
      'merge',
      'manual_review_pickup',
      'stale_lock_pickup',
      'import',
    ])
    expect(runStatuses).toEqual(['in_progress', 'completed', 'failed'])
    expect(sourcingMergeStatuses).toEqual([
      'new',
      'merged',
      'duplicate',
      'below_cutoff',
      'blocked',
      'not_fit',
      'not_pursued',
      'archived',
    ])
    expect(writableSourcingMergeStatuses).toEqual([
      'new',
      'duplicate',
      'below_cutoff',
      'blocked',
      'not_fit',
      'not_pursued',
      'archived',
    ])
    expect(manualSourcingDecisionStatuses).toEqual([
      'blocked',
      'not_fit',
      'not_pursued',
      'archived',
    ])
    expect(sourcingDestinationClasses).toEqual([
      'employer_or_ats',
      'third_party_job_posting',
    ])
    expect(sourcingUsabilities).toEqual(['usable', 'review_only'])
    expect(isRunType('sourcing')).toBe(true)
    expect(isRunType('application')).toBe(false)
    expect(isRunStatus('completed')).toBe(true)
    expect(isRunStatus('done')).toBe(false)
    expect(isSourcingMergeStatus('below_cutoff')).toBe(true)
    expect(isSourcingMergeStatus('skipped')).toBe(false)
    expect(isSourcingDestinationClass('employer_or_ats')).toBe(true)
    expect(isSourcingDestinationClass('official')).toBe(false)
    expect(isSourcingUsability('review_only')).toBe(true)
    expect(isSourcingUsability('unresolved')).toBe(false)
    expect(isWritableSourcingMergeStatus('merged')).toBe(false)
    expect(isWritableSourcingMergeStatus('blocked')).toBe(true)
    expect(defaultPolicyConfig.scoring.applyCutoff).toBe(6)
    expect(actionQueueBuckets).toEqual([
      'apply_now',
      'manual_review_pickup',
      'needs_user_info',
      'stale_lock_recovery',
      'user_review_required',
      'blocked',
      'skip_below_cutoff',
    ])
  })

  it('exports connector status, run, auth, and action contracts', () => {
    expect(connectorAuthModes).toEqual([
      'none',
      'api_key',
      'bearer_token',
      'oauth',
      'cookie_jar',
      'browser_session',
      'username_password',
    ])
    expect(connectorRunModes).toEqual(['manual', 'scheduled', 'catch_up'])
    expect(connectorRunStatuses).toEqual([
      'queued',
      'running',
      'completed',
      'failed',
      'cancelled',
      'skipped',
    ])
    expect(connectorStatusSeverities).toEqual(['healthy', 'warning', 'blocked'])
    expect(connectorStatusStates).toEqual([
      'authentication_required',
      'backfilling',
      'blocked',
      'boundary_exhausted',
      'cancelled',
      'caught_up',
      'checking_newest',
      'cooling_down',
      'failed',
      'never_run',
      'queued',
      'resolving',
      'skipped',
      'source_exhausted',
    ])
    expect(connectorActionRequiredKinds).toEqual([
      'auth',
      'captcha',
      'configuration',
      'manual_review',
      'rate_limit',
    ])
  })

  it('keeps connector auth DTOs reference-only without plaintext credentials', () => {
    const connectorSource = fs.readFileSync(path.resolve('src/connector.ts'), 'utf8')
    const readme = fs.readFileSync(path.resolve('README.md'), 'utf8')
    const authReferenceBlock =
      connectorSource.match(/export interface ConnectorAuthReferenceInput \{[\s\S]*?\n\}/)?.[0] ??
      ''
    const authSummaryBlock =
      connectorSource.match(/export interface ConnectorAuthSummary \{[\s\S]*?\n\}/)?.[0] ?? ''

    expect(authReferenceBlock).toContain('secretKey?: string')
    expect(authReferenceBlock).not.toMatch(
      /\b(password|username|email|value|cookie|sessionId|account)\??\s*:/,
    )
    expect(authSummaryBlock).not.toMatch(
      /\b(password|username|email|value|cookie|sessionId|account|secretKey)\??\s*:/,
    )
    expect(readme).toMatch(/Connector authentication/i)
    expect(readme).toMatch(/secret references/i)
    expect(readme).not.toMatch(/\bpassword\s*:/)
    expect(readme).not.toMatch(/\busername\s*:/)
  })

  it('canonicalizes mutation URLs and flexible link kinds', () => {
    expect(
      canonicalizeApplicationUrl(
        ' HTTPS://Jobs.Example.com:443/path/apply?utm_source=agent&b=2&a=1&gh_src=abc#section ',
      ),
    ).toBe('https://jobs.example.com/path/apply?a=1&b=2')
    expect(canonicalizeApplicationUrl('http://jobs.example.com:80/path')).toBe(
      'http://jobs.example.com/path',
    )
    expect(
      normalizeApplicationUrlPreservingQuery(
        ' HTTPS://Apply.Example.com:443/path?source=linkedin&route=agent&utm_source=agent#section ',
      ),
    ).toBe('https://apply.example.com/path?source=linkedin&route=agent&utm_source=agent')
    expect(() => canonicalizeApplicationUrl('ftp://jobs.example.com/path')).toThrow(
      'Invalid application URL: ftp://jobs.example.com/path',
    )
    expect(normalizeApplicationLinkKind('LinkedIn Jobs')).toBe('linkedin_jobs')
    expect(() => normalizeApplicationLinkKind('   ')).toThrow('link kind is required')
  })

  it('exports API paths and default local API URL', () => {
    expect(defaultValedictorianApiBaseUrl).toBe('http://127.0.0.1:4317')
    expect(valedictorianApiPaths.health).toBe('/v1/health')
    expect(valedictorianApiPaths.capabilities).toBe('/v1/capabilities')
    expect(valedictorianApiPaths.workspaces).toBe('/v1/workspaces')
    expect(valedictorianApiPaths.workspaceOpen).toBe('/v1/workspaces/open')
    expect(valedictorianApiPaths.workspaceCreate).toBe('/v1/workspaces/create')
    expect(valedictorianApiPaths.applications).toBe('/v1/applications')
    expect(valedictorianApiPaths.profileSensitive).toBe('/v1/profile/sensitive')
    expect(valedictorianApiPaths.secrets).toBe('/v1/secrets')
    expect(valedictorianApiPaths.secret('greenhouse password')).toBe(
      '/v1/secrets/greenhouse%20password',
    )
    expect(valedictorianApiPaths.application('application 1')).toBe(
      '/v1/applications/application%201',
    )
    expect(valedictorianApiPaths.applicationStatus('application 1')).toBe(
      '/v1/applications/application%201/status',
    )
    expect(valedictorianApiPaths.applicationAttempts('application 1')).toBe(
      '/v1/applications/application%201/attempts',
    )
    expect(valedictorianApiPaths.applicationAttemptSteps('application 1', 'attempt 1')).toBe(
      '/v1/applications/application%201/attempts/attempt%201/steps',
    )
    expect(valedictorianApiPaths.applicationAttemptComplete('application 1', 'attempt 1')).toBe(
      '/v1/applications/application%201/attempts/attempt%201/complete',
    )
    expect(valedictorianApiPaths.runs).toBe('/v1/runs')
    expect(valedictorianApiPaths.runSteps('run 1')).toBe('/v1/runs/run%201/steps')
    expect(valedictorianApiPaths.runComplete('run 1')).toBe('/v1/runs/run%201/complete')
    expect(valedictorianApiPaths.connectors).toBe('/v1/connectors')
    expect(valedictorianApiPaths.connector('jobright/session 1')).toBe(
      '/v1/connectors/jobright%2Fsession%201',
    )
    expect(valedictorianApiPaths.connectorStatus('jobright/session 1')).toBe(
      '/v1/connectors/jobright%2Fsession%201/status',
    )
    expect(valedictorianApiPaths.connectorRuns('jobright/session 1')).toBe(
      '/v1/connectors/jobright%2Fsession%201/runs',
    )
    expect(valedictorianApiPaths.connectorCheckpoints('jobright/session 1')).toBe(
      '/v1/connectors/jobright%2Fsession%201/checkpoints',
    )
    expect(valedictorianApiPaths.connectorObservations('jobright/session 1')).toBe(
      '/v1/connectors/jobright%2Fsession%201/observations',
    )
    expect(valedictorianApiPaths.sourcingFindings).toBe('/v1/sourcing/findings')
    expect(valedictorianApiPaths.sourcingCandidatesProcess).toBe(
      '/v1/sourcing/candidates/process',
    )
    expect(valedictorianApiPaths.sourcingFinding('finding 1')).toBe(
      '/v1/sourcing/findings/finding%201',
    )
    expect(valedictorianApiPaths.sourcingFindingDecide('finding 1')).toBe(
      '/v1/sourcing/findings/finding%201/decide',
    )
    expect(valedictorianApiPaths.sourcingFindingPromote('finding 1')).toBe(
      '/v1/sourcing/findings/finding%201/promote',
    )
    expect(valedictorianApiPaths.scores).toBe('/v1/scores')
    expect(valedictorianApiPaths.actionQueue).toBe('/v1/action-queue')
    expect(valedictorianApiPaths.policyConfig).toBe('/v1/policy/config')
    expect(valedictorianApiPaths.policyConfigReset).toBe('/v1/policy/config/reset')
    expect(valedictorianApiPaths.policyEvidence).toBe('/v1/policy/evidence')
    expect(valedictorianApiPaths.policyEvaluateApplication).toBe(
      '/v1/policy/evaluate/application',
    )
    expect(valedictorianApiPaths.policyEvaluateSourcingCandidate).toBe(
      '/v1/policy/evaluate/sourcing-candidate',
    )
    expect(valedictorianApiPaths.policyEvaluateRunWindow).toBe(
      '/v1/policy/evaluate/run-window',
    )
  })

  it('exports local capabilities for clients to adapt behavior', () => {
    expect(defaultLocalCapabilities).toEqual({
      localSqlite: true,
      agentWorkflows: false,
      workflowRuns: true,
      applicationAttempts: true,
      sourcing: true,
      connectors: true,
      hostedSync: false,
      multiWorkspace: true,
      billing: false,
      connectorScheduling: { available: false },
    })
  })

  it('has no Electron, React, SQLite, or native database dependencies', () => {
    const packageJson = readPackageJson()
    const dependencyNames = Object.keys({
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    })

    expect(packageJson.name).toBe('sparxie')
    expect(packageJson.types).toBe('./dist/index.d.ts')
    expect(packageJson.files).toEqual(['dist'])
    expect(packageJson.exports).toBeDefined()
    expect(dependencyNames).not.toEqual(
      expect.arrayContaining([
        'electron',
        'react',
        'react-dom',
        'drizzle-orm',
        'better-sqlite3',
        '@types/better-sqlite3',
      ]),
    )
  })

  it('exports connector earliestBackfillDate schemas and required summary field', () => {
    const connectorSource = fs.readFileSync(path.resolve('src/connector.ts'), 'utf8')
    const indexSource = fs.readFileSync(path.resolve('src/index.ts'), 'utf8')
    const summaryBlock =
      connectorSource.match(/export interface ConnectorInstanceSummary \{[\s\S]*?\n\}/)?.[0] ??
      ''
    const createBlock =
      connectorSource.match(/export interface CreateConnectorInstanceInput \{[\s\S]*?\n\}/)?.[0] ??
      ''
    const updateBlock =
      connectorSource.match(/export interface UpdateConnectorInstanceInput \{[\s\S]*?\n\}/)?.[0] ??
      ''

    expect(indexSource).toContain("export * from './canonical-date.js'")
    expect(summaryBlock).toMatch(/earliestBackfillDate:\s*CanonicalDateOnly/)
    expect(createBlock).toMatch(/earliestBackfillDate\?:\s*CanonicalDateOnly/)
    expect(updateBlock).toMatch(/earliestBackfillDate\?:\s*CanonicalDateOnly/)
    expect(connectorSource).toContain('connectorInstanceSummarySchema')
    expect(connectorSource).toContain('connectorInstancesListResultSchema')
    expect(connectorSource).toContain('createConnectorInstanceInputSchema')
    expect(connectorSource).toContain('updateConnectorInstanceInputSchema')
    expect(connectorSource).toContain('connectorAuthReferenceInputSchema')
  })
})
