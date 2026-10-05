'use server';
import { getUserId } from '@/helpers/userHelper';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { revalidatePath } from 'next/cache';
import { getCurrentISTTimestamp, getFutureISTTimestamp } from '@/helpers/dateHelpers';
import { resolveCustomerCity, normalizePagination, normalizeCategoryId, sortCouponsForYou, isCouponValid } from '@/helpers/couponFilterHelpers';

/**
 * Applies customer-facing coupon availability rules:
 * 1. is_active = true
 * 2. start_date IS NULL OR start_date <= current IST wall-clock time
 * 3. end_date IS NULL OR end_date >= current IST wall-clock time
 * 4. associated business status = 'approved' (via businesses!inner)
 */
function applyCouponAvailabilityFilter(query, nowIst = getCurrentISTTimestamp()) {
    return query
        .eq('is_active', true)
        .eq('businesses.status', 'approved')
        .or(`start_date.is.null,start_date.lte.${nowIst}`)
        .or(`end_date.is.null,end_date.gte.${nowIst}`);
}


// ─────────────────────────────────────────────────────────────────────────────
// NEW: Fetch all business categories (for the category pill bar)
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchAllCategories() {
    const { data, error } = await supabaseAdmin
        .from('business_categories')
        .select('id, name, description')
        .order('name', { ascending: true });

    if (error) {
        console.error('Error fetching categories:', error);
        return { success: false, error };
    }

    return { success: true, categories: data || [] };
}


// ─────────────────────────────────────────────────────────────────────────────
// NEW: Fetch coupons filtered by business category
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchCouponsByCategory(categoryId, options = {}) {
    return fetchLocationBasedCoupons({
        ...options,
        categoryId
    });
}


// ─────────────────────────────────────────────────────────────────────────────
// NEW: Fetch coupons expiring within the next 24 hours (Expires Soon)
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchExpiresSoonCoupons(options = {}) {
    return fetchLocationBasedCoupons({
        ...options,
        expiresSoon: true,
        sortBy: 'expiring_soon'
    });
}


