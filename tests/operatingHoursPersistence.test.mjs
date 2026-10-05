import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import fs from 'fs';

// Read .env.local without exposing secrets
const envPath = path.resolve('c:/Users/rohan/promo-origin/.env.local');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const idx = trimmed.indexOf('=');
        if (idx !== -1) {
            const key = trimmed.slice(0, idx).trim();
            let val = trimmed.slice(idx + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1);
            }
            process.env[key] = val;
        }
    }
}

import { createRequire } from 'module';
const req = createRequire(import.meta.url);
const { createClient } = req('@supabase/supabase-js');

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

describe('Sprint 7B: Operating Hours Persistence & Atomicity Tests', () => {

    let testLocationId;
    let originalTimezone;

    before(async () => {
        // Query an approved location to use as test target
        const { data: loc } = await supabaseAdmin
            .from('business_locations')
            .select('id, timezone')
            .limit(1)
            .single();

        assert.ok(loc, 'Must have at least one location');
        testLocationId = loc.id;
        originalTimezone = loc.timezone || 'Asia/Kolkata';

        // Ensure clean initial state for this location
        await supabaseAdmin.from('business_hours').delete().eq('location_id', testLocationId);
    });

    after(async () => {
        // Cleanup: remove test hours and restore timezone
        await supabaseAdmin.from('business_hours').delete().eq('location_id', testLocationId);
        await supabaseAdmin
            .from('business_locations')
            .update({ timezone: originalTimezone })
            .eq('id', testLocationId);
    });

    test('1. Saving a complete 7-day schedule persists all 7 rows', async () => {
        const testSchedule = [
            { dayOfWeek: 1, openTime: '08:00:00', closeTime: '20:00:00', isClosed: false, is24Hours: false },
            { dayOfWeek: 2, openTime: '08:00:00', closeTime: '20:00:00', isClosed: false, is24Hours: false },
            { dayOfWeek: 3, openTime: '08:00:00', closeTime: '20:00:00', isClosed: false, is24Hours: false },
            { dayOfWeek: 4, openTime: '08:00:00', closeTime: '20:00:00', isClosed: false, is24Hours: false },
            { dayOfWeek: 5, openTime: '08:00:00', closeTime: '22:00:00', isClosed: false, is24Hours: false },
            { dayOfWeek: 6, openTime: '00:00:00', closeTime: '00:00:00', isClosed: false, is24Hours: true },
            { dayOfWeek: 7, openTime: '00:00:00', closeTime: '00:00:00', isClosed: true, is24Hours: false },
        ];

        const { error } = await supabaseAdmin.rpc('save_vendor_operating_hours', {
            p_location_id: testLocationId,
            p_timezone: 'Asia/Kolkata',
            p_schedule: testSchedule
        });

        assert.equal(error, null, 'RPC must execute without error');

        // Verify all 7 records exist
        const { data: rows } = await supabaseAdmin
            .from('business_hours')
            .select('*')
            .eq('location_id', testLocationId)
            .order('day_of_week', { ascending: true });

        assert.equal(rows.length, 7);

        // Verify Saturday is 24 hours
        const sat = rows.find(r => r.day_of_week === 6);
        assert.equal(sat.is_24_hours, true);
        assert.equal(sat.is_closed, false);

        // Verify Sunday is closed
        const sun = rows.find(r => r.day_of_week === 7);
        assert.equal(sun.is_closed, true);
        assert.equal(sun.is_24_hours, false);
    });

    test('2. Saving again cleanly replaces the previous schedule (no duplicates)', async () => {
        // Updated schedule: Sunday is now open, Friday is 24h
        const updatedSchedule = [
            { dayOfWeek: 1, openTime: '10:00:00', closeTime: '18:00:00', isClosed: false, is24Hours: false },
            { dayOfWeek: 2, openTime: '10:00:00', closeTime: '18:00:00', isClosed: false, is24Hours: false },
            { dayOfWeek: 3, openTime: '10:00:00', closeTime: '18:00:00', isClosed: false, is24Hours: false },
            { dayOfWeek: 4, openTime: '10:00:00', closeTime: '18:00:00', isClosed: false, is24Hours: false },
            { dayOfWeek: 5, openTime: '00:00:00', closeTime: '00:00:00', isClosed: false, is24Hours: true },
            { dayOfWeek: 6, openTime: '11:00:00', closeTime: '23:00:00', isClosed: false, is24Hours: false },
            { dayOfWeek: 7, openTime: '12:00:00', closeTime: '17:00:00', isClosed: false, is24Hours: false },
        ];

        const { error } = await supabaseAdmin.rpc('save_vendor_operating_hours', {
            p_location_id: testLocationId,
            p_timezone: 'Asia/Dubai',
            p_schedule: updatedSchedule
        });

        assert.equal(error, null);

        const { data: rows } = await supabaseAdmin
            .from('business_hours')
            .select('*')
            .eq('location_id', testLocationId);

        // Exactly 7 rows (no duplicates from previous schedule)
        assert.equal(rows.length, 7);

        // Check Sunday open
        const sun = rows.find(r => r.day_of_week === 7);
        assert.equal(sun.is_closed, false);
        assert.equal(sun.open_time, '12:00:00');

        // Check location timezone updated to Asia/Dubai
        const { data: loc } = await supabaseAdmin
            .from('business_locations')
            .select('timezone')
            .eq('id', testLocationId)
            .single();

        assert.equal(loc.timezone, 'Asia/Dubai');
    });

    test('3. Failed transaction rolls back atomically (no partial schedule or timezone update)', async () => {
        // Read current state before failure test
        const { data: rowsBefore } = await supabaseAdmin
            .from('business_hours')
            .select('day_of_week, open_time, close_time')
            .eq('location_id', testLocationId)
            .order('day_of_week');

        const { data: locBefore } = await supabaseAdmin
            .from('business_locations')
            .select('timezone')
            .eq('id', testLocationId)
            .single();

        // Attempt invalid schedule: dayOfWeek 999 (violates chk_business_hours_day_of_week)
        const invalidSchedule = [
            { dayOfWeek: 999, openTime: '10:00:00', closeTime: '18:00:00', isClosed: false, is24Hours: false },
        ];

        const { error } = await supabaseAdmin.rpc('save_vendor_operating_hours', {
            p_location_id: testLocationId,
            p_timezone: 'America/New_York', // Attempted timezone change
            p_schedule: invalidSchedule
        });

        // Must fail with error
        assert.notEqual(error, null, 'RPC must fail on invalid day_of_week constraint');

        // Verify timezone did NOT change to America/New_York (rolled back!)
        const { data: locAfter } = await supabaseAdmin
            .from('business_locations')
            .select('timezone')
            .eq('id', testLocationId)
            .single();

        assert.equal(locAfter.timezone, locBefore.timezone, 'Timezone must remain unchanged after transaction rollback');

        // Verify schedule rows were NOT deleted or partially modified (rolled back!)
        const { data: rowsAfter } = await supabaseAdmin
            .from('business_hours')
            .select('day_of_week, open_time, close_time')
            .eq('location_id', testLocationId)
            .order('day_of_week');

        assert.equal(rowsAfter.length, rowsBefore.length, 'Schedule row count must remain unchanged after rollback');
        assert.deepEqual(rowsAfter, rowsBefore, 'Schedule contents must remain identical after rollback');
    });
});
