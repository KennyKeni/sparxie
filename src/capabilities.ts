import { z } from 'zod'
import {
  connectorScheduleCadenceKinds,
  MAX_CONNECTOR_SCHEDULE_INTERVAL_MINUTES,
  type ConnectorSchedulingCapability,
  unavailableConnectorSchedulingCapability,
} from './connector/connector-schedule.js'

export type { ConnectorSchedulingCapability }

export interface ValedictorianCapabilities {
  localSqlite: boolean
  agentWorkflows: boolean
  workflowRuns: boolean
  applicationAttempts: boolean
  sourcing: boolean
  connectors: boolean
  hostedSync: boolean
  multiWorkspace: boolean
  billing: boolean
  localSecretResolution: boolean
  connectorScheduling: ConnectorSchedulingCapability
}

export const defaultLocalCapabilities: ValedictorianCapabilities = {
  localSqlite: true,
  agentWorkflows: false,
  workflowRuns: true,
  applicationAttempts: true,
  sourcing: true,
  connectors: true,
  hostedSync: false,
  multiWorkspace: true,
  billing: false,
  localSecretResolution: false,
  connectorScheduling: unavailableConnectorSchedulingCapability,
}

/** Upper bounds for capability-declared scheduler integers (minutes). */
export const MAX_CONNECTOR_SCHEDULING_INTERVAL_MINUTES = MAX_CONNECTOR_SCHEDULE_INTERVAL_MINUTES
export const MAX_CONNECTOR_SCHEDULING_CATCH_UP_AGE_MINUTES = MAX_CONNECTOR_SCHEDULE_INTERVAL_MINUTES

const connectorSchedulingUnavailableSchema = z
  .object({
    available: z.literal(false),
  })
  .strict()

const connectorSchedulingAvailableSchema = z
  .object({
    available: z.literal(true),
    supportedCadences: z
      .array(z.enum(connectorScheduleCadenceKinds))
      .min(1)
      .superRefine((cadences, context) => {
        if (new Set(cadences).size !== cadences.length) {
          context.addIssue({
            code: 'custom',
            message: 'supportedCadences must be unique',
          })
        }
      }),
    minimumIntervalMinutes: z
      .number()
      .int()
      .positive()
      .max(MAX_CONNECTOR_SCHEDULING_INTERVAL_MINUTES),
    maximumCatchUpAgeMinutes: z
      .number()
      .int()
      .positive()
      .max(MAX_CONNECTOR_SCHEDULING_CATCH_UP_AGE_MINUTES),
    timezoneModel: z.literal('iana'),
    missedOccurrencePolicy: z.literal('coalesce_one'),
  })
  .strict()

export const connectorSchedulingCapabilitySchema: z.ZodType<ConnectorSchedulingCapability> =
  z.discriminatedUnion('available', [
    connectorSchedulingUnavailableSchema,
    connectorSchedulingAvailableSchema,
  ])

export const valedictorianCapabilitiesSchema: z.ZodType<ValedictorianCapabilities> = z
  .object({
    localSqlite: z.boolean(),
    agentWorkflows: z.boolean(),
    workflowRuns: z.boolean(),
    applicationAttempts: z.boolean(),
    sourcing: z.boolean(),
    connectors: z.boolean(),
    hostedSync: z.boolean(),
    multiWorkspace: z.boolean(),
    billing: z.boolean(),
    localSecretResolution: z.boolean(),
    connectorScheduling: connectorSchedulingCapabilitySchema,
  })
  .strict()