// ─────────────────────────────────────────────────────────────────────────────
// NEW: Fetch personalized coupons for customer "For You" feed
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchForYouCoupons(options = {}) {
    const {
        city: clientProvidedCity = null,
        categoryId = null,
        limit = 8,
        offset = 0,
        includeCount = false
    } = options;

    const rawUserId = await getUserId();
    const userId = typeof rawUserId === 'string' && rawUserId.trim().length > 0 ? rawUserId.trim() : null;
    const nowIst = getCurrentISTTimestamp();

    // Step 1: Resolve customer's city:
    // Priority 1: Logged-in customer's primary user_locations city
    // Priority 2: clientProvidedCity (from IP detection)
    let userLocCity = null;
    if (userId) {
        const { data: primaryLoc } = await supabaseAdmin
            .from("user_locations")
            .select("city, is_primary")
            .eq("user_id", userId)
            .eq("is_primary", true)
            .maybeSingle();

        if (primaryLoc?.city && primaryLoc.city.trim().length > 0) {
            userLocCity = primaryLoc.city.trim();
        } else {
            const { data: anyLoc } = await supabaseAdmin
                .from("user_locations")
                .select("city")
                .eq("user_id", userId)
                .not("city", "is", null)
                .maybeSingle();

            if (anyLoc?.city && anyLoc.city.trim().length > 0) {
                userLocCity = anyLoc.city.trim();
            }
        }
    }

    const { city: targetCity, source: locationSource } = resolveCustomerCity({
        userLocationCity: userLocCity,
        ipCity: clientProvidedCity
    });

    // If location cannot be determined, return empty without substituting distant offers
    if (!targetCity) {
        return {
            success: true,
            coupons: [],
            totalCount: 0,
            locationSource: 'none',
            locationName: null,
            message: 'Location could not be determined. Please enable location or set your city in your profile.'
        };
    }

    // Step 2: Find approved businesses in the specified city (and category if provided)
    let locationQuery = supabaseAdmin
        .from("business_locations")
        .select("business_id, city, businesses!inner(id, status, category_id)")
        .ilike("city", targetCity)
        .eq("businesses.status", "approved");

    const targetCategoryId = normalizeCategoryId(categoryId);
    if (targetCategoryId) {
        locationQuery = locationQuery.eq("businesses.category_id", targetCategoryId);
    }

    const { data: businessLocations, error: locationsError } = await locationQuery;

    if (locationsError) {
        console.error("Error fetching locations for For You feed:", locationsError);
        return {
            success: false,
            error: locationsError,
            coupons: [],
            totalCount: 0,
            locationSource,
            locationName: targetCity
        };
    }

    if (!businessLocations || businessLocations.length === 0) {
        return {
            success: true,
            coupons: [],
            totalCount: 0,
            locationSource,
            locationName: targetCity
        };
    }

    const businessIds = [...new Set(businessLocations.map(location => location.business_id))];
    if (businessIds.length === 0) {
        return {
            success: true,
            coupons: [],
            totalCount: 0,
            locationSource,
            locationName: targetCity
        };
    }

    // Step 3: Fetch active candidate coupons, user claim history, and business reviews in parallel
    const couponQuery = supabaseAdmin
        .from("coupons")
        .select(`
            *,
            businesses!inner(
                id,
                name,
                category_id,
                logo_url,
                business_categories(
                    id,
                    name
                ),
                business_locations(
                    id,
                    address,
                    area,
                    city,
                    state,
                    postal_code
                )
            )
        `)
        .in("business_id", businessIds);

    const availableCouponQuery = applyCouponAvailabilityFilter(couponQuery, nowIst);

    const userHistoryPromise = userId
        ? supabaseAdmin
            .from("user_coupons")
            .select(`
                coupon_id,
                coupon_status,
                coupons!inner(
                    business_id,
                    businesses!inner(category_id)
                )
            `)
            .eq("user_id", userId)
        : Promise.resolve({ data: [] });

    const reviewsPromise = supabaseAdmin
        .from("business_reviews")
        .select("business_id, rating")
        .in("business_id", businessIds);

    const [
        { data: rawCoupons, error: couponsError },
        { data: userCouponsData, error: userCouponsError },
        { data: reviewsData, error: reviewsError }
    ] = await Promise.all([
        availableCouponQuery,
        userHistoryPromise,
        reviewsPromise
    ]);

    if (couponsError) {
        console.error("Error fetching coupons for For You feed:", couponsError);
        return {
            success: false,
            error: couponsError,
            coupons: [],
            totalCount: 0,
            locationSource,
            locationName: targetCity
        };
    }

    // Build user category weights from previous claims/redemptions
    const userCategoryWeights = {};
    const claimedCouponIds = new Set();
    if (Array.isArray(userCouponsData)) {
        userCouponsData.forEach(item => {
            if (item.coupon_id) {
                claimedCouponIds.add(item.coupon_id);
            }
            const catId = item?.coupons?.businesses?.category_id;
            if (catId) {
                userCategoryWeights[catId] = (userCategoryWeights[catId] || 0) + 1;
            }
        });
    }

    // Build business rating map from business_reviews
    const businessRatingMap = {};
    if (Array.isArray(reviewsData)) {
        reviewsData.forEach(rev => {
            if (!rev.business_id || typeof rev.rating !== 'number') return;
            if (!businessRatingMap[rev.business_id]) {
                businessRatingMap[rev.business_id] = { sum: 0, count: 0, avgRating: 0 };
            }
            businessRatingMap[rev.business_id].sum += rev.rating;
            businessRatingMap[rev.business_id].count += 1;
            businessRatingMap[rev.business_id].avgRating =
                businessRatingMap[rev.business_id].sum / businessRatingMap[rev.business_id].count;
        });
    }

    // Filter, annotate, and deduplicate candidate coupons
    const seenCouponIds = new Set();
    const candidateCoupons = [];
    const now = new Date();

    for (const coupon of (rawCoupons || [])) {
        if (!coupon || !coupon.id) continue;
        if (seenCouponIds.has(coupon.id)) continue;
        if (!isCouponValid(coupon, now)) continue;

        seenCouponIds.add(coupon.id);
        const bizId = coupon.business_id || coupon.businesses?.id;
        const bizRating = businessRatingMap[bizId]?.avgRating ?? 0;
        const ratingCount = businessRatingMap[bizId]?.count ?? 0;

        candidateCoupons.push({
            ...coupon,
            business_rating: bizRating,
            rating_count: ratingCount,
            is_claimed: claimedCouponIds.has(coupon.id)
        });
    }

    // Step 4: Deterministic ranking
    const rankedCoupons = sortCouponsForYou(candidateCoupons, {
        userCategoryWeights,
        businessRatingMap,
        targetCity
    });

    const totalCount = rankedCoupons.length;

    // Step 5: Pagination
    let pagedCoupons = rankedCoupons;
    if (limit !== null && limit !== undefined) {
        const { limit: validLimit, offset: validOffset } = normalizePagination(limit, offset, 8);
        pagedCoupons = rankedCoupons.slice(validOffset, validOffset + validLimit);
    }

    return {
        success: true,
        coupons: pagedCoupons,
        totalCount,
        locationSource,
        locationName: targetCity
    };
}



