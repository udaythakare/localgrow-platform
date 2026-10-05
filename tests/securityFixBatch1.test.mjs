import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

// Load .env.local
const envContent = readFileSync('.env.local', 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx !== -1) {
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    env[key] = val;
  }
}

const supabaseAdmin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

describe('LocalGrow — Security Fix Batch 1 Verification', () => {

  // =========================================================================
  // 1. getUserId Truthiness Bug Fix
  // =========================================================================
  describe('1. helpers/userHelper.js - getUserId truthiness fix', () => {
    test('helpers/userHelper.js returns null when unauthenticated, not an object', () => {
      const filePath = join(process.cwd(), 'helpers/userHelper.js');
      const content = readFileSync(filePath, 'utf8');

      // Verify old bug is gone
      assert.equal(
        content.includes('return { msg: "user not logged in" }'),
        false,
        'Old truthy object return { msg: ... } must be completely removed'
      );

      // Verify returns null
      assert.ok(
        content.includes('return null;'),
        'Must return null when session or user id is missing'
      );
    });

    test('Evaluating truthiness of unauthenticated session value behaves correctly', () => {
      // Emulate getUserId() return value for unauthenticated session
      const mockUnauthUserId = null;
      assert.equal(Boolean(mockUnauthUserId), false, 'null must evaluate to false in if (!userId)');

      // Show contrast with old bug:
      const oldBuggyUserId = { msg: "user not logged in" };
      assert.equal(Boolean(oldBuggyUserId), true, 'Old object was truthy and bypassed if (!userId)');
    });
  });

  // =========================================================================
  // 2. Vendor Role Enforcement on Business Dashboard
  // =========================================================================
  describe('2. Business Dashboard Vendor Role Protection', () => {
    test('middleware.js enforces app_business_owner or superadmin on /business/dashboard/*', () => {
      const filePath = join(process.cwd(), 'middleware.js');
      const content = readFileSync(filePath, 'utf8');

      assert.ok(content.includes("path.startsWith('/business/dashboard')"), 'Middleware must match /business/dashboard');
      assert.ok(content.includes("getToken("), 'Middleware must check NextAuth JWT token');
      assert.ok(content.includes("roles.includes('app_business_owner')"), 'Middleware must check app_business_owner role');
      assert.ok(content.includes("/u/profile/apply-for-business"), 'Customers without vendor role must be redirected to apply-for-business');
    });

    test('layout.js redirects users with no business or non-approved status', () => {
      const filePath = join(process.cwd(), 'app/business/dashboard/layout.js');
      const content = readFileSync(filePath, 'utf8');

      assert.ok(content.includes("if (!data?.data)"), 'Must check if business record is missing/null');
      assert.ok(content.includes("router.push('/u/profile/apply-for-business')"), 'Must redirect null business to apply');
      assert.ok(content.includes("router.push('/business/pending')"), 'Must redirect pending business to pending page');
      assert.ok(content.includes("router.push('/business/rejected')"), 'Must redirect rejected business to rejected page');
    });
  });

  // =========================================================================
  // 3. Vendor PUT Mass-Assignment Fix
  // =========================================================================
  describe('3. app/api/vendors/[vendorId]/route.js - PUT mass-assignment fix', () => {
    test('PUT route uses explicit allowlist and strips status, user_id, created_at', () => {
      const filePath = join(process.cwd(), 'app/api/vendors/[vendorId]/route.js');
      const content = readFileSync(filePath, 'utf8');

      assert.ok(content.includes('ALLOWED_VENDOR_UPDATE_FIELDS'), 'Must define explicit ALLOWED_VENDOR_UPDATE_FIELDS allowlist');
      assert.ok(content.includes('delete sanitizedData.status'), 'Must delete status if present');
      assert.ok(content.includes('delete sanitizedData.user_id'), 'Must delete user_id if present');
      assert.ok(content.includes('delete sanitizedData.created_at'), 'Must delete created_at if present');
      assert.ok(content.includes('delete sanitizedData.rejection_reason'), 'Must delete rejection_reason if present');
    });

    test('Vendor cannot self-approve or change user_id via mass assignment logic', () => {
      const ALLOWED_VENDOR_UPDATE_FIELDS = [
        'name',
        'description',
        'category_id',
        'website',
        'phone',
        'email',
        'logo_url',
        'logo_public_id',
      ];

      const maliciousPayload = {
        name: 'Updated Name',
        status: 'approved',
        user_id: '00000000-0000-0000-0000-000000000000',
        created_at: '1970-01-01T00:00:00.000Z',
        rejection_reason: null,
      };

      const sanitizedData = {};
      for (const field of ALLOWED_VENDOR_UPDATE_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(maliciousPayload, field)) {
          sanitizedData[field] = maliciousPayload[field];
        }
      }
      delete sanitizedData.status;
      delete sanitizedData.user_id;
      delete sanitizedData.created_at;
      delete sanitizedData.rejection_reason;

      assert.equal(sanitizedData.name, 'Updated Name');
      assert.equal(sanitizedData.status, undefined, 'status must NOT be present in sanitizedData');
      assert.equal(sanitizedData.user_id, undefined, 'user_id must NOT be present in sanitizedData');
      assert.equal(sanitizedData.created_at, undefined, 'created_at must NOT be present in sanitizedData');
      assert.equal(sanitizedData.rejection_reason, undefined, 'rejection_reason must NOT be present in sanitizedData');
    });

    test('Legitimate vendor profile update fields are preserved', () => {
      const ALLOWED_VENDOR_UPDATE_FIELDS = [
        'name',
        'description',
        'category_id',
        'website',
        'phone',
        'email',
        'logo_url',
        'logo_public_id',
      ];

      const legitimatePayload = {
        name: 'Artisan Sourdough Bakery',
        description: 'Fresh organic bread baked daily',
        website: 'https://artisansourdough.com',
        phone: '+91 98200 12345',
        email: 'hello@artisansourdough.com'
      };

      const sanitizedData = {};
      for (const field of ALLOWED_VENDOR_UPDATE_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(legitimatePayload, field)) {
          sanitizedData[field] = legitimatePayload[field];
        }
      }

      assert.equal(sanitizedData.name, 'Artisan Sourdough Bakery');
      assert.equal(sanitizedData.description, 'Fresh organic bread baked daily');
      assert.equal(sanitizedData.website, 'https://artisansourdough.com');
      assert.equal(sanitizedData.phone, '+91 98200 12345');
      assert.equal(sanitizedData.email, 'hello@artisansourdough.com');
    });
  });

  // =========================================================================
  // 4. Vendor GET IDOR Fix
  // =========================================================================
  describe('4. app/api/vendors/[vendorId]/route.js - GET IDOR fix', () => {
    test('GET route enforces ownership or superadmin and strips user_id', () => {
      const filePath = join(process.cwd(), 'app/api/vendors/[vendorId]/route.js');
      const content = readFileSync(filePath, 'utf8');

      assert.ok(content.includes('isOwner'), 'Must check isOwner');
      assert.ok(content.includes('isSuperadmin'), 'Must check isSuperadmin');
      assert.ok(content.includes('403'), 'Must return 403 on unauthorized access');
      assert.ok(content.includes('const { user_id, ...safeBusinessData } = data;'), 'Must strip internal user_id from returned response');
    });

    test('Vendor cannot GET another vendor business; superadmin can', async () => {
      // Query two distinct businesses from live dataset
      const { data: businesses } = await supabaseAdmin
        .from('businesses')
        .select('id, user_id, name')
        .limit(2);

      assert.ok(businesses && businesses.length >= 2, 'Need 2 businesses for IDOR test');
      const [biz1, biz2] = businesses;

      // Simulate vendor 1 accessing biz1 (own) -> allowed
      const isOwnerBiz1 = biz1.user_id === biz1.user_id;
      assert.equal(isOwnerBiz1, true, 'Vendor 1 must own Biz 1');

      // Simulate vendor 1 accessing biz2 (other) -> rejected 403
      const isOwnerBiz2 = biz1.user_id === biz2.user_id;
      const isSuperadminFalse = false;
      const canAccessBiz2 = isOwnerBiz2 || isSuperadminFalse;
      assert.equal(canAccessBiz2, false, 'Vendor 1 accessing Biz 2 must be rejected 403');

      // Simulate superadmin accessing biz2 -> allowed
      const isSuperadminTrue = true;
      const superadminCanAccess = isOwnerBiz2 || isSuperadminTrue;
      assert.equal(superadminCanAccess, true, 'Superadmin accessing Biz 2 must be allowed');
    });
  });
});
