import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    operatingHoursUpdateSchema,
    dayScheduleSchema,
    isValidTimezone
} from '../lib/validations/operatingHoursSchema.js';

describe('Sprint 7B: Operating Hours Validation Tests', () => {

    const validLocationId = '480a85c9-b418-47f0-a6ad-e0fc54d97ea6';
    const validTimezone = 'Asia/Kolkata';

    function createValidSevenDaySchedule() {
        return [
            { dayOfWeek: 1, openTime: '09:00', closeTime: '17:00', isClosed: false, is24Hours: false },
            { dayOfWeek: 2, openTime: '09:00', closeTime: '17:00', isClosed: false, is24Hours: false },
            { dayOfWeek: 3, openTime: '09:00', closeTime: '17:00', isClosed: false, is24Hours: false },
            { dayOfWeek: 4, openTime: '09:00', closeTime: '17:00', isClosed: false, is24Hours: false },
            { dayOfWeek: 5, openTime: '09:00', closeTime: '17:00', isClosed: false, is24Hours: false },
            { dayOfWeek: 6, openTime: '10:00', closeTime: '16:00', isClosed: false, is24Hours: false },
            { dayOfWeek: 7, openTime: '00:00', closeTime: '00:00', isClosed: true, is24Hours: false },
        ];
    }

    test('1. Valid complete 7-day schedule passes validation', () => {
        const payload = {
            locationId: validLocationId,
            timezone: validTimezone,
            schedule: createValidSevenDaySchedule()
        };
        const result = operatingHoursUpdateSchema.safeParse(payload);
        assert.equal(result.success, true);
    });

    test('2. Duplicate weekdays are rejected', () => {
        const schedule = createValidSevenDaySchedule();
        schedule[1].dayOfWeek = 1; // Duplicate Monday
        const payload = {
            locationId: validLocationId,
            timezone: validTimezone,
            schedule
        };
        const result = operatingHoursUpdateSchema.safeParse(payload);
        assert.equal(result.success, false);
        const issues = result.error.issues;
        assert.ok(issues.some(i => i.message.includes('each day of the week (1 to 7) exactly once')));
    });

    test('3. Missing weekdays (length < 7) are rejected', () => {
        const schedule = createValidSevenDaySchedule().slice(0, 6);
        const payload = {
            locationId: validLocationId,
            timezone: validTimezone,
            schedule
        };
        const result = operatingHoursUpdateSchema.safeParse(payload);
        assert.equal(result.success, false);
        const issues = result.error.issues;
        assert.ok(issues.some(i => i.message.includes('must contain exactly 7 day entries')));
    });

    test('4. Invalid timezone is rejected', () => {
        const payload = {
            locationId: validLocationId,
            timezone: 'Invalid/Non_Existent_Zone',
            schedule: createValidSevenDaySchedule()
        };
        const result = operatingHoursUpdateSchema.safeParse(payload);
        assert.equal(result.success, false);
        const issues = result.error.issues;
        assert.ok(issues.some(i => i.message.includes('Invalid IANA timezone')));
    });

    test('5. Valid IANA timezones (Asia/Kolkata, America/New_York, UTC) are accepted', () => {
        assert.equal(isValidTimezone('Asia/Kolkata'), true);
        assert.equal(isValidTimezone('America/New_York'), true);
        assert.equal(isValidTimezone('UTC'), true);
        assert.equal(isValidTimezone('Europe/London'), true);
        assert.equal(isValidTimezone('Fake/Zone'), false);
        assert.equal(isValidTimezone(''), false);
    });

    test('6. Closed and 24-hour flags cannot both be true', () => {
        const day = {
            dayOfWeek: 1,
            openTime: '00:00',
            closeTime: '00:00',
            isClosed: true,
            is24Hours: true
        };
        const result = dayScheduleSchema.safeParse(day);
        assert.equal(result.success, false);
        assert.ok(result.error.issues.some(i => i.message.includes('cannot be both closed and open 24 hours')));
    });

    test('7. Equal opening and closing times are rejected for ordinary schedules', () => {
        const day = {
            dayOfWeek: 1,
            openTime: '09:00',
            closeTime: '09:00',
            isClosed: false,
            is24Hours: false
        };
        const result = dayScheduleSchema.safeParse(day);
        assert.equal(result.success, false);
        assert.ok(result.error.issues.some(i => i.message.includes('cannot be identical')));
    });

    test('8. Overnight schedules crossing midnight (e.g. 18:00–02:00) are accepted', () => {
        const day = {
            dayOfWeek: 5,
            openTime: '18:00',
            closeTime: '02:00',
            isClosed: false,
            is24Hours: false
        };
        const result = dayScheduleSchema.safeParse(day);
        assert.equal(result.success, true);
    });

    test('9. Closed and 24-hour entries may use 00:00 for both times', () => {
        const closedDay = {
            dayOfWeek: 7,
            openTime: '00:00',
            closeTime: '00:00',
            isClosed: true,
            is24Hours: false
        };
        assert.equal(dayScheduleSchema.safeParse(closedDay).success, true);

        const allDay = {
            dayOfWeek: 6,
            openTime: '00:00',
            closeTime: '00:00',
            isClosed: false,
            is24Hours: true
        };
        assert.equal(dayScheduleSchema.safeParse(allDay).success, true);
    });

    test('10. Invalid locationId format is rejected', () => {
        const payload = {
            locationId: 'not-a-valid-uuid',
            timezone: validTimezone,
            schedule: createValidSevenDaySchedule()
        };
        const result = operatingHoursUpdateSchema.safeParse(payload);
        assert.equal(result.success, false);
        assert.ok(result.error.issues.some(i => i.message.includes('Invalid location ID')));
    });
});