// ─────────────────────────────────────────────────────────────────────────────
// EXISTING — everything below is exactly your original code, untouched
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchAllCoupons(options = {}) {
    const {
        sortBy = 'newest', // 'newest', 'oldest'
        dateFilter = null, // { after: '2024-01-01', before: '2024-12-31' }
        limit = null,
        offset = 0,
        includeCount = false
    } = options;

    const userId = await getUserId();
    const nowIst = getCurrentISTTimestamp();

    // Build the base query
    let query = supabaseAdmin.from("coupons").select(`
        *,
        businesses!inner(
            id,
            name,
            category_id,
            logo_url,
            business_categories(
                id,
                name
            ),
            business_locations(
                id,
                address,
                area,
                city,
                state,
                postal_code
            )
        )
    `);

    query = applyCouponAvailabilityFilter(query, nowIst);

    // Apply date filtering if provided
    if (dateFilter) {
        if (dateFilter.after) {
            query = query.gte('created_at', dateFilter.after);
        }
        if (dateFilter.before) {
            query = query.lte('created_at', dateFilter.before);
        }
    }

    // Apply sorting
    if (sortBy === 'newest') {
        query = query.order('created_at', { ascending: false });
    } else if (sortBy === 'oldest') {
        query = query.order('created_at', { ascending: true });
    }

    // Apply pagination
    if (limit) {
        query = query.range(offset, offset + limit - 1);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Error fetching coupons:", error);
        return { success: false, error };
    }

    // Get total count if requested
    let totalCount = null;
    if (includeCount) {
        let countQuery = supabaseAdmin
            .from("coupons")
            .select("*, businesses!inner(status)", { count: 'exact', head: true });

        countQuery = applyCouponAvailabilityFilter(countQuery, nowIst);

        // Apply same filters for count
        if (dateFilter) {
            if (dateFilter.after) {
                countQuery = countQuery.gte('created_at', dateFilter.after);
            }
            if (dateFilter.before) {
                countQuery = countQuery.lte('created_at', dateFilter.before);
            }
        }

        const { count: totalCouponsCount, error: countError } = await countQuery;
        if (!countError) {
            totalCount = totalCouponsCount;
        }
    }

    if (!userId) {
        return {
            success: true,
            coupons: data || [],
            totalCount
        };
    }

    // Fetch user's claimed coupons
    const { data: userCoupons, error: userCouponsError } = await supabaseAdmin
        .from("user_coupons")
        .select("coupon_id")
        .eq("user_id", userId);

    if (userCouponsError) {
        console.error("Error fetching user coupons:", userCouponsError);
        return { success: false, error: userCouponsError };
    }

    // Create a Set of coupon IDs that the user has claimed for efficient lookup
    const claimedCouponIds = new Set(userCoupons.map(uc => uc.coupon_id));

    // Add is_claimed field to each coupon
    const couponsWithClaimStatus = (data || []).map(coupon => ({
        ...coupon,
        is_claimed: claimedCouponIds.has(coupon.id)
    }));

    return {
        success: true,
        coupons: couponsWithClaimStatus || [],
        totalCount
    };
}




