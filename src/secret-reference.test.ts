import { describe, expect, it } from 'vitest'
import {
  createSecretReference,
  formatSecretReferenceUri,
  parseSecretReferenceUri,
  secretReferenceKeySchema,
  secretReferenceSchema,
  secretReferenceUriSchema,
  type SecretReference,
  type SecretReferenceUri,
} from './secret-reference.js'

describe('secret reference key codec', () => {
  it('round-trips multi-segment keys with canonical percent-encoded path segments', () => {
    const key = 'connector_jobright/password'
    const uri = formatSecretReferenceUri(key)

    expect(uri).toBe('secret://connector_jobright/password')
    expect(parseSecretReferenceUri(uri)).toBe(key)
    expect(formatSecretReferenceUri(parseSecretReferenceUri(uri))).toBe(uri)
    expect(secretReferenceKeySchema.parse(key)).toBe(key)
    expect(secretReferenceUriSchema.parse(uri)).toBe(uri)
  })

  it('percent-encodes reserved segment characters and requires exact round-trip equality', () => {
    const key = 'greenhouse password/api#token?'
    const uri = formatSecretReferenceUri(key)

    expect(uri).toBe('secret://greenhouse%20password/api%23token%3F')
    expect(parseSecretReferenceUri(uri)).toBe(key)
    expect(formatSecretReferenceUri(parseSecretReferenceUri(uri))).toBe(uri)
    expect(secretReferenceUriSchema.safeParse('secret://greenhouse password/api#token?').success)
      .toBe(false)
    expect(secretReferenceUriSchema.safeParse('secret://greenhouse%20password/api%23token%3f').success)
      .toBe(false)
  })

  it('rejects empty, blank, control, empty-segment, malformed, and wrong-scheme keys/URIs', () => {
    for (const key of ['', '   ', '\t', 'a\nb', 'a\0b', 'a//b', '/a', 'a/', '//']) {
      expect(secretReferenceKeySchema.safeParse(key).success).toBe(false)
      expect(() => formatSecretReferenceUri(key)).toThrow()
    }

    for (const uri of [
      '',
      'secret://',
      'secret:///',
      'secret://a//b',
      'secret://a/',
      'secret:///a',
      'secret://%',
      'secret://%2',
      'secret://%zz',
      'secret://a%2Fb',
      'secrets://a',
      'http://a',
      'secret:a',
      'secret:/a',
      'secret:////a',
      'SECRET://a',
    ]) {
      expect(secretReferenceUriSchema.safeParse(uri).success).toBe(false)
      expect(() => parseSecretReferenceUri(uri)).toThrow()
    }
  })

  it('rejects lone UTF-16 surrogates that cannot be canonically encoded', () => {
    const loneHigh = '\uD800'
    const loneLow = '\uDC00'

    expect(secretReferenceKeySchema.safeParse(loneHigh).success).toBe(false)
    expect(secretReferenceKeySchema.safeParse(loneLow).success).toBe(false)
    expect(secretReferenceKeySchema.safeParse(`ok/${loneHigh}`).success).toBe(false)
    expect(secretReferenceKeySchema.safeParse(`${loneLow}/ok`).success).toBe(false)
    expect(() => formatSecretReferenceUri(loneHigh)).toThrow()
    expect(() => formatSecretReferenceUri(loneLow)).toThrow()
  })

  it('rejects C1 control characters in keys and URIs', () => {
    for (const control of ['\u0085', '\u009F']) {
      expect(secretReferenceKeySchema.safeParse(`a${control}b`).success).toBe(false)
      expect(() => formatSecretReferenceUri(`a${control}b`)).toThrow()
      expect(secretReferenceUriSchema.safeParse(`secret://a${encodeURIComponent(control)}b`).success)
        .toBe(false)
      expect(() => parseSecretReferenceUri(`secret://a${encodeURIComponent(control)}b`)).toThrow()
    }
  })

  it('round-trips valid non-ASCII Unicode segments', () => {
    const key = 'コネクタ/パスワード🔑'
    const uri = formatSecretReferenceUri(key)

    expect(uri).toBe(
      'secret://%E3%82%B3%E3%83%8D%E3%82%AF%E3%82%BF/%E3%83%91%E3%82%B9%E3%83%AF%E3%83%BC%E3%83%89%F0%9F%94%91',
    )
    expect(parseSecretReferenceUri(uri)).toBe(key)
    expect(formatSecretReferenceUri(parseSecretReferenceUri(uri))).toBe(uri)
    expect(secretReferenceKeySchema.parse(key)).toBe(key)
    expect(secretReferenceUriSchema.parse(uri)).toBe(uri)
  })
})

describe('structured secret reference schema', () => {
  it('accepts only the tagged $valedictorianRef object and rejects bare strings/unknown fields', () => {
    const reference: SecretReference = createSecretReference('connector_jobright/password')
    const uri: SecretReferenceUri = 'secret://connector_jobright/password'

    expect(reference).toEqual({ $valedictorianRef: uri })
    expect(secretReferenceSchema.parse(reference)).toEqual(reference)
    expect(secretReferenceSchema.safeParse(uri).success).toBe(false)
    expect(secretReferenceSchema.safeParse('secret://connector_jobright/password').success).toBe(false)
    expect(secretReferenceSchema.safeParse('connector_jobright/password').success).toBe(false)
    expect(secretReferenceSchema.safeParse({ $valedictorianRef: uri, extra: true }).success)
      .toBe(false)
    expect(secretReferenceSchema.safeParse({ valedictorianRef: uri }).success).toBe(false)
    expect(secretReferenceSchema.safeParse({ $valedictorianRef: 'http://x' }).success).toBe(false)
  })
})
