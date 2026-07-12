import { z } from 'zod'
import { describe, expect, it } from 'vitest'
import {
  connectorScheduleAuditEventSchema,
  connectorScheduleAuditListResultSchema,
  connectorScheduleCadenceSchema,
  connectorScheduleDstPolicy,
  connectorScheduleErrorPayloadSchema,
  connectorScheduleHistoryListInputSchema,
  connectorScheduleLastRunStatuses,
  connectorScheduleLastRunSummarySchema,
  connectorScheduleOccurrenceIdempotencyKey,
  connectorScheduleOccurrenceListResultSchema,
  connectorScheduleOccurrenceSummarySchema,
  connectorScheduleSummarySchema,
  deleteConnectorScheduleInputSchema,
  dispatchConnectorScheduleDueInputSchema,
  dispatchConnectorScheduleDueResultSchema,
  MAX_CONNECTOR_SCHEDULE_HISTORY_LIMIT,
  MAX_CONNECTOR_SCHEDULE_INTERVAL_MINUTES,
  pauseConnectorScheduleInputSchema,
  resumeConnectorScheduleInputSchema,
  upsertConnectorScheduleInputSchema,
  valedictorianApiPaths,
} from './index'

describe('connector schedule cadence contract', () => {
  it('documents that ISO weekday 1 means Monday', () => {
    const jsonSchema = z.toJSONSchema(connectorScheduleCadenceSchema)
    const weeklySchema = jsonSchema.oneOf?.find(
      (cadence) => cadence.properties?.kind?.const === 'weekly',
    )

    expect(weeklySchema?.properties?.dayOfWeek?.description).toBe(
      'ISO-8601 weekday: 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday, 7 = Sunday',
    )
  })

  it('documents that ISO weekday 7 means Sunday', () => {
    const jsonSchema = z.toJSONSchema(connectorScheduleCadenceSchema)
    const weeklySchema = jsonSchema.oneOf?.find(
      (cadence) => cadence.properties?.kind?.const === 'weekly',
    )

    expect(weeklySchema?.properties?.dayOfWeek?.description).toBe(
      'ISO-8601 weekday: 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday, 7 = Sunday',
    )
  })

  it('accepts only structured interval, daily, and weekly cadences', () => {
    expect(
      connectorScheduleCadenceSchema.parse({ kind: 'interval', everyMinutes: 30 }),
    ).toEqual({ kind: 'interval', everyMinutes: 30 })
    expect(
      connectorScheduleCadenceSchema.parse({ kind: 'daily', localTime: '09:30' }),
    ).toEqual({ kind: 'daily', localTime: '09:30' })
    expect(
      connectorScheduleCadenceSchema.parse({
        kind: 'weekly',
        dayOfWeek: 1,
        localTime: '18:00',
      }),
    ).toEqual({ kind: 'weekly', dayOfWeek: 1, localTime: '18:00' })
  })

  it('rejects cron strings, unknown keys, invalid times, and noninteger interval/day values', () => {
    expect(connectorScheduleCadenceSchema.safeParse('0 * * * *').success).toBe(false)
    expect(
      connectorScheduleCadenceSchema.safeParse({
        kind: 'interval',
        everyMinutes: 30,
        cron: '0 * * * *',
      }).success,
    ).toBe(false)
    expect(
      connectorScheduleCadenceSchema.safeParse({
        kind: 'interval',
        everyMinutes: 30.5,
      }).success,
    ).toBe(false)
    expect(
      connectorScheduleCadenceSchema.safeParse({
        kind: 'interval',
        everyMinutes: 0,
      }).success,
    ).toBe(false)
    expect(
      connectorScheduleCadenceSchema.safeParse({
        kind: 'daily',
        localTime: '9:30',
      }).success,
    ).toBe(false)
    expect(
      connectorScheduleCadenceSchema.safeParse({
        kind: 'daily',
        localTime: '24:00',
      }).success,
    ).toBe(false)
    expect(
      connectorScheduleCadenceSchema.safeParse({
        kind: 'weekly',
        dayOfWeek: 0,
        localTime: '09:00',
      }).success,
    ).toBe(false)
    expect(
      connectorScheduleCadenceSchema.safeParse({
        kind: 'weekly',
        dayOfWeek: 8,
        localTime: '09:00',
      }).success,
    ).toBe(false)
    expect(
      connectorScheduleCadenceSchema.safeParse({
        kind: 'weekly',
        dayOfWeek: 1.5,
        localTime: '09:00',
      }).success,
    ).toBe(false)
  })

  it('documents DST gap/overlap policy without computing schedule instants', () => {
    expect(connectorScheduleDstPolicy).toEqual({
      nonexistentLocalTime: 'first_valid_after_gap',
      repeatedLocalTime: 'earlier_instant',
    })
  })

  it('rejects server-owned fields on schedule mutation input', () => {
    const valid = {
      connectorInstanceId: 'connector-1',
      expectedRevision: null,
      state: 'enabled',
      cadence: { kind: 'interval', everyMinutes: 60 },
      timezone: 'America/New_York',
    }

    expect(upsertConnectorScheduleInputSchema.parse(valid)).toEqual(valid)

    for (const forbidden of [
      { id: 'schedule-1' },
      { revision: 'rev-1' },
      { nextEligibleAt: '2026-07-12T13:00:00.000Z' },
      { createdAt: '2026-07-11T14:00:00.000Z' },
      { updatedAt: '2026-07-11T14:00:00.000Z' },
      { lastOccurrence: null },
      { lastRun: null },
      { actor: 'user' },
    ]) {
      expect(
        upsertConnectorScheduleInputSchema.safeParse({ ...valid, ...forbidden }).success,
        JSON.stringify(forbidden),
      ).toBe(false)
    }

    expect(
      upsertConnectorScheduleInputSchema.safeParse({
        ...valid,
        timezone: 'Not/A_Zone',
      }).success,
    ).toBe(false)
  })

  it('requires expectedRevision as string or null on upsert and rejects omission', () => {
    const base = {
      connectorInstanceId: 'connector-1',
      state: 'enabled' as const,
      cadence: { kind: 'interval' as const, everyMinutes: 60 },
      timezone: 'America/New_York',
    }

    expect(
      upsertConnectorScheduleInputSchema.parse({ ...base, expectedRevision: null }),
    ).toEqual({ ...base, expectedRevision: null })
    expect(
      upsertConnectorScheduleInputSchema.parse({ ...base, expectedRevision: 'rev-1' }),
    ).toEqual({ ...base, expectedRevision: 'rev-1' })
    expect(upsertConnectorScheduleInputSchema.safeParse(base).success).toBe(false)
    expect(
      upsertConnectorScheduleInputSchema.safeParse({ ...base, expectedRevision: '' }).success,
    ).toBe(false)
  })

  it('bounds interval cadence everyMinutes to the one-year hard ceiling', () => {
    expect(MAX_CONNECTOR_SCHEDULE_INTERVAL_MINUTES).toBe(525_600)
    expect(
      connectorScheduleCadenceSchema.parse({
        kind: 'interval',
        everyMinutes: MAX_CONNECTOR_SCHEDULE_INTERVAL_MINUTES,
      }),
    ).toEqual({
      kind: 'interval',
      everyMinutes: MAX_CONNECTOR_SCHEDULE_INTERVAL_MINUTES,
    })
    expect(
      connectorScheduleCadenceSchema.safeParse({
        kind: 'interval',
        everyMinutes: MAX_CONNECTOR_SCHEDULE_INTERVAL_MINUTES + 1,
      }).success,
    ).toBe(false)
  })
})

