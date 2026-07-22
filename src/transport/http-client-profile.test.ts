import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createHttpValedictorianClient,
  defaultUserProfile,
  profileDocumentSchemaVersion,
  valedictorianApiPaths,
} from '../index.js'
import { jsonResponse } from './http-client.test-support.js'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('ordinary profile HTTP validation', () => {
  it('rejects an ordinary profile.get response that includes an SSN field', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        ...defaultUserProfile,
        fullName: 'Kenny Lin',
        ssnLast4: '5125',
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const error = await createHttpValedictorianClient({ baseUrl: 'http://127.0.0.1:4317' })
      .forWorkspace('workspace-1')
      .profile.get()
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(Error)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rejects ordinary profile.update input with impossible DOB or secret fields before fetch', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    vi.stubGlobal('fetch', fetchMock)
    const profile = createHttpValedictorianClient({
      baseUrl: 'http://127.0.0.1:4317',
    }).forWorkspace('workspace-1').profile

    await expect(
      profile.update({ dateOfBirth: '2023-02-29' }),
    ).rejects.toBeInstanceOf(Error)
    await expect(
      profile.update({ fullName: 'Kenny Lin', ssnLast4: '5125' } as never),
    ).rejects.toBeInstanceOf(Error)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('validates the full profile returned from ordinary profile.update', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        fullName: 'Kenny Lin',
        answers: [],
        ssnLast4: '5125',
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const error = await createHttpValedictorianClient({ baseUrl: 'http://127.0.0.1:4317' })
      .forWorkspace('workspace-1')
      .profile.update({ fullName: 'Kenny Lin' })
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(Error)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rejects agent-context responses with secrets, unknown fields, or invalid facts', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        answers: [],
        basics: { fullName: 'Kenny Lin', ssnLast4: '5125' },
        education: [],
      }),
    )
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        answers: [],
        basics: { fullName: 'Kenny Lin' },
        education: [],
        secret: true,
      }),
    )
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        answers: [],
        basics: { dateOfBirth: '2023-02-29' },
        education: [],
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const agentContext = createHttpValedictorianClient({
      baseUrl: 'http://127.0.0.1:4317',
    }).forWorkspace('workspace-1').profile.agentContext

    await expect(agentContext.get()).rejects.toBeInstanceOf(Error)
    await expect(agentContext.get()).rejects.toBeInstanceOf(Error)
    await expect(agentContext.get()).rejects.toBeInstanceOf(Error)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})

describe('profile document HTTP client', () => {
  it('exports workspace-relative profile document paths', () => {
    expect(valedictorianApiPaths.profileDocument).toBe('/v1/profile/document')
    expect(valedictorianApiPaths.profileDocumentValidate).toBe('/v1/profile/document/validate')
    expect(valedictorianApiPaths.profileDocumentFormat).toBe('/v1/profile/document/format')
    expect(valedictorianApiPaths.profileDocumentRestore).toBe('/v1/profile/document/restore')
  })

  it('maps profile.document methods through the workspace-scoped HTTP client', async () => {
    const document = {
      schemaVersion: profileDocumentSchemaVersion,
      revision: 'rev-2',
      profile: {
        ...defaultUserProfile,
        fullName: 'Kenny Lin',
        dateOfBirth: '1998-04-12',
        gender: 'Man' as const,
      },
    }
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(jsonResponse(document))
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...document, revision: 'rev-3' }))
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        schemaVersion: profileDocumentSchemaVersion,
        revision: 'rev-3',
      }),
    )
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...document, revision: 'rev-4' }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...document, revision: 'rev-5' }))
    vi.stubGlobal('fetch', fetchMock)

    const workspace = createHttpValedictorianClient({
      baseUrl: 'http://127.0.0.1:4317',
    }).forWorkspace('workspace-1')

    await expect(workspace.profile.document.get()).resolves.toEqual(document)
    await expect(
      workspace.profile.document.update({
        expectedRevision: 'rev-2',
        profile: { fullName: 'Kenny Lin' },
      }),
    ).resolves.toMatchObject({ revision: 'rev-3' })
    await expect(workspace.profile.document.validate()).resolves.toEqual({
      schemaVersion: profileDocumentSchemaVersion,
      revision: 'rev-3',
    })
    await expect(
      workspace.profile.document.format({ expectedRevision: 'rev-3' }),
    ).resolves.toMatchObject({ revision: 'rev-4' })
    await expect(
      workspace.profile.document.restore({ expectedRevision: null }),
    ).resolves.toMatchObject({ revision: 'rev-5' })

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:4317/v1/workspaces/workspace-1/profile/document',
      expect.objectContaining({ method: 'GET' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:4317/v1/workspaces/workspace-1/profile/document',
      expect.objectContaining({
        body: JSON.stringify({
          expectedRevision: 'rev-2',
          profile: { fullName: 'Kenny Lin' },
        }),
        method: 'PUT',
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'http://127.0.0.1:4317/v1/workspaces/workspace-1/profile/document/validate',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      'http://127.0.0.1:4317/v1/workspaces/workspace-1/profile/document/format',
      expect.objectContaining({
        body: JSON.stringify({ expectedRevision: 'rev-3' }),
        method: 'POST',
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      'http://127.0.0.1:4317/v1/workspaces/workspace-1/profile/document/restore',
      expect.objectContaining({
        body: JSON.stringify({ expectedRevision: null }),
        method: 'POST',
      }),
    )
  })
})
