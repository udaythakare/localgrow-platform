/**
 * Security Fix Batch 2 — Focused Tests (no external deps beyond dotenv)
 * Run from: c:\Users\rohan\promo-origin
 *   node --input-type=module < "C:\Users\rohan\.gemini\antigravity-ide\brain\634fd80b-6a59-4c7c-9b02-38cc23218bc8\scratch\securityFixBatch2.test.mjs"
 * OR copy to project and run with node
 */

import fs from 'fs';
import path from 'path';

// Load .env.local from the project root (zero external dependencies)
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
            const k = trimmed.slice(0, eqIdx).trim();
            const v = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
            if (!process.env[k]) process.env[k] = v;
        }
    }
}

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET;

console.log(`\nRunning Batch 2 Security Tests against: ${BASE_URL}`);
console.log(`INTERNAL_API_SECRET present: ${!!INTERNAL_SECRET}`);

let passed = 0;
let failed = 0;
const results = [];

function assert(name, condition, detail = '') {
    if (condition) {
        passed++;
        results.push(`  ✅ PASS  ${name}`);
    } else {
        failed++;
        results.push(`  ❌ FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
    }
}

async function fetchJSON(url, opts = {}) {
    try {
        const res = await fetch(url, opts);
        let body = null;
        try { body = await res.json(); } catch {}
        return { status: res.status, body, headers: Object.fromEntries(res.headers.entries()) };
    } catch (e) {
        return { status: -1, error: e.message };
    }
}

// ─────────────────────────────────────────────────────────────
// 1. /api/send-email — INTERNAL_API_SECRET guard
// ─────────────────────────────────────────────────────────────
console.log('\n🔒 1. /api/send-email security');

{
    // No secret → should return 401
    const r1 = await fetchJSON(`${BASE_URL}/api/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'attacker@evil.com', subject: 'hack', message: 'payload' })
    });
    assert('Rejects request with no x-internal-secret (401)', r1.status === 401, `got ${r1.status}`);

    // Wrong secret → should return 401
    const r2 = await fetchJSON(`${BASE_URL}/api/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-secret': 'wrong-secret' },
        body: JSON.stringify({ email: 'attacker@evil.com', subject: 'hack', message: 'payload' })
    });
    assert('Rejects request with wrong x-internal-secret (401)', r2.status === 401, `got ${r2.status}`);

    if (INTERNAL_SECRET) {
        // Correct secret → NOT 401
        const r3 = await fetchJSON(`${BASE_URL}/api/send-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-internal-secret': INTERNAL_SECRET },
            body: JSON.stringify({ email: 'test@example.com', subject: 'Test', message: 'Hello' })
        });
        assert('Accepts request with correct x-internal-secret (not 401)', r3.status !== 401, `got ${r3.status}`);

        // Missing fields + correct secret → 400
        const r4 = await fetchJSON(`${BASE_URL}/api/send-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-internal-secret': INTERNAL_SECRET },
            body: JSON.stringify({ email: 'test@example.com' })
        });
        assert('Returns 400 for missing required fields', r4.status === 400, `got ${r4.status}`);
    } else {
        results.push('  ⚠️  SKIP  INTERNAL_API_SECRET not in env');
    }
}

// ─────────────────────────────────────────────────────────────
// 2. /api/send-notification — INTERNAL_API_SECRET guard
// ─────────────────────────────────────────────────────────────
console.log('\n🔔 2. /api/send-notification security');

{
    const r1 = await fetchJSON(`${BASE_URL}/api/send-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'hack', body: 'payload' })
    });
    assert('Rejects request with no x-internal-secret (401)', r1.status === 401, `got ${r1.status}`);

    const r2 = await fetchJSON(`${BASE_URL}/api/send-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-secret': 'bad' },
        body: JSON.stringify({ title: 'hack', body: 'payload' })
    });
    assert('Rejects request with wrong x-internal-secret (401)', r2.status === 401, `got ${r2.status}`);

    if (INTERNAL_SECRET) {
        // Broadcast (no userId) + correct secret → 400
        const r3 = await fetchJSON(`${BASE_URL}/api/send-notification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-internal-secret': INTERNAL_SECRET },
            body: JSON.stringify({ title: 'broadcast', body: 'payload' })
        });
        assert('Rejects broadcast (no userId) even with valid secret (400)', r3.status === 400, `got ${r3.status}`);
    }
}

