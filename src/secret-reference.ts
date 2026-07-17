import { z } from 'zod'

const SECRET_REFERENCE_SCHEME = 'secret://'
function containsControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code <= 0x1f || code === 0x7f || (code >= 0x80 && code <= 0x9f)) return true
  }
  return false
}

export type SecretReferenceUri = `secret://${string}`

export interface SecretReference {
  readonly $valedictorianRef: SecretReferenceUri
}

function assertNonEmptySegments(segments: string[]): asserts segments is [string, ...string[]] {
  if (segments.length === 0 || segments.some((segment) => segment.length === 0)) {
    throw new Error('secret reference key must contain only non-empty segments')
  }
}

function assertValidKeySegment(segment: string) {
  if (segment.length === 0) {
    throw new Error('secret reference key segment must be non-empty')
  }
  if (containsControlCharacter(segment) || /^\s|\s$/.test(segment) || segment.includes('/')) {
    throw new Error('secret reference key segment is invalid')
  }
  if (segment.trim().length === 0) {
    throw new Error('secret reference key segment must not be blank')
  }
  try {
    encodeURIComponent(segment)
  } catch {
    throw new Error('secret reference key segment cannot be canonically encoded')
  }
}

function splitKey(key: string): [string, ...string[]] {
  if (typeof key !== 'string' || key.length === 0 || key.trim().length === 0) {
    throw new Error('secret reference key is required')
  }
  if (containsControlCharacter(key)) {
    throw new Error('secret reference key must not contain control characters')
  }
  const segments = key.split('/')
  assertNonEmptySegments(segments)
  for (const segment of segments) assertValidKeySegment(segment)
  return segments
}

function encodeSegment(segment: string): string {
  return encodeURIComponent(segment)
}

function decodeSegment(segment: string): string {
  if (segment.length === 0) {
    throw new Error('secret reference URI segment must be non-empty')
  }
  if (/(?:^|[^%])%(?![0-9A-Fa-f]{2})/.test(` ${segment}`)) {
    throw new Error('secret reference URI segment encoding is malformed')
  }
  let decoded: string
  try {
    decoded = decodeURIComponent(segment)
  } catch {
    throw new Error('secret reference URI segment encoding is malformed')
  }
  if (decoded.includes('/')) {
    throw new Error('secret reference URI segment must not decode to a path separator')
  }
  assertValidKeySegment(decoded)
  if (encodeSegment(decoded) !== segment) {
    throw new Error('secret reference URI segment encoding is not canonical')
  }
  return decoded
}

export function formatSecretReferenceUri(key: string): SecretReferenceUri {
  const segments = splitKey(key)
  return `${SECRET_REFERENCE_SCHEME}${segments.map(encodeSegment).join('/')}` as SecretReferenceUri
}

export function parseSecretReferenceUri(uri: string): string {
  if (typeof uri !== 'string' || !uri.startsWith(SECRET_REFERENCE_SCHEME)) {
    throw new Error('secret reference URI scheme is invalid')
  }
  const path = uri.slice(SECRET_REFERENCE_SCHEME.length)
  if (path.length === 0) {
    throw new Error('secret reference URI key is required')
  }
  const encodedSegments = path.split('/')
  assertNonEmptySegments(encodedSegments)
  const decodedSegments = encodedSegments.map(decodeSegment)
  return decodedSegments.join('/')
}

export function createSecretReference(key: string): SecretReference {
  return { $valedictorianRef: formatSecretReferenceUri(key) }
}

export const secretReferenceKeySchema: z.ZodType<string> = z.string().superRefine((value, context) => {
  try {
    splitKey(value)
  } catch {
    context.addIssue({ code: 'custom', message: 'invalid secret reference key' })
  }
})

export const secretReferenceUriSchema: z.ZodType<SecretReferenceUri> = z
  .string()
  .superRefine((value, context) => {
    try {
      const key = parseSecretReferenceUri(value)
      if (formatSecretReferenceUri(key) !== value) {
        context.addIssue({ code: 'custom', message: 'secret reference URI is not canonical' })
      }
    } catch {
      context.addIssue({ code: 'custom', message: 'invalid secret reference URI' })
    }
  }) as z.ZodType<SecretReferenceUri>

export const secretReferenceSchema: z.ZodType<SecretReference> = z
  .object({
    $valedictorianRef: secretReferenceUriSchema,
  })
  .strict()
