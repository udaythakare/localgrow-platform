import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    validateImageFile,
    validateCaption,
    validateDisplayOrder,
    ALLOWED_IMAGE_MIME_TYPES,
    MAX_LOGO_SIZE_BYTES,
    MAX_PHOTO_SIZE_BYTES,
    MAX_GALLERY_PHOTOS,
    MAX_CAPTION_LENGTH
} from '../lib/validations/businessImageValidation.js';

describe('LocalGrow V2 Sprint 9 Stage 3: Business Image Validation Tests', () => {

    describe('1. MIME Type Validation', () => {
        test('Allowed image formats (JPEG, PNG, WebP) pass validation', () => {
            const validMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
            for (const mime of validMimes) {
                const file = { type: mime, size: 1024 * 500 }; // 500 KB
                const result = validateImageFile(file, { label: 'Logo' });
                assert.equal(result.valid, true, `Expected ${mime} to be valid`);
            }
        });

        test('Case-insensitivity: uppercase and mixed-case MIME types pass', () => {
            const file = { type: 'IMAGE/JPEG', size: 1024 * 500 };
            const result = validateImageFile(file);
            assert.equal(result.valid, true);
        });

        test('Disallowed formats (GIF, SVG, PDF, Executables) are rejected', () => {
            const invalidMimes = [
                'image/gif',
                'image/svg+xml',
                'application/pdf',
                'application/octet-stream',
                'text/plain',
                'image/bmp'
            ];
            for (const mime of invalidMimes) {
                const file = { type: mime, size: 1024 * 500 };
                const result = validateImageFile(file, { label: 'Image' });
                assert.equal(result.valid, false, `Expected ${mime} to be rejected`);
                assert.ok(result.error.includes('Allowed formats: JPEG, PNG, WebP'));
            }
        });

        test('Missing or empty file parameter is rejected', () => {
            assert.equal(validateImageFile(null).valid, false);
            assert.equal(validateImageFile(undefined).valid, false);
        });

        test('File with 0 bytes is rejected', () => {
            const file = { type: 'image/png', size: 0 };
            const result = validateImageFile(file, { label: 'Logo' });
            assert.equal(result.valid, false);
            assert.ok(result.error.includes('empty'));
        });
    });

    describe('2. File Size Limits', () => {
        test('Logo size: <= 5MB passes validation', () => {
            const fileAtLimit = { type: 'image/png', size: MAX_LOGO_SIZE_BYTES };
            assert.equal(validateImageFile(fileAtLimit, { maxSize: MAX_LOGO_SIZE_BYTES, label: 'Logo' }).valid, true);

            const fileUnderLimit = { type: 'image/jpeg', size: 1024 * 1024 * 2 }; // 2MB
            assert.equal(validateImageFile(fileUnderLimit, { maxSize: MAX_LOGO_SIZE_BYTES, label: 'Logo' }).valid, true);
        });

        test('Logo size: > 5MB is rejected with clear error', () => {
            const fileOverLimit = { type: 'image/png', size: MAX_LOGO_SIZE_BYTES + 1 };
            const result = validateImageFile(fileOverLimit, { maxSize: MAX_LOGO_SIZE_BYTES, label: 'Logo' });
            assert.equal(result.valid, false);
            assert.ok(result.error.includes('exceeds the 5MB limit'));
        });

        test('Gallery photo size: <= 10MB passes validation', () => {
            const fileAtLimit = { type: 'image/webp', size: MAX_PHOTO_SIZE_BYTES };
            assert.equal(validateImageFile(fileAtLimit, { maxSize: MAX_PHOTO_SIZE_BYTES, label: 'Gallery photo' }).valid, true);
        });

        test('Gallery photo size: > 10MB is rejected with clear error', () => {
            const fileOverLimit = { type: 'image/jpeg', size: MAX_PHOTO_SIZE_BYTES + 1024 };
            const result = validateImageFile(fileOverLimit, { maxSize: MAX_PHOTO_SIZE_BYTES, label: 'Gallery photo' });
            assert.equal(result.valid, false);
            assert.ok(result.error.includes('exceeds the 10MB limit'));
        });
    });

    describe('3. Caption Validation & Sanitization', () => {
        test('Null, undefined, and empty string captions sanitize to null', () => {
            assert.deepEqual(validateCaption(null), { valid: true, sanitized: null });
            assert.deepEqual(validateCaption(undefined), { valid: true, sanitized: null });
            assert.deepEqual(validateCaption(''), { valid: true, sanitized: null });
            assert.deepEqual(validateCaption('   '), { valid: true, sanitized: null });
        });

        test('Valid captions up to 150 characters pass and are trimmed', () => {
            const caption = '  Our cozy storefront in Mumbai  ';
            const result = validateCaption(caption);
            assert.equal(result.valid, true);
            assert.equal(result.sanitized, 'Our cozy storefront in Mumbai');

            const exact150 = 'a'.repeat(MAX_CAPTION_LENGTH);
            assert.equal(validateCaption(exact150).valid, true);
            assert.equal(validateCaption(exact150).sanitized.length, 150);
        });

        test('Captions exceeding 150 characters are rejected', () => {
            const overLimit = 'x'.repeat(MAX_CAPTION_LENGTH + 1);
            const result = validateCaption(overLimit);
            assert.equal(result.valid, false);
            assert.ok(result.error.includes(`exceeds maximum length of ${MAX_CAPTION_LENGTH}`));
        });

        test('Non-string captions are rejected', () => {
            assert.equal(validateCaption(12345).valid, false);
            assert.equal(validateCaption({}).valid, false);
        });
    });

    describe('4. Display Order Validation', () => {
        test('Null/undefined/empty string defaults to order 0', () => {
            assert.deepEqual(validateDisplayOrder(null), { valid: true, order: 0 });
            assert.deepEqual(validateDisplayOrder(undefined), { valid: true, order: 0 });
            assert.deepEqual(validateDisplayOrder(''), { valid: true, order: 0 });
        });

        test('Non-negative integers pass validation', () => {
            assert.deepEqual(validateDisplayOrder(0), { valid: true, order: 0 });
            assert.deepEqual(validateDisplayOrder(1), { valid: true, order: 1 });
            assert.deepEqual(validateDisplayOrder('5'), { valid: true, order: 5 });
        });

        test('Negative integers and decimals are rejected', () => {
            assert.equal(validateDisplayOrder(-1).valid, false);
            assert.equal(validateDisplayOrder(2.5).valid, false);
            assert.equal(validateDisplayOrder('invalid').valid, false);
        });
    });
});
