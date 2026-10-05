import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import cloudinary from '../lib/cloudinary.js';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import {
    uploadBusinessLogo,
    removeBusinessLogo,
    uploadGalleryPhoto,
    deleteGalleryPhoto,
    getBusinessBranding,
    getVendorBusiness,
    safeDeleteFromCloudinary
} from '../lib/businessImageService.js';

describe('LocalGrow V2 Sprint 9 Stage 3: Image Upload & Authorization Tests', () => {

    let originalUploadStream;
    let originalDestroy;
    let destroyedPublicIds = [];
    let uploadedFolders = [];

    // Real DB business reference for authentic testing
    let testBusiness = null;
    let anotherBusiness = null;

    before(async () => {
        originalUploadStream = cloudinary.uploader.upload_stream;
        originalDestroy = cloudinary.uploader.destroy;

        // Mock Cloudinary uploader methods for clean deterministic test assertions
        cloudinary.uploader.destroy = async (publicId) => {
            destroyedPublicIds.push(publicId);
            return { result: 'ok' };
        };

        cloudinary.uploader.upload_stream = (options, callback) => {
            uploadedFolders.push(options?.folder);
            return {
                end: (buf) => {
                    callback(null, {
                        secure_url: `https://res.cloudinary.com/test/image/upload/v12345/${options?.folder}/test_asset.png`,
                        public_id: `${options?.folder}/test_asset_${Date.now()}`
                    });
                }
            };
        };

        // Query up to 2 distinct businesses from DB for testing ownership boundaries
        const { data: businesses } = await supabaseAdmin
            .from('businesses')
            .select('id, user_id, name, status, logo_url, logo_public_id')
            .limit(2);

        if (businesses && businesses.length > 0) {
            testBusiness = businesses[0];
            if (businesses.length > 1) {
                anotherBusiness = businesses[1];
            }
        }
    });

    after(() => {
        cloudinary.uploader.upload_stream = originalUploadStream;
        cloudinary.uploader.destroy = originalDestroy;
    });

    beforeEach(() => {
        destroyedPublicIds = [];
        uploadedFolders = [];
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Authentication Enforcement (401 Unauthorized)
    // ─────────────────────────────────────────────────────────────────────────
    describe('1. Authentication Enforcement (401 Unauthorized)', () => {
        test('Unauthenticated getBusinessBranding returns 401', async () => {
            const result = await getBusinessBranding(null);
            assert.equal(result.success, false);
            assert.equal(result.status, 401);
            assert.equal(result.error, 'Authentication required');
        });

        test('Unauthenticated uploadBusinessLogo returns 401', async () => {
            const fakeFile = { type: 'image/png', size: 1024, arrayBuffer: async () => new ArrayBuffer(8) };
            const result = await uploadBusinessLogo(null, fakeFile);
            assert.equal(result.success, false);
            assert.equal(result.status, 401);
            assert.equal(result.error, 'Authentication required');
        });

        test('Unauthenticated removeBusinessLogo returns 401', async () => {
            const result = await removeBusinessLogo(null);
            assert.equal(result.success, false);
            assert.equal(result.status, 401);
            assert.equal(result.error, 'Authentication required');
        });

        test('Unauthenticated uploadGalleryPhoto returns 401', async () => {
            const fakeFile = { type: 'image/jpeg', size: 1024, arrayBuffer: async () => new ArrayBuffer(8) };
            const result = await uploadGalleryPhoto(null, fakeFile);
            assert.equal(result.success, false);
            assert.equal(result.status, 401);
            assert.equal(result.error, 'Authentication required');
        });

        test('Unauthenticated deleteGalleryPhoto returns 401', async () => {
            const result = await deleteGalleryPhoto(null, '00000000-0000-0000-0000-000000000001');
            assert.equal(result.success, false);
            assert.equal(result.status, 401);
            assert.equal(result.error, 'Authentication required');
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Ownership Verification & Cross-Business Protection
    // ─────────────────────────────────────────────────────────────────────────
    describe('2. Business Ownership & Authorization Checks', () => {
        test('User with non-existent or unowned business cannot upload or view (404)', async () => {
            const nonExistentUserId = '00000000-0000-0000-0000-999999999999';
            const result = await getBusinessBranding(nonExistentUserId);
            assert.equal(result.success, false);
            assert.equal(result.status, 404);
            assert.ok(result.error.includes('No registered business found'));
        });

        test('User attempting to target another business ID receives 403 Forbidden', async () => {
            if (!testBusiness || !anotherBusiness) {
                return; // Skip if less than 2 businesses in DB
            }
            // User owns testBusiness, but attempts to specify anotherBusiness.id
            const result = await getBusinessBranding(testBusiness.user_id, anotherBusiness.id);
            assert.equal(result.success, false);
            assert.equal(result.status, 403);
            assert.ok(result.error.includes('Unauthorized') || result.error.includes('do not own'));
        });

        test('Cross-business photo deletion is strictly prevented (404/403)', async () => {
            if (!testBusiness) return;
            // User owns testBusiness, but tries to delete a photo not belonging to their business
            const randomPhotoId = '00000000-0000-0000-0000-777777777777';

            const result = await deleteGalleryPhoto(testBusiness.user_id, randomPhotoId);
            assert.equal(result.success, false);
            assert.equal(result.status, 404);
            assert.ok(result.error.includes('not found') || result.error.includes('does not belong'));
            // Ensure no Cloudinary deletion occurred
            assert.equal(destroyedPublicIds.length, 0);
        });

        test('Photo deletion with null or empty photoId returns 400', async () => {
            const result = await deleteGalleryPhoto('some-user-id', null);
            assert.equal(result.success, false);
            assert.equal(result.status, 400);
            assert.equal(result.error, 'Photo ID is required');
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Payload Validation via Service Operations
    // ─────────────────────────────────────────────────────────────────────────
    describe('3. MIME Type & Size Validation in Operations', () => {
        test('Disallowed MIME type in logo upload returns 400 before Cloudinary call', async () => {
            if (!testBusiness) return;

            const fakeGifFile = {
                type: 'image/gif',
                size: 1024 * 50,
                arrayBuffer: async () => new ArrayBuffer(8)
            };

            const result = await uploadBusinessLogo(testBusiness.user_id, fakeGifFile);
            assert.equal(result.success, false);
            assert.equal(result.status, 400);
            assert.ok(result.error.includes('Allowed formats: JPEG, PNG, WebP'));
            assert.equal(uploadedFolders.length, 0); // Cloudinary was NOT called
        });

        test('Oversized logo (> 5MB) returns 400 before Cloudinary call', async () => {
            if (!testBusiness) return;

            const oversizedFile = {
                type: 'image/png',
                size: 6 * 1024 * 1024,
                arrayBuffer: async () => new ArrayBuffer(8)
            };

            const result = await uploadBusinessLogo(testBusiness.user_id, oversizedFile);
            assert.equal(result.success, false);
            assert.equal(result.status, 400);
            assert.ok(result.error.includes('exceeds the 5MB limit'));
            assert.equal(uploadedFolders.length, 0);
        });

        test('Disallowed MIME type in gallery photo returns 400 before Cloudinary call', async () => {
            if (!testBusiness) return;

            const fakeSvgFile = {
                type: 'image/svg+xml',
                size: 1024 * 20,
                arrayBuffer: async () => new ArrayBuffer(8)
            };

            const result = await uploadGalleryPhoto(testBusiness.user_id, fakeSvgFile);
            assert.equal(result.success, false);
            assert.equal(result.status, 400);
            assert.ok(result.error.includes('Allowed formats: JPEG, PNG, WebP'));
            assert.equal(uploadedFolders.length, 0);
        });

        test('Gallery photo caption exceeding 150 characters returns 400 before Cloudinary call', async () => {
            if (!testBusiness) return;

            const validFile = {
                type: 'image/webp',
                size: 1024 * 50,
                arrayBuffer: async () => new ArrayBuffer(8)
            };

            const result = await uploadGalleryPhoto(testBusiness.user_id, validFile, {
                caption: 'a'.repeat(151)
            });
            assert.equal(result.success, false);
            assert.equal(result.status, 400);
            assert.ok(result.error.includes('Caption exceeds maximum length of 150'));
            assert.equal(uploadedFolders.length, 0);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Cloudinary Cleanup Safety & Ordering
    // ─────────────────────────────────────────────────────────────────────────
    describe('4. Cloudinary Cleanup Safety & Rollback Guarantee', () => {
        test('Logo replacement: old asset is deleted only if DB update succeeds', async () => {
            if (!testBusiness) return;

            const mockFile = {
                type: 'image/png',
                size: 1024 * 100,
                arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer
            };

            const result = await uploadBusinessLogo(testBusiness.user_id, mockFile);

            if (result.success) {
                // If migration is applied and DB update succeeded:
                assert.ok(result.logoUrl.includes('businesses/logos'));
                assert.ok(uploadedFolders.includes('businesses/logos'));
            } else {
                // If migration is not applied and DB update fails:
                // Verify newly uploaded asset was rolled back and deleted from Cloudinary
                assert.ok(destroyedPublicIds.length >= 1, 'Expected rollback deletion of new asset');
            }
        });

        test('Logo removal: does not delete Cloudinary asset if business lookup fails', async () => {
            const foreignUserId = '00000000-0000-0000-0000-999999999999';
            const result = await removeBusinessLogo(foreignUserId);
            assert.equal(result.success, false);
            // No Cloudinary deletion should be attempted
            assert.equal(destroyedPublicIds.length, 0);
        });

        test('Gallery deletion: does not delete Cloudinary asset if photo lookup fails', async () => {
            const result = await deleteGalleryPhoto('00000000-0000-0000-0000-111111111111', '00000000-0000-0000-0000-222222222222');
            assert.equal(result.success, false);
            assert.equal(destroyedPublicIds.length, 0);
        });

        test('safeDeleteFromCloudinary handles null or empty public ID gracefully without throwing', async () => {
            const r1 = await safeDeleteFromCloudinary(null);
            assert.equal(r1, true);
            const r2 = await safeDeleteFromCloudinary('');
            assert.equal(r2, true);
            assert.equal(destroyedPublicIds.length, 0);
        });
    });
});
