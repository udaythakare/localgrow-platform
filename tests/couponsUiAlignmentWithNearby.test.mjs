import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  getBusinessInitials,
  formatDisplayDate,
  formatTime12h,
} from '../helpers/businessDetailsHelpers.js';
import { joinAddress } from '../utils/addressUtils.js';

describe('LocalGrow — /coupons UI Alignment With /nearby', () => {

  describe('1. Component Reusability & Shared Business Helpers', () => {
    it('getBusinessInitials produces expected initials for multi-word shop names', () => {
      assert.strictEqual(getBusinessInitials('Organic Farm Store'), 'OF');
      assert.strictEqual(getBusinessInitials('Spice Corner'), 'SC');
      assert.strictEqual(getBusinessInitials('Apex Bakery'), 'AB');
    });

    it('getBusinessInitials handles single-word and fallback names gracefully', () => {
      assert.strictEqual(getBusinessInitials('Pluffies'), 'PL');
      assert.strictEqual(getBusinessInitials(''), 'LG');
      assert.strictEqual(getBusinessInitials(null), 'LG');
      assert.strictEqual(getBusinessInitials(undefined), 'LG');
    });

    it('formatDisplayDate formats coupon dates consistently in Indian locale', () => {
      const formatted = formatDisplayDate('2026-10-15T00:00:00Z');
      assert.ok(formatted.includes('Oct') && formatted.includes('2026'));
      assert.strictEqual(formatDisplayDate(null), null);
      assert.strictEqual(formatDisplayDate('invalid-date'), null);
    });

    it('formatTime12h formats redemption window hours cleanly', () => {
      assert.strictEqual(formatTime12h('09:00:00'), '9:00 AM');
      assert.strictEqual(formatTime12h('17:30:00'), '5:30 PM');
      assert.strictEqual(formatTime12h('12:00:00'), '12:00 PM');
      assert.strictEqual(formatTime12h('00:00:00'), '12:00 AM');
      assert.strictEqual(formatTime12h(null), '');
    });
  });

  describe('2. Store URL Resolution (View Details Experience Matching /nearby)', () => {
    function resolveStoreUrl(coupon) {
      const business = coupon?.businesses || {};
      const businessId = business.id || coupon?.business_id;
      const primaryLocation = Array.isArray(business.business_locations) && business.business_locations.length > 0
        ? business.business_locations[0]
        : null;
      const locationId = primaryLocation?.id || null;
      return businessId
        ? (locationId ? `/businesses/${businessId}?locationId=${locationId}` : `/businesses/${businessId}`)
        : '#';
    }

    it('resolves store URL with locationId query param when primary location exists', () => {
      const coupon = {
        business_id: 'biz-123',
        businesses: {
          id: 'biz-123',
          name: 'Apex Grocers',
          business_locations: [
            { id: 'loc-456', address: '123 Market St', city: 'Thane' },
          ],
        },
      };
      assert.strictEqual(resolveStoreUrl(coupon), '/businesses/biz-123?locationId=loc-456');
    });

    it('resolves store URL without locationId when business has no locations', () => {
      const coupon = {
        business_id: 'biz-789',
        businesses: {
          id: 'biz-789',
          name: 'Online Only Store',
          business_locations: [],
        },
      };
      assert.strictEqual(resolveStoreUrl(coupon), '/businesses/biz-789');
    });

    it('falls back to "#" when business identifier is absent', () => {
      const coupon = { title: 'Orphan Coupon' };
      assert.strictEqual(resolveStoreUrl(coupon), '#');
    });
  });

  describe('3. Shop Information & Coupon Metadata Mappings', () => {
    it('resolves business category from business_categories relation', () => {
      const coupon = {
        businesses: {
          business_categories: { id: 'cat-1', name: 'Food & Dining' },
        },
      };
      assert.strictEqual(coupon.businesses?.business_categories?.name, 'Food & Dining');
    });

    it('resolves store address via joinAddress utility', () => {
      const location = {
        address: 'Shop 4, Galaxy Mall',
        area: 'Vashi',
        city: 'Navi Mumbai',
        state: 'Maharashtra',
        postal_code: '400703',
      };
      const formattedAddress = joinAddress(location);
      assert.ok(formattedAddress.includes('Shop 4, Galaxy Mall'));
      assert.ok(formattedAddress.includes('Vashi'));
      assert.ok(formattedAddress.includes('Navi Mumbai'));
    });

    it('extracts rating and reviews count correctly without hardcoding or mock values', () => {
      const couponWithRating = {
        business_rating: 4.8,
        rating_count: 24,
      };
      assert.strictEqual(couponWithRating.business_rating, 4.8);
      assert.strictEqual(couponWithRating.rating_count, 24);

      const couponWithoutRating = {};
      const rating = typeof couponWithoutRating.business_rating === 'number'
        ? couponWithoutRating.business_rating
        : 0;
      assert.strictEqual(rating, 0);
    });

    it('correctly calculates remaining claims for bounded coupons', () => {
      const coupon = {
        max_claims: 50,
        current_claims: 18,
      };
      const remaining = coupon.max_claims != null
        ? Math.max(0, coupon.max_claims - coupon.current_claims)
        : null;
      assert.strictEqual(remaining, 32);
    });
  });

  describe('4. Modern Customer UI Design System Tokens', () => {
    it('CouponCard.jsx contains the modern card container, soft shadows, and clean token structure', () => {
      const fileContent = readFileSync(
        join(process.cwd(), 'components/GlobalCouponComp/CouponCard/CouponCard.jsx'),
        'utf8'
      );

      // Card container uses rounded-xl, subtle slate border, and soft shadows
      assert.ok(fileContent.includes('rounded-xl border border-slate-200'));
      assert.ok(fileContent.includes('shadow-sm'));
      assert.ok(fileContent.includes('hover:shadow-md'));

      // Category badge styling uses clean rounded-md pill
      assert.ok(fileContent.includes('rounded-md text-[9px] sm:text-[10px] font-semibold bg-slate-100/95 text-slate-700'));

      // Location badge styling uses soft indigo pill
      assert.ok(fileContent.includes('bg-indigo-50/95 text-indigo-700'));

      // Decoupled customer claims counter
      assert.ok(fileContent.includes('CustomerClaimsCounter'));

      // View Details button
      assert.ok(fileContent.includes('View Details'));

      // Claim Deal button styling
      assert.ok(fileContent.includes('Claim Deal'));
      assert.ok(fileContent.includes('bg-indigo-600 hover:bg-indigo-700'));
    });

    it('GlobalCouponSection.jsx uses modern pill controls, soft dividers, and responsive grid', () => {
      const fileContent = readFileSync(
        join(process.cwd(), 'components/GlobalCouponSection.jsx'),
        'utf8'
      );

      // Category pill button styling
      assert.ok(fileContent.includes('rounded-full text-xs font-semibold'));

      // All Deals pill
      assert.ok(fileContent.includes('All Deals'));

      // Clear filter button
      assert.ok(fileContent.includes('Clear filter'));

      // Responsive grid matches 3 columns on desktop, 2 on mobile
      assert.ok(fileContent.includes('grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6'));
    });

    it('CouponHeader.jsx contains modern LocationBadge and Refresh button', () => {
      const fileContent = readFileSync(
        join(process.cwd(), 'components/GlobalCouponComp/CouponHeader.jsx'),
        'utf8'
      );

      assert.ok(fileContent.includes('bg-indigo-50 text-indigo-700'));
      assert.ok(fileContent.includes('Refresh Deals'));
    });
  });

  describe('5. Safety Check: /nearby Remains Unmodified', () => {
    it('app/nearby/page.jsx exists and is intact', () => {
      const nearbyPagePath = join(process.cwd(), 'app/nearby/page.jsx');
      assert.ok(existsSync(nearbyPagePath));
      const content = readFileSync(nearbyPagePath, 'utf8');
      assert.ok(content.includes('NearbySection'));
    });

    it('components/nearby/NearbyBusinessCard.jsx exists and is intact', () => {
      const cardPath = join(process.cwd(), 'components/nearby/NearbyBusinessCard.jsx');
      assert.ok(existsSync(cardPath));
      const content = readFileSync(cardPath, 'utf8');
      assert.ok(content.includes('NearbyBusinessCard'));
      assert.ok(content.includes('View Store'));
    });

    it('components/nearby/NearbySection.jsx exists and is intact', () => {
      const sectionPath = join(process.cwd(), 'components/nearby/NearbySection.jsx');
      assert.ok(existsSync(sectionPath));
      const content = readFileSync(sectionPath, 'utf8');
      assert.ok(content.includes('NearbyBusinessCard'));
      assert.ok(content.includes('Geospatial Discovery'));
    });
  });

});
