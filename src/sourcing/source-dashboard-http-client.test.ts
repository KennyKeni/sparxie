import { describe, expect, it, vi } from 'vitest'
import {
  SourceIngestionHttpError,
  ValedictorianProtocolError,
  ValedictorianSourceHttpClient,
  sourceRuleErrorBodies,
  sourceRunErrorBodies,
} from '../index.js'

function client(fetchMock: typeof fetch) {
  return new ValedictorianSourceHttpClient({
    baseUrl: 'https://source.test/',
    fetch: fetchMock,
    token: 'operator',
  })
}

const attachment = {
  createdAt: '2026-07-18T12:00:00.000Z',
  createdBy: 'operator-1',
  enabled: true,
  id: 'attachment-1',
  params: { minimumCount: 10 },
  revokedAt: null,
  ruleKey: 'minimum_count',
  scopeKind: 'source',
  scopeRef: 'source-1',
  severity: 'block_publish',
} as const

describe('source dashboard detail operations', () => {
  it('reads evidence bytes and preserves response content type', async () => {
    const bytes = new Uint8Array([1, 2, 3, 255])
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(new Response(bytes, {
      headers: { 'content-type': 'application/octet-stream' },
      status: 200,
    }))

    await expect(client(fetchMock).getRunEvidenceArtifact(
      'run one',
      'responses/page one.json',
    )).resolves.toEqual({
      bytes,
      contentType: 'application/octet-stream',
    })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://source.test/runs/run%20one/evidence/responses/page%20one.json',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('reads a strict JobSnapshot inspection response', async () => {
    const payload = {
      snapshot: {
        addedCount: 2,
        changedCount: 1,
        jobCount: 3,
        previousSnapshotId: null,
        publishedAt: '2026-07-18T12:00:00.000Z',
        removedCount: 0,
        sampleJobs: [{
          applyUrl: 'https://example.test/apply/1',
          detailUrl: null,
          locations: [{ rawText: 'Denver, CO' }],
          stableJobKey: 'job-1',
          title: 'Engineer',
        }],
        snapshotId: 'snapshot-1',
        sourceId: 'source-1',
        sourceRunId: 'run-1',
      },
    }
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(Response.json(payload))

    await expect(client(fetchMock).getSnapshot('snapshot one')).resolves.toEqual(payload)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://source.test/snapshots/snapshot%20one',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('reads effective rules and writes and revokes strict attachments', async () => {
    const rules = {
      providerKey: 'greenhouse',
      rules: [{
        attachmentId: attachment.id,
        enabled: true,
        layers: [{
          attachmentId: attachment.id,
          scopeKind: 'source',
          scopeRef: 'source-1',
        }],
        params: { minimumCount: 10 },
        provenance: {
          attachmentId: attachment.id,
          scopeKind: 'source',
          scopeRef: 'source-1',
        },
        ruleKey: 'minimum_count',
        severity: 'block_publish',
        severityAttachmentId: attachment.id,
      }],
      sourceId: 'source-1',
      sourceSlug: 'example-source',
    }
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock
      .mockResolvedValueOnce(Response.json(rules))
      .mockResolvedValueOnce(Response.json({ attachment }, { status: 201 }))
      .mockResolvedValueOnce(Response.json({
        attachment: { ...attachment, revokedAt: '2026-07-18T13:00:00.000Z' },
      }))
    const source = client(fetchMock)

    await expect(source.getEffectiveRules('source one')).resolves.toEqual(rules)
    await expect(source.putRuleAttachment({
      enabled: true,
      params: { minimumCount: 10 },
      ruleKey: 'minimum_count',
      scopeKind: 'source',
      scopeRef: 'source-1',
      severity: 'block_publish',
    })).resolves.toEqual({ attachment })
    await expect(source.deleteRuleAttachment('attachment one')).resolves.toEqual({
      attachment: { ...attachment, revokedAt: '2026-07-18T13:00:00.000Z' },
    })

    expect(fetchMock.mock.calls.map(([url, init]) => [url, init?.method])).toEqual([
      ['https://source.test/sources/source%20one/effective-rules', 'GET'],
      ['https://source.test/rules/attachments', 'PUT'],
      ['https://source.test/rules/attachments/attachment%20one', 'DELETE'],
    ])
  })

  it('maps detail operation contracts and rejects malformed successful DTOs', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock
      .mockResolvedValueOnce(Response.json(
        sourceRunErrorBodies.evidence_artifact_not_found,
        { status: 404 },
      ))
      .mockResolvedValueOnce(Response.json(
        sourceRuleErrorBodies.rule_attachment_not_found,
        { status: 404 },
      ))
      .mockResolvedValueOnce(Response.json({ snapshot: { diagnostic: 'canary' } }))
    const source = client(fetchMock)

    const evidenceError = await source.getRunEvidenceArtifact('run-1', 'missing.json')
      .catch((error: unknown) => error)
    expect(evidenceError).toBeInstanceOf(SourceIngestionHttpError)
    expect(evidenceError).toMatchObject({ code: 'evidence_artifact_not_found', status: 404 })

    const ruleError = await source.deleteRuleAttachment('missing')
      .catch((error: unknown) => error)
    expect(ruleError).toBeInstanceOf(SourceIngestionHttpError)
    expect(ruleError).toMatchObject({ code: 'rule_attachment_not_found', status: 404 })

    const protocol = await source.getSnapshot('snapshot-1').catch((error: unknown) => error)
    expect(protocol).toBeInstanceOf(ValedictorianProtocolError)
    expect(JSON.stringify(protocol)).not.toContain('canary')
  })
})