describe('connector schedule resource contract', () => {
  const occurrence = {
    id: 'occ-1',
    scheduleId: 'schedule-1',
    scheduleRevision: 'rev-1',
    nominalAt: '2026-03-08T07:00:00.000Z',
    idempotencyKey: 'rev-1:2026-03-08T07:00:00.000Z',
    admittedMode: 'scheduled' as const,
    outcome: 'completed' as const,
    connectorRunId: 'run-1',
    createdAt: '2026-03-08T07:00:01.000Z',
  }

  const schedule = {
    id: 'schedule-1',
    connectorInstanceId: 'connector-1',
    revision: 'rev-1',
    state: 'enabled' as const,
    cadence: { kind: 'daily' as const, localTime: '02:30' },
    timezone: 'America/New_York',
    nextEligibleAt: '2026-03-09T06:30:00.000Z',
    createdAt: '2026-03-01T12:00:00.000Z',
    updatedAt: '2026-03-08T07:00:01.000Z',
    lastOccurrence: occurrence,
    lastRun: {
      id: 'run-1',
      status: 'completed',
      mode: 'scheduled',
      startedAt: '2026-03-08T07:00:01.000Z',
      completedAt: '2026-03-08T07:05:00.000Z',
    },
  }

  it('validates one schedule per connector with opaque identity and sanitized last outcome', () => {
    expect(connectorScheduleSummarySchema.parse(schedule)).toEqual(schedule)
    expect(
      connectorScheduleSummarySchema.safeParse({
        ...schedule,
        lastRun: { ...schedule.lastRun, secret: 'x' },
      }).success,
    ).toBe(false)
    expect(
      connectorScheduleSummarySchema.safeParse({
        ...schedule,
        lastOccurrence: { ...occurrence, email: 'user@example.com' },
      }).success,
    ).toBe(false)
  })

  it('validates immutable audit events without credentials or personal identity', () => {
    const event = {
      id: 'audit-1',
      scheduleId: 'schedule-1',
      actorClass: 'user' as const,
      action: 'upserted' as const,
      revision: 'rev-1',
      at: '2026-03-01T12:00:00.000Z',
    }

    expect(connectorScheduleAuditEventSchema.parse(event)).toEqual(event)
    expect(
      connectorScheduleAuditEventSchema.safeParse({
        ...event,
        actorClass: 'scheduler',
        action: 'dispatched',
      }).success,
    ).toBe(true)
    expect(
      connectorScheduleAuditEventSchema.safeParse({
        ...event,
        userId: 'user-1',
      }).success,
    ).toBe(false)
    expect(
      connectorScheduleAuditEventSchema.safeParse({
        ...event,
        credential: 'token',
      }).success,
    ).toBe(false)
  })

  it('validates occurrence summaries with schedule revision, nominal instant, and run linkage', () => {
    expect(connectorScheduleOccurrenceSummarySchema.parse(occurrence)).toEqual(occurrence)
    expect(
      connectorScheduleOccurrenceSummarySchema.parse({
        ...occurrence,
        admittedMode: 'catch_up',
        connectorRunId: null,
        outcome: 'admitted',
      }),
    ).toMatchObject({ admittedMode: 'catch_up', connectorRunId: null })
  })

  it('restricts last-run summaries to closed scheduled statuses and scheduled|catch_up modes', () => {
    expect(connectorScheduleLastRunStatuses).toEqual([
      'queued',
      'running',
      'completed',
      'failed',
      'cancelled',
      'skipped',
    ])

    expect(
      connectorScheduleLastRunSummarySchema.parse({
        id: 'run-1',
        status: 'completed',
        mode: 'scheduled',
        startedAt: '2026-03-08T07:00:01.000Z',
        completedAt: '2026-03-08T07:05:00.000Z',
      }),
    ).toMatchObject({ status: 'completed', mode: 'scheduled' })

    expect(
      connectorScheduleLastRunSummarySchema.safeParse({
        id: 'run-1',
        status: 'mystery',
        mode: 'scheduled',
        startedAt: '2026-03-08T07:00:01.000Z',
        completedAt: null,
      }).success,
    ).toBe(false)
    expect(
      connectorScheduleLastRunSummarySchema.safeParse({
        id: 'run-1',
        status: 'completed',
        mode: 'manual',
        startedAt: '2026-03-08T07:00:01.000Z',
        completedAt: null,
      }).success,
    ).toBe(false)
  })
})

