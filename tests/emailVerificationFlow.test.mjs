/**
 * tests/emailVerificationFlow.test.mjs
 *
 * Focused tests for the email verification feature:
 *   - register-user token generation (secure, no PII)
 *   - resend-verification token invalidation + new token
 *   - /api/verify-email handler:
 *       valid token → account activated
 *       expired token → rejected
 *       already-used token → rejected
 *       malformed / unknown token → rejected
 *       token replay (two concurrent requests) → second is rejected
 *   - NextAuth Credentials sign-in rejection for unverified accounts
 *
 * All DB operations against real Supabase; test data is cleaned up in after().
 */

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { POST as registerUser }     from '../app/api/register-user/route.js';
import { POST as resendVerification } from '../app/api/resend-verification/route.js';
import { GET  as verifyEmail }       from '../app/api/verify-email/route.js';

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/** Build a minimal NextRequest-like object for POST routes */
function makePostRequest(body) {
    return {
        json: async () => body,
        headers: { get: () => null },
    };
}

/** Build a minimal NextRequest-like object for GET /api/verify-email?token=... */
function makeGetRequest(token) {
    const url = `http://localhost/api/verify-email${token !== undefined ? `?token=${token}` : ''}`;
    return { url };
}

/** Helper to generate a CSPRNG token pair the same way production code does */
function generateTokenPair() {
    const raw = crypto.randomBytes(32).toString('hex');
    const hashed = crypto.createHash('sha256').update(raw).digest('hex');
    return { raw, hashed };
}

/** Insert a verification token row directly for test setup */
async function insertToken({ userId, hashedToken, expiresAt = null, used = false }) {
    const expires = expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000);
    const { data, error } = await supabaseAdmin
        .from('user_tokens')
        .insert({
            user_id: userId,
            token: hashedToken,
            expires_at: expires,
            type: 'verification',
            used,
        })
        .select('id')
        .single();
    if (error) throw new Error(`insertToken: ${error.message}`);
    return data.id;
}

/** Read is_verified for a user */
async function getIsVerified(userId) {
    const { data } = await supabaseAdmin
        .from('user_roles')
        .select('is_verified')
        .eq('user_id', userId)
        .single();
    return data?.is_verified ?? null;
}

/** Read used for a token row */
async function getTokenUsed(tokenId) {
    const { data } = await supabaseAdmin
        .from('user_tokens')
        .select('used')
        .eq('id', tokenId)
        .single();
    return data?.used ?? null;
}

// ──────────────────────────────────────────────────────────────────────────────
// Suite-level test user state
// ──────────────────────────────────────────────────────────────────────────────

