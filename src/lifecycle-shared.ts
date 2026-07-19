import { z } from 'zod'

export const lifecycleInstantSchema = z.iso.datetime({ offset: true })
export const lifecycleIdSchema = z.string().trim().min(1).max(200)
export const lifecycleTextSchema = z.string().trim().min(1).max(2_000)
export const lifecycleUrlSchema = z.url({ protocol: /^https?$/ }).max(4_096)

export const uuidV7Schema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)

export const lifecycleActorTypes = ['user', 'agent', 'system'] as const
export type LifecycleActorType = (typeof lifecycleActorTypes)[number]

export const lifecycleActorSchema = z
  .object({
    id: lifecycleIdSchema,
    type: z.enum(lifecycleActorTypes),
    displayName: z.string().trim().min(1).max(200).optional(),
  })
  .strict()

export type LifecycleActor = z.infer<typeof lifecycleActorSchema>

export const lifecycleBlockerCodes = [
  'invalid_input',
  'missing_lineage',
  'foreign_lineage',
  'workspace_ownership',
  'strong_identity_conflict',
  'impossible_state',
  'bounded_data_violation',
  'security_violation',
  'deterministic_duplicate',
] as const

export type LifecycleBlockerCode = (typeof lifecycleBlockerCodes)[number]

export const duplicateResolutions = ['attach', 'merge'] as const
export type DuplicateResolution = (typeof duplicateResolutions)[number]

export const lifecycleBlockerSchema = z
  .object({
    code: z.enum(lifecycleBlockerCodes),
    message: z.string().trim().min(1).max(500),
    field: z.string().trim().min(1).max(200).optional(),
    conflictingResourceId: lifecycleIdSchema.optional(),
    allowedDuplicateResolutions: z.array(z.enum(duplicateResolutions)).max(2).optional(),
  })
  .strict()
  .superRefine((blocker, context) => {
    const duplicateMetadata = blocker.conflictingResourceId !== undefined
      || blocker.allowedDuplicateResolutions !== undefined
    if (duplicateMetadata && blocker.code !== 'deterministic_duplicate') {
      context.addIssue({ code: 'custom', message: 'duplicate metadata requires deterministic_duplicate' })
    }
  })

export type LifecycleBlocker = z.infer<typeof lifecycleBlockerSchema>

export const lifecycleWarningCodes = [
  'fit',
  'rank',
  'cutoff',
  'missing_optional_facts',
  'third_party_destination',
  'weak_possible_match',
] as const

export type LifecycleWarningCode = (typeof lifecycleWarningCodes)[number]

export const lifecycleWarningSchema = z
  .object({
    code: z.enum(lifecycleWarningCodes),
    message: z.string().trim().min(1).max(500),
    field: z.string().trim().min(1).max(200).optional(),
  })
  .strict()

export type LifecycleWarning = z.infer<typeof lifecycleWarningSchema>

export const warningOverrideSchema = z
  .object({
    actor: lifecycleActorSchema,
    rationale: z.string().trim().min(1).max(1_000),
    warningCodes: z.array(z.enum(lifecycleWarningCodes)).min(1).max(lifecycleWarningCodes.length),
  })
  .strict()
  .superRefine((override, context) => {
    if (new Set(override.warningCodes).size !== override.warningCodes.length) {
      context.addIssue({ code: 'custom', message: 'warning override codes must be unique', path: ['warningCodes'] })
    }
  })

export type WarningOverride = z.infer<typeof warningOverrideSchema>

export const removalChoices = [
  'reject_if_dependents',
  'preserve_historical_lineage',
  'unlink_dependents',
  'cascade_tombstone',
] as const

export type RemovalChoice = (typeof removalChoices)[number]

export const removalInputSchema = z
  .object({
    id: lifecycleIdSchema,
    choice: z.enum(removalChoices),
    actor: lifecycleActorSchema,
    rationale: z.string().trim().min(1).max(1_000),
  })
  .strict()

export type RemovalInput = z.infer<typeof removalInputSchema>

export const removalResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('removed'),
    id: lifecycleIdSchema,
    choice: z.enum(removalChoices),
    removedAt: lifecycleInstantSchema,
    affectedDependentIds: z.array(lifecycleIdSchema).max(1_000),
  }).strict(),
  z.object({
    status: z.literal('blocked'),
    id: lifecycleIdSchema,
    blocker: lifecycleBlockerSchema,
    supportedChoices: z.array(z.enum(removalChoices)).min(1).max(removalChoices.length),
    dependentIds: z.array(lifecycleIdSchema).max(1_000),
  }).strict(),
])

export type RemovalResult = z.infer<typeof removalResultSchema>

export const restoreInputSchema = z
  .object({
    id: lifecycleIdSchema,
    actor: lifecycleActorSchema,
    rationale: z.string().trim().min(1).max(1_000),
  })
  .strict()

export type RestoreInput = z.infer<typeof restoreInputSchema>

export const restoreResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('restored'), id: lifecycleIdSchema, restoredAt: lifecycleInstantSchema }).strict(),
  z.object({ status: z.literal('blocked'), id: lifecycleIdSchema, blocker: lifecycleBlockerSchema }).strict(),
])

export type RestoreResult = z.infer<typeof restoreResultSchema>

export const lifecycleAuditEvidenceSchema = z
  .object({
    actor: lifecycleActorSchema,
    timestamp: lifecycleInstantSchema,
    sourceId: lifecycleIdSchema.optional(),
    targetId: lifecycleIdSchema.optional(),
    priorRevision: z.number().int().positive().optional(),
    newRevision: z.number().int().positive().optional(),
    priorIdentity: lifecycleIdSchema.optional(),
    newIdentity: lifecycleIdSchema.optional(),
    overrideRationale: z.string().trim().min(1).max(1_000).optional(),
  })
  .strict()

export type LifecycleAuditEvidence = z.infer<typeof lifecycleAuditEvidenceSchema>

export const historyListInputSchema = z
  .object({ id: lifecycleIdSchema, limit: z.number().int().min(1).max(200).optional(), cursor: lifecycleIdSchema.optional() })
  .strict()

export type HistoryListInput = z.infer<typeof historyListInputSchema>

export const lifecycleListPageShape = {
  nextCursor: lifecycleIdSchema.nullable(),
} as const

export const mutationResultSchema = <T extends z.ZodType>(resourceSchema: T) =>
  z.discriminatedUnion('status', [
    z.object({ status: z.literal('succeeded'), resource: resourceSchema }).strict(),
    z.object({ status: z.literal('blocked'), blocker: lifecycleBlockerSchema }).strict(),
  ])

export const promotionResultSchema = <T extends z.ZodType>(resourceSchema: T) =>
  z.discriminatedUnion('status', [
    z.object({
      status: z.literal('promoted'),
      resource: resourceSchema,
      created: z.boolean(),
      warnings: z.array(lifecycleWarningSchema).max(lifecycleWarningCodes.length),
      audit: lifecycleAuditEvidenceSchema,
    }).strict(),
    z.object({ status: z.literal('blocked'), blocker: lifecycleBlockerSchema }).strict(),
  ])
