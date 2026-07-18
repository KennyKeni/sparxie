import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createHttpValedictorianClient,
  invalidPersistedRawDetailErrorBody,
  InvalidPersistedRawDetailHttpError,
  profileDocumentErrorBodies,
  ProfileDocumentHttpError,
  ValedictorianHttpError,
  ValedictorianProtocolError,
  valedictorianSafeRequestFailedMessage,
} from './index.js'
import { jsonResponse } from './http-client.test-support.js'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('typed protocol failures for contracted endpoints', () => {
  it('maps malformed known integrity bodies to ValedictorianProtocolError', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        code: invalidPersistedRawDetailErrorBody.code,
        message: 'payload.password: canary-protocol-secret',
        validation: { rawPayload: 'secret' },
      }, { status: 500 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const error = await createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    })
      .forWorkspace('workspace-1')
      .sourcing.rawRecords.get('raw-1')
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ValedictorianProtocolError)
    expect(error).not.toBeInstanceOf(ValedictorianHttpError)
    expect(error).not.toBeInstanceOf(InvalidPersistedRawDetailHttpError)
    expect(error).toMatchObject({ message: valedictorianSafeRequestFailedMessage })
    expect(JSON.stringify(error)).not.toContain('canary-protocol-secret')
    expect(String(error)).not.toContain('canary-protocol-secret')
    expect(JSON.stringify(error)).not.toContain('password')
  })

  it('maps profile status mismatches to ValedictorianProtocolError', async () => {
    const body = profileDocumentErrorBodies.profile_revision_conflict
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(jsonResponse(body, { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)

    const error = await createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    })
      .forWorkspace('workspace-1')
      .profile.document.update({
        expectedRevision: 'rev-1',
        profile: { fullName: 'Kenny' },
      })
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ValedictorianProtocolError)
    expect(error).not.toBeInstanceOf(ProfileDocumentHttpError)
    expect(error).toMatchObject({ message: valedictorianSafeRequestFailedMessage })
    expect(JSON.stringify(error)).not.toContain(body.message)
  })
})