// Additional helper functions for specific use cases

export async function fetchRecentCoupons(days = 7) {
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - days);

    return await fetchAllCoupons({
        sortBy: 'newest',
        dateFilter: {
            after: dateThreshold.toISOString()
        }
    });
}

export async function fetchCouponsFromDateRange(startDate, endDate) {
    return await fetchAllCoupons({
        sortBy: 'newest',
        dateFilter: {
            after: startDate,
            before: endDate
        }
    });
}

export async function fetchLatestCoupons(limit = 10) {
    return await fetchAllCoupons({
        sortBy: 'newest',
        limit: limit
    });
}



/**
 * Fetch coupons based on the customer's locality.
 * Resolves location using:
 * 1. Logged-in customer's primary user_locations city
 * 2. IP-detected city
 * 
 * Applies the same locality, category, and active eligibility filters.
 * Does NOT fall back to distant / all-city coupons.
 */
export async function fetchLocationBasedCoupons(options = {}) {
    const {
        city: clientProvidedCity = null,
        categoryId = null,
        limit = null,
        offset = 0,
        includeCount = false,
        sortBy = 'newest',
        expiresSoon = false
    } = options;

    const rawUserId = await getUserId();
    const userId = typeof rawUserId === 'string' && rawUserId.trim().length > 0 ? rawUserId.trim() : null;
    const nowIst = getCurrentISTTimestamp();

    // Step 1: Resolve customer's city:
    // Priority 1: Logged-in customer's primary user_locations city
    // Priority 2: clientProvidedCity (from IP detection)
    let userLocCity = null;
    if (userId) {
        const { data: primaryLoc } = await supabaseAdmin
            .from("user_locations")
            .select("city, is_primary")
            .eq("user_id", userId)
            .eq("is_primary", true)
            .maybeSingle();

        if (primaryLoc?.city && primaryLoc.city.trim().length > 0) {
            userLocCity = primaryLoc.city.trim();
        } else {
            const { data: anyLoc } = await supabaseAdmin
                .from("user_locations")
                .select("city")
                .eq("user_id", userId)
                .not("city", "is", null)
                .maybeSingle();

            if (anyLoc?.city && anyLoc.city.trim().length > 0) {
                userLocCity = anyLoc.city.trim();
            }
        }
    }

    const { city: targetCity, source: locationSource } = resolveCustomerCity({
        userLocationCity: userLocCity,
        ipCity: clientProvidedCity
    });

    // If location cannot be determined, return empty without substituting distant offers
    if (!targetCity) {
        return {
            success: true,
            coupons: [],
            totalCount: 0,
            locationSource: 'none',
            locationName: null,
            message: 'Location could not be determined. Please enable location or set your city in your profile.'
        };
    }

    // Step 2: Find approved businesses in the specified city (and category if provided)
    let locationQuery = supabaseAdmin
        .from("business_locations")
        .select("business_id, businesses!inner(id, status, category_id)")
        .ilike("city", targetCity)
        .eq("businesses.status", "approved");

    const targetCategoryId = normalizeCategoryId(categoryId);
    if (targetCategoryId) {
        locationQuery = locationQuery.eq("businesses.category_id", targetCategoryId);
    }

    const { data: businessLocations, error: locationsError } = await locationQuery;

    if (locationsError) {
        console.error("Error fetching locations:", locationsError);
        return {
            success: false,
            error: locationsError,
            coupons: [],
            totalCount: 0,
            locationSource,
            locationName: targetCity
        };
    }

    if (!businessLocations || businessLocations.length === 0) {
        // No approved businesses in this city/category - return clean empty state without fallback
        return {
            success: true,
            coupons: [],
            totalCount: 0,
            locationSource,
            locationName: targetCity
        };
    }

    const businessIds = [...new Set(businessLocations.map(location => location.business_id))];
    if (businessIds.length === 0) {
        return {
            success: true,
            coupons: [],
            totalCount: 0,
            locationSource,
            locationName: targetCity
        };
    }

    // Step 3: Build the coupon query
    let query = supabaseAdmin.from("coupons").select(`
        *,
        businesses!inner(
            id,
            name,
            category_id,
            logo_url,
            business_categories(
                id,
                name
            ),
            business_locations(
                id,
                address,
                area,
                city,
                state,
                postal_code
            )
        )
    `);
    query = query.in("business_id", businessIds);

    if (expiresSoon) {
        const future24hIst = getFutureISTTimestamp(24);
        query = query
            .eq('is_active', true)
            .or(`start_date.is.null,start_date.lte.${nowIst}`)
            .not('end_date', 'is', null)
            .gte('end_date', nowIst)
            .lte('end_date', future24hIst)
            .order('end_date', { ascending: true });
    } else {
        query = applyCouponAvailabilityFilter(query, nowIst);

        if (sortBy === 'oldest') {
            query = query.order("created_at", { ascending: true });
        } else if (sortBy === 'expiring_soon') {
            query = query.order("end_date", { ascending: true });
        } else {
            // Default customer feed: newest first by actual creation timestamp
            query = query.order("created_at", { ascending: false });
        }
    }

    if (limit !== null && limit !== undefined) {
        const { limit: validLimit, offset: validOffset } = normalizePagination(limit, offset);
        query = query.range(validOffset, validOffset + validLimit - 1);
    }

    const { data: cityCoupons, error: cityCouponsError } = await query;

    if (cityCouponsError) {
        console.error("Error fetching city coupons:", cityCouponsError);
        return {
            success: false,
            error: cityCouponsError,
            coupons: [],
            totalCount: 0,
            locationSource,
            locationName: targetCity
        };
    }

    if (!cityCoupons || cityCoupons.length === 0) {
        return {
            success: true,
            coupons: [],
            totalCount: 0,
            locationSource,
            locationName: targetCity
        };
    }

    // Step 4: Get total count if requested
    let totalCount = cityCoupons.length;
    if (includeCount) {
        let countQuery = supabaseAdmin
            .from("coupons")
            .select("*, businesses!inner(status)", { count: 'exact', head: true })
            .in("business_id", businessIds);

        if (expiresSoon) {
            const future24hIst = getFutureISTTimestamp(24);
            countQuery = countQuery
                .eq('is_active', true)
                .or(`start_date.is.null,start_date.lte.${nowIst}`)
                .not('end_date', 'is', null)
                .gte('end_date', nowIst)
                .lte('end_date', future24hIst);
        } else {
            countQuery = applyCouponAvailabilityFilter(countQuery, nowIst);
        }

        const { count, error: countError } = await countQuery;
        if (!countError && count !== null) {
            totalCount = count;
        }
    }

    // Step 5: Fetch business ratings from reviews for these businesses
    const businessRatingMap = {};
    const { data: reviewsData } = await supabaseAdmin
        .from("business_reviews")
        .select("business_id, rating")
        .in("business_id", businessIds);

    if (Array.isArray(reviewsData)) {
        reviewsData.forEach(rev => {
            if (!rev.business_id || typeof rev.rating !== 'number') return;
            if (!businessRatingMap[rev.business_id]) {
                businessRatingMap[rev.business_id] = { sum: 0, count: 0, avgRating: 0 };
            }
            businessRatingMap[rev.business_id].sum += rev.rating;
            businessRatingMap[rev.business_id].count += 1;
            businessRatingMap[rev.business_id].avgRating =
                businessRatingMap[rev.business_id].sum / businessRatingMap[rev.business_id].count;
        });
    }

    // Step 6: Add claim status if user is logged in & attach rating metadata
    let claimedCouponIds = new Set();
    if (userId) {
        const { data: userCoupons } = await supabaseAdmin
            .from("user_coupons")
            .select("coupon_id")
            .eq("user_id", userId);

        claimedCouponIds = new Set((userCoupons || []).map(uc => uc.coupon_id));
    }

    const annotatedCoupons = cityCoupons.map(coupon => {
        const bId = coupon.business_id || coupon.businesses?.id;
        const ratingInfo = businessRatingMap[bId];
        return {
            ...coupon,
            business_rating: ratingInfo?.avgRating ?? 0,
            rating_count: ratingInfo?.count ?? 0,
            is_claimed: claimedCouponIds.has(coupon.id)
        };
    });

    return {
        success: true,
        coupons: annotatedCoupons,
        totalCount,
        locationSource,
        locationName: targetCity
    };
}


