import type {
  CaptureCompletionDetail,
  CaptureResolutionListInput,
  CaptureResolutionListResult,
  CaptureProcessingStartResult,
  CorrectCaptureResolutionResult,
  CompleteCaptureManuallyInput,
  CompleteCaptureManuallyResult,
  CorrectCaptureResolutionInput,
  ReplayCaptureRevisionInput,
  RetryCaptureProcessingInput,
} from './capture-resolution.js'

export interface CaptureResolutionWorkspaceClient {
  list(input: CaptureResolutionListInput): Promise<CaptureResolutionListResult>
  get(captureId: string): Promise<CaptureCompletionDetail>
  retry(input: RetryCaptureProcessingInput): Promise<CaptureProcessingStartResult>
  replay(input: ReplayCaptureRevisionInput): Promise<CaptureProcessingStartResult>
  correct(input: CorrectCaptureResolutionInput): Promise<CorrectCaptureResolutionResult>
  complete(input: CompleteCaptureManuallyInput): Promise<CompleteCaptureManuallyResult>
}
