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

export const duplicateResolutionSchema = z.object({
  action: z.enum(duplicateResolutions),
  targetResourceId: lifecycleIdSchema,
}).strict()

export type DuplicateResolutionDecision = z.infer<typeof duplicateResolutionSchema>

export const lifecycleBlockerSchema = z
  .object({
    code: z.enum(lifecycleBlockerCodes),
    message: z.string().trim().min(1).max(500),
    field: z.string().trim().min(1).max(200).optional(),
    conflictingResourceId: lifecycleIdSchema.optional(),
    allowedDuplicateResolutions: z.array(z.enum(duplicateResolutions)).min(1).max(2).optional(),
  })
  .strict()
  .superRefine((blocker, context) => {
    const duplicateMetadata = blocker.conflictingResourceId !== undefined
      || blocker.allowedDuplicateResolutions !== undefined
    if (duplicateMetadata && blocker.code !== 'deterministic_duplicate') {
      context.addIssue({ code: 'custom', message: 'duplicate metadata requires deterministic_duplicate' })
    }
    if (blocker.code === 'deterministic_duplicate' && blocker.conflictingResourceId === undefined) {
      context.addIssue({ code: 'custom', message: 'deterministic duplicates require the conflicting resource id', path: ['conflictingResourceId'] })
    }
    if (blocker.code === 'deterministic_duplicate' && blocker.allowedDuplicateResolutions === undefined) {
      context.addIssue({ code: 'custom', message: 'deterministic duplicates require an actionable resolution', path: ['allowedDuplicateResolutions'] })
    }
    if (blocker.allowedDuplicateResolutions !== undefined
      && new Set(blocker.allowedDuplicateResolutions).size !== blocker.allowedDuplicateResolutions.length) {
      context.addIssue({ code: 'custom', message: 'duplicate resolutions must be unique', path: ['allowedDuplicateResolutions'] })
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
    audit: z.lazy(() => lifecycleAuditEvidenceSchema),
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

export const lifecycleIdentitySchema = z.object({
  kind: z.string().trim().min(1).max(100),
  provider: z.string().trim().toLowerCase().min(1).max(200),
  account: z.string().trim().toLowerCase().min(1).max(500).nullable(),
  value: z.string().trim().min(1).max(2_000),
  strength: z.enum(['strong', 'provisional']),
}).strict()

export type LifecycleIdentity = z.infer<typeof lifecycleIdentitySchema>

export const restoreResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('restored'), id: lifecycleIdSchema, restoredAt: lifecycleInstantSchema,
    dependentLinks: z.array(z.object({
      dependentId: lifecycleIdSchema,
      state: z.enum(['restored', 'remained_unlinked', 'remained_tombstoned']),
    }).strict()).max(1_000),
    audit: z.lazy(() => lifecycleAuditEvidenceSchema),
  }).strict(),
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
    priorIdentity: lifecycleIdentitySchema.optional(),
    newIdentity: lifecycleIdentitySchema.optional(),
    override: warningOverrideSchema.optional(),
  })
  .strict()

export type LifecycleAuditEvidence = z.infer<typeof lifecycleAuditEvidenceSchema>

export const historyListInputSchema = z
  .object({ id: lifecycleIdSchema, limit: z.number().int().min(1).max(200).optional(), cursor: lifecycleIdSchema.optional() })
  .strict()

export type HistoryListInput = z.infer<typeof historyListInputSchema>

export const lifecycleListPageShape = {
  limit: z.number().int().min(1).max(200),
  nextCursor: lifecycleIdSchema.nullable(),
} as const

export const lifecycleListResultSchema = <T extends z.ZodType>(itemSchema: T) => z.object({
  items: z.array(itemSchema).max(200),
  ...lifecycleListPageShape,
}).strict().superRefine((page, context) => {
  if (page.items.length > page.limit) {
    context.addIssue({ code: 'custom', message: 'page items cannot exceed the declared limit', path: ['items'] })
  }
})

export const mutationResultSchema = <T extends z.ZodType>(resourceSchema: T) =>
  z.discriminatedUnion('status', [
    z.object({
      status: z.literal('succeeded'), resource: resourceSchema,
      duplicateResolution: duplicateResolutionSchema.nullable(),
      audit: lifecycleAuditEvidenceSchema,
    }).strict(),
    z.object({ status: z.literal('blocked'), blocker: lifecycleBlockerSchema }).strict(),
  ])

export const promotionResultSchema = <T extends z.ZodType>(resourceSchema: T) =>
  z.discriminatedUnion('status', [
    z.object({
      status: z.literal('promoted'),
      resource: resourceSchema,
      created: z.boolean(),
      warnings: z.array(lifecycleWarningSchema).max(lifecycleWarningCodes.length),
      override: warningOverrideSchema.nullable(),
      duplicateResolution: duplicateResolutionSchema.nullable(),
      audit: lifecycleAuditEvidenceSchema,
    }).strict(),
    z.object({ status: z.literal('blocked'), blocker: lifecycleBlockerSchema }).strict(),
  ]).superRefine((result, context) => {
    if ('override' in result
      && JSON.stringify(result.override) !== JSON.stringify(result.audit.override ?? null)) {
      context.addIssue({ code: 'custom', message: 'promotion audit must retain the exact warning override', path: ['audit', 'override'] })
    }
    if ('override' in result && result.override !== null) {
      const reportedWarningCodes = new Set(result.warnings.map((warning) => warning.code))
      for (const code of result.override.warningCodes) {
        if (!reportedWarningCodes.has(code)) {
          context.addIssue({ code: 'custom', message: 'an override can reference only reported warnings', path: ['override', 'warningCodes'] })
        }
      }
    }
  })
