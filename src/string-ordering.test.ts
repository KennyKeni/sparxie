import { describe, expect, it } from 'vitest'
import { compareUtf8Bytewise } from './string-ordering.js'

describe('UTF-8 bytewise string ordering', () => {
  it('orders ASCII, multibyte, and prefix values by encoded bytes', () => {
    expect(compareUtf8Bytewise('connector-a', 'connector-b')).toBeLessThan(0)
    expect(compareUtf8Bytewise('a', 'aa')).toBeLessThan(0)
    expect(compareUtf8Bytewise('é', 'z')).toBeGreaterThan(0)
    expect(compareUtf8Bytewise('same', 'same')).toBe(0)
  })
})