describe('connector schedule revision-guarded mutations', () => {
  it('requires expectedRevision for pause, resume, and delete and rejects server-owned fields', () => {
    const base = { connectorInstanceId: 'connector-1', expectedRevision: 'rev-1' }

    expect(pauseConnectorScheduleInputSchema.parse(base)).toEqual(base)
    expect(resumeConnectorScheduleInputSchema.parse(base)).toEqual(base)
    expect(deleteConnectorScheduleInputSchema.parse(base)).toEqual(base)

    for (const schema of [
      pauseConnectorScheduleInputSchema,
      resumeConnectorScheduleInputSchema,
      deleteConnectorScheduleInputSchema,
    ]) {
      expect(schema.safeParse({ connectorInstanceId: 'connector-1' }).success).toBe(false)
      expect(
        schema.safeParse({ ...base, nextEligibleAt: '2026-07-12T13:00:00.000Z' }).success,
      ).toBe(false)
      expect(schema.safeParse({ ...base, actor: 'user' }).success).toBe(false)
    }
  })
})

describe('connector schedule due-dispatch input', () => {
  it('requires expectedRevision and rejects client-supplied occurrence identity or clock fields', () => {
    const input = {
      connectorInstanceId: 'connector-1',
      expectedRevision: 'rev-1',
    }

    expect(dispatchConnectorScheduleDueInputSchema.parse(input)).toEqual(input)

    expect(
      dispatchConnectorScheduleDueInputSchema.safeParse({
        connectorInstanceId: 'connector-1',
      }).success,
    ).toBe(false)
    expect(
      dispatchConnectorScheduleDueInputSchema.safeParse({
        connectorInstanceId: 'connector-1',
        expectedRevision: '',
      }).success,
    ).toBe(false)

    for (const forbidden of [
      { idempotencyKey: 'rev-1:2026-07-12T13:00:00.000Z' },
      { now: '2026-07-12T13:00:00.000Z' },
      { nextEligibleAt: '2026-07-12T13:00:00.000Z' },
      { nominalAt: '2026-07-12T13:00:00.000Z' },
    ]) {
      expect(
        dispatchConnectorScheduleDueInputSchema.safeParse({
          ...input,
          ...forbidden,
        }).success,
        JSON.stringify(forbidden),
      ).toBe(false)
    }
  })
})

