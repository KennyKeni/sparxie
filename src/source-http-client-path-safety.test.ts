import { describe, expect, it, vi } from 'vitest'
import { ValedictorianSourceHttpClient } from './index.js'

const invalidSourcePathSegmentMessage =
  'Source identifier must be a nonempty non-relative path segment'

function client(fetchMock: typeof fetch) {
  return new ValedictorianSourceHttpClient({
    baseUrl: 'https://source.test/',
    fetch: fetchMock,
    token: 'operator',
  })
}

describe('source HTTP client path safety', () => {
  it.each(['', '.', '..'])('rejects unsafe dynamic identifier %j before fetch', async (id) => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockRejectedValue(new Error('fetch must not be called'))
    const source = client(fetchMock)
    const operations = [
      () => source.getRun(id),
      () => source.getRunEvidenceArtifact(id, 'response.json'),
      () => source.getSnapshot(id),
      () => source.getEffectiveRules(id),
      () => source.deleteRuleAttachment(id),
      () => source.probeSource(id),
      () => source.updateSourceLifecycle(id, { status: 'paused' }),
      () => source.getSchedule(id),
      () => source.setSchedule(id, { cadence: 'daily' }),
      () => source.disableSchedule(id),
      () => source.requestRun(id),
      () => source.acceptBaseline(id, 'operator verified the baseline'),
      () => source.forcePublish(id, 'operator reviewed the evidence'),
    ]

    for (const operation of operations) {
      const error = await operation().catch((caught: unknown) => caught)
      expect(error).toBeInstanceOf(TypeError)
      expect(error).toMatchObject({ message: invalidSourcePathSegmentMessage })
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