describe('Email Verification Flow', () => {

    // All UUIDs and registered emails created during the test run, cleaned up in after()
    const createdUserIds   = [];
    const createdTokenIds  = [];
    const createdEmails    = [];

    /**
     * Create a user + role directly via supabaseAdmin so we can test
     * the verify handler independently of the registration route.
     */
    async function createTestUser({ isVerified = false } = {}) {
        const email = `test_ev_${Date.now()}_${Math.random().toString(36).slice(2)}@example-localgrow.invalid`;
        const { data: user, error: uErr } = await supabaseAdmin
            .from('users')
            .insert({
                email,
                username: `test_${Date.now()}`,
                password: '$2b$10$placeholderHashNotUsedInTests...........',
                full_name: 'Test User',
            })
            .select('id, email')
            .single();
        if (uErr) throw new Error(`createTestUser: ${uErr.message}`);

        const { error: rErr } = await supabaseAdmin
            .from('user_roles')
            .insert({ user_id: user.id, role: 'app_user', is_verified: isVerified });
        if (rErr) throw new Error(`createTestUser role: ${rErr.message}`);

        createdUserIds.push(user.id);
        return user;
    }

    after(async () => {
        // Fallback: resolve any test user accounts created by email that were not yet tracked
        if (createdEmails.length) {
            const { data: emailUsers } = await supabaseAdmin
                .from('users')
                .select('id')
                .in('email', createdEmails);
            if (emailUsers?.length) {
                for (const u of emailUsers) {
                    if (!createdUserIds.includes(u.id)) {
                        createdUserIds.push(u.id);
                    }
                }
            }
        }

        // Clean up all tokens first (FK)
        if (createdTokenIds.length) {
            await supabaseAdmin.from('user_tokens').delete().in('id', createdTokenIds);
        }
        // Then child records for all test users in reverse-dependency order
        if (createdUserIds.length) {
            await supabaseAdmin.from('user_tokens').delete().in('user_id', createdUserIds);
            await supabaseAdmin.from('user_roles').delete().in('user_id', createdUserIds);
            await supabaseAdmin.from('user_locations').delete().in('user_id', createdUserIds);
            await supabaseAdmin.from('login_logs').delete().in('user_id', createdUserIds);
            await supabaseAdmin.from('users').delete().in('id', createdUserIds);
        }
    });

    // ──────────────────────────────────────────────────────────────────────
    // Section 1 – register-user token format
    // ──────────────────────────────────────────────────────────────────────

    describe('register-user: token generation', () => {

        test('Token stored in DB is a 64-char hex SHA-256 hash — no PII', async () => {
            const email = `reg_${Date.now()}@example-localgrow.invalid`;
            createdEmails.push(email);
            const req = makePostRequest({
                fullname: 'Reg Test',
                email,
                password: 'TestPassword123!',
                mobile_number: '9999999999',
            });

            // Intercept send-email call by mocking fetch
            const origFetch = global.fetch;
            global.fetch = async () => ({ json: async () => ({ success: true }) });
            const res = await registerUser(req);
            global.fetch = origFetch;

            const body = await res.json();
            // Registration may fail if email sending is mocked — but user should be created
            // We just need to verify the token row
            assert.ok(body.success, `Registration failed: ${body.message}`);

            // Find the user we just created
            const { data: user } = await supabaseAdmin
                .from('users')
                .select('id, email')
                .eq('email', email)
                .maybeSingle();

            if (user?.id) {
                createdUserIds.push(user.id);
            }
            assert.ok(user, 'User should exist after registration');

            // Find token row
            const { data: tokenRows } = await supabaseAdmin
                .from('user_tokens')
                .select('token, used, type')
                .eq('user_id', user.id)
                .eq('type', 'verification');

            assert.ok(tokenRows && tokenRows.length > 0, 'Token row should exist');
            const { token } = tokenRows[0];

            // Must be exactly 64 lowercase hex characters (SHA-256)
            assert.match(token, /^[0-9a-f]{64}$/, 'Stored token should be SHA-256 hex');

            // Must NOT contain the email address
            assert.ok(!token.includes(email), 'Stored token must not contain email');
            assert.ok(!token.includes('@'), 'Stored token must not contain @ character');

            // Must not equal any Math.random-style fragment (non-hex chars or length ≠ 64)
            assert.strictEqual(token.length, 64);
        });

    });

    // ──────────────────────────────────────────────────────────────────────
    // Section 2 – verify-email handler
    // ──────────────────────────────────────────────────────────────────────

    describe('verify-email: token validation', () => {

        test('Valid token activates account and marks token used', async () => {
            const user = await createTestUser({ isVerified: false });
            const { raw, hashed } = generateTokenPair();
            const tokenId = await insertToken({ userId: user.id, hashedToken: hashed });
            createdTokenIds.push(tokenId);

            const res = await verifyEmail(makeGetRequest(raw));
            const body = await res.json();

            assert.strictEqual(body.status, 'ok', `Expected ok, got ${body.status}`);
            assert.strictEqual(await getIsVerified(user.id), true, 'is_verified should be true');
            assert.strictEqual(await getTokenUsed(tokenId), true, 'Token should be marked used');
        });

        test('Expired token is rejected; account stays unverified', async () => {
            const user = await createTestUser({ isVerified: false });
            const { raw, hashed } = generateTokenPair();
            const past = new Date(Date.now() - 1000); // 1 second in the past
            const tokenId = await insertToken({ userId: user.id, hashedToken: hashed, expiresAt: past });
            createdTokenIds.push(tokenId);

            const res = await verifyEmail(makeGetRequest(raw));
            const body = await res.json();

            assert.strictEqual(body.status, 'expired');
            assert.strictEqual(await getIsVerified(user.id), false, 'is_verified must remain false');
        });

        test('Already-used token is rejected', async () => {
            const user = await createTestUser({ isVerified: false });
            const { raw, hashed } = generateTokenPair();
            const tokenId = await insertToken({ userId: user.id, hashedToken: hashed, used: true });
            createdTokenIds.push(tokenId);

            const res = await verifyEmail(makeGetRequest(raw));
            const body = await res.json();

            assert.strictEqual(body.status, 'used');
            assert.strictEqual(await getIsVerified(user.id), false, 'is_verified must remain false');
        });

        test('Unknown token (not in DB) is rejected', async () => {
            const { raw } = generateTokenPair(); // never inserted
            const res = await verifyEmail(makeGetRequest(raw));
            const body = await res.json();

            assert.strictEqual(body.status, 'invalid');
        });

        test('Malformed token — too short — is rejected', async () => {
            const res = await verifyEmail(makeGetRequest('abc123'));
            const body = await res.json();
            assert.strictEqual(body.status, 'invalid');
        });

        test('Malformed token — non-hex characters — is rejected', async () => {
            const res = await verifyEmail(makeGetRequest('z'.repeat(64)));
            const body = await res.json();
            assert.strictEqual(body.status, 'invalid');
        });

        test('Missing token parameter is rejected', async () => {
            const res = await verifyEmail(makeGetRequest(undefined));
            const body = await res.json();
            assert.strictEqual(body.status, 'invalid');
        });

        test('Token replay — second request after first succeeds is rejected', async () => {
            const user = await createTestUser({ isVerified: false });
            const { raw, hashed } = generateTokenPair();
            const tokenId = await insertToken({ userId: user.id, hashedToken: hashed });
            createdTokenIds.push(tokenId);

            // First request succeeds
            const res1 = await verifyEmail(makeGetRequest(raw));
            const body1 = await res1.json();
            assert.strictEqual(body1.status, 'ok', 'First request should succeed');

            // Second request with same raw token must be rejected
            const res2 = await verifyEmail(makeGetRequest(raw));
            const body2 = await res2.json();
            assert.strictEqual(body2.status, 'used', 'Replay should be rejected');
        });

        test('Concurrent verification attempts — only one request succeeds', async () => {
            const user = await createTestUser({ isVerified: false });
            const { raw, hashed } = generateTokenPair();
            const tokenId = await insertToken({ userId: user.id, hashedToken: hashed });
            createdTokenIds.push(tokenId);

            // Execute concurrent requests simultaneously
            const [res1, res2, res3] = await Promise.all([
                verifyEmail(makeGetRequest(raw)),
                verifyEmail(makeGetRequest(raw)),
                verifyEmail(makeGetRequest(raw)),
            ]);

            const [body1, body2, body3] = await Promise.all([
                res1.json(),
                res2.json(),
                res3.json(),
            ]);

            const statuses = [body1.status, body2.status, body3.status];
            const okCount = statuses.filter(s => s === 'ok').length;
            const usedCount = statuses.filter(s => s === 'used').length;

            assert.strictEqual(okCount, 1, `Exactly one concurrent request must succeed; got statuses: ${statuses.join(', ')}`);
            assert.strictEqual(usedCount, 2, `Other concurrent requests must be rejected as 'used'; got statuses: ${statuses.join(', ')}`);
            assert.strictEqual(await getIsVerified(user.id), true, 'User role should be verified');
            assert.strictEqual(await getTokenUsed(tokenId), true, 'Token must be marked used');
        });

        test('Legacy format token (non-64 hex) is rejected immediately as invalid', async () => {
            const legacyToken = 'user@example.com-1712345678-abc12345';
            const res = await verifyEmail(makeGetRequest(legacyToken));
            const body = await res.json();
            assert.strictEqual(body.status, 'invalid');
        });

        test('Token of non-verification type is rejected and does not activate account', async () => {
            const user = await createTestUser({ isVerified: false });
            const { raw, hashed } = generateTokenPair();

            // Insert token with type 'password_reset' instead of 'verification'
            const { data, error } = await supabaseAdmin
                .from('user_tokens')
                .insert({
                    user_id: user.id,
                    token: hashed,
                    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
                    type: 'password_reset',
                    used: false,
                })
                .select('id')
                .single();
            if (error) throw error;
            createdTokenIds.push(data.id);

            const res = await verifyEmail(makeGetRequest(raw));
            const body = await res.json();

            assert.strictEqual(body.status, 'invalid');
            assert.strictEqual(await getIsVerified(user.id), false, 'Account must remain unverified');
            assert.strictEqual(await getTokenUsed(data.id), false, 'Non-verification token must not be consumed');
        });

    });

    // ──────────────────────────────────────────────────────────────────────
    // Section 3 – resend-verification
    // ──────────────────────────────────────────────────────────────────────

    describe('resend-verification: behavior', () => {

        test('Resend invalidates prior tokens and creates a new one', async () => {
            const user = await createTestUser({ isVerified: false });

            // Seed an old unused token
            const { hashed: oldHashed } = generateTokenPair();
            const oldTokenId = await insertToken({ userId: user.id, hashedToken: oldHashed });
            createdTokenIds.push(oldTokenId);

            // Mock fetch so the email send call doesn't fail in test env
            const origFetch = global.fetch;
            global.fetch = async () => ({ json: async () => ({ success: true }) });

            const req = makePostRequest({ email: user.email });
            const res = await resendVerification(req);
            global.fetch = origFetch;

            const body = await res.json();
            assert.ok(body.success, `Resend failed: ${body.message}`);

            // Old token must be marked used
            assert.strictEqual(await getTokenUsed(oldTokenId), true, 'Old token must be invalidated');

            // A new token should exist
            const { data: newTokens } = await supabaseAdmin
                .from('user_tokens')
                .select('id, token, used')
                .eq('user_id', user.id)
                .eq('type', 'verification')
                .eq('used', false);

            assert.ok(newTokens && newTokens.length > 0, 'New active token should exist');
            // Track for cleanup
            newTokens.forEach(t => createdTokenIds.push(t.id));

            // New token is also SHA-256 format
            assert.match(newTokens[0].token, /^[0-9a-f]{64}$/, 'New token should be SHA-256 hex');
        });

        test('Resend for already-verified user is rejected', async () => {
            const user = await createTestUser({ isVerified: true });

            const req = makePostRequest({ email: user.email });
            const res = await resendVerification(req);
            const body = await res.json();

            assert.strictEqual(body.success, false);
            assert.ok(body.message.includes('verified'), 'Should indicate already verified');
        });

        test('Resend for unknown email does not reveal user existence', async () => {
            const req = makePostRequest({ email: 'nonexistent@example-localgrow.invalid' });
            const res = await resendVerification(req);
            const body = await res.json();

            // Must return success:true (to avoid enumeration) with generic message
            assert.strictEqual(body.success, true);
        });

        test('Resend request with missing email returns 400', async () => {
            const req = makePostRequest({});
            const res = await resendVerification(req);
            const body = await res.json();

            assert.strictEqual(res.status, 400);
            assert.strictEqual(body.success, false);
            assert.ok(body.message.includes('Email is required'));
        });

    });

    // ──────────────────────────────────────────────────────────────────────
    // Section 4 – NextAuth Credentials enforcement
    // ──────────────────────────────────────────────────────────────────────

    describe('NextAuth: Credentials sign-in verification enforcement', () => {

        test('Credentials authorize throws for unverified user', async () => {
            // Import options to access the authorize function directly
            const { options } = await import('../app/api/auth/[...nextauth]/options.js');
            const credentialsProvider = options.providers.find(p => p.id === 'credentials');
            assert.ok(credentialsProvider, 'Credentials provider should exist');

            // Create a real unverified user in DB
            const email = `unverified_${Date.now()}@example-localgrow.invalid`;
            const bcrypt = await import('bcrypt');
            const hashedPwd = await bcrypt.hash('TestPass123!', 10);

            const { data: user, error: uErr } = await supabaseAdmin
                .from('users')
                .insert({
                    email,
                    username: `unver_${Date.now()}`,
                    password: hashedPwd,
                    full_name: 'Unverified User',
                })
                .select('id')
                .single();
            if (uErr) throw new Error(`setup: ${uErr.message}`);
            createdUserIds.push(user.id);

            await supabaseAdmin.from('user_roles').insert({
                user_id: user.id, role: 'app_user', is_verified: false
            });

            // authorize() must throw for unverified accounts
            await assert.rejects(
                () => credentialsProvider.authorize({ email, password: 'TestPass123!' }),
                (err) => {
                    assert.ok(
                        err.message.includes('verify your email'),
                        `Expected email-verification message, got: ${err.message}`
                    );
                    return true;
                }
            );
        });

        test('Credentials authorize succeeds for verified user', async () => {
            const { options } = await import('../app/api/auth/[...nextauth]/options.js');
            const credentialsProvider = options.providers.find(p => p.id === 'credentials');

            const email = `verified_${Date.now()}@example-localgrow.invalid`;
            const bcrypt = await import('bcrypt');
            const hashedPwd = await bcrypt.hash('TestPass123!', 10);

            const { data: user, error: uErr } = await supabaseAdmin
                .from('users')
                .insert({
                    email,
                    username: `ver_${Date.now()}`,
                    password: hashedPwd,
                    full_name: 'Verified User',
                })
                .select('id')
                .single();
            if (uErr) throw new Error(`setup: ${uErr.message}`);
            createdUserIds.push(user.id);

            await supabaseAdmin.from('user_roles').insert({
                user_id: user.id, role: 'app_user', is_verified: true, is_active: true
            });

            // Also create user_locations row so location check doesn't fail
            await supabaseAdmin.from('user_locations').upsert({
                user_id: user.id, is_primary: true
            }, { onConflict: 'user_id' });

            const result = await credentialsProvider.authorize({ email, password: 'TestPass123!' });
            assert.ok(result, 'authorize should return user object');
            assert.strictEqual(result.email, email);
        });

    });

    // ──────────────────────────────────────────────────────────────────────
    // Section 5 – End-to-End Lifecycle Chain (No-Email Integration)
    // ──────────────────────────────────────────────────────────────────────

    describe('End-to-end verification lifecycle chain', () => {

        test('Complete lifecycle: registration -> login rejected -> token verified -> replay rejected -> login succeeds', async () => {
            const { options } = await import('../app/api/auth/[...nextauth]/options.js');
            const credentialsProvider = options.providers.find(p => p.id === 'credentials');
            assert.ok(credentialsProvider, 'Credentials provider should exist');

            const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
            const email = `chain_${uniqueSuffix}@example-localgrow.invalid`;
            const password = 'ChainTestPassword123!';
            let capturedToken = null;

            // Track email synchronously for guaranteed cleanup recovery in after()
            createdEmails.push(email);

            // 1. Intercept internal email dispatch to capture rawToken in memory without sending emails
            const origFetch = global.fetch;
            try {
                global.fetch = async (url, opts) => {
                    if (opts?.body) {
                        try {
                            const payload = JSON.parse(opts.body);
                            const match = payload.message?.match(/token=([0-9a-f]{64})/);
                            if (match) {
                                capturedToken = match[1];
                            }
                        } catch {
                            // Defensive: ignore body parse errors
                        }
                    }
                    return { json: async () => ({ success: true }) };
                };

                const regReq = makePostRequest({
                    fullname: `Chain User ${uniqueSuffix}`,
                    email,
                    password,
                    mobile_number: '9876543210',
                });

                const regRes = await registerUser(regReq);
                const regBody = await regRes.json();
                assert.ok(regBody.success, `Registration failed: ${regBody.message}`);
            } finally {
                // Guaranteed restoration of global.fetch even if assertions or requests fail
                global.fetch = origFetch;
            }

            // Immediately track user for cleanup as soon as database record is available
            const { data: user, error: userFetchErr } = await supabaseAdmin
                .from('users')
                .select('id')
                .eq('email', email)
                .maybeSingle();

            if (user?.id) {
                createdUserIds.push(user.id);
            }

            assert.ok(user && !userFetchErr, 'User must exist in database after registration');

            // Verify raw token was captured in memory only
            assert.ok(capturedToken, 'Verification token must be captured from registration dispatch');

            // 2. Confirm credentials login is rejected before verification
            await assert.rejects(
                () => credentialsProvider.authorize({ email, password }),
                (err) => {
                    assert.ok(
                        err.message.includes('verify your email'),
                        `Expected email-verification error, got: ${err.message}`
                    );
                    return true;
                }
            );

            // Confirm account is unverified in database
            assert.strictEqual(await getIsVerified(user.id), false, 'Account must be unverified prior to token use');

            // 3. Verify the captured token through the production route and Supabase RPC
            const verifyRes = await verifyEmail(makeGetRequest(capturedToken));
            const verifyBody = await verifyRes.json();
            assert.strictEqual(verifyBody.status, 'ok', 'Token verification must succeed');
            assert.strictEqual(await getIsVerified(user.id), true, 'Account must be verified after token consumption');

            // 4. Confirm replay is rejected
            const replayRes = await verifyEmail(makeGetRequest(capturedToken));
            const replayBody = await replayRes.json();
            assert.strictEqual(replayBody.status, 'used', 'Replay attempt must be rejected');

            // 5. Confirm credentials login succeeds after verification
            const authResult = await credentialsProvider.authorize({ email, password });
            assert.ok(authResult, 'Credentials authorization must return user object after verification');
            assert.strictEqual(authResult.email, email, 'Authorized user email must match');
        });

    });

});
