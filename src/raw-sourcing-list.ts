import { z } from 'zod'
import {
  normalizationGateStatuses,
  normalizationStatuses,
  sourceAdapterKinds,
  type NormalizationGateStatus,
  type SourceAdapterProvenance,
} from './raw-sourcing.js'
import {
  MAX_RAW_SOURCE_LIST_IDENTIFIER_LENGTH,
  compareIsoInstants,
  isRawSourceListInstant,
  rawSourceRecordSummarySchema,
  type RawSourceRecordSummary,
} from './raw-sourcing-list-summary.js'

export {
  MAX_RAW_SOURCE_LIST_IDENTIFIER_LENGTH,
  compareIsoInstants,
  rawSourceRecordSummarySchema,
  type RawSourceListLatestRevision,
  type RawSourceListReportedOrigin,
  type RawSourceRecordSummary,
} from './raw-sourcing-list-summary.js'

/** Opaque keyset cursor bound for raw-record list continuation. */
export const MAX_RAW_SOURCE_LIST_CURSOR_LENGTH = 1024

/** Maximum page size for raw-record list queries. */
export const MAX_RAW_SOURCE_LIST_LIMIT = 100

/**
 * Fixed keyset order for raw-record list pages.
 * The opaque `nextCursor` encodes both keys (`lastReceivedAt`, id as UTF-8 bytes).
 * Offset pagination is not part of this contract.
 *
 * Id tie-break uses {@link RAW_SOURCE_RECORDS_LIST_ID_TIE_BREAK} (UTF-8 bytewise DESC).
 */
export const RAW_SOURCE_RECORDS_LIST_KEYSET_ORDER = [
  { field: 'lastReceivedAt', direction: 'desc' },
  { field: 'id', direction: 'desc' },
] as const

export type RawSourceRecordsListKeysetOrder =
  typeof RAW_SOURCE_RECORDS_LIST_KEYSET_ORDER

/**
 * Normative id tie-break for equal `lastReceivedAt` values.
 * Compare ids as UTF-8 bytes descending — not JavaScript UTF-16 code units.
 * Summary `id` values must be well-formed Unicode scalar strings so TextEncoder
 * UTF-8 is injective over the keyset domain (no lone surrogates).
 * Database values must be stored/compared as UTF-8 bytes:
 * SQLite `BINARY`; PostgreSQL `COLLATE "C"`.
 * The opaque cursor carries the same UTF-8 bytewise id key.
 */
export const RAW_SOURCE_RECORDS_LIST_ID_TIE_BREAK = {
  field: 'id',
  direction: 'desc',
  collation: 'utf8_bytewise',
  encoding: 'utf8',
  backends: {
    sqlite: 'BINARY',
    postgres: 'COLLATE "C"',
  },
} as const

/**
 * Locale-insensitive UTF-8 bytewise string compare.
 * Returns negative when `left` sorts before `right` in ascending UTF-8 byte order.
 * Callers must supply well-formed Unicode scalar strings; lone surrogates are
 * rejected at the public summary `id` boundary.
 */
export function compareUtf8Bytewise(left: string, right: string): number {
  const leftBytes = new TextEncoder().encode(left)
  const rightBytes = new TextEncoder().encode(right)
  const length = Math.min(leftBytes.length, rightBytes.length)

  for (let index = 0; index < length; index += 1) {
    const delta = leftBytes[index]! - rightBytes[index]!
    if (delta !== 0) {
      return delta
    }
  }

  return leftBytes.length - rightBytes.length
}

export const rawSourceListNormalizationStatuses = [
  'raw_only',
  ...normalizationStatuses,
] as const

export type RawSourceListNormalizationStatus =
  (typeof rawSourceListNormalizationStatuses)[number]

export function isRawSourceListNormalizationStatus(
  value: string,
): value is RawSourceListNormalizationStatus {
  return (rawSourceListNormalizationStatuses as readonly string[]).includes(value)
}

export const rawSourceListProjectionStatuses = [
  'not_eligible',
  'pending',
  'projected',
  'failed',
] as const

export type RawSourceListProjectionStatus =
  (typeof rawSourceListProjectionStatuses)[number]

export function isRawSourceListProjectionStatus(
  value: string,
): value is RawSourceListProjectionStatus {
  return (rawSourceListProjectionStatuses as readonly string[]).includes(value)
}

const listIdentifierSchema = z
  .string()
  .min(1)
  .max(MAX_RAW_SOURCE_LIST_IDENTIFIER_LENGTH)

