import { z } from 'zod'

export interface ValedictorianProjectConfig {
  version: 1
  workspace: {
    name?: string
  }
}

export const defaultValedictorianProjectConfig: ValedictorianProjectConfig = {
  version: 1,
  workspace: {},
}

const currentProjectConfigVersion = 1
const forbiddenSecretKeys = new Set(['apitoken', 'token', 'secret', 'clientsecret'])

const projectConfigSchema = z
  .object({
    version: z.literal(1).optional().default(1),
    workspace: z
      .object({
        name: z.string().transform((value) => value.trim()).pipe(z.string().min(1)).optional(),
      })
      .optional()
      .default({}),
  })
  .strict()

export function parseValedictorianProjectConfig(value: unknown): ValedictorianProjectConfig {
  assertNoSecretLikeKeys(value)

  const version = readConfigVersion(value)

  if (version > currentProjectConfigVersion) {
    throw new Error(`Project config version ${version} is newer than this package supports.`)
  }

  const parsed = projectConfigSchema.safeParse(value)

  if (!parsed.success) {
    throw new Error(`Invalid Valedictorian project config: ${parsed.error.issues[0]?.message ?? 'unknown error'}`)
  }

  return parsed.data
}

function readConfigVersion(value: unknown) {
  if (!isRecord(value)) {
    return currentProjectConfigVersion
  }

  return typeof value.version === 'number' ? value.version : currentProjectConfigVersion
}

function assertNoSecretLikeKeys(value: unknown) {
  if (Array.isArray(value)) {
    for (const item of value) {
      assertNoSecretLikeKeys(item)
    }
    return
  }

  if (!isRecord(value)) {
    return
  }

  for (const [key, child] of Object.entries(value)) {
    if (forbiddenSecretKeys.has(key.toLowerCase())) {
      throw new Error(`Project config must not contain secret-like key: ${key}`)
    }

    assertNoSecretLikeKeys(child)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}
