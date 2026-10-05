/**
 * Helpers for My Coupons customer experience:
 * - Real-time IST date parsing and boundary validation
 * - Coupon status classification (REDEEMED -> EXPIRED -> ACTIVE)
 * - Separation of active vs expired claimed coupons
 */

import { getCurrentISTTimestamp } from './dateHelpers.js';
import { formatDisplayDate, getBusinessInitials } from './businessDetailsHelpers.js';

export { formatDisplayDate, getBusinessInitials };

/**
 * Parses any date representation (ISO string, UTC string, IST timestamp without time zone,
 * Date object, or numeric epoch) into a deterministic Date instance.
 *
 * For timestamps without timezone info (e.g. Postgres TIMESTAMP WITHOUT TIME ZONE '2026-10-01T13:46:02'),
 * interprets them as IST wall-clock timestamps (+05:30).
 *
 * @param {string|number|Date|null|undefined} dateInput
 * @returns {Date|null}
 */
export function parseToISTDate(dateInput) {
    if (!dateInput) return null;
    if (dateInput instanceof Date) {
        return isNaN(dateInput.getTime()) ? null : dateInput;
    }
    if (typeof dateInput === 'number') {
        const d = new Date(dateInput);
        return isNaN(d.getTime()) ? null : d;
    }
    if (typeof dateInput !== 'string') return null;

    const trimmed = dateInput.trim();
    if (trimmed.length === 0) return null;

    // Check if timezone offset or Z is already present
    // Matches e.g. 'Z', '+05:30', '-04:00', '+0530', '-0500' at the end of the string
    const hasTimezone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(trimmed);

    if (hasTimezone) {
        const d = new Date(trimmed);
        return isNaN(d.getTime()) ? null : d;
    }

    // No timezone specified: interpret as IST wall-clock timestamp (+05:30)
    const normalized = trimmed.replace(' ', 'T');
    const d = new Date(`${normalized}+05:30`);
    return isNaN(d.getTime()) ? null : d;
}

/**
 * Checks whether a coupon is expired based on its end_date timestamp.
 * A coupon is expired if end_date is strictly before the reference timestamp (end_date < now).
 * If end_date equals now, the coupon is still valid (not expired).
 *
 * @param {Object} coupon
 * @param {Date|string|number} [now=new Date()]
 * @returns {boolean}
 */
export function isCouponExpired(coupon, now = new Date()) {
    if (!coupon || !coupon.end_date) return false;
    const endDate = parseToISTDate(coupon.end_date);
    if (!endDate) return false;

    const nowDate = parseToISTDate(now) || new Date();
    return endDate.getTime() < nowDate.getTime();
}

/**
 * Validates whether a coupon is currently active and within its real-time validity window:
 * - is_active !== false
 * - business status !== 'rejected' / pending (if business is present and status is set)
 * - start_date <= now (if start_date is set)
 * - end_date >= now (if end_date is set)
 *
 * @param {Object} coupon
 * @param {Date|string|number} [now=new Date()]
 * @returns {boolean}
 */
export function isCouponActive(coupon, now = new Date()) {
    if (!coupon) return false;
    if (coupon.is_active === false) return false;

    // Business check if available
    const biz = coupon.businesses;
    if (biz && biz.status && biz.status !== 'approved') {
        return false;
    }

    const nowDate = parseToISTDate(now) || new Date();
    const nowTime = nowDate.getTime();

    // Start date check: start_date <= now
    if (coupon.start_date) {
        const startDate = parseToISTDate(coupon.start_date);
        if (startDate && startDate.getTime() > nowTime) {
            return false; // Future start date
        }
    }

    // End date check: end_date >= now (exact boundary is active)
    if (coupon.end_date) {
        const endDate = parseToISTDate(coupon.end_date);
        if (endDate && endDate.getTime() < nowTime) {
            return false; // Expired
        }
    }

    return true;
}

/**
 * Conceptual status priority:
 * REDEEMED
 *     ↓
 * EXPIRED
 *     ↓
 * ACTIVE
 *
 * Classifies a user_coupons record into one of:
 * - 'redeemed' : user successfully redeemed/used the coupon
 * - 'expired'  : coupon was claimed, not redeemed, and end_date has passed (end_date < now)
 * - 'active'   : coupon was claimed, not redeemed, is_active=true, start_date <= now <= end_date
 * - 'other'    : claimed but future start date, inactive, unapproved business, or unhandled
 *
 * @param {Object} userCoupon - Record from user_coupons (optionally joining coupons and businesses)
 * @param {Date|string|number} [now=new Date()] - Reference time for deterministic evaluation
 * @returns {'redeemed' | 'expired' | 'active' | 'other'}
 */
export function classifyUserCoupon(userCoupon, now = new Date()) {
    if (!userCoupon) return 'other';

    // 1. REDEEMED takes highest priority (regardless of coupon expiry date)
    if (userCoupon.coupon_status === 'redeemed') {
        return 'redeemed';
    }

    // Must be claimed by user
    if (userCoupon.coupon_status !== 'claimed') {
        return 'other';
    }

    const coupon = userCoupon.coupons || userCoupon;

    // 2. EXPIRED check (claimed but unredeemed and end_date < now)
    if (isCouponExpired(coupon, now)) {
        return 'expired';
    }

    // 3. ACTIVE check (claimed + valid real-time availability)
    if (isCouponActive(coupon, now)) {
        return 'active';
    }

    return 'other';
}

/**
 * Partitions a list of user_coupons records into Active, Expired, and Redeemed collections,
 * and computes accurate summary counts.
 *
 * @param {Array} userCouponsList - Array of user_coupons records
 * @param {Date|string|number} [now=new Date()] - Reference timestamp
 * @returns {{
 *   active: Array,
 *   expired: Array,
 *   redeemed: Array,
 *   counts: { active: number, expired: number, redeemed: number, total: number }
 * }}
 */
export function classifyUserCoupons(userCouponsList, now = new Date()) {
    const active = [];
    const expired = [];
    const redeemed = [];

    if (!Array.isArray(userCouponsList)) {
        return {
            active,
            expired,
            redeemed,
            counts: { active: 0, expired: 0, redeemed: 0, total: 0 }
        };
    }

    for (const item of userCouponsList) {
        const status = classifyUserCoupon(item, now);
        if (status === 'active') {
            active.push(item);
        } else if (status === 'expired') {
            expired.push(item);
        } else if (status === 'redeemed') {
            redeemed.push(item);
        }
    }

    return {
        active,
        expired,
        redeemed,
        counts: {
            active: active.length,
            expired: expired.length,
            redeemed: redeemed.length,
            total: active.length + expired.length + redeemed.length
        }
    };
}
