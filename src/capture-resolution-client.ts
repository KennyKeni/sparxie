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
import type {
  CaptureCompletionDetailV2,
  CaptureResolutionListResultV2,
  CompleteCaptureManuallyV2Input,
  CompleteCaptureManuallyV2Result,
} from './capture-resolution-v2.js'

export interface CaptureResolutionWorkspaceClient {
  list(input: CaptureResolutionListInput): Promise<CaptureResolutionListResult>
  get(captureId: string): Promise<CaptureCompletionDetail>
  retry(input: RetryCaptureProcessingInput): Promise<CaptureProcessingStartResult>
  replay(input: ReplayCaptureRevisionInput): Promise<CaptureProcessingStartResult>
  correct(input: CorrectCaptureResolutionInput): Promise<CorrectCaptureResolutionResult>
  complete(input: CompleteCaptureManuallyInput): Promise<CompleteCaptureManuallyResult>
}

/** URL-only current Capture-resolution transport published alongside v1. */
export interface CaptureResolutionV2WorkspaceClient {
  list(input: CaptureResolutionListInput): Promise<CaptureResolutionListResultV2>
  get(captureId: string): Promise<CaptureCompletionDetailV2>
  complete(input: CompleteCaptureManuallyV2Input): Promise<CompleteCaptureManuallyV2Result>
}