export async function claimCoupon(couponId, redeemMinutes = 0) {
    const userId = await getUserId();
    if (!userId) {
        return { success: false, message: "User not logged in" };
    }

    // Fetch coupon details including type and end_date
    const { data: couponData, error: couponError } = await supabaseAdmin
        .from("coupons")
        .select("user_id, coupon_type, end_date, redemption_time_type, redemption_start_time, redemption_end_time")
        .eq("id", couponId)
        .single();

    if (couponError) {
        console.error("Error fetching coupon data:", couponError);
        return { success: false, error: couponError };
    }

    if (couponData.user_id === userId) {
        return { success: false, message: "You cannot claim your own coupon" };
    }

    // Check if user has already claimed this coupon
    const { data: existingCoupon, error: checkError } = await supabaseAdmin
        .from("user_coupons")
        .select("*")
        .eq("user_id", userId)
        .eq("coupon_id", couponId)
        .single();

    // If there was no error, it means the coupon was found
    if (existingCoupon) {
        return {
            success: false,
            message: "Coupon already claimed by this user",
            coupon: existingCoupon
        };
    }

    // If there was an error other than "not found", return it
    if (checkError && checkError.code !== "PGRST116") {
        console.error("Error checking existing coupon:", checkError);
        return { success: false, error: checkError };
    }

    // Check time restrictions for specific hours redemption
    if (couponData.redemption_time_type === "specific_hours") {
        const now = new Date();
        const currentTime = now.toTimeString().slice(0, 8); // Get HH:MM:SS format

        const startTime = couponData.redemption_start_time;
        const endTime = couponData.redemption_end_time;

        // Function to compare time strings in HH:MM:SS format
        const isTimeInRange = (current, start, end) => {
            // Handle case where end time is next day (e.g., 22:00 to 06:00)
            if (start <= end) {
                // Same day range (e.g., 09:00 to 17:00)
                return current >= start && current <= end;
            } else {
                // Cross midnight range (e.g., 22:00 to 06:00)
                return current >= start || current <= end;
            }
        };

        if (!isTimeInRange(currentTime, startTime, endTime)) {
            return {
                success: false,
                message: `Coupon can only be claimed between ${startTime} and ${endTime}`
            };
        }
    }

    // For newly claimed coupons, campaign validity comes from coupons.start_date and coupons.end_date.
    // Do not calculate a 5/10-minute timer. For backward compatibility with the user_coupons schema,
    // remaining_claim_time mirrors the campaign's end_date (or null if open-ended).
    const remaining_claim_time = couponData.end_date
        ? new Date(couponData.end_date).toISOString()
        : null;
    const coupon_status = "claimed";

    // Insert the new user_coupon
    const { data, error } = await supabaseAdmin
        .from("user_coupons")
        .insert([{
            user_id: userId,
            coupon_id: couponId,
            coupon_status: coupon_status,
            remaining_claim_time: remaining_claim_time
        }])
        .select("*")
        .single();

    if (error) {
        console.error("Error claiming coupon:", error);
        return { success: false, error };
    }

    // ── Atomic max_claims enforcement ──────────────────────────────────────
    // Step 1: Read current state
    const { data: couponRow, error: fetchError } = await supabaseAdmin
        .from('coupons')
        .select('current_claims, max_claims')
        .eq('id', couponId)
        .single();

    if (fetchError || !couponRow) {
        console.error('Error fetching coupon for claim counter:', fetchError);
        return { success: false, error: fetchError };
    }

    // Pre-check: fast rejection before we attempt the DB update
    if (couponRow.max_claims !== null && couponRow.current_claims >= couponRow.max_claims) {
        // Roll back the user_coupon we just inserted
        await supabaseAdmin
            .from('user_coupons')
            .delete()
            .eq('user_id', userId)
            .eq('coupon_id', couponId);
        return { success: false, message: 'This coupon has reached its maximum claim limit' };
    }

    // Step 2: Conditional atomic increment.
    // The filter re-checks the guard at DB level, so even if two concurrent
    // claims both pass step 1, only one succeeds here (the other gets 0 rows).
    let updateQuery = supabaseAdmin
        .from('coupons')
        .update({ current_claims: (couponRow.current_claims ?? 0) + 1 })
        .eq('id', couponId)
        .eq('current_claims', couponRow.current_claims); // optimistic-lock on current value

    if (couponRow.max_claims !== null) {
        updateQuery = updateQuery.lt('current_claims', couponRow.max_claims);
    }

    const { data: updatedRows, error: updError } = await updateQuery.select('id');

    if (updError) {
        // Roll back the user_coupon row we just inserted
        await supabaseAdmin
            .from('user_coupons')
            .delete()
            .eq('user_id', userId)
            .eq('coupon_id', couponId);
        console.error('Error updating coupon count:', updError);
        return { success: false, error: updError };
    }

    if (!updatedRows || updatedRows.length === 0) {
        // Concurrent claim won the race — quota is now full or counter changed.
        await supabaseAdmin
            .from('user_coupons')
            .delete()
            .eq('user_id', userId)
            .eq('coupon_id', couponId);
        return { success: false, message: 'This coupon has reached its maximum claim limit' };
    }

    // revalidatePath("/u/profile");
    revalidatePath("/coupons");
    revalidatePath("/u/profile/my-coupons");

    return {
        success: true,
        coupon: data,
    };
}


