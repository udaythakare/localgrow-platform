import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateReviewInput, normalizeUserId } from '../helpers/reviewValidation.js';

describe('LocalGrow V2 Sprint 10 Stage 4: Customer Review Validation', () => {
    describe('Session User ID Authentication & Normalization', () => {
        test('Valid string user ID passes and trims whitespace', () => {
            const validId = 'd458fa15-587c-4a6c-a515-9b5b4bd40092';
            assert.equal(normalizeUserId(validId), validId);
            assert.equal(normalizeUserId(`  ${validId}  `), validId);
        });

        test('Truth-y error object from userHelper is rejected as unauthenticated (returns null)', () => {
            const unauthenticatedObject = { msg: 'user not logged in' };
            assert.equal(normalizeUserId(unauthenticatedObject), null);
        });

        test('Null, undefined, and empty/whitespace strings are rejected as unauthenticated (returns null)', () => {
            assert.equal(normalizeUserId(null), null);
            assert.equal(normalizeUserId(undefined), null);
            assert.equal(normalizeUserId(''), null);
            assert.equal(normalizeUserId('   '), null);
        });

        test('Non-string types (numbers, booleans, arrays) are rejected (returns null)', () => {
            assert.equal(normalizeUserId(12345), null);
            assert.equal(normalizeUserId(true), null);
            assert.equal(normalizeUserId(['some-id']), null);
        });
    });

    describe('Rating Validation', () => {
        test('Valid ratings (1-5) pass', () => {
            for (let i = 1; i <= 5; i++) {
                const res = validateReviewInput(i, null);
                assert.equal(res.valid, true);
            }
        });

        test('Rating below 1 fails', () => {
            const res = validateReviewInput(0, null);
            assert.equal(res.valid, false);
            assert.match(res.message, /between 1 and 5/);
        });

        test('Rating above 5 fails', () => {
            const res = validateReviewInput(6, null);
            assert.equal(res.valid, false);
            assert.match(res.message, /between 1 and 5/);
        });

        test('Non-integer rating fails', () => {
            const res = validateReviewInput(4.5, null);
            assert.equal(res.valid, false);
            assert.match(res.message, /integer between 1 and 5/);
        });
    });

    describe('Comment Validation', () => {
        test('Comment length up to 1000 passes', () => {
            const res = validateReviewInput(5, 'A'.repeat(1000));
            assert.equal(res.valid, true);
        });

        test('Comment length over 1000 fails', () => {
            const res = validateReviewInput(5, 'A'.repeat(1001));
            assert.equal(res.valid, false);
            assert.match(res.message, /cannot exceed 1000/);
        });

        test('Null or empty comment passes', () => {
            let res = validateReviewInput(5, null);
            assert.equal(res.valid, true);

            res = validateReviewInput(5, '');
            assert.equal(res.valid, true);
        });
    });
});
