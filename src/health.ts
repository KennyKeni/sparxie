import { z } from 'zod'

export interface ValedictorianHealth {
  ok: boolean
}

export const valedictorianHealthSchema: z.ZodType<ValedictorianHealth> = z
  .object({
    ok: z.boolean(),
  })
  .strict()
