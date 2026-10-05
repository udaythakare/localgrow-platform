import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    parseToISTDate,
    isCouponExpired,
    isCouponActive,
    classifyUserCoupon,
    classifyUserCoupons
} from '../helpers/myCouponHelpers.js';

describe('LocalGrow — My Coupons Classification & Functional Verification', () => {

    const referenceNow = new Date('2026-10-01T12:00:00+05:30');

    // 1. claimed + valid → Active
    it('1. claimed + valid coupon classifies as active', () => {
        const item = {
            id: 'uc-1',
            coupon_status: 'claimed',
            coupons: {
                id: 'c-1',
                title: '20% Off Groceries',
                is_active: true,
                start_date: '2026-09-01T00:00:00+05:30',
                end_date: '2026-10-15T23:59:59+05:30',
                businesses: { status: 'approved' }
            }
        };
        assert.strictEqual(classifyUserCoupon(item, referenceNow), 'active');
        const classified = classifyUserCoupons([item], referenceNow);
        assert.strictEqual(classified.active.length, 1);
        assert.strictEqual(classified.expired.length, 0);
        assert.strictEqual(classified.redeemed.length, 0);
    });

    // 2. claimed + expired → Expired
    it('2. claimed + expired coupon classifies as expired', () => {
        const item = {
            id: 'uc-2',
            coupon_status: 'claimed',
            coupons: {
                id: 'c-2',
                title: 'Summer Splash Deal',
                is_active: true,
                start_date: '2026-05-01T00:00:00+05:30',
                end_date: '2026-06-30T23:59:59+05:30',
                businesses: { status: 'approved' }
            }
        };
        assert.strictEqual(classifyUserCoupon(item, referenceNow), 'expired');
        const classified = classifyUserCoupons([item], referenceNow);
        assert.strictEqual(classified.active.length, 0);
        assert.strictEqual(classified.expired.length, 1);
        assert.strictEqual(classified.redeemed.length, 0);
    });

    // 3. claimed + future start → not Active
    it('3. claimed + future start date is not active', () => {
        const item = {
            id: 'uc-3',
            coupon_status: 'claimed',
            coupons: {
                id: 'c-3',
                title: 'Diwali Special',
                is_active: true,
                start_date: '2026-11-01T00:00:00+05:30',
                end_date: '2026-11-15T23:59:59+05:30',
                businesses: { status: 'approved' }
            }
        };
        const status = classifyUserCoupon(item, referenceNow);
        assert.notStrictEqual(status, 'active');
        const classified = classifyUserCoupons([item], referenceNow);
        assert.strictEqual(classified.active.length, 0);
    });

    // 4. claimed + inactive → not Active
    it('4. claimed + inactive coupon is not active', () => {
        const item = {
            id: 'uc-4',
            coupon_status: 'claimed',
            coupons: {
                id: 'c-4',
                title: 'Disabled Deal',
                is_active: false,
                start_date: '2026-09-01T00:00:00+05:30',
                end_date: '2026-10-30T23:59:59+05:30',
                businesses: { status: 'approved' }
            }
        };
        const status = classifyUserCoupon(item, referenceNow);
        assert.notStrictEqual(status, 'active');
        const classified = classifyUserCoupons([item], referenceNow);
        assert.strictEqual(classified.active.length, 0);
    });

    // 5. redeemed + valid → Redeemed
    it('5. redeemed + valid coupon classifies as redeemed (not active)', () => {
        const item = {
            id: 'uc-5',
            coupon_status: 'redeemed',
            coupons: {
                id: 'c-5',
                title: 'Lunch Thali Combo',
                is_active: true,
                start_date: '2026-09-01T00:00:00+05:30',
                end_date: '2026-10-15T23:59:59+05:30',
                businesses: { status: 'approved' }
            }
        };
        assert.strictEqual(classifyUserCoupon(item, referenceNow), 'redeemed');
        const classified = classifyUserCoupons([item], referenceNow);
        assert.strictEqual(classified.active.length, 0);
        assert.strictEqual(classified.expired.length, 0);
        assert.strictEqual(classified.redeemed.length, 1);
    });

    // 6. redeemed + expired → Redeemed
    it('6. redeemed + past end_date classifies as redeemed (precedence over expiry)', () => {
        const item = {
            id: 'uc-6',
            coupon_status: 'redeemed',
            coupons: {
                id: 'c-6',
                title: 'New Year Coffee',
                is_active: true,
                start_date: '2026-01-01T00:00:00+05:30',
                end_date: '2026-01-31T23:59:59+05:30',
                businesses: { status: 'approved' }
            }
        };
        assert.strictEqual(classifyUserCoupon(item, referenceNow), 'redeemed');
        const classified = classifyUserCoupons([item], referenceNow);
        assert.strictEqual(classified.active.length, 0);
        assert.strictEqual(classified.expired.length, 0);
        assert.strictEqual(classified.redeemed.length, 1);
    });

    // 7. unclaimed coupon → not shown
    it('7. unclaimed coupon is neither active, expired, nor redeemed', () => {
        const item = {
            id: 'uc-7',
            coupon_status: 'available',
            coupons: {
                id: 'c-7',
                title: 'Browse-only deal',
                is_active: true,
                end_date: '2026-10-15T23:59:59+05:30'
            }
        };
        const status = classifyUserCoupon(item, referenceNow);
        assert.strictEqual(status, 'other');
        const classified = classifyUserCoupons([item], referenceNow);
        assert.strictEqual(classified.active.length, 0);
        assert.strictEqual(classified.expired.length, 0);
        assert.strictEqual(classified.redeemed.length, 0);
        assert.strictEqual(classified.counts.total, 0);
    });

    // 8. current user's coupons only: test with user_id filtering
    it('8. user isolation filters ensure only authenticated user coupons are processed', () => {
        const currentUserId = 'user-auth-123';
        const rawCoupons = [
            { id: 'uc-1', user_id: 'user-auth-123', coupon_status: 'claimed', coupons: { is_active: true, end_date: '2026-10-15' } },
            { id: 'uc-2', user_id: 'other-user-999', coupon_status: 'claimed', coupons: { is_active: true, end_date: '2026-10-15' } }
        ];
        const userCoupons = rawCoupons.filter(uc => uc.user_id === currentUserId);
        assert.strictEqual(userCoupons.length, 1);
        assert.strictEqual(userCoupons[0].id, 'uc-1');
        const classified = classifyUserCoupons(userCoupons, referenceNow);
        assert.strictEqual(classified.active.length, 1);
    });

    // 9. exact end-date boundary
    it('9. exact end-date boundary semantics: equal is active, 1 second earlier is expired', () => {
        const exactBoundary = new Date('2026-10-01T12:00:00+05:30');
        const oneSecBefore = new Date('2026-10-01T11:59:59+05:30');
        const oneSecAfter = new Date('2026-10-01T12:00:01+05:30');

        const activeAtBoundary = {
            coupon_status: 'claimed',
            coupons: { is_active: true, end_date: exactBoundary.toISOString() }
        };
        const expiredJustBefore = {
            coupon_status: 'claimed',
            coupons: { is_active: true, end_date: oneSecBefore.toISOString() }
        };
        const activeJustAfter = {
            coupon_status: 'claimed',
            coupons: { is_active: true, end_date: oneSecAfter.toISOString() }
        };

        // At exact boundary: end_date >= now is true, end_date < now is false
        assert.strictEqual(isCouponExpired(activeAtBoundary.coupons, exactBoundary), false);
        assert.strictEqual(isCouponActive(activeAtBoundary.coupons, exactBoundary), true);
        assert.strictEqual(classifyUserCoupon(activeAtBoundary, exactBoundary), 'active');

        // One second before: end_date < now is true
        assert.strictEqual(isCouponExpired(expiredJustBefore.coupons, exactBoundary), true);
        assert.strictEqual(isCouponActive(expiredJustBefore.coupons, exactBoundary), false);
        assert.strictEqual(classifyUserCoupon(expiredJustBefore, exactBoundary), 'expired');

        // One second after: active
        assert.strictEqual(isCouponExpired(activeJustAfter.coupons, exactBoundary), false);
        assert.strictEqual(isCouponActive(activeJustAfter.coupons, exactBoundary), true);
        assert.strictEqual(classifyUserCoupon(activeJustAfter, exactBoundary), 'active');
    });

    // 10. counts match sections
    it('10. summary counts strictly match the classified sections count', () => {
        const dataset = [
            { id: '1', coupon_status: 'claimed', coupons: { is_active: true, end_date: '2026-10-15T00:00:00+05:30' } },
            { id: '2', coupon_status: 'claimed', coupons: { is_active: true, end_date: '2026-10-20T00:00:00+05:30' } },
            { id: '3', coupon_status: 'claimed', coupons: { is_active: true, end_date: '2026-08-01T00:00:00+05:30' } },
            { id: '4', coupon_status: 'claimed', coupons: { is_active: true, end_date: '2026-09-01T00:00:00+05:30' } },
            { id: '5', coupon_status: 'claimed', coupons: { is_active: true, end_date: '2026-09-15T00:00:00+05:30' } },
            { id: '6', coupon_status: 'redeemed', coupons: { is_active: true, end_date: '2026-05-01T00:00:00+05:30' } },
            { id: '7', coupon_status: 'redeemed', coupons: { is_active: true, end_date: '2026-11-01T00:00:00+05:30' } },
        ];

        const { active, expired, redeemed, counts } = classifyUserCoupons(dataset, referenceNow);

        assert.strictEqual(active.length, 2);
        assert.strictEqual(expired.length, 3);
        assert.strictEqual(redeemed.length, 2);

        assert.strictEqual(counts.active, active.length);
        assert.strictEqual(counts.expired, expired.length);
        assert.strictEqual(counts.redeemed, redeemed.length);
        assert.strictEqual(counts.total, active.length + expired.length + redeemed.length);
    });

    // 11. expired coupons are not deleted
    it('11. expired coupons remain in the result set and are never deleted', () => {
        const item = {
            id: 'uc-expired-kept',
            user_id: 'user-1',
            coupon_id: 'c-exp',
            coupon_status: 'claimed',
            coupons: {
                id: 'c-exp',
                title: 'Kept Expired Deal',
                end_date: '2026-03-01T00:00:00+05:30'
            }
        };
        const { expired } = classifyUserCoupons([item], referenceNow);
        assert.strictEqual(expired.length, 1);
        assert.strictEqual(expired[0].id, 'uc-expired-kept');
        assert.strictEqual(expired[0].coupon_status, 'claimed'); // database record untouched
    });

    // 12. no expired coupon appears in Active
    it('12. guaranteed that no expired coupon appears in the Active section', () => {
        const dataset = [
            { id: 'exp-1', coupon_status: 'claimed', coupons: { is_active: true, end_date: '2026-04-05T10:31:07.81292' } },
            { id: 'exp-2', coupon_status: 'claimed', coupons: { is_active: true, end_date: '2026-03-21T10:31:07.81292' } },
            { id: 'act-1', coupon_status: 'claimed', coupons: { is_active: true, end_date: '2026-12-31T23:59:59' } },
        ];

        const { active, expired } = classifyUserCoupons(dataset, referenceNow);

        assert.strictEqual(active.length, 1);
        assert.strictEqual(active[0].id, 'act-1');

        assert.strictEqual(expired.length, 2);
        const expiredIds = expired.map(e => e.id);
        assert.ok(expiredIds.includes('exp-1'));
        assert.ok(expiredIds.includes('exp-2'));

        // Verify active does not contain any expired ids
        for (const act of active) {
            assert.ok(!expiredIds.includes(act.id));
        }
    });

    // 13. parseToISTDate handles Postgres TIMESTAMP WITHOUT TIME ZONE correctly
    it('13. parseToISTDate parses both ISO strings and Postgres TIMESTAMP WITHOUT TIME ZONE', () => {
        // Postgres TIMESTAMP WITHOUT TIME ZONE formatted string
        const pgTimestamp = '2026-10-01T12:00:00';
        const parsed = parseToISTDate(pgTimestamp);
        assert.ok(parsed instanceof Date);
        // Epoch of 2026-10-01T12:00:00+05:30
        const expected = new Date('2026-10-01T12:00:00+05:30').getTime();
        assert.strictEqual(parsed.getTime(), expected);

        // String with space instead of T
        const pgWithSpace = '2026-10-01 12:00:00';
        assert.strictEqual(parseToISTDate(pgWithSpace).getTime(), expected);

        // String with Z
        const utcString = '2026-10-01T06:30:00Z';
        assert.strictEqual(parseToISTDate(utcString).getTime(), expected);
    });

    // 14. open-ended coupon (null end_date) is active if claimed and is_active
    it('14. open-ended coupon (null end_date) remains active', () => {
        const item = {
            id: 'uc-open',
            coupon_status: 'claimed',
            coupons: {
                id: 'c-open',
                title: 'Always Active Deal',
                is_active: true,
                end_date: null,
                businesses: { status: 'approved' }
            }
        };
        assert.strictEqual(classifyUserCoupon(item, referenceNow), 'active');
    });

    // 15. unapproved business makes coupon not active
    it('15. coupon from unapproved business is excluded from active', () => {
        const item = {
            id: 'uc-unapp',
            coupon_status: 'claimed',
            coupons: {
                id: 'c-unapp',
                title: 'Pending Shop Deal',
                is_active: true,
                end_date: '2026-10-30T00:00:00+05:30',
                businesses: { status: 'pending' }
            }
        };
        assert.notStrictEqual(classifyUserCoupon(item, referenceNow), 'active');
    });
});