describe('connector schedule due-dispatch result', () => {
  it('accepts the strict outcome union and rejects multi-occurrence admission bursts', () => {
    for (const status of [
      'not_due',
      'unavailable',
      'paused',
      'connector_disabled',
      'deferred_active',
    ] as const) {
      expect(
        dispatchConnectorScheduleDueResultSchema.parse(
          status === 'deferred_active'
            ? { status, activeRunId: 'run-active' }
            : status === 'not_due'
              ? { status, nextEligibleAt: '2026-07-12T14:00:00.000Z' }
              : { status },
        ),
      ).toMatchObject({ status })
    }

    const admitted = {
      status: 'admitted' as const,
      occurrence: {
        id: 'occ-2',
        scheduleId: 'schedule-1',
        scheduleRevision: 'rev-1',
        nominalAt: '2026-07-12T12:00:00.000Z',
        idempotencyKey: 'rev-1:2026-07-12T12:00:00.000Z',
        admittedMode: 'catch_up' as const,
        outcome: 'admitted' as const,
        connectorRunId: 'run-2',
        createdAt: '2026-07-12T13:00:00.000Z',
      },
      run: {
        id: 'run-2',
        status: 'queued',
        mode: 'catch_up',
        startedAt: '2026-07-12T13:00:00.000Z',
        completedAt: null,
      },
    }

    expect(dispatchConnectorScheduleDueResultSchema.parse(admitted)).toEqual(admitted)
    expect(
      dispatchConnectorScheduleDueResultSchema.safeParse({
        status: 'admitted',
        occurrences: [admitted.occurrence],
        run: admitted.run,
      }).success,
    ).toBe(false)
  })

  it('requires admitted dispatch occurrence linkage to match the admitted run', () => {
    const admitted = {
      status: 'admitted' as const,
      occurrence: {
        id: 'occ-2',
        scheduleId: 'schedule-1',
        scheduleRevision: 'rev-1',
        nominalAt: '2026-07-12T12:00:00.000Z',
        idempotencyKey: 'rev-1:2026-07-12T12:00:00.000Z',
        admittedMode: 'catch_up' as const,
        outcome: 'admitted' as const,
        connectorRunId: 'run-2',
        createdAt: '2026-07-12T13:00:00.000Z',
      },
      run: {
        id: 'run-2',
        status: 'queued' as const,
        mode: 'catch_up' as const,
        startedAt: '2026-07-12T13:00:00.000Z',
        completedAt: null,
      },
    }

    expect(dispatchConnectorScheduleDueResultSchema.parse(admitted)).toEqual(admitted)
    expect(
      dispatchConnectorScheduleDueResultSchema.safeParse({
        ...admitted,
        occurrence: { ...admitted.occurrence, connectorRunId: null },
      }).success,
    ).toBe(false)
    expect(
      dispatchConnectorScheduleDueResultSchema.safeParse({
        ...admitted,
        occurrence: { ...admitted.occurrence, connectorRunId: 'other-run' },
      }).success,
    ).toBe(false)
    expect(
      dispatchConnectorScheduleDueResultSchema.safeParse({
        ...admitted,
        occurrence: { ...admitted.occurrence, admittedMode: 'scheduled' },
      }).success,
    ).toBe(false)
  })
})

