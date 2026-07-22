import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createHttpValedictorianClient,
  profileDocumentErrorBodies,
  ProfileDocumentHttpError,
  ValedictorianHttpError,
  ValedictorianProtocolError,
} from '../index.js'
import { jsonResponse } from './http-client.test-support.js'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('profile document typed HTTP errors', () => {
  it('maps a well-formed invalid document body to ProfileDocumentHttpError', async () => {
    const body = {
      code: 'invalid_profile_document' as const,
      message: profileDocumentErrorBodies.invalid_profile_document.message,
      path: ['profile', 'dateOfBirth'],
      line: 3,
      column: 8,
    }
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(jsonResponse(body, { status: 422 }))
    vi.stubGlobal('fetch', fetchMock)

    const error = await createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    })
      .forWorkspace('workspace-1')
      .profile.document.get()
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ProfileDocumentHttpError)
    expect(error).toMatchObject({
      status: 422,
      code: 'invalid_profile_document',
      body,
      message: body.message,
    })
  })

  it('does not leak unvalidated content for a recognized malformed error code', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          code: 'profile_revision_conflict',
          message: 'stale',
          currentRevision: 'secret-rev',
        },
        { status: 409 },
      ),
    )
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
    expect(error).not.toBeInstanceOf(ValedictorianHttpError)
    expect(JSON.stringify(error)).not.toContain('secret-rev')
    expect(String(error)).not.toContain('secret-rev')
  })
})
