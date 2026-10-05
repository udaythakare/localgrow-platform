import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchLocationBasedCoupons, fetchForYouCoupons } from '@/actions/couponActions';
import {
    getCoupons,
    getLoadingState,
    saveCoupons,
    saveLocationSource,
} from '@/helpers/couponStateManager';
import { normalizeCategoryId, isCouponValid, isCouponExpiringSoon } from '@/helpers/couponFilterHelpers';

const ITEMS_PER_PAGE = 5;

export const useCouponData = (categoryId = null) => {
    const [coupons, setCoupons] = useState([]);
    const [expiresSoonCoupons, setExpiresSoonCoupons] = useState([]);
    const [forYouCoupons, setForYouCoupons] = useState([]);
    const [loading, setLoading] = useState(false);
    const [lastRefreshed, setLastRefreshed] = useState(null);
    const [error, setError] = useState(null);
    const [locationSource, setLocationSource] = useState('none');
    const [locationName, setLocationName] = useState('');

    // Infinite scroll states
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(0);
    const [totalCount, setTotalCount] = useState(0);

    // Keep category in ref for async callbacks
    const categoryIdRef = useRef(categoryId);
    useEffect(() => {
        categoryIdRef.current = categoryId;
    }, [categoryId]);

    // Cache detected city from IP geolocation
    const detectedCity = useRef(null);

    // Helper to detect city from IP
    const detectCity = async (force = false) => {
        if (!force && detectedCity.current) return detectedCity.current;
        if (force) detectedCity.current = null;
        try {
            const res = await fetch('/api/geo');
            const data = await res.json();
            if (data?.success && data?.city) {
                detectedCity.current = data.city;
                return data.city;
            }
        } catch (err) {
            console.error('Failed to detect city from IP:', err);
        }
        return null;
    };

    // Memoized handler functions
    const handleCouponsUpdated = useCallback(() => {
        const stored = getCoupons();
        const active = stored.filter(c => isCouponValid(c));
        setCoupons(active);
        setLastRefreshed(new Date());
    }, []);

    const handleLoadingUpdated = useCallback(() => {
        setLoading(getLoadingState());
    }, []);

    // Fetch initial data or refresh
    const refreshCouponData = useCallback(async (activeCategoryId) => {
        try {
            setLoading(true);
            setError(null);

            // Reset pagination
            setPage(0);
            setHasMore(true);

            // Resolve target category:
            // - If explicitly null, user requested clearing category filter
            // - If valid string ID, use it
            // - Otherwise (undefined or DOM event passed from onClick), preserve current category
            const targetCategoryId = activeCategoryId === null
                ? null
                : (normalizeCategoryId(activeCategoryId) || normalizeCategoryId(categoryIdRef.current));

            // Detect city from IP as fallback (force re-fetch if location was unknown)
            const city = await detectCity(locationSource === 'none');

            // Fetch main feed (newest first), expires soon, and For You in parallel
            const [mainResponse, expiresSoonResponse, forYouResponse] = await Promise.all([
                fetchLocationBasedCoupons({
                    city,
                    categoryId: targetCategoryId,
                    limit: ITEMS_PER_PAGE,
                    offset: 0,
                    includeCount: true,
                    sortBy: 'newest'
                }),
                fetchLocationBasedCoupons({
                    city,
                    categoryId: targetCategoryId,
                    expiresSoon: true,
                    limit: 8,
                    sortBy: 'expiring_soon'
                }),
                fetchForYouCoupons({
                    city,
                    categoryId: targetCategoryId,
                    limit: 8,
                    offset: 0,
                    includeCount: true
                })
            ]);

            // Update location source info from main query
            if (mainResponse?.locationSource) {
                setLocationSource(mainResponse.locationSource);
                setLocationName(mainResponse.locationName || '');
                saveLocationSource(mainResponse.locationSource, mainResponse.locationName);
            }

            if (mainResponse && !mainResponse.success && mainResponse.error) {
                console.error('Failed to fetch location based coupons:', mainResponse.error);
                setError(`Failed to fetch coupons: ${mainResponse.error.message || 'Unknown error'}`);
                setCoupons([]);
                setExpiresSoonCoupons([]);
                setForYouCoupons([]);
                setTotalCount(0);
                setHasMore(false);
                return;
            }

            // Update main feed coupons (excluding expired)
            if (mainResponse?.coupons) {
                const activeCoupons = mainResponse.coupons.filter(c => isCouponValid(c));
                setCoupons(activeCoupons);
                saveCoupons(activeCoupons);
                setLastRefreshed(new Date());
                setPage(1);

                // Set total count and hasMore
                if (mainResponse.totalCount !== undefined && mainResponse.totalCount !== null) {
                    setTotalCount(mainResponse.totalCount);
                    setHasMore(activeCoupons.length < mainResponse.totalCount);
                } else {
                    setHasMore(activeCoupons.length === ITEMS_PER_PAGE);
                }
            } else {
                setCoupons([]);
                setTotalCount(0);
                setHasMore(false);
            }

            // Update expires soon coupons (valid and expiring within 24h)
            if (expiresSoonResponse?.coupons) {
                const validExpiring = expiresSoonResponse.coupons.filter(c => isCouponExpiringSoon(c));
                setExpiresSoonCoupons(validExpiring);
            } else {
                setExpiresSoonCoupons([]);
            }

            // Update For You recommendations (valid and deduplicated)
            if (forYouResponse?.coupons) {
                const validForYou = forYouResponse.coupons.filter(c => isCouponValid(c));
                const seenForYou = new Set();
                const uniqueForYou = validForYou.filter(c => {
                    if (seenForYou.has(c.id)) return false;
                    seenForYou.add(c.id);
                    return true;
                });
                setForYouCoupons(uniqueForYou);
            } else {
                setForYouCoupons([]);
            }
        } catch (err) {
            console.error('Error refreshing coupon data:', err);
            setError(`Failed to refresh coupons: ${err.message}`);
            setCoupons([]);
            setExpiresSoonCoupons([]);
            setForYouCoupons([]);
            setHasMore(false);
        } finally {
            setLoading(false);
        }
    }, [locationSource]);

    // Load more coupons for infinite scroll (newest first)
    const loadMoreCoupons = useCallback(async () => {
        if (!hasMore || loading) return;

        try {
            const offset = page * ITEMS_PER_PAGE;
            const city = detectedCity.current || await detectCity();
            const activeCategoryId = normalizeCategoryId(categoryIdRef.current);

            const response = await fetchLocationBasedCoupons({
                city,
                categoryId: activeCategoryId,
                limit: ITEMS_PER_PAGE,
                offset,
                includeCount: false,
                sortBy: 'newest'
            });

            if (response?.coupons) {
                const activeNewCoupons = response.coupons.filter(c => isCouponValid(c));

                // Prevent duplicates by checking existing IDs
                setCoupons(prev => {
                    const existingIds = new Set(prev.map(c => c.id));
                    const uniqueNewCoupons = activeNewCoupons.filter(coupon => !existingIds.has(coupon.id));

                    if (uniqueNewCoupons.length === 0) {
                        setHasMore(false);
                        return prev;
                    }

                    const updated = [...prev, ...uniqueNewCoupons];
                    saveCoupons(updated);
                    return updated;
                });

                setPage(prev => prev + 1);

                // Check if we have more data
                if (totalCount > 0) {
                    setHasMore((page + 1) * ITEMS_PER_PAGE < totalCount);
                } else {
                    setHasMore(activeNewCoupons.length === ITEMS_PER_PAGE);
                }
            }
        } catch (err) {
            console.error('Error loading more coupons:', err);
            setError(`Failed to load more coupons: ${err.message}`);
        }
    }, [hasMore, loading, page, totalCount]);

    // Initial setup effect & category change effect
    const isFirstMount = useRef(true);
    useEffect(() => {
        if (isFirstMount.current) {
            isFirstMount.current = false;
            refreshCouponData(categoryId);
            return;
        }
        refreshCouponData(categoryId);
    }, [categoryId, refreshCouponData]);

    // Listen to local state changes
    useEffect(() => {
        window.addEventListener('coupons-updated', handleCouponsUpdated);
        window.addEventListener('loading-updated', handleLoadingUpdated);

        return () => {
            window.removeEventListener('coupons-updated', handleCouponsUpdated);
            window.removeEventListener('loading-updated', handleLoadingUpdated);
        };
    }, [handleCouponsUpdated, handleLoadingUpdated]);

    return {
        coupons,
        expiresSoonCoupons,
        forYouCoupons,
        setCoupons,
        loading,
        lastRefreshed,
        error,
        hasMore,
        totalCount,
        locationSource,
        locationName,
        setError,
        refreshCouponData,
        clearFilters: () => refreshCouponData(null),
        loadMoreCoupons
    };
};
