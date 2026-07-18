import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  ValedictorianProtocolError,
  parseValedictorianContractValue,
  valedictorianSafeRequestFailedMessage,
} from './index.js'

describe('parseValedictorianContractValue', () => {
  it('throws a safe protocol failure for malformed contracted payloads', () => {
    const schema = z.object({ id: z.string() }).strict()

    try {
      parseValedictorianContractValue(schema, { id: 1, canary: 'protocol-secret' })
      expect.unreachable('expected protocol failure')
    } catch (error) {
      expect(error).toBeInstanceOf(ValedictorianProtocolError)
      expect(error).toMatchObject({ message: valedictorianSafeRequestFailedMessage })
      expect(JSON.stringify(error)).not.toContain('protocol-secret')
      expect(String(error)).not.toContain('protocol-secret')
      expect(JSON.stringify(error)).not.toContain('Zod')
    }
  })
})
