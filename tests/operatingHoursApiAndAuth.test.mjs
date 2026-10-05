import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import fs from 'fs';

// Read .env.local into process.env without printing secrets
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

// Import next-auth mock helper
import * as nextAuth from 'next-auth';
import { GET, PUT } from '../app/api/vendors/operating-hours/route.js';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';

describe('Sprint 7B: Operating Hours API & Authorization Tests', () => {

    let originalGetServerSession;
    let mockSession = null;

    // Test business & location references in database
    let approvedLocationId;
    let approvedUserId;

    before(async () => {
        // Save original getServerSession
        originalGetServerSession = nextAuth.getServerSession;

        // Mock getServerSession
        nextAuth.getServerSession = async () => mockSession;

        // Query an existing approved business and its location for real DB checks
        const { data: approvedBiz } = await supabaseAdmin
            .from('businesses')
            .select('id, user_id, status, business_locations(id, timezone)')
            .eq('status', 'approved')
            .limit(1)
            .single();

        if (approvedBiz && approvedBiz.business_locations?.length > 0) {
            approvedUserId = approvedBiz.user_id;
            approvedLocationId = approvedBiz.business_locations[0].id;
        }
    });

    after(() => {
        // Restore original
        nextAuth.getServerSession = originalGetServerSession;
    });

    test('1. Unauthenticated GET returns 401 Unauthorized', async () => {
        mockSession = null; // Unauthenticated

        const req = new Request(`http://localhost:3000/api/vendors/operating-hours?locationId=${approvedLocationId}`, {
            method: 'GET',
        });
        const res = await GET(req);
        assert.equal(res.status, 401);
        const json = await res.json();
        assert.equal(json.success, false);
        assert.equal(json.message, 'Authentication required');
    });

    test('2. Unauthenticated PUT returns 401 Unauthorized', async () => {
        mockSession = null; // Unauthenticated

        const req = new Request('http://localhost:3000/api/vendors/operating-hours', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                locationId: approvedLocationId,
                timezone: 'Asia/Kolkata',
                schedule: []
            })
        });
        const res = await PUT(req);
        assert.equal(res.status, 401);
        const json = await res.json();
        assert.equal(json.success, false);
        assert.equal(json.message, 'Authentication required');
    });

    test('3. Vendor cannot read another vendor location (returns 404 IDOR protection)', async () => {
        // User is authenticated as another user ID
        mockSession = { user: { id: '00000000-0000-0000-0000-000000000099' } };

        const req = new Request(`http://localhost:3000/api/vendors/operating-hours?locationId=${approvedLocationId}`, {
            method: 'GET',
        });
        const res = await GET(req);
        assert.equal(res.status, 404);
        const json = await res.json();
        assert.equal(json.success, false);
        assert.ok(json.message.includes('not found or does not belong to your business'));
    });

    test('4. Vendor cannot modify another vendor location (returns 404 IDOR protection)', async () => {
        mockSession = { user: { id: '00000000-0000-0000-0000-000000000099' } };

        const validSchedule = [
            { dayOfWeek: 1, openTime: '09:00', closeTime: '17:00', isClosed: false, is24Hours: false },
            { dayOfWeek: 2, openTime: '09:00', closeTime: '17:00', isClosed: false, is24Hours: false },
            { dayOfWeek: 3, openTime: '09:00', closeTime: '17:00', isClosed: false, is24Hours: false },
            { dayOfWeek: 4, openTime: '09:00', closeTime: '17:00', isClosed: false, is24Hours: false },
            { dayOfWeek: 5, openTime: '09:00', closeTime: '17:00', isClosed: false, is24Hours: false },
            { dayOfWeek: 6, openTime: '10:00', closeTime: '16:00', isClosed: false, is24Hours: false },
            { dayOfWeek: 7, openTime: '00:00', closeTime: '00:00', isClosed: true, is24Hours: false },
        ];

        const req = new Request('http://localhost:3000/api/vendors/operating-hours', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                locationId: approvedLocationId,
                timezone: 'Asia/Kolkata',
                schedule: validSchedule
            })
        });
        const res = await PUT(req);
        assert.equal(res.status, 404);
        const json = await res.json();
        assert.equal(json.success, false);
        assert.ok(json.message.includes('not found or does not belong to your business'));
    });

    test('5. Pending business cannot manage schedules (returns 403 Forbidden)', async () => {
        // Query or check a pending business
        const { data: pendingBiz } = await supabaseAdmin
            .from('businesses')
            .select('id, user_id, status, business_locations(id)')
            .eq('status', 'pending')
            .limit(1)
            .maybeSingle();

        if (pendingBiz && pendingBiz.business_locations?.length > 0) {
            mockSession = { user: { id: pendingBiz.user_id } };
            const req = new Request(`http://localhost:3000/api/vendors/operating-hours?locationId=${pendingBiz.business_locations[0].id}`, {
                method: 'GET',
            });
            const res = await GET(req);
            assert.equal(res.status, 403);
            const json = await res.json();
            assert.equal(json.success, false);
            assert.ok(json.message.includes('Only approved businesses can manage operating hours'));
        }
    });

    test('6. Rejected business cannot manage schedules (returns 403 Forbidden)', async () => {
        // Query or check a rejected business
        const { data: rejectedBiz } = await supabaseAdmin
            .from('businesses')
            .select('id, user_id, status, business_locations(id)')
            .eq('status', 'rejected')
            .limit(1)
            .maybeSingle();

        if (rejectedBiz && rejectedBiz.business_locations?.length > 0) {
            mockSession = { user: { id: rejectedBiz.user_id } };
            const req = new Request(`http://localhost:3000/api/vendors/operating-hours?locationId=${rejectedBiz.business_locations[0].id}`, {
                method: 'GET',
            });
            const res = await GET(req);
            assert.equal(res.status, 403);
            const json = await res.json();
            assert.equal(json.success, false);
            assert.ok(json.message.includes('Only approved businesses can manage operating hours'));
        }
    });

    test('7. Approved business owner can read their schedule (returns 200 OK)', async () => {
        assert.ok(approvedUserId, 'Must have an approved user');
        assert.ok(approvedLocationId, 'Must have an approved location');

        mockSession = { user: { id: approvedUserId } };

        const req = new Request(`http://localhost:3000/api/vendors/operating-hours?locationId=${approvedLocationId}`, {
            method: 'GET',
        });
        const res = await GET(req);
        assert.equal(res.status, 200);
        const json = await res.json();
        assert.equal(json.success, true);
        assert.equal(json.data.locationId, approvedLocationId);
        assert.equal(typeof json.data.timezone, 'string');
        assert.equal(typeof json.data.hasHoursConfigured, 'boolean');
        assert.ok(Array.isArray(json.data.schedule));
    });

    test('8. Approved business owner can save their schedule (returns 200 OK)', async () => {
        assert.ok(approvedUserId, 'Must have an approved user');
        assert.ok(approvedLocationId, 'Must have an approved location');

        mockSession = { user: { id: approvedUserId } };

        const testSchedule = [
            { dayOfWeek: 1, openTime: '08:30', closeTime: '21:30', isClosed: false, is24Hours: false },
            { dayOfWeek: 2, openTime: '08:30', closeTime: '21:30', isClosed: false, is24Hours: false },
            { dayOfWeek: 3, openTime: '08:30', closeTime: '21:30', isClosed: false, is24Hours: false },
            { dayOfWeek: 4, openTime: '08:30', closeTime: '21:30', isClosed: false, is24Hours: false },
            { dayOfWeek: 5, openTime: '08:30', closeTime: '22:00', isClosed: false, is24Hours: false },
            { dayOfWeek: 6, openTime: '00:00', closeTime: '00:00', isClosed: false, is24Hours: true },
            { dayOfWeek: 7, openTime: '00:00', closeTime: '00:00', isClosed: true, is24Hours: false },
        ];

        const req = new Request('http://localhost:3000/api/vendors/operating-hours', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                locationId: approvedLocationId,
                timezone: 'Asia/Kolkata',
                schedule: testSchedule
            })
        });

        const res = await PUT(req);
        assert.equal(res.status, 200);
        const json = await res.json();
        assert.equal(json.success, true);
        assert.equal(json.data.hasHoursConfigured, true);
        assert.equal(json.data.schedule.length, 7);

        // Verify Saturday is 24 hours
        const sat = json.data.schedule.find(s => s.dayOfWeek === 6);
        assert.equal(sat.is24Hours, true);
        assert.equal(sat.isClosed, false);

        // Verify Sunday is closed
        const sun = json.data.schedule.find(s => s.dayOfWeek === 7);
        assert.equal(sun.isClosed, true);
        assert.equal(sun.is24Hours, false);

        // Cleanup: remove the test schedule rows
        await supabaseAdmin.from('business_hours').delete().eq('location_id', approvedLocationId);
    });
});
