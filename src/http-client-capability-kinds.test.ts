import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ConnectorOptionQueryHttpError,
  ConnectorRetirementConflictError,
  createHttpValedictorianClient,
  InvalidPersistedRawDetailHttpError,
  invalidPersistedRawDetailErrorBody,
  LocalSecretResolutionHttpError,
  connectorOptionQueryErrorBodies,
  connectorOptionQueryErrorCodes,
  connectorOptionQueryErrorKindByCode,
  connectorOptionQueryErrorStatusByCode,
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
  invalidPersistedRawDetailErrorKindByCode,
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

    expect(invalidPersistedRawDetailErrorKindByCode).toEqual({
      invalid_persisted_raw_detail: 'integrity',
    })
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

  it('attaches kind on validated local-secret, option-query, raw-detail, and retirement failures', async () => {
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
      const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      fetchMock.mockResolvedValueOnce(
        jsonResponse(invalidPersistedRawDetailErrorBody, { status: 503 }),
      )
      vi.stubGlobal('fetch', fetchMock)
      const error = await createHttpValedictorianClient({
        baseUrl: 'https://valedictorian.test',
      })
        .forWorkspace('workspace-1')
        .sourcing.rawRecords.get('raw-1')
        .catch((caught: unknown) => caught)
      expect(error).toBeInstanceOf(InvalidPersistedRawDetailHttpError)
      expect(error).toMatchObject({
        kind: invalidPersistedRawDetailErrorKindByCode.invalid_persisted_raw_detail,
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
  })
})
