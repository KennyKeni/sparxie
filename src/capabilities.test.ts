import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createHttpValedictorianClient,
  defaultLocalCapabilities,
  valedictorianCapabilitiesSchema,
} from './index'
import { jsonResponse } from './http-client.test-support'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('connectorScheduling capability contract', () => {
  it('requires a discriminated connectorScheduling capability and defaults local to unavailable', () => {
    expect(defaultLocalCapabilities.connectorScheduling).toEqual({ available: false })
    expect(valedictorianCapabilitiesSchema.parse(defaultLocalCapabilities)).toEqual(
      defaultLocalCapabilities,
    )

    const available = {
      ...defaultLocalCapabilities,
      connectorScheduling: {
        available: true,
        supportedCadences: ['interval', 'daily', 'weekly'],
        minimumIntervalMinutes: 15,
        maximumCatchUpAgeMinutes: 1440,
        timezoneModel: 'iana',
        missedOccurrencePolicy: 'coalesce_one',
      },
    }

    expect(valedictorianCapabilitiesSchema.parse(available)).toEqual(available)
  })

  it('rejects unknown keys, empty/duplicate cadences, and non-positive or unbounded scheduler integers', () => {
    expect(
      valedictorianCapabilitiesSchema.safeParse({
        ...defaultLocalCapabilities,
        connectorScheduling: { available: false, extra: true },
      }).success,
    ).toBe(false)

    expect(
      valedictorianCapabilitiesSchema.safeParse({
        ...defaultLocalCapabilities,
        connectorScheduling: {
          available: true,
          supportedCadences: [],
          minimumIntervalMinutes: 15,
          maximumCatchUpAgeMinutes: 1440,
          timezoneModel: 'iana',
          missedOccurrencePolicy: 'coalesce_one',
        },
      }).success,
    ).toBe(false)

    expect(
      valedictorianCapabilitiesSchema.safeParse({
        ...defaultLocalCapabilities,
        connectorScheduling: {
          available: true,
          supportedCadences: ['interval', 'interval'],
          minimumIntervalMinutes: 15,
          maximumCatchUpAgeMinutes: 1440,
          timezoneModel: 'iana',
          missedOccurrencePolicy: 'coalesce_one',
        },
      }).success,
    ).toBe(false)

    expect(
      valedictorianCapabilitiesSchema.safeParse({
        ...defaultLocalCapabilities,
        connectorScheduling: {
          available: true,
          supportedCadences: ['daily'],
          minimumIntervalMinutes: 0,
          maximumCatchUpAgeMinutes: 1440,
          timezoneModel: 'iana',
          missedOccurrencePolicy: 'coalesce_one',
        },
      }).success,
    ).toBe(false)

    expect(
      valedictorianCapabilitiesSchema.safeParse({
        ...defaultLocalCapabilities,
        connectorScheduling: {
          available: true,
          supportedCadences: ['daily'],
          minimumIntervalMinutes: 15,
          maximumCatchUpAgeMinutes: 525_601,
          timezoneModel: 'iana',
          missedOccurrencePolicy: 'coalesce_one',
        },
      }).success,
    ).toBe(false)

    expect(
      valedictorianCapabilitiesSchema.safeParse({
        ...defaultLocalCapabilities,
        connectorScheduling: {
          available: true,
          supportedCadences: ['daily'],
          minimumIntervalMinutes: 15,
          maximumCatchUpAgeMinutes: 1440,
          timezoneModel: 'offset',
          missedOccurrencePolicy: 'coalesce_one',
        },
      }).success,
    ).toBe(false)

    expect(
      valedictorianCapabilitiesSchema.safeParse({
        ...defaultLocalCapabilities,
        connectorScheduling: {
          available: true,
          supportedCadences: ['daily'],
          minimumIntervalMinutes: 15,
          maximumCatchUpAgeMinutes: 1440,
          timezoneModel: 'iana',
          missedOccurrencePolicy: 'replay_all',
        },
      }).success,
    ).toBe(false)
  })
})

describe('HTTP capabilities client validation', () => {
  it('parses valid capability payloads and rejects malformed connectorScheduling data', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
    fetchMock.mockResolvedValueOnce(jsonResponse(defaultLocalCapabilities))
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        ...defaultLocalCapabilities,
        connectorScheduling: undefined,
      }),
    )
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        ...defaultLocalCapabilities,
        connectorScheduling: { available: false, extra: true },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const client = createHttpValedictorianClient({
      baseUrl: 'https://valedictorian.test',
    })

    await expect(client.capabilities.get()).resolves.toEqual(defaultLocalCapabilities)
    await expect(client.capabilities.get()).rejects.toThrow()
    await expect(client.capabilities.get()).rejects.toThrow()
  })
})
