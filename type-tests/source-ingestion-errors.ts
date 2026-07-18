import {
  SourceIngestionHttpError,
  ValedictorianHttpError,
  ValedictorianProtocolError,
  ValedictorianSourceHttpClient,
  type SourceConfidenceRuleAttachmentResponse,
  type SourceEffectiveConfidenceRulesResponse,
  type SourceEvidenceArtifactResponse,
  type SourceIngestionErrorBody,
  type SourceJobSnapshotResponse,
} from '../src/index.js'

declare const client: ValedictorianSourceHttpClient
declare const caught: unknown

const evidence: Promise<SourceEvidenceArtifactResponse> = client.getRunEvidenceArtifact(
  'run-1',
  'response.json',
)
const snapshot: Promise<SourceJobSnapshotResponse> = client.getSnapshot('snapshot-1')
const rules: Promise<SourceEffectiveConfidenceRulesResponse> =
  client.getEffectiveRules('source-1')
const attachment: Promise<SourceConfidenceRuleAttachmentResponse> =
  client.deleteRuleAttachment('attachment-1')

if (caught instanceof SourceIngestionHttpError) {
  const base: ValedictorianHttpError<SourceIngestionErrorBody> = caught
  const code: SourceIngestionErrorBody['code'] = caught.code
  const status: number = caught.status
  const requestId: string | undefined = caught.requestId
  const retryKind: 'delta-seconds' | 'http-date' | undefined = caught.retryAfter?.kind
  void [base, code, status, requestId, retryKind]
} else if (caught instanceof ValedictorianProtocolError) {
  const safeMessage: string = caught.message
  void safeMessage
}

void [evidence, snapshot, rules, attachment]
