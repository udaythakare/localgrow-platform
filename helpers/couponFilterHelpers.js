/**
 * Helper utilities for customer coupon locality filtering, city resolution, and pagination.
 */

/**
 * Resolves the target city and location source according to the priority:
 * 1. Logged-in customer's primary profile location city (from user_locations)
 * 2. IP-detected city (from /api/geo)
 * 
 * @param {{ userLocationCity?: string|null, ipCity?: string|null }} params
 * @returns {{ city: string|null, source: 'profile_city' | 'ip_city' | 'none' }}
 */
export function resolveCustomerCity({ userLocationCity = null, ipCity = null } = {}) {
    if (typeof userLocationCity === 'string' && userLocationCity.trim().length > 0) {
        return {
            city: userLocationCity.trim(),
            source: 'profile_city'
        };
    }
    if (typeof ipCity === 'string' && ipCity.trim().length > 0) {
        return {
            city: ipCity.trim(),
            source: 'ip_city'
        };
    }
    return {
        city: null,
        source: 'none'
    };
}

/**
 * Validates and normalizes coupon query pagination parameters.
 * 
 * @param {number|null} limit 
 * @param {number|null} offset 
 * @param {number} defaultLimit 
 * @returns {{ limit: number, offset: number }}
 */
export function normalizePagination(limit, offset, defaultLimit = 5) {
    const validLimit = typeof limit === 'number' && limit > 0 ? Math.floor(limit) : defaultLimit;
    const validOffset = typeof offset === 'number' && offset >= 0 ? Math.floor(offset) : 0;
    return { limit: validLimit, offset: validOffset };
}

/**
 * Normalizes and sanitizes category ID input.
 * Rejects non-string types, event objects, and empty/whitespace strings.
 * 
 * @param {*} categoryId 
 * @returns {string|null}
 */
export function normalizeCategoryId(categoryId) {
    if (typeof categoryId === 'string' && categoryId.trim().length > 0) {
        return categoryId.trim();
    }
    return null;
}

/**
 * Formats empty state messaging based on location and category context.
 * 
 * @param {{ locationSource: string, locationName: string|null, categoryName?: string|null }} params
 * @returns {{ title: string, message: string, buttonText: string, isLocationUnknown: boolean }}
 */
export function getCouponEmptyStateContent({ locationSource = 'none', locationName = null, categoryName = null } = {}) {
    const isLocationUnknown = locationSource === 'none' || !locationName || locationName.trim().length === 0;

    if (isLocationUnknown) {
        return {
            title: "Location Required",
            message: "We couldn't determine your location. Please ensure location services are enabled or set your city in your profile to discover local deals.",
            buttonText: "Retry Location",
            isLocationUnknown: true
        };
    }

    const trimmedLoc = locationName.trim();

    if (categoryName && categoryName.trim().length > 0) {
        const cat = categoryName.trim();
        return {
            title: `No ${cat} Deals in ${trimmedLoc}`,
            message: `There are currently no active ${cat} coupons in ${trimmedLoc}. Try selecting another category or check back later!`,
            buttonText: "Clear Category Filter",
            isLocationUnknown: false
        };
    }

    return {
        title: `No Deals Found in ${trimmedLoc}`,
        message: `There are currently no active offers from approved businesses in ${trimmedLoc}. Check back soon as new deals are added regularly!`,
        buttonText: "Refresh Deals",
        isLocationUnknown: false
    };
}

/**
 * Checks whether a coupon is expired based on its end_date timestamp.
 * 
 * @param {Object} coupon 
 * @param {Date} [now=new Date()] 
 * @returns {boolean}
 */
export function isCouponExpired(coupon, now = new Date()) {
    if (!coupon || !coupon.end_date) return false;
    const endDate = new Date(coupon.end_date);
    if (isNaN(endDate.getTime())) return false;
    return endDate.getTime() < now.getTime();
}

/**
 * Validates that a coupon is currently active and within its start/end validity window.
 * Does NOT rely on is_expired; uses real timestamps.
 * 
 * @param {Object} coupon 
 * @param {Date} [now=new Date()] 
 * @returns {boolean}
 */
export function isCouponValid(coupon, now = new Date()) {
    if (!coupon) return false;
    if (coupon.is_active === false) return false;
    if (coupon.businesses && coupon.businesses.status && coupon.businesses.status !== 'approved') return false;

    const nowTime = now.getTime();

    if (coupon.start_date) {
        const startDate = new Date(coupon.start_date);
        if (!isNaN(startDate.getTime()) && startDate.getTime() > nowTime) {
            return false; // Not yet started
        }
    }

    if (coupon.end_date) {
        const endDate = new Date(coupon.end_date);
        if (!isNaN(endDate.getTime()) && endDate.getTime() < nowTime) {
            return false; // Expired
        }
    }

    return true;
}

/**
 * Checks if a coupon is expiring soon (within next 24 hours).
 * Requires:
 * 1. Coupon is currently valid (not expired, not inactive)
 * 2. Coupon has a valid end_date (coupons without end_date return false)
 * 3. end_date is >= now AND <= now + hours (default 24h)
 * 
 * @param {Object} coupon 
 * @param {Date} [now=new Date()] 
 * @param {number} [hours=24] 
 * @returns {boolean}
 */
export function isCouponExpiringSoon(coupon, now = new Date(), hours = 24) {
    if (!coupon || !coupon.end_date) return false;
    if (!isCouponValid(coupon, now)) return false;

    const endDate = new Date(coupon.end_date);
    if (isNaN(endDate.getTime())) return false;

    const nowTime = now.getTime();
    const windowEnd = nowTime + hours * 60 * 60 * 1000;

    return endDate.getTime() >= nowTime && endDate.getTime() <= windowEnd;
}

