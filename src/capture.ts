import { z } from 'zod'
import {
  historyListInputSchema,
  lifecycleActorSchema,
  lifecycleAuditEvidenceSchema,
  lifecycleIdSchema,
  lifecycleInstantSchema,
  lifecycleListResultSchema,
  mutationResultSchema,
  removalInputSchema,
  removalResultSchema,
  restoreInputSchema,
  restoreResultSchema,
} from './lifecycle-shared.js'

export const evidenceModes = ['reported', 'ats_details_provided'] as const
export type EvidenceMode = (typeof evidenceModes)[number]

export const sourceAdapterKinds = ['connector', 'cli', 'manual', 'import'] as const

const jsonValueSchema: z.ZodType<unknown> = z.json()
const forbiddenEvidenceKey = /^(?:authorization|cookie|password|secret|token|ssn)$/i

function findForbiddenEvidencePath(value: unknown, path: PropertyKey[] = []): PropertyKey[] | null {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const found = findForbiddenEvidencePath(item, [...path, index])
      if (found) return found
    }
    return null
  }
  if (value === null || typeof value !== 'object') return null
  for (const [key, item] of Object.entries(value)) {
    if (forbiddenEvidenceKey.test(key)) return [...path, key]
    const found = findForbiddenEvidencePath(item, [...path, key])
    if (found) return found
  }
  return null
}

const boundedJsonObjectSchema = z
  .record(z.string().min(1).max(200), jsonValueSchema)
  .superRefine((value, context) => {
    if (JSON.stringify(value).length > 262_144) {
      context.addIssue({ code: 'custom', message: 'payload exceeds the capture evidence bound' })
    }
    const forbiddenPath = findForbiddenEvidencePath(value)
    if (forbiddenPath) {
      context.addIssue({ code: 'custom', message: 'payload contains a forbidden sensitive key', path: forbiddenPath })
    }
  })

export const captureEvidenceSchema = z
  .object({
    kind: z.string().trim().min(1).max(100),
    label: z.string().trim().min(1).max(200),
    value: jsonValueSchema,
  })
  .strict()
  .superRefine((evidence, context) => {
    if (JSON.stringify(evidence.value).length > 16_384) {
      context.addIssue({ code: 'custom', message: 'evidence value exceeds its bound', path: ['value'] })
    }
    const forbiddenPath = findForbiddenEvidencePath(evidence.value)
    if (forbiddenPath) {
      context.addIssue({ code: 'custom', message: 'evidence contains a forbidden sensitive key', path: ['value', ...forbiddenPath] })
    }
  })

export const captureAdapterSchema = z
  .object({
    id: lifecycleIdSchema,
    kind: z.enum(sourceAdapterKinds),
    version: z.string().trim().min(1).max(100),
  })
  .strict()

const captureEvidenceFields = {
  evidenceMode: z.enum(evidenceModes),
  adapter: captureAdapterSchema,
  observedAt: lifecycleInstantSchema,
  receivedAt: lifecycleInstantSchema,
  providerRecordId: z.string().trim().min(1).max(500).nullable(),
  providerSchema: z.string().trim().min(1).max(500).nullable(),
  payload: boundedJsonObjectSchema.nullable(),
  evidence: z.array(captureEvidenceSchema).max(50),
} as const

export const captureSchema = z
  .object({
    id: lifecycleIdSchema,
    workspaceId: lifecycleIdSchema,
    ...captureEvidenceFields,
    revision: z.number().int().positive(),
    createdAt: lifecycleInstantSchema,
    updatedAt: lifecycleInstantSchema,
    removedAt: lifecycleInstantSchema.nullable(),
  })
  .strict()

export type Capture = z.infer<typeof captureSchema>

export const captureListInputSchema = z
  .object({
    evidenceMode: z.enum(evidenceModes).optional(),
    adapterId: lifecycleIdSchema.optional(),
    includeRemoved: z.boolean().optional(),
    limit: z.number().int().min(1).max(200).optional(),
    cursor: lifecycleIdSchema.optional(),
  })
  .strict()

export type CaptureListInput = z.infer<typeof captureListInputSchema>

export const captureListResultSchema = lifecycleListResultSchema(captureSchema)
export type CaptureListResult = z.infer<typeof captureListResultSchema>

export const createCaptureInputSchema = z.object({
  evidenceMode: z.enum(evidenceModes), adapter: captureAdapterSchema,
  observedAt: lifecycleInstantSchema,
  providerRecordId: z.string().trim().min(1).max(500).nullable(),
  providerSchema: z.string().trim().min(1).max(500).nullable(),
  payload: boundedJsonObjectSchema.nullable(), evidence: z.array(captureEvidenceSchema).max(50),
}).strict()
export type CreateCaptureInput = z.infer<typeof createCaptureInputSchema>

export const correctCaptureInputSchema = z
  .object({
    captureId: lifecycleIdSchema,
    expectedRevision: z.number().int().positive(),
    actor: lifecycleActorSchema,
    rationale: z.string().trim().min(1).max(1_000),
    correction: z.object({
      providerRecordId: z.string().trim().min(1).max(500).nullable().optional(),
      providerSchema: z.string().trim().min(1).max(500).nullable().optional(),
      payload: boundedJsonObjectSchema.nullable().optional(),
      evidence: z.array(captureEvidenceSchema).max(50).optional(),
    }).strict().refine((value) => Object.keys(value).length > 0, 'correction must change at least one field'),
  })
  .strict()

export type CorrectCaptureInput = z.infer<typeof correctCaptureInputSchema>

export const captureMutationResultSchema = mutationResultSchema(captureSchema)
export type CaptureMutationResult = z.infer<typeof captureMutationResultSchema>

export const captureRevisionKinds = ['created', 'corrected', 'removed', 'restored'] as const
export const captureRevisionSchema = z
  .object({
    captureId: lifecycleIdSchema,
    revision: z.number().int().positive(),
    kind: z.enum(captureRevisionKinds),
    snapshot: captureSchema,
    audit: lifecycleAuditEvidenceSchema,
  })
  .strict()
  .superRefine((entry, context) => {
    if (entry.captureId !== entry.snapshot.id) {
      context.addIssue({ code: 'custom', message: 'history Capture id must equal the snapshot id', path: ['captureId'] })
    }
  })

export type CaptureRevision = z.infer<typeof captureRevisionSchema>
export const captureHistoryInputSchema = historyListInputSchema
export const captureHistoryResultSchema = lifecycleListResultSchema(captureRevisionSchema)
export type CaptureHistoryResult = z.infer<typeof captureHistoryResultSchema>

export const removeCaptureInputSchema = removalInputSchema
export const removeCaptureResultSchema = removalResultSchema
export const restoreCaptureInputSchema = restoreInputSchema
export const restoreCaptureResultSchema = restoreResultSchema
