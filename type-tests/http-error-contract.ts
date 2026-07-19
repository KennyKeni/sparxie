import {
  ConnectorCreateHttpError,
  connectorCreateErrorBodies,
  ConnectorScheduleHttpError,
  connectorScheduleErrorBodies,
  LocalSecretResolutionHttpError,
  localSecretResolutionErrorBodies,
  ProfileDocumentHttpError,
  profileDocumentErrorBodies,
  ValedictorianHttpError,
  ValedictorianProtocolError,
  ValedictorianTransportError,
  parseValedictorianContractValue,
  parseValedictorianRetryAfterHeader,
  valedictorianFailureKindMessages,
  valedictorianFailureKinds,
  type ConnectorCreateErrorBody,
  type ValedictorianFailureKind,
  type ValedictorianErrorBody,
  type ValedictorianRetryAfter,
} from '../src/index.js'

const kinds: typeof valedictorianFailureKinds = [
  'validation',
  'not_found',
  'conflict',
  'authentication',
  'authorization',
  'rate_limit',
  'unavailable',
  'integrity',
  'internal',
]

const kind: ValedictorianFailureKind = kinds[0]
const message: string = valedictorianFailureKindMessages[kind]

const body: ValedictorianErrorBody<'example_code', { field: string }> = {
  code: 'example_code',
  message,
  details: { field: 'fullName' },
  requestId: 'req_01',
}

const httpError = new ValedictorianHttpError({
  body,
  message: body.message,
  status: 422,
  kind: 'validation',
})

const profileError = new ProfileDocumentHttpError(
  profileDocumentErrorBodies.profile_revision_conflict,
  409,
)
const profileKind: ValedictorianFailureKind = profileError.kind

const secretError = new LocalSecretResolutionHttpError(
  localSecretResolutionErrorBodies.secret_not_found,
  404,
)
const secretKind: ValedictorianFailureKind = secretError.kind

const scheduleError = new ConnectorScheduleHttpError(
  connectorScheduleErrorBodies.stale_schedule_revision,
  409,
)
const scheduleKind: ValedictorianFailureKind = scheduleError.kind

const createError = new ConnectorCreateHttpError(
  connectorCreateErrorBodies.already_configured,
  409,
)
const createBody: ConnectorCreateErrorBody = createError.body
const createKind: ValedictorianFailureKind = createError.kind

const transportError = new ValedictorianTransportError()
const protocolError = new ValedictorianProtocolError()
const retryAfter: ValedictorianRetryAfter | undefined = parseValedictorianRetryAfterHeader('12')

void httpError
void profileKind
void secretKind
void scheduleKind
void createBody
void createKind
void transportError
void protocolError
void retryAfter
void parseValedictorianContractValue