/**
 * Sorts coupons by actual creation timestamp descending (newest first).
 * 
 * @param {Array} coupons 
 * @returns {Array}
 */
export function sortCouponsByNewest(coupons) {
    if (!Array.isArray(coupons)) return [];
    return [...coupons].sort((a, b) => {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return timeB - timeA;
    });
}

/**
 * Sorts coupons by earliest end_date first (ascending).
 * 
 * @param {Array} coupons 
 * @returns {Array}
 */
export function sortCouponsByExpiringSoon(coupons) {
    if (!Array.isArray(coupons)) return [];
    return [...coupons].sort((a, b) => {
        const timeA = a.end_date ? new Date(a.end_date).getTime() : Infinity;
        const timeB = b.end_date ? new Date(b.end_date).getTime() : Infinity;
        return timeA - timeB;
    });
}

/**
 * Checks if a coupon matches a given target city.
 * 
 * @param {Object} coupon 
 * @param {string|null} targetCity 
 * @returns {boolean}
 */
export function isLocalityMatch(coupon, targetCity) {
    if (!targetCity || typeof targetCity !== 'string' || targetCity.trim().length === 0) {
        return true;
    }
    const cleanCity = targetCity.trim().toLowerCase();

    // Check direct coupon city
    if (typeof coupon?.city === 'string' && coupon.city.trim().toLowerCase() === cleanCity) {
        return true;
    }

    // Check businesses.business_locations
    const locations = coupon?.businesses?.business_locations;
    if (Array.isArray(locations)) {
        return locations.some(loc => loc && typeof loc.city === 'string' && loc.city.trim().toLowerCase() === cleanCity);
    } else if (locations && typeof locations.city === 'string') {
        return locations.city.trim().toLowerCase() === cleanCity;
    }

    return true;
}

/**
 * Deterministic comparator for the "For You" customer feed.
 * 
 * Priority hierarchy:
 * 1. Category affinity: Categories previously claimed/redeemed by user (descending count)
 * 2. Locality match: Target city match prioritized over non-local
 * 3. Business rating: Higher-rated businesses from business_reviews (descending average rating)
 * 4. Local popularity: Current coupon claims (descending current_claims)
 * 5. Newer coupons: Actual creation timestamp created_at (descending)
 * 6. Deterministic tie-breaker: Coupon ID (localeCompare)
 * 
 * @param {Object} a 
 * @param {Object} b 
 * @param {{ userCategoryWeights?: Object, businessRatingMap?: Object, targetCity?: string }} context 
 * @returns {number}
 */
export function compareForYouCoupons(a, b, context = {}) {
    const {
        userCategoryWeights = {},
        businessRatingMap = {},
        targetCity = null
    } = context;

    // 1. Categories customer has previously claimed/redeemed
    const catA = a?.businesses?.category_id || a?.category_id || null;
    const catB = b?.businesses?.category_id || b?.category_id || null;
    const weightA = catA ? (userCategoryWeights[catA] || 0) : 0;
    const weightB = catB ? (userCategoryWeights[catB] || 0) : 0;

    if (weightB !== weightA) {
        return weightB - weightA;
    }

    // 2. Locality match
    if (targetCity) {
        const localA = isLocalityMatch(a, targetCity);
        const localB = isLocalityMatch(b, targetCity);
        if (localA !== localB) {
            return localA ? -1 : 1;
        }
    }

    // 3. Higher-rated businesses
    const bizIdA = a?.business_id || a?.businesses?.id;
    const bizIdB = b?.business_id || b?.businesses?.id;
    const ratingA = (bizIdA && businessRatingMap[bizIdA]?.avgRating !== undefined)
        ? businessRatingMap[bizIdA].avgRating
        : (typeof a?.business_rating === 'number' ? a.business_rating : 0);
    const ratingB = (bizIdB && businessRatingMap[bizIdB]?.avgRating !== undefined)
        ? businessRatingMap[bizIdB].avgRating
        : (typeof b?.business_rating === 'number' ? b.business_rating : 0);

    const ratingDiff = ratingB - ratingA;
    if (Math.abs(ratingDiff) > 0.0001) {
        return ratingDiff;
    }

    // 4. Local popularity / current claims
    const claimsA = typeof a?.current_claims === 'number' && !isNaN(a.current_claims) ? a.current_claims : 0;
    const claimsB = typeof b?.current_claims === 'number' && !isNaN(b.current_claims) ? b.current_claims : 0;
    if (claimsB !== claimsA) {
        return claimsB - claimsA;
    }

    // 5. Newer coupons as tie-breaker (created_at DESC)
    const getTime = (dateStr) => {
        if (!dateStr) return 0;
        const ms = new Date(dateStr).getTime();
        return isNaN(ms) ? 0 : ms;
    };
    const timeA = getTime(a?.created_at);
    const timeB = getTime(b?.created_at);
    if (timeB !== timeA) {
        return timeB - timeA;
    }

    // 6. Final deterministic tie-breaker: coupon ID
    const idA = String(a?.id || '');
    const idB = String(b?.id || '');
    return idA.localeCompare(idB);
}

/**
 * Sorts coupons for the "For You" customer feed using deterministic ranking.
 * 
 * @param {Array} coupons 
 * @param {Object} context 
 * @returns {Array}
 */
export function sortCouponsForYou(coupons, context = {}) {
    if (!Array.isArray(coupons)) return [];
    return [...coupons].sort((a, b) => compareForYouCoupons(a, b, context));
}

