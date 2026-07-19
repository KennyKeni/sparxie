import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ConnectorCreateHttpError,
  ConnectorOptionQueryHttpError,
  ConnectorRetirementConflictError,
  ConnectorScheduleHttpError,
  createHttpValedictorianClient,
  LocalSecretResolutionHttpError,
  connectorCreateErrorBodies,
  connectorCreateErrorCodes,
  connectorCreateErrorKindByCode,
  connectorCreateErrorStatusByCode,
  connectorOptionQueryErrorBodies,
  connectorOptionQueryErrorCodes,
  connectorOptionQueryErrorKindByCode,
  connectorOptionQueryErrorStatusByCode,
  connectorScheduleErrorBodies,
  connectorScheduleErrorCodes,
  connectorScheduleErrorKindByCode,
  connectorScheduleErrorStatusByCode,
  createSecretReference,
  localSecretResolutionErrorBodies,
  localSecretResolutionErrorCodes,
  localSecretResolutionErrorKindByCode,
  localSecretResolutionErrorStatusByCode,
  profileDocumentErrorBodies,
  profileDocumentErrorCodes,
  profileDocumentErrorKindByCode,
  profileDocumentErrorStatusByCode,
  ProfileDocumentHttpError,
} from './index.js'
import { jsonResponse } from './http-client.test-support.js'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('validated capability failure kinds', () => {
  it('exports exhaustive kindByCode maps for strict contracts', () => {
    expect(profileDocumentErrorKindByCode).toEqual({
      invalid_profile_document: 'validation',
      unsupported_profile_schema_version: 'conflict',
      profile_revision_conflict: 'conflict',
      profile_document_unavailable: 'not_found',
      profile_backup_unavailable: 'not_found',
    })
    expect(Object.keys(profileDocumentErrorKindByCode).sort()).toEqual(
      [...profileDocumentErrorCodes].sort(),
    )

    expect(localSecretResolutionErrorKindByCode).toEqual({
      secret_not_found: 'not_found',
      local_secret_resolution_unsupported: 'conflict',
      local_secret_resolution_unauthorized: 'authorization',
      secure_storage_unavailable: 'unavailable',
    })
    expect(Object.keys(localSecretResolutionErrorKindByCode).sort()).toEqual(
      [...localSecretResolutionErrorCodes].sort(),
    )

    expect(connectorOptionQueryErrorKindByCode.option_value_invalid).toBe('validation')
    expect(connectorOptionQueryErrorKindByCode.unsupported_descriptor).toBe('conflict')
    expect(connectorOptionQueryErrorKindByCode.option_query_unavailable).toBe('conflict')
    expect(Object.keys(connectorOptionQueryErrorKindByCode).sort()).toEqual(
      [...connectorOptionQueryErrorCodes].sort(),
    )

    expect(connectorScheduleErrorKindByCode).toEqual({
      connector_scheduling_unavailable: 'unavailable',
      invalid_timezone: 'validation',
      invalid_cadence: 'validation',
      schedule_too_frequent: 'validation',
      stale_schedule_revision: 'conflict',
      schedule_dispatch_conflict: 'conflict',
    })
    expect(Object.keys(connectorScheduleErrorKindByCode).sort()).toEqual(
      [...connectorScheduleErrorCodes].sort(),
    )
    expect(Object.keys(connectorScheduleErrorStatusByCode).sort()).toEqual(
      [...connectorScheduleErrorCodes].sort(),
    )

    expect(connectorCreateErrorKindByCode).toEqual({
      already_configured: 'conflict',
    })
    expect(Object.keys(connectorCreateErrorKindByCode).sort()).toEqual(
      [...connectorCreateErrorCodes].sort(),
    )
    expect(Object.keys(connectorCreateErrorStatusByCode).sort()).toEqual(
      [...connectorCreateErrorCodes].sort(),
    )

  })

  it('attaches non-optional kind on validated profile document HTTP failures', async () => {
    for (const code of profileDocumentErrorCodes) {
      const body = code === 'invalid_profile_document'
        ? {
            ...profileDocumentErrorBodies.invalid_profile_document,
            path: ['profile', 'dateOfBirth'],
          }
        : profileDocumentErrorBodies[code]
      const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      fetchMock.mockResolvedValueOnce(
        jsonResponse(body, { status: profileDocumentErrorStatusByCode[code] }),
      )
      vi.stubGlobal('fetch', fetchMock)

      const error = await createHttpValedictorianClient({
        baseUrl: 'https://valedictorian.test',
      })
        .forWorkspace('workspace-1')
        .profile.document.get()
        .catch((caught: unknown) => caught)

      expect(error).toBeInstanceOf(ProfileDocumentHttpError)
      expect(error).toMatchObject({
        code,
        kind: profileDocumentErrorKindByCode[code],
        status: profileDocumentErrorStatusByCode[code],
        message: body.message,
      })
      expect(error).toHaveProperty('kind')
    }
  })

  it('attaches kind on validated local-secret, option-query, and retirement failures', async () => {
    for (const code of localSecretResolutionErrorCodes) {
      const body = localSecretResolutionErrorBodies[code]
      const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify(body), {
          headers: {
            'cache-control': 'no-store',
            'content-type': 'application/json',
          },
          status: localSecretResolutionErrorStatusByCode[code],
        }),
      )
      vi.stubGlobal('fetch', fetchMock)

      const error = await createHttpValedictorianClient({
        baseUrl: 'https://valedictorian.test',
      })
        .forWorkspace('workspace-1')
        .secrets.local.resolve({
          reference: createSecretReference('connector_jobright/password'),
          purpose: { kind: 'subprocess_injection' },
        })
        .catch((caught: unknown) => caught)

      expect(error).toBeInstanceOf(LocalSecretResolutionHttpError)
      expect(error).toMatchObject({
        code,
        kind: localSecretResolutionErrorKindByCode[code],
        status: localSecretResolutionErrorStatusByCode[code],
      })
    }

    for (const code of connectorOptionQueryErrorCodes) {
      const body = connectorOptionQueryErrorBodies[code]
      const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      fetchMock.mockResolvedValueOnce(
        jsonResponse(body, { status: connectorOptionQueryErrorStatusByCode[code] }),
      )
      vi.stubGlobal('fetch', fetchMock)

      const error = await createHttpValedictorianClient({
        baseUrl: 'https://valedictorian.test',
      })
        .forWorkspace('workspace-1')
        .connectors.options.query({
          connectorInstanceId: 'jobright-session',
          body: {
            sourceId: 'jobright.locations',
            operation: { kind: 'search', search: 'nyc', limit: 20 },
            dependencies: {},
          },
          expectedIdentity: {
            connectorId: 'jobright.resolver',
            connectorVersion: '0.13.0',
            filterSchemaVersion: 'filters@3',
            catalogVersion: 'options@2',
            sourceVersion: 'locations@4',
          },
        })
        .catch((caught: unknown) => caught)

      expect(error).toBeInstanceOf(ConnectorOptionQueryHttpError)
      expect(error).toMatchObject({
        code,
        kind: connectorOptionQueryErrorKindByCode[code],
        status: connectorOptionQueryErrorStatusByCode[code],
      })
    }

    {
      const conflict = {
        code: 'connector_retirement_active_work_conflict' as const,
        connectorInstanceId: 'jobright/session 1',
        message: 'Cancel active connector runs before retirement.',
        cancellationRequired: true as const,
        activeRuns: [{ connectorRunId: 'run-1', status: 'running' as const }],
      }
      const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      fetchMock.mockResolvedValueOnce(jsonResponse(conflict, { status: 409 }))
      vi.stubGlobal('fetch', fetchMock)
      const error = await createHttpValedictorianClient({
        baseUrl: 'https://valedictorian.test',
      })
        .forWorkspace('workspace-1')
        .connectors.remove({ connectorInstanceId: 'jobright/session 1' })
        .catch((caught: unknown) => caught)
      expect(error).toBeInstanceOf(ConnectorRetirementConflictError)
      expect(error).toMatchObject({ kind: 'conflict' })
    }

    for (const code of connectorScheduleErrorCodes) {
      const body = connectorScheduleErrorBodies[code]
      const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      fetchMock.mockResolvedValueOnce(
        jsonResponse(body, { status: connectorScheduleErrorStatusByCode[code] }),
      )
      vi.stubGlobal('fetch', fetchMock)

      const error = await createHttpValedictorianClient({
        baseUrl: 'https://valedictorian.test',
      })
        .forWorkspace('workspace-1')
        .connectors.schedules.upsert({
          connectorInstanceId: 'jobright/session 1',
          expectedRevision: null,
          state: 'enabled',
          cadence: { kind: 'interval', everyMinutes: 60 },
          timezone: 'America/New_York',
        })
        .catch((caught: unknown) => caught)

      expect(error).toBeInstanceOf(ConnectorScheduleHttpError)
      expect(error).toMatchObject({
        code,
        kind: connectorScheduleErrorKindByCode[code],
        status: connectorScheduleErrorStatusByCode[code],
      })
    }

    for (const code of connectorCreateErrorCodes) {
      const body = connectorCreateErrorBodies[code]
      const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      fetchMock.mockResolvedValueOnce(
        jsonResponse(body, { status: connectorCreateErrorStatusByCode[code] }),
      )
      vi.stubGlobal('fetch', fetchMock)

      const error = await createHttpValedictorianClient({
        baseUrl: 'https://valedictorian.test',
      })
        .forWorkspace('workspace-1')
        .connectors.create({
          id: 'jobright-a',
          connectorId: 'jobright.resolver',
          connectorVersion: '0.16.0',
          displayName: 'Jobright',
          enabled: true,
        })
        .catch((caught: unknown) => caught)

      expect(error).toBeInstanceOf(ConnectorCreateHttpError)
      expect(error).toMatchObject({
        code,
        kind: connectorCreateErrorKindByCode[code],
        status: connectorCreateErrorStatusByCode[code],
      })
    }
  })
})
