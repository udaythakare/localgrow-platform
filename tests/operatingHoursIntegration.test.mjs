import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import fs from 'fs';

// Read .env.local without exposing secrets
const envPath = path.resolve('c:/Users/rohan/.env.local');
const localEnv = path.resolve('c:/Users/rohan/promo-origin/.env.local');
const pathToUse = fs.existsSync(localEnv) ? localEnv : envPath;
if (fs.existsSync(pathToUse)) {
    const envContent = fs.readFileSync(pathToUse, 'utf8');
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

describe('Sprint 7B: Operating Hours End-to-End Integration Tests', () => {

    let approvedLocationId;
    let businessLat;
    let businessLon;

    before(async () => {
        // Query approved location with valid coordinates (Mumbai Biryani Hub)
        const { data: loc } = await supabaseAdmin
            .from('business_locations')
            .select('id, latitude, longitude, businesses!inner(id, name, status)')
            .eq('businesses.status', 'approved')
            .not('latitude', 'is', null)
            .not('longitude', 'is', null)
            .limit(1)
            .single();

        assert.ok(loc, 'Must have an approved location with coordinates for nearby query');
        approvedLocationId = loc.id;
        businessLat = loc.latitude;
        businessLon = loc.longitude;

        // Ensure clean state before test
        await supabaseAdmin.from('business_hours').delete().eq('location_id', approvedLocationId);
    });

    after(async () => {
        // Clean up test hours
        await supabaseAdmin.from('business_hours').delete().eq('location_id', approvedLocationId);
    });

    test('1. Unconfigured hours location returns hasHoursConfigured: false and isOpenNow: null in Nearby API', async () => {
        const url = `http://localhost:8080/api/v2/businesses/nearby?latitude=${businessLat}&longitude=${businessLon}&radiusKm=2`;
        const res = await fetch(url);
        assert.equal(res.status, 200);

        const data = await res.json();
        assert.ok(data.content.length > 0, 'Should find at least 1 nearby business');

        const item = data.content.find(b => b.locationId === approvedLocationId);
        assert.ok(item, 'Target location must be in nearby results');
        assert.equal(item.operatingHours.hasHoursConfigured, false);
        assert.equal(item.operatingHours.isOpenNow, null);
        assert.equal(item.operatingHours.statusText, 'Hours not configured');
        assert.equal(item.operatingHours.todaySchedule, null);
    });

    test('2. Saved schedule immediately enriches Nearby API response with live status', async () => {
        // Determine today's ISO weekday in IST (1 = Monday .. 7 = Sunday)
        const now = new Date();
        const istDayOfWeek = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Kolkata',
            weekday: 'narrow'
        }).format(now);

        // Save a 7-day schedule where all days are open 00:00 to 23:59 (always open)
        const alwaysOpenSchedule = [1, 2, 3, 4, 5, 6, 7].map(d => ({
            dayOfWeek: d,
            openTime: '00:01:00',
            closeTime: '23:59:00',
            isClosed: false,
            is24Hours: false
        }));

        const { error } = await supabaseAdmin.rpc('save_vendor_operating_hours', {
            p_location_id: approvedLocationId,
            p_timezone: 'Asia/Kolkata',
            p_schedule: alwaysOpenSchedule
        });

        assert.equal(error, null, 'Schedule save RPC must succeed');

        // Query Spring Boot Nearby API
        const url = `http://localhost:8080/api/v2/businesses/nearby?latitude=${businessLat}&longitude=${businessLon}&radiusKm=2`;
        const res = await fetch(url);
        assert.equal(res.status, 200);

        const data = await res.json();
        const item = data.content.find(b => b.locationId === approvedLocationId);
        assert.ok(item, 'Target location must be in nearby results');

        // Must now be configured and open!
        assert.equal(item.operatingHours.hasHoursConfigured, true);
        assert.equal(item.operatingHours.isOpenNow, true);
        assert.ok(item.operatingHours.statusText.includes('Open now'));
        assert.ok(item.operatingHours.todaySchedule !== null);
        assert.equal(item.operatingHours.weeklySchedule.length, 7);
    });

    test('3. Updating schedule to Closed today reflects isOpenNow: false in Nearby API', async () => {
        // Save a schedule where all days are closed
        const allClosedSchedule = [1, 2, 3, 4, 5, 6, 7].map(d => ({
            dayOfWeek: d,
            openTime: '00:00:00',
            closeTime: '00:00:00',
            isClosed: true,
            is24Hours: false
        }));

        const { error } = await supabaseAdmin.rpc('save_vendor_operating_hours', {
            p_location_id: approvedLocationId,
            p_timezone: 'Asia/Kolkata',
            p_schedule: allClosedSchedule
        });

        assert.equal(error, null);

        // Query Spring Boot Nearby API
        const url = `http://localhost:8080/api/v2/businesses/nearby?latitude=${businessLat}&longitude=${businessLon}&radiusKm=2`;
        const res = await fetch(url);
        assert.equal(res.status, 200);

        const data = await res.json();
        const item = data.content.find(b => b.locationId === approvedLocationId);
        assert.ok(item);

        // Must now be closed!
        assert.equal(item.operatingHours.hasHoursConfigured, true);
        assert.equal(item.operatingHours.isOpenNow, false);
        assert.equal(item.operatingHours.statusText, 'Closed today');
        assert.equal(item.operatingHours.todaySchedule.isClosed, true);
    });
});