const listInstantSchema = z.iso.datetime({ offset: true })

export interface RawSourceRecordsListQuery {
  cursor?: string
  limit?: number
  adapterId?: string
  adapterKind?: SourceAdapterProvenance['kind']
  connectorInstanceId?: string
  receivedFrom?: string
  receivedTo?: string
  normalizationStatus?: RawSourceListNormalizationStatus
  gateStatus?: NormalizationGateStatus
  projectionStatus?: RawSourceListProjectionStatus
}

export interface RawSourceRecordsListResult {
  items: RawSourceRecordSummary[]
  /**
   * Opaque continuation encoding both keyset keys (`lastReceivedAt`, `id`).
   * Null ends the page sequence. Offset pagination is not supported.
   */
  nextCursor: string | null
}

const rawSourceRecordsListQueryObjectSchema = z
  .object({
    cursor: z.string().min(1).max(MAX_RAW_SOURCE_LIST_CURSOR_LENGTH).optional(),
    limit: z.number().int().min(1).max(MAX_RAW_SOURCE_LIST_LIMIT).optional(),
    adapterId: listIdentifierSchema.optional(),
    adapterKind: z.enum(sourceAdapterKinds).optional(),
    connectorInstanceId: listIdentifierSchema.optional(),
    receivedFrom: listInstantSchema.optional(),
    receivedTo: listInstantSchema.optional(),
    normalizationStatus: z.enum(rawSourceListNormalizationStatuses).optional(),
    gateStatus: z.enum(normalizationGateStatuses).optional(),
    projectionStatus: z.enum(rawSourceListProjectionStatuses).optional(),
  })
  .strict()

export const rawSourceRecordsListQuerySchema: z.ZodType<RawSourceRecordsListQuery> =
  rawSourceRecordsListQueryObjectSchema.superRefine((query, context) => {
    if (
      query.receivedFrom !== undefined &&
      query.receivedTo !== undefined &&
      isRawSourceListInstant(query.receivedFrom) &&
      isRawSourceListInstant(query.receivedTo) &&
      compareIsoInstants(query.receivedFrom, query.receivedTo) > 0
    ) {
      context.addIssue({
        code: 'custom',
        message: 'receivedFrom must be at or before receivedTo',
        path: ['receivedFrom'],
      })
    }
  })

export const rawSourceRecordsListResultSchema: z.ZodType<RawSourceRecordsListResult> = z
  .object({
    items: z.array(rawSourceRecordSummarySchema).max(MAX_RAW_SOURCE_LIST_LIMIT),
    nextCursor: z.string().min(1).max(MAX_RAW_SOURCE_LIST_CURSOR_LENGTH).nullable(),
  })
  .strict()
  .superRefine((result, context) => {
    for (let index = 1; index < result.items.length; index += 1) {
      const previous = result.items[index - 1]!
      const current = result.items[index]!
      if (
        !isRawSourceListInstant(current.lastReceivedAt) ||
        !isRawSourceListInstant(previous.lastReceivedAt)
      ) {
        continue
      }
      const receivedOrder = compareIsoInstants(
        current.lastReceivedAt,
        previous.lastReceivedAt,
      )

      if (receivedOrder > 0) {
        context.addIssue({
          code: 'custom',
          message:
            'items must follow lastReceivedAt DESC then id DESC keyset order',
          path: ['items', index, 'lastReceivedAt'],
        })
        continue
      }

      if (
        receivedOrder === 0 &&
        compareUtf8Bytewise(current.id, previous.id) >= 0
      ) {
        context.addIssue({
          code: 'custom',
          message:
            'equal lastReceivedAt ties must order by UTF-8 bytewise id DESC; nextCursor encodes both keys',
          path: ['items', index, 'id'],
        })
      }
    }
  })

/** Deterministic allowlisted query-param order for raw-record list encoding. */
export const rawSourceRecordsListQueryParamKeys = [
  'cursor',
  'limit',
  'adapterId',
  'adapterKind',
  'connectorInstanceId',
  'receivedFrom',
  'receivedTo',
  'normalizationStatus',
  'gateStatus',
  'projectionStatus',
] as const

export function rawSourceRecordsListQueryToSearchParams(
  query: RawSourceRecordsListQuery = {},
) {
  const params = new URLSearchParams()

  for (const key of rawSourceRecordsListQueryParamKeys) {
    const value = query[key]

    if (value !== undefined) {
      params.set(key, String(value))
    }
  }

  return params
}
