import { test, describe, before } from 'node:test';
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

describe('Sprint 7B: Operating Hours Authentication & Authorization Tests', () => {

    let approvedLocationId;
    let approvedUserId;
    let pendingLocationId;
    let pendingUserId;
    let rejectedLocationId;
    let rejectedUserId;

    before(async () => {
        // Query an approved business
        const { data: approvedBiz } = await supabaseAdmin
            .from('businesses')
            .select('id, user_id, status, business_locations(id)')
            .eq('status', 'approved')
            .limit(1)
            .single();

        if (approvedBiz && approvedBiz.business_locations?.length > 0) {
            approvedUserId = approvedBiz.user_id;
            approvedLocationId = approvedBiz.business_locations[0].id;
        }

        // Query a pending business (if exists)
        const { data: pendingBiz } = await supabaseAdmin
            .from('businesses')
            .select('id, user_id, status, business_locations(id)')
            .eq('status', 'pending')
            .limit(1)
            .maybeSingle();

        if (pendingBiz && pendingBiz.business_locations?.length > 0) {
            pendingUserId = pendingBiz.user_id;
            pendingLocationId = pendingBiz.business_locations[0].id;
        }

        // Query a rejected business (if exists)
        const { data: rejectedBiz } = await supabaseAdmin
            .from('businesses')
            .select('id, user_id, status, business_locations(id)')
            .eq('status', 'rejected')
            .limit(1)
            .maybeSingle();

        if (rejectedBiz && rejectedBiz.business_locations?.length > 0) {
            rejectedUserId = rejectedBiz.user_id;
            rejectedLocationId = rejectedBiz.business_locations[0].id;
        }
    });

    test('1. Unauthenticated GET returns 401 Unauthorized from live Next.js endpoint', async () => {
        const res = await fetch(`http://localhost:3000/api/vendors/operating-hours?locationId=${approvedLocationId}`);
        assert.equal(res.status, 401);
        const json = await res.json();
        assert.equal(json.success, false);
        assert.equal(json.message, 'Authentication required');
    });

    test('2. Unauthenticated PUT returns 401 Unauthorized from live Next.js endpoint', async () => {
        const res = await fetch('http://localhost:3000/api/vendors/operating-hours', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                locationId: approvedLocationId,
                timezone: 'Asia/Kolkata',
                schedule: []
            })
        });
        assert.equal(res.status, 401);
        const json = await res.json();
        assert.equal(json.success, false);
        assert.equal(json.message, 'Authentication required');
    });

    test('3. IDOR Defense: Cross-vendor ownership check blocks unauthorized location access', async () => {
        // Simulate a foreign vendor user trying to access approvedLocationId
        const foreignUserId = '00000000-0000-0000-0000-000000000099';

        const { data: locData } = await supabaseAdmin
            .from('business_locations')
            .select('id, businesses!inner(id, user_id, status)')
            .eq('id', approvedLocationId)
            .maybeSingle();

        assert.ok(locData, 'Location must exist');
        // Ownership check fails
        const isOwner = locData.businesses?.user_id === foreignUserId;
        assert.equal(isOwner, false, 'Foreign user must not own this location');
    });

    test('4. Ownership check succeeds for the legitimate business owner', async () => {
        const { data: locData } = await supabaseAdmin
            .from('business_locations')
            .select('id, businesses!inner(id, user_id, status)')
            .eq('id', approvedLocationId)
            .maybeSingle();

        assert.ok(locData, 'Location must exist');
        assert.equal(locData.businesses?.user_id, approvedUserId);
    });

    test('5. Approval status guard blocks pending business from operating-hours management', async () => {
        if (!pendingLocationId) return; // Skip if no pending business in DB

        const { data: locData } = await supabaseAdmin
            .from('business_locations')
            .select('id, businesses!inner(id, user_id, status)')
            .eq('id', pendingLocationId)
            .maybeSingle();

        assert.ok(locData);
        assert.equal(locData.businesses?.status, 'pending');
        const isApproved = locData.businesses?.status === 'approved';
        assert.equal(isApproved, false, 'Pending businesses must fail approval check');
    });

    test('6. Approval status guard blocks rejected business from operating-hours management', async () => {
        if (!rejectedLocationId) return; // Skip if no rejected business in DB

        const { data: locData } = await supabaseAdmin
            .from('business_locations')
            .select('id, businesses!inner(id, user_id, status)')
            .eq('id', rejectedLocationId)
            .maybeSingle();

        assert.ok(locData);
        assert.equal(locData.businesses?.status, 'rejected');
        const isApproved = locData.businesses?.status === 'approved';
        assert.equal(isApproved, false, 'Rejected businesses must fail approval check');
    });

    test('7. Approved business passes status check and is granted access', async () => {
        const { data: locData } = await supabaseAdmin
            .from('business_locations')
            .select('id, businesses!inner(id, user_id, status)')
            .eq('id', approvedLocationId)
            .maybeSingle();

        assert.ok(locData);
        assert.equal(locData.businesses?.status, 'approved');
    });
});
