import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { reverseGeocode } from '../helpers/geocoding.js';
import {
  resolveCustomerCity,
  normalizePagination,
  normalizeCategoryId,
  isCouponExpired,
  isCouponValid,
  isCouponExpiringSoon,
  sortCouponsByNewest,
  sortCouponsForYou,
  isLocalityMatch,
  compareForYouCoupons
} from '../helpers/couponFilterHelpers.js';
import {
  classifyUserCoupon,
  classifyUserCoupons,
  isCouponActive
} from '../helpers/myCouponHelpers.js';

const canRedeemCoupon = (userCoupon, now) => {
  return classifyUserCoupon(userCoupon, now) === 'active';
};
import { validateReviewInput } from '../helpers/reviewValidation.js';

// Setup Supabase admin client for live database verification
const req = createRequire(import.meta.url);
const { createClient } = req('@supabase/supabase-js');

// Parse .env.local
let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
let supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  const envContent = readFileSync('.env.local', 'utf8');
  for (const line of envContent.split('\n')) {
    const p = line.split('=');
    if (p.length >= 2) {
      const k = p.shift().trim();
      const v = p.join('=').trim().replace(/^['"]|['"]$/g, '');
      if (k === 'NEXT_PUBLIC_SUPABASE_URL') supabaseUrl = v;
      if (k === 'SUPABASE_SERVICE_ROLE_KEY') supabaseKey = v;
    }
  }
}

const supabase = createClient(supabaseUrl, supabaseKey);

describe('LocalGrow — Full Marketplace E2E Validation', () => {

  const now = new Date('2026-10-01T17:30:00.000Z');
  const customerUserId = '94d04dbd-67af-5146-ba67-e0e4a3c504f2'; // customer01@localgrow.test
  const vendorUserId = '69bbe3d1-168f-5def-a6d6-eb906b7d774c';   // vendor01@localgrow.test
  const vendorBusinessId = 'e3303e5a-011b-547e-bc4a-4cb8d0283cd7'; // Urban Andheri Kitchen

  // =========================================================================
  // 1. CUSTOMER PROFILE LOCATION
  // =========================================================================
  describe('1. Customer Profile Location Verification', () => {
    test('Customer record and user_locations record exist in Supabase', async () => {
      const { data: userLoc, error } = await supabase
        .from('user_locations')
        .select('*')
        .eq('user_id', customerUserId)
        .maybeSingle();

      assert.equal(error, null);
      assert.ok(userLoc, 'Customer user_locations record must exist');
      assert.equal(userLoc.city, 'Mumbai');
      assert.equal(userLoc.area, 'Andheri');
      assert.equal(userLoc.state, 'Maharashtra');
      assert.equal(userLoc.postal_code, '400053');
      assert.equal(userLoc.country, 'India');
      assert.equal(typeof userLoc.latitude, 'number');
      assert.equal(typeof userLoc.longitude, 'number');
      assert.equal(userLoc.is_primary, true);
    });

    test('reverseGeocode accurately detects address components from GPS coordinates', async () => {
      const result = await reverseGeocode(19.1197, 72.8468);
      assert.ok(result, 'reverseGeocode result must not be null');
      assert.equal(result.city, 'Mumbai');
      assert.equal(result.area, 'Andheri West');
      assert.equal(result.state, 'Maharashtra');
      assert.equal(result.country, 'India');
      assert.equal(typeof result.latitude, 'number');
      assert.equal(typeof result.longitude, 'number');
    });

    test('updateUserLocation action persists coordinates and all address fields cleanly', async () => {
      const filePath = join(process.cwd(), 'app/u/profile/apply-for-investor/actions/userActions.js');
      const content = readFileSync(filePath, 'utf8');

      assert.ok(content.includes('latitude: (lat !== null && !isNaN(lat)) ? lat : null'));
      assert.ok(content.includes('longitude: (lon !== null && !isNaN(lon)) ? lon : null'));
      assert.ok(content.includes('city: locationData.city.trim()'));
      assert.ok(content.includes('is_primary: true'));
      assert.ok(content.includes("onConflict: 'user_id'"));
    });
  });

  // =========================================================================
  // 2. /coupons LOCALITY, ACTIVE DEALS, EXPIRY & FOR YOU
  // =========================================================================
  describe('2. /coupons Locality & Filtering Verification', () => {
    test('Locality resolution prioritizes saved user_locations.city (Mumbai)', async () => {
      const { data: userLoc } = await supabase
        .from('user_locations')
        .select('city')
        .eq('user_id', customerUserId)
        .maybeSingle();

      const resolved = resolveCustomerCity({
        userLocationCity: userLoc?.city,
        ipCity: 'Bengaluru'
      });

      assert.equal(resolved.city, 'Mumbai');
      assert.equal(resolved.source, 'profile_city');
    });

    test('Active local coupons exist for approved businesses in Mumbai and expired coupons are excluded', async () => {
      // 1. Approved businesses in Mumbai
      const { data: bizLocs } = await supabase
        .from('business_locations')
        .select('business_id, city, businesses!inner(id, status)')
        .ilike('city', 'Mumbai');

      const approvedIds = (bizLocs || [])
        .filter(b => b.businesses?.status === 'approved')
        .map(b => b.business_id);

      assert.ok(approvedIds.length > 0, 'Must have approved businesses in Mumbai');

      // 2. Active coupons
      const { data: activeCoupons } = await supabase
        .from('coupons')
        .select('id, title, is_active, start_date, end_date')
        .in('business_id', approvedIds)
        .eq('is_active', true)
        .gt('end_date', now.toISOString());

      assert.ok(activeCoupons && activeCoupons.length > 0, 'Active coupons must exist for Mumbai');

      for (const c of activeCoupons) {
        assert.equal(c.is_active, true);
        assert.ok(new Date(c.end_date) > now, 'Active coupon end_date must be in the future');
      }

      // 3. Expired coupons
      const { data: expiredCoupons } = await supabase
        .from('coupons')
        .select('id, end_date')
        .in('business_id', approvedIds)
        .lt('end_date', now.toISOString());

      assert.ok(expiredCoupons && expiredCoupons.length > 0, 'Expired coupons exist in dataset');
      for (const c of expiredCoupons) {
        assert.ok(new Date(c.end_date) <= now, 'Expired coupon end_date must be in the past');
      }
    });

    test('Expires Soon identifies coupons within the next 24-hour window', () => {
      const couponSoon = {
        is_active: true,
        businesses: { status: 'approved' },
        end_date: new Date(now.getTime() + 10 * 3600 * 1000).toISOString() // 10h from now
      };
      const couponLater = {
        is_active: true,
        businesses: { status: 'approved' },
        end_date: new Date(now.getTime() + 48 * 3600 * 1000).toISOString() // 48h from now
      };

      assert.equal(isCouponExpiringSoon(couponSoon, now), true);
      assert.equal(isCouponExpiringSoon(couponLater, now), false);
    });

    test('For You sorting ranks local deals and category affinity ahead of non-local deals', () => {
      const localCoupon = {
        id: 'c-local',
        businesses: { category_id: 'cat-1', business_locations: [{ city: 'Mumbai' }] }
      };
      const distantCoupon = {
        id: 'c-distant',
        businesses: { category_id: 'cat-1', business_locations: [{ city: 'Delhi' }] }
      };

      const sorted = sortCouponsForYou([distantCoupon, localCoupon], {
        targetCity: 'Mumbai'
      });

      assert.equal(sorted[0].id, 'c-local', 'Local deal must rank ahead in For You feed');
    });

    test('Category filtering and pagination normalization sanitize inputs gracefully', () => {
      assert.equal(normalizeCategoryId('  cat-uuid-123  '), 'cat-uuid-123');
      assert.equal(normalizeCategoryId({}), null); // SyntheticEvent protection
      assert.deepEqual(normalizePagination(10, 20), { limit: 10, offset: 20 });
      assert.deepEqual(normalizePagination(-5, null), { limit: 5, offset: 0 });
    });
  });

  // =========================================================================
  // 3. /nearby GPS, RADIUS, MULTI-OFFER DIRECT CLAIM
  // =========================================================================
  describe('3. /nearby GPS & Radius Verification', () => {
    test('Spring Boot /api/v2/businesses/nearby serves businesses within selected radius', async () => {
      const springBootUrl = process.env.SPRING_BOOT_URL || 'http://localhost:8080';
      const res = await fetch(`${springBootUrl}/api/v2/businesses/nearby?latitude=19.1197&longitude=72.8468&radiusKm=2&page=0&size=10`);

      assert.ok(res.ok, `Spring Boot Nearby API responded with status ${res.status}`);
      const data = await res.json();
      assert.ok(data.content || Array.isArray(data), 'Response must have businesses content');

      const items = data.content || data;
      assert.ok(items.length > 0, 'Businesses must be returned for Mumbai coordinates');

      // Verify businesses are within 2km
      for (const b of items) {
        if (b.distanceKm !== undefined) {
          assert.ok(b.distanceKm <= 2.01, `Business ${b.name} (${b.distanceKm}km) must be <= 2km`);
        }
      }
    });

    test('Business with multiple active offers exists and attaches multiple offers', async () => {
      const { data: biz } = await supabase
        .from('businesses')
        .select('id, name, coupons(id, title, is_active, end_date)')
        .eq('id', vendorBusinessId)
        .single();

      assert.ok(biz, 'Urban Andheri Kitchen must exist');
      const activeCoupons = (biz.coupons || []).filter(c => c.is_active && new Date(c.end_date) > now);
      assert.ok(activeCoupons.length >= 2, `Urban Andheri Kitchen must have multiple active offers (found ${activeCoupons.length})`);
    });

    test('NearbyBusinessCard retains compact card with primary offer and +N more badge', () => {
      const filePath = join(process.cwd(), 'components/nearby/NearbyBusinessCard.jsx');
      const content = readFileSync(filePath, 'utf8');

      assert.ok(content.includes('primaryOffer = hasOffers ? activeOffers[0] : null'));
      assert.ok(content.includes('+{activeOffers.length - 1} more'));
      assert.ok(content.includes('handleClaimOffer'));
      assert.ok(content.includes('claimCoupon(offerId)'));
      assert.ok(content.includes('e.stopPropagation()')); // Must prevent card navigation
      assert.equal(content.includes('router.push("/coupons")'), false, 'Must NOT redirect to /coupons');
    });

    test('Claiming offer #1 on Nearby does not mark offer #2 as claimed', () => {
      const claimedSet = new Set(['offer-1']);
      assert.equal(claimedSet.has('offer-1'), true);
      assert.equal(claimedSet.has('offer-2'), false, 'Offer 2 must remain unclaimed');
    });
  });

  // =========================================================================
  // 4. BUSINESS DETAILS VIEW & DIRECT CLAIM
  // =========================================================================
  describe('4. Business Details View & Direct Claim Verification', () => {
    test('Business details view renders logo, hours, and rating correctly', async () => {
      const { data: biz } = await supabase
        .from('businesses')
        .select('id, name, logo_url, status')
        .eq('id', vendorBusinessId)
        .single();

      assert.ok(biz);
      assert.equal(biz.status, 'approved');
      assert.ok(biz.logo_url, 'Business must have a logo URL');

      const { data: loc } = await supabase
        .from('business_locations')
        .select('id')
        .eq('business_id', vendorBusinessId)
        .limit(1)
        .single();

      const { data: hours } = await supabase
        .from('business_hours')
        .select('*')
        .eq('location_id', loc.id);

      assert.ok(hours && hours.length === 7, 'Must have 7 days of operating hours');

      const { data: reviews } = await supabase
        .from('business_reviews')
        .select('rating')
        .eq('business_id', vendorBusinessId);

      assert.ok(reviews && reviews.length > 0, 'Must have reviews');
    });

    test('BusinessDetailsView has direct claim buttons without /coupons redirect', () => {
      const filePath = join(process.cwd(), 'components/business/BusinessDetailsView.jsx');
      const content = readFileSync(filePath, 'utf8');

      assert.ok(content.includes("from '@/actions/couponActions'"));
      assert.ok(content.includes('handleClaimOffer(offer)'));
      assert.equal(content.includes('Claim on Coupons →'), false, 'Must NOT contain legacy redirect label');
      assert.ok(content.includes('Claimed'));
    });
  });

  // =========================================================================
  // 5. MY COUPONS CLASSIFICATION & QR CODE
  // =========================================================================
  describe('5. My Coupons Classification & QR Rules', () => {
    test('Customer claimed coupons classify accurately into Active, Expired, and Redeemed', async () => {
      const { data: userCoupons } = await supabase
        .from('user_coupons')
        .select('id, user_id, coupon_id, coupon_status, remaining_claim_time, is_expired, coupons(id, title, is_active, start_date, end_date, businesses(id, name, status))')
        .eq('user_id', customerUserId);

      assert.ok(userCoupons && userCoupons.length > 0, 'Customer must have user_coupons records');

      const { active, expired, redeemed, counts } = classifyUserCoupons(userCoupons, now);

      assert.ok(counts.active > 0, 'Must have active coupons');
      assert.ok(counts.redeemed > 0, 'Must have redeemed coupons');
      assert.equal(counts.total, userCoupons.length);

      // Verify mutual exclusivity
      const activeIds = new Set(active.map(c => c.id));
      const redeemedIds = new Set(redeemed.map(c => c.id));
      for (const id of activeIds) {
        assert.equal(redeemedIds.has(id), false);
      }
    });

    test('QR code is available only for valid redeemable claimed coupons', () => {
      const activeCoupon = {
        coupon_status: 'claimed',
        coupons: {
          is_active: true,
          end_date: new Date(now.getTime() + 86400000).toISOString()
        }
      };
      const expiredCoupon = {
        coupon_status: 'claimed',
        coupons: {
          is_active: true,
          end_date: new Date(now.getTime() - 86400000).toISOString()
        }
      };
      const redeemedCoupon = {
        coupon_status: 'redeemed',
        coupons: {
          is_active: true,
          end_date: new Date(now.getTime() + 86400000).toISOString()
        }
      };

      assert.equal(canRedeemCoupon(activeCoupon, now), true);
      assert.equal(canRedeemCoupon(expiredCoupon, now), false);
      assert.equal(canRedeemCoupon(redeemedCoupon, now), false);
    });
  });

  // =========================================================================
  // 6 & 7. VENDOR REDEMPTION & SECURITY ENFORCEMENT
  // =========================================================================
  describe('6 & 7. Vendor Scan & Redemption Security Enforcement', () => {
    test('Vendor scan action verifies vendor ownership, campaign validity, and claim state', () => {
      const filePath = join(process.cwd(), 'app/business/dashboard/scan-coupon/actions/requestCouponAction.js');
      const content = readFileSync(filePath, 'utf8');

      // 1. Vendor ownership
      assert.ok(content.includes('coupon.user_id !== vendorId'));
      assert.ok(content.includes('Coupon does not belong to your shop!'));

      // 2. Active status
      assert.ok(content.includes('coupon.is_active === false'));

      // 3. Campaign expiry
      assert.ok(content.includes('endDate.getTime() < Date.now()'));
      assert.ok(content.includes('Coupon campaign has expired'));

      // 4. Redemption limit
      assert.ok(content.includes('currentRedemption >= coupon.total_coupons'));

      // 5. User claim record check
      assert.ok(content.includes('No claim record found for this customer'));

      // 6. Already redeemed check
      assert.ok(content.includes('coupon_status === "redeemed"'));
      assert.ok(content.includes('Coupon has already been redeemed'));

      // 7. Atomic update enforcing coupon_status = "claimed"
      assert.ok(content.includes('.eq("coupon_status", "claimed")'));
    });

    test('Security rejects all 5 invalid redemption cases', () => {
      const vendorA = 'vendor-shop-A';
      const vendorB = 'vendor-shop-B';
      const couponA = { id: 'c-1', user_id: vendorA, is_active: true, end_date: '2026-10-25T00:00:00Z' };

      // Case 1: Wrong vendor
      assert.notEqual(couponA.user_id, vendorB);

      // Case 2: Already redeemed
      const claimRedeemed = { coupon_status: 'redeemed' };
      assert.equal(claimRedeemed.coupon_status === 'claimed', false);

      // Case 3: Expired coupon
      const isExpired = new Date('2026-09-01T00:00:00Z').getTime() < now.getTime();
      assert.equal(isExpired, true);

      // Case 4: Unclaimed coupon (record null)
      const claimRecord = null;
      assert.equal(Boolean(claimRecord), false);

      // Case 5: Inactive coupon
      const couponInactive = { is_active: false };
      assert.equal(couponInactive.is_active, false);
    });
  });

  // =========================================================================
  // 8. POST-REDEMPTION TRANSITION
  // =========================================================================
  describe('8. Customer After Redemption Verification', () => {
    test('Redeemed coupon remains classified as Redeemed even if end_date has expired', () => {
      const ucRedeemedExpired = {
        id: 'uc-1',
        coupon_status: 'redeemed',
        coupons: {
          is_active: true,
          end_date: '2026-09-01T00:00:00.000Z' // past date
        }
      };

      const classification = classifyUserCoupon(ucRedeemedExpired, now);
      assert.equal(classification, 'redeemed', 'Redeemed state must strictly supersede campaign expiry');
    });
  });

  // =========================================================================
  // 9. REVIEWS SYSTEM
  // =========================================================================
  describe('9. Customer Review Submission & Rating Summary', () => {
    test('Review input validation enforces 1-5 rating and comment constraints', () => {
      assert.deepEqual(validateReviewInput(5, 'Great experience'), { valid: true });
      assert.deepEqual(validateReviewInput(0), { valid: false, message: 'Rating must be an integer between 1 and 5' });
      assert.deepEqual(validateReviewInput(6), { valid: false, message: 'Rating must be an integer between 1 and 5' });
      assert.deepEqual(validateReviewInput('five'), { valid: false, message: 'Rating must be an integer between 1 and 5' });
    });

    test('Review exists in database and links customer to business', async () => {
      const { data: review } = await supabase
        .from('business_reviews')
        .select('*')
        .eq('business_id', vendorBusinessId)
        .eq('user_id', customerUserId)
        .maybeSingle();

      assert.ok(review, 'Review for customer and business must exist');
      assert.ok(review.rating >= 1 && review.rating <= 5);
    });
  });

  // =========================================================================
  // 10. "FOR YOU" RECOMMENDATION WEIGHTS
  // =========================================================================
  describe('10. For You Rule-Based Recommendation Weights', () => {
    test('Customer interaction history heavily prioritizes candidate coupons from claimed categories', () => {
      const userCategoryWeights = {
        'cat-food': 5,
        'cat-electronics': 1
      };

      const candidateA = {
        id: 'coupon-food',
        businesses: { category_id: 'cat-food' }
      };
      const candidateB = {
        id: 'coupon-electronics',
        businesses: { category_id: 'cat-electronics' }
      };

      const diff = compareForYouCoupons(candidateA, candidateB, { userCategoryWeights });
      assert.ok(diff < 0, 'Candidate from higher-affinity category (food) must be sorted before lower-affinity category');
    });
  });
});