describe('connector schedule occurrence idempotency', () => {
  it('requires idempotencyKey to equal the canonical revision:nominalAt derivation', () => {
    const nominalAt = '2026-07-12T12:00:00.000Z'
    const scheduleRevision = 'rev-1'
    const occurrence = {
      id: 'occ-2',
      scheduleId: 'schedule-1',
      scheduleRevision,
      nominalAt,
      idempotencyKey: connectorScheduleOccurrenceIdempotencyKey(scheduleRevision, nominalAt),
      admittedMode: 'scheduled' as const,
      outcome: 'completed' as const,
      connectorRunId: 'run-2',
      createdAt: '2026-07-12T13:00:00.000Z',
    }

    expect(occurrence.idempotencyKey).toBe('rev-1:2026-07-12T12:00:00.000Z')
    expect(connectorScheduleOccurrenceSummarySchema.parse(occurrence)).toEqual(occurrence)
    expect(
      connectorScheduleOccurrenceSummarySchema.safeParse({
        ...occurrence,
        idempotencyKey: 'arbitrary-client-key',
      }).success,
    ).toBe(false)
  })
})

describe('connector schedule error payload', () => {
  it('accepts only the closed connector-schedule error codes with message and no extras', () => {
    for (const code of [
      'connector_scheduling_unavailable',
      'invalid_timezone',
      'invalid_cadence',
      'schedule_too_frequent',
      'stale_schedule_revision',
      'schedule_dispatch_conflict',
    ] as const) {
      expect(
        connectorScheduleErrorPayloadSchema.parse({
          code,
          message: `error:${code}`,
        }),
      ).toEqual({ code, message: `error:${code}` })
    }

    expect(
      connectorScheduleErrorPayloadSchema.safeParse({
        code: 'not_found',
        message: 'missing',
      }).success,
    ).toBe(false)
    expect(
      connectorScheduleErrorPayloadSchema.safeParse({
        code: 'invalid_timezone',
        message: 'bad zone',
        stack: 'secret',
      }).success,
    ).toBe(false)
  })
})

describe('connector schedule history bounds', () => {
  it('bounds history list input and result limits to positive integers at most 200', () => {
    expect(MAX_CONNECTOR_SCHEDULE_HISTORY_LIMIT).toBe(200)

    const valid = {
      connectorInstanceId: 'connector-1',
      limit: 200,
      offset: 0,
    }
    expect(connectorScheduleHistoryListInputSchema.parse(valid)).toEqual(valid)

    expect(
      connectorScheduleHistoryListInputSchema.safeParse({
        connectorInstanceId: 'connector-1',
        limit: 0,
        offset: 0,
      }).success,
    ).toBe(false)
    expect(
      connectorScheduleHistoryListInputSchema.safeParse({
        connectorInstanceId: 'connector-1',
        limit: 201,
        offset: 0,
      }).success,
    ).toBe(false)
    expect(
      connectorScheduleHistoryListInputSchema.safeParse({
        connectorInstanceId: '',
        limit: 25,
        offset: 0,
      }).success,
    ).toBe(false)
    expect(
      connectorScheduleHistoryListInputSchema.safeParse({
        ...valid,
        extra: true,
      }).success,
    ).toBe(false)
    expect(
      connectorScheduleHistoryListInputSchema.safeParse({
        connectorInstanceId: 'connector-1',
        limit: 25,
        offset: -1,
      }).success,
    ).toBe(false)

    expect(
      connectorScheduleAuditListResultSchema.safeParse({
        items: [],
        total: 0,
        limit: 0,
        offset: 0,
        hasMore: false,
      }).success,
    ).toBe(false)
    expect(
      connectorScheduleOccurrenceListResultSchema.safeParse({
        items: [],
        total: 0,
        limit: 201,
        offset: 0,
        hasMore: false,
      }).success,
    ).toBe(false)
  })
})

describe('connector schedule API paths', () => {
  it('exposes workspace connector schedule paths for get, mutate, history, and due dispatch', () => {
    const id = 'jobright/session 1'

    expect(valedictorianApiPaths.connectorSchedule(id)).toBe(
      '/v1/connectors/jobright%2Fsession%201/schedule',
    )
    expect(valedictorianApiPaths.connectorSchedulePause(id)).toBe(
      '/v1/connectors/jobright%2Fsession%201/schedule/pause',
    )
    expect(valedictorianApiPaths.connectorScheduleResume(id)).toBe(
      '/v1/connectors/jobright%2Fsession%201/schedule/resume',
    )
    expect(valedictorianApiPaths.connectorScheduleAudit(id)).toBe(
      '/v1/connectors/jobright%2Fsession%201/schedule/audit',
    )
    expect(valedictorianApiPaths.connectorScheduleOccurrences(id)).toBe(
      '/v1/connectors/jobright%2Fsession%201/schedule/occurrences',
    )
    expect(valedictorianApiPaths.connectorScheduleDispatchDue(id)).toBe(
      '/v1/connectors/jobright%2Fsession%201/schedule/dispatch-due',
    )
  })
})