// ─────────────────────────────────────────────────────────────
// 3. HTTP Security Headers
// ─────────────────────────────────────────────────────────────
console.log('\n🛡️  3. HTTP Security Headers');

{
    try {
        const res = await fetch(`${BASE_URL}/`, { method: 'GET' });
        const headers = Object.fromEntries(res.headers.entries());

        assert('X-Frame-Options: DENY present', headers['x-frame-options'] === 'DENY', headers['x-frame-options'] || 'missing');
        assert('X-Content-Type-Options: nosniff present', headers['x-content-type-options'] === 'nosniff', headers['x-content-type-options'] || 'missing');
        assert('Referrer-Policy present', !!headers['referrer-policy'], headers['referrer-policy'] || 'missing');
        assert('X-XSS-Protection present', !!headers['x-xss-protection'], headers['x-xss-protection'] || 'missing');
        assert('Permissions-Policy present', !!headers['permissions-policy'], headers['permissions-policy'] || 'missing');
        results.push(`  ℹ️   NOTE  Strict-Transport-Security: ${headers['strict-transport-security'] || 'not present (expected on HTTPS only)'}`);
    } catch (e) {
        results.push(`  ⚠️  SKIP  Could not fetch homepage: ${e.message}`);
    }
}

// ─────────────────────────────────────────────────────────────
// 4. Coupon claim concurrency — static code inspection
// ─────────────────────────────────────────────────────────────
console.log('\n🎫 4. Coupon claim concurrency guard (static code check)');

{
    const couponActionsPath = path.resolve(process.cwd(), 'actions/couponActions.js');
    const code = fs.readFileSync(couponActionsPath, 'utf-8');

    assert(
        'Reads current_claims and max_claims before update',
        code.includes("select('current_claims, max_claims')"),
        'pattern not found'
    );
    assert(
        'Uses optimistic-lock .eq("current_claims", ...) guard',
        code.includes('.eq(\'current_claims\', couponRow.current_claims)'),
        'pattern not found'
    );
    assert(
        'Returns "maximum claim limit" error on quota exceeded',
        code.includes('maximum claim limit'),
        'error message not found'
    );
    assert(
        'Rolls back user_coupon on failure',
        code.includes("from('user_coupons')") && code.includes('.delete()'),
        'rollback pattern not found'
    );
    assert(
        'Applies .lt(current_claims, max_claims) DB guard',
        code.includes('.lt(\'current_claims\', couponRow.max_claims)'),
        'lt guard not found'
    );
}

// ─────────────────────────────────────────────────────────────
// 5. Caller code inspection — all send-email callers pass secret
// ─────────────────────────────────────────────────────────────
console.log('\n📬 5. send-email caller code inspection');

{
    const filesToCheck = [
        'lib/sendAdminEmail.js',
        'app/api/register-user/route.js',
        'app/api/resend-verification/route.js',
        'app/api/vendors/onboard/route.js',
    ];

    for (const rel of filesToCheck) {
        const fullPath = path.resolve(process.cwd(), rel);
        const code = fs.readFileSync(fullPath, 'utf-8');
        const hasSendEmail = code.includes('/api/send-email');
        if (hasSendEmail) {
            assert(
                `${rel} passes x-internal-secret when calling send-email`,
                code.includes('x-internal-secret') && code.includes('INTERNAL_API_SECRET'),
                'secret header not found in caller'
            );
        }
    }

    // Vendor couponActions notification caller
    const notifPath = path.resolve(process.cwd(), 'app/business/dashboard/coupons/actions/couponActions.js');
    const notifCode = fs.readFileSync(notifPath, 'utf-8');
    assert(
        'Vendor couponActions passes x-internal-secret to send-notification',
        notifCode.includes('x-internal-secret') && notifCode.includes('INTERNAL_API_SECRET'),
        'secret not found in vendor notification caller'
    );
    assert(
        'Vendor couponActions uses NEXT_PUBLIC_SITE_URL instead of hardcoded localhost',
        notifCode.includes('NEXT_PUBLIC_SITE_URL') && !notifCode.includes('http://localhost:3000/api/send-notification'),
        'still using hardcoded localhost'
    );
}

// ─────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────
console.log('\n' + results.join('\n'));
console.log(`\n${'─'.repeat(55)}`);
console.log(`Total: ${passed + failed}  |  ✅ Passed: ${passed}  |  ❌ Failed: ${failed}`);
if (failed === 0) console.log('🎉 All Batch 2 security tests passed!');
process.exit(failed > 0 ? 1 : 0);
