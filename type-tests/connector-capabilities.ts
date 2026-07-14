import type {
  ConnectorRendererSchema,
  InstalledConnectorDescriptor,
  InstalledConnectorDescriptorsListResult,
} from '../src/index.js'
import {
  connectorDescriptorMaxBindings,
  connectorDescriptorMaxDependencies,
  connectorDescriptorMaxDisplayPointers,
  connectorDescriptorMaxDynamicObjectProperties,
  connectorDescriptorMaxIdentifierLength,
  connectorDescriptorMaxLabelLength,
  connectorDescriptorMaxPointerLength,
  connectorDescriptorMaxSources,
  connectorDescriptorMaxVersionLength,
  installedConnectorDescriptorSchema,
  installedConnectorDescriptorsListResultSchema,
} from '../src/index.js'

type IsExact<Actual, Expected> =
  (<Value>() => Value extends Actual ? 1 : 2) extends
    (<Value>() => Value extends Expected ? 1 : 2)
    ? true
    : false

const descriptorKeysAreExact: IsExact<
  keyof InstalledConnectorDescriptor,
  | 'connectorId'
  | 'connectorVersion'
  | 'displayName'
  | 'configSchema'
  | 'filterSchema'
  | 'dynamicOptions'
> = true

const listResultKeysAreExact: IsExact<keyof InstalledConnectorDescriptorsListResult, 'items'> = true

const descriptorOmitsProviderInternals: IsExact<
  keyof InstalledConnectorDescriptor &
    (
      | 'auth'
      | 'credentials'
      | 'secrets'
      | 'cookies'
      | 'endpoint'
      | 'route'
      | 'module'
      | 'function'
      | 'accessor'
      | 'workspaceId'
      | 'executionScopeId'
    ),
  never
> = true

const dynamicOptionsOmitsProviderInternals: IsExact<
  keyof NonNullable<InstalledConnectorDescriptor['dynamicOptions']> &
    (
      | 'auth'
      | 'requirementIds'
      | 'credentials'
      | 'secrets'
      | 'cookies'
      | 'endpoint'
      | 'route'
      | 'module'
      | 'function'
      | 'accessor'
      | 'workspaceId'
      | 'executionScopeId'
    ),
  never
> = true

installedConnectorDescriptorSchema satisfies {
  parse(value: unknown): InstalledConnectorDescriptor
}
installedConnectorDescriptorsListResultSchema satisfies {
  parse(value: unknown): InstalledConnectorDescriptorsListResult
}

const maxIdentifierLength: 128 = connectorDescriptorMaxIdentifierLength
const maxLabelLength: 256 = connectorDescriptorMaxLabelLength
const maxVersionLength: 128 = connectorDescriptorMaxVersionLength
const maxPointerLength: 1_024 = connectorDescriptorMaxPointerLength
const maxSources: 100 = connectorDescriptorMaxSources
const maxBindings: 500 = connectorDescriptorMaxBindings
const maxDependencies: 50 = connectorDescriptorMaxDependencies
const maxDisplayPointers: 10 = connectorDescriptorMaxDisplayPointers
const maxDynamicObjectProperties: 100 = connectorDescriptorMaxDynamicObjectProperties

// @ts-expect-error renderer schema v1 does not publish container defaults
const arrayDefault: ConnectorRendererSchema = { type: 'array', maxItems: 2, items: { type: 'boolean' }, default: [true] }
// @ts-expect-error renderer schema v1 does not publish container defaults
const objectDefault: ConnectorRendererSchema = { type: 'object', additionalProperties: false, properties: {}, default: {} }

void descriptorKeysAreExact
void listResultKeysAreExact
void descriptorOmitsProviderInternals
void dynamicOptionsOmitsProviderInternals
void maxIdentifierLength
void maxLabelLength
void maxVersionLength
void maxPointerLength
void maxSources
void maxBindings
void maxDependencies
void maxDisplayPointers
void maxDynamicObjectProperties
void arrayDefault
void objectDefault
