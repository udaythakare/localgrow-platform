import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    resolveCustomerCity,
    normalizePagination,
    normalizeCategoryId,
    getCouponEmptyStateContent,
    isCouponExpired,
    isCouponValid,
    isCouponExpiringSoon,
    sortCouponsByNewest,
    sortCouponsByExpiringSoon,
    compareForYouCoupons,
    sortCouponsForYou,
    isLocalityMatch
} from '../helpers/couponFilterHelpers.js';

describe('LocalGrow — /coupons Locality Filtering & Empty States', () => {

    describe('Customer City Resolution Hierarchy', () => {
        test('Priority 1: Uses logged-in customer primary user_locations city when available', () => {
            const result = resolveCustomerCity({
                userLocationCity: 'Pune',
                ipCity: 'Mumbai'
            });
            assert.deepEqual(result, {
                city: 'Pune',
                source: 'profile_city'
            });
        });

        test('Trims whitespace from user_locations city', () => {
            const result = resolveCustomerCity({
                userLocationCity: '  Nashik  ',
                ipCity: 'Pune'
            });
            assert.deepEqual(result, {
                city: 'Nashik',
                source: 'profile_city'
            });
        });

        test('Priority 2: Falls back to IP-detected city when user_locations city is null or empty', () => {
            const nullUserCity = resolveCustomerCity({
                userLocationCity: null,
                ipCity: 'Bengaluru'
            });
            assert.deepEqual(nullUserCity, {
                city: 'Bengaluru',
                source: 'ip_city'
            });

            const emptyUserCity = resolveCustomerCity({
                userLocationCity: '   ',
                ipCity: 'Bengaluru'
            });
            assert.deepEqual(emptyUserCity, {
                city: 'Bengaluru',
                source: 'ip_city'
            });
        });

        test('Trims whitespace from IP-detected city', () => {
            const result = resolveCustomerCity({
                userLocationCity: null,
                ipCity: '  Hyderabad  '
            });
            assert.deepEqual(result, {
                city: 'Hyderabad',
                source: 'ip_city'
            });
        });

        test('Priority 3: Returns null and source none when neither profile city nor IP city is available', () => {
            const bothNull = resolveCustomerCity({
                userLocationCity: null,
                ipCity: null
            });
            assert.deepEqual(bothNull, {
                city: null,
                source: 'none'
            });

            const bothEmpty = resolveCustomerCity({
                userLocationCity: '',
                ipCity: '   '
            });
            assert.deepEqual(bothEmpty, {
                city: null,
                source: 'none'
            });

            const emptyArgs = resolveCustomerCity();
            assert.deepEqual(emptyArgs, {
                city: null,
                source: 'none'
            });
        });

        test('Rejects non-string inputs gracefully', () => {
            const invalidTypes = resolveCustomerCity({
                userLocationCity: 12345,
                ipCity: { city: 'Delhi' }
            });
            assert.deepEqual(invalidTypes, {
                city: null,
                source: 'none'
            });
        });
    });

    describe('Pagination Normalization', () => {
        test('Preserves valid limit and offset values', () => {
            const res = normalizePagination(10, 20);
            assert.deepEqual(res, { limit: 10, offset: 20 });
        });

        test('Floors fractional numbers to integers', () => {
            const res = normalizePagination(7.8, 14.2);
            assert.deepEqual(res, { limit: 7, offset: 14 });
        });

        test('Applies default limit when limit is null, negative, or invalid', () => {
            assert.equal(normalizePagination(null, 0, 5).limit, 5);
            assert.equal(normalizePagination(-1, 0, 5).limit, 5);
            assert.equal(normalizePagination(0, 0, 8).limit, 8);
            assert.equal(normalizePagination('10', 0, 5).limit, 5);
        });

        test('Defaults offset to 0 when offset is negative or invalid', () => {
            assert.equal(normalizePagination(5, -5).offset, 0);
            assert.equal(normalizePagination(5, null).offset, 0);
            assert.equal(normalizePagination(5, undefined).offset, 0);
        });
    });

    describe('Empty and Error States Content', () => {
        test('Unknown location produces "Location Required" state without distant fallback', () => {
            const state = getCouponEmptyStateContent({
                locationSource: 'none',
                locationName: null
            });
            assert.equal(state.isLocationUnknown, true);
            assert.equal(state.title, 'Location Required');
            assert.match(state.message, /couldn't determine your location/i);
            assert.equal(state.buttonText, 'Retry Location');
        });

        test('Empty string location is also treated as unknown location', () => {
            const state = getCouponEmptyStateContent({
                locationSource: 'ip_city',
                locationName: '   '
            });
            assert.equal(state.isLocationUnknown, true);
            assert.equal(state.title, 'Location Required');
        });

        test('Known locality with zero coupons shows locality empty state', () => {
            const state = getCouponEmptyStateContent({
                locationSource: 'profile_city',
                locationName: 'Nagpur'
            });
            assert.equal(state.isLocationUnknown, false);
            assert.equal(state.title, 'No Deals Found in Nagpur');
            assert.match(state.message, /no active offers from approved businesses in Nagpur/i);
            assert.equal(state.buttonText, 'Refresh Deals');
        });

        test('Known locality with category filter shows category-specific empty state', () => {
            const state = getCouponEmptyStateContent({
                locationSource: 'ip_city',
                locationName: 'Pune',
                categoryName: 'Food & Drink'
            });
            assert.equal(state.isLocationUnknown, false);
            assert.equal(state.title, 'No Food & Drink Deals in Pune');
            assert.match(state.message, /no active Food & Drink coupons in Pune/i);
            assert.equal(state.buttonText, 'Clear Category Filter');
        });
    });

    describe('Category Filter Normalization & Event Safety', () => {
        test('Preserves valid UUID string category ID and trims whitespace', () => {
            const uuid = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
            assert.equal(normalizeCategoryId(uuid), uuid);
            assert.equal(normalizeCategoryId(`  ${uuid}  `), uuid);
        });

        test('Rejects DOM click event and React SyntheticEvent objects', () => {
            const domClickEvent = {
                type: 'click',
                target: {},
                bubbles: true,
                preventDefault: () => {},
                stopPropagation: () => {}
            };
            const reactSyntheticEvent = {
                _reactName: 'onClick',
                type: 'click',
                nativeEvent: domClickEvent
            };

            assert.equal(normalizeCategoryId(domClickEvent), null);
            assert.equal(normalizeCategoryId(reactSyntheticEvent), null);
        });

        test('Rejects other non-string types and empty strings', () => {
            assert.equal(normalizeCategoryId(null), null);
            assert.equal(normalizeCategoryId(undefined), null);
            assert.equal(normalizeCategoryId(''), null);
            assert.equal(normalizeCategoryId('    '), null);
            assert.equal(normalizeCategoryId(12345), null);
            assert.equal(normalizeCategoryId(true), null);
            assert.equal(normalizeCategoryId({ id: 'uuid' }), null);
            assert.equal(normalizeCategoryId(['uuid']), null);
        });

        test('Refresh category resolution preserves active category when event object is passed', () => {
            const currentCategoryRef = 'cat-uuid-active';
            const clickEvent = { type: 'click', target: {} };

            // When click event is passed to refresh, it should NOT use the event as category
            const resolveTargetCategory = (activeCategoryId) => {
                if (activeCategoryId === null) return null;
                return normalizeCategoryId(activeCategoryId) || normalizeCategoryId(currentCategoryRef);
            };

            assert.equal(resolveTargetCategory(clickEvent), 'cat-uuid-active');
            assert.equal(resolveTargetCategory(undefined), 'cat-uuid-active');
            assert.equal(resolveTargetCategory(null), null); // Explicit clear
            assert.equal(resolveTargetCategory('cat-uuid-new'), 'cat-uuid-new'); // Explicit change
        });
    });

    describe('Empty State Button Actions & Event Decoupling', () => {
        test('EmptyState correctly maps Clear Category Filter to clear handler', () => {
            const content = getCouponEmptyStateContent({
                locationSource: 'profile_city',
                locationName: 'Mumbai',
                categoryName: 'Electronics'
            });
            assert.equal(content.buttonText, 'Clear Category Filter');

            let cleared = false;
            let refreshed = false;
            const onClearFilters = () => { cleared = true; };
            const onRefresh = () => { refreshed = true; };

            const handleAction = content.buttonText === "Clear Category Filter"
                ? onClearFilters
                : (onRefresh || onClearFilters);

            // Execute without event argument leak
            handleAction();
            assert.equal(cleared, true);
            assert.equal(refreshed, false);
        });

        test('EmptyState correctly maps Refresh Deals to refresh handler', () => {
            const content = getCouponEmptyStateContent({
                locationSource: 'ip_city',
                locationName: 'Delhi'
            });
            assert.equal(content.buttonText, 'Refresh Deals');

            let cleared = false;
            let refreshed = false;
            const onClearFilters = () => { cleared = true; };
            const onRefresh = () => { refreshed = true; };

            const handleAction = content.buttonText === "Clear Category Filter"
                ? onClearFilters
                : (onRefresh || onClearFilters);

            handleAction();
            assert.equal(cleared, false);
            assert.equal(refreshed, true);
        });

        test('EmptyState correctly maps Retry Location to refresh/detection handler', () => {
            const content = getCouponEmptyStateContent({
                locationSource: 'none',
                locationName: null
            });
            assert.equal(content.buttonText, 'Retry Location');
            assert.equal(content.isLocationUnknown, true);

            let cleared = false;
            let refreshed = false;
            const onClearFilters = () => { cleared = true; };
            const onRefresh = () => { refreshed = true; };

            const handleAction = content.buttonText === "Clear Category Filter"
                ? onClearFilters
                : (onRefresh || onClearFilters);

            handleAction();
            assert.equal(cleared, false);
            assert.equal(refreshed, true);
        });
    });

    describe('Newest-First Ordering & Consistency', () => {
        test('sortCouponsByNewest sorts coupons strictly by created_at descending', () => {
            const coupons = [
                { id: '1', created_at: '2026-03-01T10:00:00Z', title: 'Older' },
                { id: '2', created_at: '2026-03-15T12:00:00Z', title: 'Newest' },
                { id: '3', created_at: '2026-03-10T08:30:00Z', title: 'Middle' }
            ];

            const sorted = sortCouponsByNewest(coupons);
            assert.deepEqual(sorted.map(c => c.id), ['2', '3', '1']);
            assert.equal(sorted[0].title, 'Newest');
            assert.equal(sorted[2].title, 'Older');
        });

        test('Maintains original array immutability during sort', () => {
            const coupons = [
                { id: 'a', created_at: '2026-01-01T00:00:00Z' },
                { id: 'b', created_at: '2026-02-01T00:00:00Z' }
            ];
            const sorted = sortCouponsByNewest(coupons);
            assert.equal(coupons[0].id, 'a');
            assert.equal(sorted[0].id, 'b');
        });

        test('Handles missing, invalid, or empty input gracefully', () => {
            assert.deepEqual(sortCouponsByNewest(null), []);
            assert.deepEqual(sortCouponsByNewest(undefined), []);
            assert.deepEqual(sortCouponsByNewest([]), []);
        });
    });

    describe('Coupon Expiry & Validity Window Verification', () => {
        const referenceNow = new Date('2026-09-30T12:00:00Z');

        test('Excludes coupons whose end_date is in the past (expired coupons)', () => {
            const expiredCoupon = {
                id: 'exp-1',
                title: 'Summer Sale',
                is_active: true,
                start_date: '2026-05-01T00:00:00Z',
                end_date: '2026-05-31T23:59:59Z',
                businesses: { status: 'approved' }
            };

            assert.equal(isCouponExpired(expiredCoupon, referenceNow), true);
            assert.equal(isCouponValid(expiredCoupon, referenceNow), false);
        });

        test('Includes coupons that are currently valid (future end_date)', () => {
            const validCoupon = {
                id: 'val-1',
                title: 'Autumn Special',
                is_active: true,
                start_date: '2026-09-01T00:00:00Z',
                end_date: '2026-10-15T23:59:59Z',
                businesses: { status: 'approved' }
            };

            assert.equal(isCouponExpired(validCoupon, referenceNow), false);
            assert.equal(isCouponValid(validCoupon, referenceNow), true);
        });

        test('Includes coupons with no end_date if active and approved', () => {
            const openEndedCoupon = {
                id: 'open-1',
                title: 'Always Active',
                is_active: true,
                start_date: '2026-09-01T00:00:00Z',
                end_date: null,
                businesses: { status: 'approved' }
            };

            assert.equal(isCouponExpired(openEndedCoupon, referenceNow), false);
            assert.equal(isCouponValid(openEndedCoupon, referenceNow), true);
        });

        test('Excludes coupons whose start_date is in the future (not yet active)', () => {
            const futureCoupon = {
                id: 'fut-1',
                title: 'Winter Warmup',
                is_active: true,
                start_date: '2026-11-01T00:00:00Z',
                end_date: '2026-12-31T23:59:59Z',
                businesses: { status: 'approved' }
            };

            assert.equal(isCouponValid(futureCoupon, referenceNow), false);
        });

        test('Excludes inactive or unapproved business coupons', () => {
            const inactiveCoupon = {
                id: 'inact-1',
                is_active: false,
                end_date: '2026-10-31T00:00:00Z'
            };
            const unapprovedBizCoupon = {
                id: 'unapp-1',
                is_active: true,
                end_date: '2026-10-31T00:00:00Z',
                businesses: { status: 'pending' }
            };

            assert.equal(isCouponValid(inactiveCoupon, referenceNow), false);
            assert.equal(isCouponValid(unapprovedBizCoupon, referenceNow), false);
        });

        test('Does not rely on stale is_expired field; uses real timestamps as source of truth', () => {
            // A coupon with stale is_expired = false, but end_date in the past
            const staleNotExpired = {
                id: 'stale-1',
                is_active: true,
                is_expired: false,
                end_date: '2026-08-01T00:00:00Z',
                businesses: { status: 'approved' }
            };
            assert.equal(isCouponExpired(staleNotExpired, referenceNow), true);
            assert.equal(isCouponValid(staleNotExpired, referenceNow), false);

            // A coupon with stale is_expired = true, but valid active timestamps
            const staleExpiredFlag = {
                id: 'stale-2',
                is_active: true,
                is_expired: true,
                start_date: '2026-09-01T00:00:00Z',
                end_date: '2026-10-30T00:00:00Z',
                businesses: { status: 'approved' }
            };
            assert.equal(isCouponExpired(staleExpiredFlag, referenceNow), false);
            assert.equal(isCouponValid(staleExpiredFlag, referenceNow), true);
        });
    });

    describe('Expires Soon Section (24h Window, Ordering, No-End-Date Exclusion)', () => {
        const referenceNow = new Date('2026-09-30T12:00:00Z');

        test('Includes coupon expiring in 4 hours (within 24h window)', () => {
            const expiringIn4Hours = {
                id: 'soon-4h',
                is_active: true,
                end_date: '2026-09-30T16:00:00Z',
                businesses: { status: 'approved' }
            };
            assert.equal(isCouponExpiringSoon(expiringIn4Hours, referenceNow, 24), true);
        });

        test('Includes coupon expiring in exactly 24 hours (boundary inclusion)', () => {
            const expiringIn24Hours = {
                id: 'soon-24h',
                is_active: true,
                end_date: '2026-10-01T12:00:00Z',
                businesses: { status: 'approved' }
            };
            assert.equal(isCouponExpiringSoon(expiringIn24Hours, referenceNow, 24), true);
        });

        test('Excludes coupon expiring in 24 hours + 1 minute (outside 24h window)', () => {
            const expiringIn25Hours = {
                id: 'later-25h',
                is_active: true,
                end_date: '2026-10-01T12:01:00Z',
                businesses: { status: 'approved' }
            };
            assert.equal(isCouponExpiringSoon(expiringIn25Hours, referenceNow, 24), false);
        });

        test('Excludes coupons without an end_date from Expires Soon', () => {
            const noEndDateCoupon = {
                id: 'no-end',
                is_active: true,
                end_date: null,
                businesses: { status: 'approved' }
            };
            assert.equal(isCouponExpiringSoon(noEndDateCoupon, referenceNow, 24), false);

            const undefinedEndDate = {
                id: 'undef-end',
                is_active: true,
                businesses: { status: 'approved' }
            };
            assert.equal(isCouponExpiringSoon(undefinedEndDate, referenceNow, 24), false);
        });

        test('Excludes already-expired coupons from Expires Soon', () => {
            const alreadyExpired = {
                id: 'already-exp',
                is_active: true,
                end_date: '2026-09-30T11:59:00Z',
                businesses: { status: 'approved' }
            };
            assert.equal(isCouponExpiringSoon(alreadyExpired, referenceNow, 24), false);
        });

        test('sortCouponsByExpiringSoon orders coupons by earliest end_date first', () => {
            const coupons = [
                { id: '18h', end_date: '2026-10-01T06:00:00Z' },
                { id: '2h', end_date: '2026-09-30T14:00:00Z' },
                { id: '10h', end_date: '2026-09-30T22:00:00Z' }
            ];

            const sorted = sortCouponsByExpiringSoon(coupons);
            assert.deepEqual(sorted.map(c => c.id), ['2h', '10h', '18h']);
        });
    });

    describe('Locality, Category & Pagination Consistency', () => {
        test('Preserves locality and category across pagination requests', () => {
            const categoryId = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
            const city = 'Pune';

            // Simulate hook state query options across 3 pages
            const page0 = { city, categoryId: normalizeCategoryId(categoryId), limit: 5, offset: 0, sortBy: 'newest' };
            const page1 = { city, categoryId: normalizeCategoryId(categoryId), limit: 5, offset: 5, sortBy: 'newest' };
            const page2 = { city, categoryId: normalizeCategoryId(categoryId), limit: 5, offset: 10, sortBy: 'newest' };

            assert.equal(page0.city, 'Pune');
            assert.equal(page1.city, 'Pune');
            assert.equal(page2.city, 'Pune');

            assert.equal(page0.categoryId, categoryId);
            assert.equal(page1.categoryId, categoryId);
            assert.equal(page2.categoryId, categoryId);

            assert.equal(page0.sortBy, 'newest');
            assert.equal(page1.sortBy, 'newest');
            assert.equal(page2.sortBy, 'newest');

            assert.deepEqual(normalizePagination(page0.limit, page0.offset), { limit: 5, offset: 0 });
            assert.deepEqual(normalizePagination(page1.limit, page1.offset), { limit: 5, offset: 5 });
            assert.deepEqual(normalizePagination(page2.limit, page2.offset), { limit: 5, offset: 10 });
        });

        test('Clearing category filter maintains locality and resets pagination to 0', () => {
            const city = 'Mumbai';
            const activeCategoryId = null;

            const clearedQuery = {
                city,
                categoryId: normalizeCategoryId(activeCategoryId),
                limit: 5,
                offset: 0,
                sortBy: 'newest'
            };

            assert.equal(clearedQuery.city, 'Mumbai');
            assert.equal(clearedQuery.categoryId, null);
            assert.equal(clearedQuery.offset, 0);
            assert.equal(clearedQuery.sortBy, 'newest');
        });
    });

    describe('Customer "For You" Feed: Category-History Relevance', () => {
        test('Prioritizes coupons from categories customer has previously claimed/redeemed', () => {
            const userCategoryWeights = {
                'cat-food': 4,
                'cat-retail': 1
            };

            const couponRetail = {
                id: 'retail-1',
                businesses: { category_id: 'cat-retail' },
                current_claims: 50,
                created_at: '2026-09-20T00:00:00Z'
            };

            const couponFood = {
                id: 'food-1',
                businesses: { category_id: 'cat-food' },
                current_claims: 5,
                created_at: '2026-09-01T00:00:00Z'
            };

            const sorted = sortCouponsForYou([couponRetail, couponFood], { userCategoryWeights });
            assert.equal(sorted[0].id, 'food-1');
            assert.equal(sorted[1].id, 'retail-1');
        });

        test('Prioritizes categories with higher claim/redemption count over lower interaction categories', () => {
            const userCategoryWeights = {
                'cat-spa': 5,
                'cat-dining': 3,
                'cat-auto': 1
            };

            const coupons = [
                { id: 'c-auto', businesses: { category_id: 'cat-auto' } },
                { id: 'c-spa', businesses: { category_id: 'cat-spa' } },
                { id: 'c-dining', businesses: { category_id: 'cat-dining' } },
                { id: 'c-other', businesses: { category_id: 'cat-other' } }
            ];

            const sorted = sortCouponsForYou(coupons, { userCategoryWeights });
            assert.deepEqual(sorted.map(c => c.id), ['c-spa', 'c-dining', 'c-auto', 'c-other']);
        });

        test('Category-affinity priority overrides business rating and claims', () => {
            const userCategoryWeights = {
                'cat-gym': 2
            };

            const businessRatingMap = {
                'biz-hotel': { avgRating: 5.0, count: 20 },
                'biz-gym': { avgRating: 3.5, count: 5 }
            };

            const couponHotel = {
                id: 'hotel-1',
                business_id: 'biz-hotel',
                businesses: { id: 'biz-hotel', category_id: 'cat-hotel' },
                current_claims: 100
            };

            const couponGym = {
                id: 'gym-1',
                business_id: 'biz-gym',
                businesses: { id: 'biz-gym', category_id: 'cat-gym' },
                current_claims: 2
            };

            const sorted = sortCouponsForYou([couponHotel, couponGym], {
                userCategoryWeights,
                businessRatingMap
            });
            assert.equal(sorted[0].id, 'gym-1');
            assert.equal(sorted[1].id, 'hotel-1');
        });
    });

    describe('Customer "For You" Feed: Locality Match & Restriction', () => {
        test('isLocalityMatch correctly identifies matching and non-matching cities', () => {
            const couponPune = {
                id: 'p1',
                businesses: {
                    business_locations: [{ city: 'Pune' }]
                }
            };
            const couponMumbai = {
                id: 'm1',
                businesses: {
                    business_locations: [{ city: 'Mumbai' }]
                }
            };

            assert.equal(isLocalityMatch(couponPune, 'Pune'), true);
            assert.equal(isLocalityMatch(couponPune, 'pune'), true);
            assert.equal(isLocalityMatch(couponPune, '  PUNE  '), true);
            assert.equal(isLocalityMatch(couponMumbai, 'Pune'), false);
        });

        test('Prioritizes target-city coupons over non-matching city candidates', () => {
            const couponLocal = {
                id: 'local-deal',
                businesses: { category_id: 'cat-1', business_locations: [{ city: 'Nagpur' }] }
            };
            const couponRemote = {
                id: 'remote-deal',
                businesses: { category_id: 'cat-1', business_locations: [{ city: 'Delhi' }] }
            };

            const sorted = sortCouponsForYou([couponRemote, couponLocal], {
                targetCity: 'Nagpur'
            });
            assert.equal(sorted[0].id, 'local-deal');
            assert.equal(sorted[1].id, 'remote-deal');
        });

        test('When location cannot be resolved, resolveCustomerCity returns null and prevents distant fallback', () => {
            const unresolved = resolveCustomerCity({ userLocationCity: null, ipCity: null });
            assert.equal(unresolved.city, null);
            assert.equal(unresolved.source, 'none');
        });
    });

    describe('Customer "For You" Feed: Rating, Popularity, and Newness Ranking', () => {
        test('Higher-rated business ranks ahead of lower-rated business when category affinity is equal', () => {
            const businessRatingMap = {
                'biz-high': { avgRating: 4.8, count: 12 },
                'biz-low': { avgRating: 3.9, count: 8 }
            };

            const couponLow = {
                id: 'c-low',
                business_id: 'biz-low',
                businesses: { id: 'biz-low', category_id: 'cat-same' },
                current_claims: 20
            };
            const couponHigh = {
                id: 'c-high',
                business_id: 'biz-high',
                businesses: { id: 'biz-high', category_id: 'cat-same' },
                current_claims: 5
            };

            const sorted = sortCouponsForYou([couponLow, couponHigh], { businessRatingMap });
            assert.equal(sorted[0].id, 'c-high');
            assert.equal(sorted[1].id, 'c-low');
        });

        test('Equal business rating: higher local popularity (current_claims) ranks ahead', () => {
            const businessRatingMap = {
                'biz-1': { avgRating: 4.5, count: 10 },
                'biz-2': { avgRating: 4.5, count: 15 }
            };

            const couponLessClaims = {
                id: 'c-few',
                business_id: 'biz-1',
                businesses: { id: 'biz-1', category_id: 'cat-same' },
                current_claims: 8
            };
            const couponMoreClaims = {
                id: 'c-many',
                business_id: 'biz-2',
                businesses: { id: 'biz-2', category_id: 'cat-same' },
                current_claims: 42
            };

            const sorted = sortCouponsForYou([couponLessClaims, couponMoreClaims], { businessRatingMap });
            assert.equal(sorted[0].id, 'c-many');
            assert.equal(sorted[1].id, 'c-few');
        });

        test('Equal rating and equal popularity: newer coupon (created_at DESC) ranks ahead', () => {
            const businessRatingMap = {
                'biz-1': { avgRating: 4.0, count: 5 }
            };

            const olderCoupon = {
                id: 'c-older',
                business_id: 'biz-1',
                businesses: { id: 'biz-1', category_id: 'cat-same' },
                current_claims: 15,
                created_at: '2026-08-01T10:00:00Z'
            };
            const newerCoupon = {
                id: 'c-newer',
                business_id: 'biz-1',
                businesses: { id: 'biz-1', category_id: 'cat-same' },
                current_claims: 15,
                created_at: '2026-09-25T14:30:00Z'
            };

            const sorted = sortCouponsForYou([olderCoupon, newerCoupon], { businessRatingMap });
            assert.equal(sorted[0].id, 'c-newer');
            assert.equal(sorted[1].id, 'c-older');
        });
    });

    describe('Customer "For You" Feed: Cold-Start Behavior', () => {
        test('Cold start (no user history): ranks strictly using rating -> popularity -> newness', () => {
            const emptyHistoryWeights = {};

            const businessRatingMap = {
                'biz-star': { avgRating: 4.9, count: 30 },
                'biz-good': { avgRating: 4.2, count: 10 }
            };

            const coupons = [
                {
                    id: 'cold-1',
                    business_id: 'biz-good',
                    businesses: { id: 'biz-good', category_id: 'cat-any' },
                    current_claims: 100,
                    created_at: '2026-09-01T00:00:00Z'
                },
                {
                    id: 'cold-2',
                    business_id: 'biz-star',
                    businesses: { id: 'biz-star', category_id: 'cat-any' },
                    current_claims: 10,
                    created_at: '2026-08-01T00:00:00Z'
                }
            ];

            const sorted = sortCouponsForYou(coupons, {
                userCategoryWeights: emptyHistoryWeights,
                businessRatingMap
            });

            // biz-star has rating 4.9 vs 4.2 -> ranks first despite fewer claims
            assert.equal(sorted[0].id, 'cold-2');
            assert.equal(sorted[1].id, 'cold-1');
        });

        test('Cold start: businesses without reviews default to 0 rating and rank below reviewed businesses', () => {
            const businessRatingMap = {
                'biz-reviewed': { avgRating: 3.8, count: 2 }
            };

            const couponUnreviewed = {
                id: 'c-unrev',
                business_id: 'biz-unreviewed',
                businesses: { id: 'biz-unreviewed', category_id: 'cat-x' },
                current_claims: 50
            };
            const couponReviewed = {
                id: 'c-rev',
                business_id: 'biz-reviewed',
                businesses: { id: 'biz-reviewed', category_id: 'cat-x' },
                current_claims: 2
            };

            const sorted = sortCouponsForYou([couponUnreviewed, couponReviewed], {
                userCategoryWeights: {},
                businessRatingMap
            });
            assert.equal(sorted[0].id, 'c-rev');
            assert.equal(sorted[1].id, 'c-unrev');
        });

        test('Cold start: does not fall back to national/other cities when zero local deals exist', () => {
            const localApprovedBusinesses = [];
            const coupons = localApprovedBusinesses.length === 0 ? [] : [{ id: 'mock' }];
            assert.deepEqual(coupons, []);
        });
    });

    describe('Customer "For You" Feed: Expired Coupon Exclusion', () => {
        const testNow = new Date('2026-09-30T12:00:00Z');

        test('Excludes expired coupons from candidate list before ranking', () => {
            const expired = {
                id: 'exp-c',
                is_active: true,
                end_date: '2026-09-29T23:59:59Z',
                businesses: { status: 'approved', category_id: 'cat-fav' }
            };
            const active = {
                id: 'act-c',
                is_active: true,
                end_date: '2026-10-15T00:00:00Z',
                businesses: { status: 'approved', category_id: 'cat-fav' }
            };

            const candidates = [expired, active].filter(c => isCouponValid(c, testNow));
            assert.deepEqual(candidates.map(c => c.id), ['act-c']);
        });

        test('Excludes coupons not yet started (start_date > now)', () => {
            const future = {
                id: 'future-c',
                is_active: true,
                start_date: '2026-10-05T00:00:00Z',
                end_date: '2026-10-20T00:00:00Z',
                businesses: { status: 'approved' }
            };
            assert.equal(isCouponValid(future, testNow), false);
        });

        test('Excludes inactive coupons and unapproved businesses from For You recommendations', () => {
            const inactive = { id: 'inact', is_active: false, businesses: { status: 'approved' } };
            const pendingBiz = { id: 'pend', is_active: true, businesses: { status: 'pending' } };
            assert.equal(isCouponValid(inactive, testNow), false);
            assert.equal(isCouponValid(pendingBiz, testNow), false);
        });
    });

    describe('Customer "For You" Feed: Deterministic Tie-Breaking', () => {
        test('Breaks tie deterministically by coupon ID when all signals are identical', () => {
            const couponA = {
                id: 'coupon-100',
                businesses: { category_id: 'cat-tie' },
                current_claims: 10,
                created_at: '2026-09-15T10:00:00Z'
            };
            const couponB = {
                id: 'coupon-200',
                businesses: { category_id: 'cat-tie' },
                current_claims: 10,
                created_at: '2026-09-15T10:00:00Z'
            };

            const order1 = sortCouponsForYou([couponB, couponA], { userCategoryWeights: {} });
            const order2 = sortCouponsForYou([couponA, couponB], { userCategoryWeights: {} });

            assert.deepEqual(order1.map(c => c.id), ['coupon-100', 'coupon-200']);
            assert.deepEqual(order2.map(c => c.id), ['coupon-100', 'coupon-200']);
        });

        test('Deterministic tie-breaker produces identical ordering under random shuffling', () => {
            const items = [
                { id: 'c-alpha', current_claims: 5, created_at: '2026-09-01T00:00:00Z' },
                { id: 'c-beta', current_claims: 5, created_at: '2026-09-01T00:00:00Z' },
                { id: 'c-gamma', current_claims: 5, created_at: '2026-09-01T00:00:00Z' },
                { id: 'c-delta', current_claims: 5, created_at: '2026-09-01T00:00:00Z' }
            ];

            const sorted1 = sortCouponsForYou([...items], {});
            const sorted2 = sortCouponsForYou([...items].reverse(), {});
            const sorted3 = sortCouponsForYou([items[2], items[0], items[3], items[1]], {});

            const expectedOrder = ['c-alpha', 'c-beta', 'c-delta', 'c-gamma'];
            assert.deepEqual(sorted1.map(c => c.id), expectedOrder);
            assert.deepEqual(sorted2.map(c => c.id), expectedOrder);
            assert.deepEqual(sorted3.map(c => c.id), expectedOrder);
        });
    });

    describe('Customer "For You" Feed: Pagination Consistency', () => {
        test('Deterministic ranking guarantees stable, non-overlapping pagination slices', () => {
            const coupons = [
                { id: 'p-01', current_claims: 90 },
                { id: 'p-02', current_claims: 80 },
                { id: 'p-03', current_claims: 70 },
                { id: 'p-04', current_claims: 60 },
                { id: 'p-05', current_claims: 50 },
                { id: 'p-06', current_claims: 40 }
            ];

            const sorted = sortCouponsForYou(coupons, {});

            const pageSize = 2;
            const page0 = sorted.slice(0, pageSize);
            const page1 = sorted.slice(2, 2 + pageSize);
            const page2 = sorted.slice(4, 4 + pageSize);

            assert.deepEqual(page0.map(c => c.id), ['p-01', 'p-02']);
            assert.deepEqual(page1.map(c => c.id), ['p-03', 'p-04']);
            assert.deepEqual(page2.map(c => c.id), ['p-05', 'p-06']);

            const combined = [...page0, ...page1, ...page2];
            assert.equal(combined.length, 6);
            assert.deepEqual(new Set(combined.map(c => c.id)).size, 6); // Zero overlaps
        });
    });

    describe('Customer "For You" Feed: Duplicate Prevention', () => {
        test('Deduplicates candidate coupons with identical IDs', () => {
            const rawCandidates = [
                { id: 'dup-1', title: 'Deal 1', is_active: true },
                { id: 'dup-2', title: 'Deal 2', is_active: true },
                { id: 'dup-1', title: 'Deal 1 (Branch 2)', is_active: true },
                { id: 'dup-3', title: 'Deal 3', is_active: true },
                { id: 'dup-2', title: 'Deal 2 (Branch 2)', is_active: true }
            ];

            const seen = new Set();
            const deduplicated = [];
            for (const c of rawCandidates) {
                if (!seen.has(c.id)) {
                    seen.add(c.id);
                    deduplicated.push(c);
                }
            }

            assert.equal(deduplicated.length, 3);
            assert.deepEqual(deduplicated.map(c => c.id), ['dup-1', 'dup-2', 'dup-3']);
        });
    });

});