export async function fetchUserCoupons(couponId) {
    const userId = await getUserId();
    if (!userId) {
        return { success: false, message: "User not logged in" };
    }

    const { data, error } = await supabaseAdmin
        .from("user_coupons")
        .select(`
    *,
    coupons(
        *,
        businesses(
            name,
            business_locations(
                address,
                area,
                city,
                state,
                postal_code
            )
        )
    )
`)
        .eq("user_id", userId)

    if (error) {
        console.error("Error fetching user coupons:", error);
        return { success: false, error };
    }

    return {
        success: true,
        coupons: data || [],
    };
}

export async function fetchUserClaimedCoupons() {

    const userId = await getUserId();

    if (!userId) {
        return { success: false, message: "User not logged in" };
    }

    const { data, error } = await supabaseAdmin
        .from("user_coupons")
        .select(`
            *,
            coupons(
                id,
                title,
                description,
                end_date,
                businesses(
                    name,
                    business_locations(
                        address,
                        area,
                        city,
                        state,
                        postal_code
                    )
                )
            )
        `)
        .eq("user_id", userId)
        .eq("coupon_status", "claimed");

    if (error) {
        console.error("Error fetching user claimed coupons:", error);
        return { success: false, error };
    }

    return {
        success: true,
        coupons: data || []
    };
}


export async function fetchUserRedeemedCoupons() {

    const userId = await getUserId();

    if (!userId) {
        return { success: false, message: "User not logged in" };
    }

    const { data, error } = await supabaseAdmin
        .from("user_coupons")
        .select(`
            *,
            coupons(
                id,
                title,
                description,
                end_date,
                businesses(
                    name,
                    business_locations(
                        address,
                        area,
                        city,
                        state,
                        postal_code
                    )
                )
            )
        `)
        .eq("user_id", userId)
        .eq("coupon_status", "redeemed");

    if (error) {
        console.error("Error fetching user redeemed coupons:", error);
        return { success: false, error };
    }

    return {
        success: true,
        coupons: data || []
    };
}
