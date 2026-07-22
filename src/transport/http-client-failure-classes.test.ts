import { describe, expect, it } from 'vitest'
import {
  ValedictorianHttpError,
  ValedictorianProtocolError,
  ValedictorianTransportError,
  valedictorianSafeRequestFailedMessage,
} from '../index.js'

describe('typed client failure classes', () => {
  it('preserves ValedictorianHttpError constructor compatibility and safe serialization', () => {
    const error = new ValedictorianHttpError({
      body: { code: 'example' },
      message: 'The request is invalid.',
      status: 422,
    })

    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(ValedictorianHttpError)
    expect(error.name).toBe('ValedictorianHttpError')
    expect(error).toMatchObject({
      status: 422,
      body: { code: 'example' },
      message: 'The request is invalid.',
    })
    expect(JSON.stringify(error)).not.toContain('password')
  })

  it('wraps transport causes as ValedictorianTransportError without serializing them', () => {
    const cause = new TypeError('fetch failed: canary-transport-secret')
    const error = new ValedictorianTransportError({ cause })

    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(ValedictorianTransportError)
    expect(error).not.toBeInstanceOf(ValedictorianHttpError)
    expect(error.name).toBe('ValedictorianTransportError')
    expect(error.message).toBe(valedictorianSafeRequestFailedMessage)
    expect(error.cause).toBe(cause)
    expect(Object.keys(error)).not.toContain('cause')
    expect(JSON.stringify(error)).not.toContain('canary-transport-secret')
    expect(String(error)).not.toContain('canary-transport-secret')
  })

  it('keeps protocol causes non-enumerable and uses safe copy', () => {
    const cause = new Error('Zod: canary-protocol-secret expected string')
    const error = new ValedictorianProtocolError({ cause })

    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(ValedictorianProtocolError)
    expect(error).not.toBeInstanceOf(ValedictorianHttpError)
    expect(error).not.toBeInstanceOf(ValedictorianTransportError)
    expect(error.name).toBe('ValedictorianProtocolError')
    expect(error.message).toBe(valedictorianSafeRequestFailedMessage)
    expect(error.cause).toBe(cause)
    expect(Object.keys(error)).not.toContain('cause')
    expect(JSON.stringify(error)).not.toContain('canary-protocol-secret')
    expect(String(error)).not.toContain('canary-protocol-secret')
  })
})
