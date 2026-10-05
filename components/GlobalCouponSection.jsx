'use client';

import { useCouponClaim } from '@/hooks/useCouponClaim';
import { useCouponData } from '@/hooks/useCouponData';
import { useQRCode } from '@/hooks/useQRCode';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import React, { useState, useEffect, useRef } from 'react';
import { ErrorDisplay } from './GlobalCouponComp/ErrorDisplay';
import { CouponHeader } from './GlobalCouponComp/CouponHeader';
import { CouponCard } from './GlobalCouponComp/CouponCard/CouponCard';
import { useRealtimeUpdates } from '@/hooks/useRealtimeSubscription';
import { EmptyState } from './GlobalCouponComp/EmptyState';
import { LoadingSpinner } from './GlobalCouponComp/LoadingSpinner';
import QRModal from '@/app/u/profile/components/QRModal';
import { ConfirmationModal } from './ConfirmationModal';
import { ChevronLeft, ChevronRight, LayoutGrid, Timer, Sparkles, X, ArrowUpDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';

// ── emoji map for categories ──────────────────────────────────────────────────
const CATEGORY_ICONS = {
    'beauty': '💅', 'spa': '🧖', 'beauty & spa': '💅',
    'things to do': '🎯', 'health': '💪', 'fitness': '🏋️',
    'health & fitness': '💪', 'automotive': '🚗', 'retail': '🛍️',
    'food': '🍽️', 'drink': '🍹', 'food & drink': '🍽️',
    'personal services': '✂️', 'home services': '🏠', 'gift cards': '🎁',
    'travel': '✈️', 'education': '📚', 'technology': '💻',
    'fashion': '👗', 'clothing': '👕', 'grocery': '🛒',
    'pharmacy': '💊', 'entertainment': '🎬', 'sports': '⚽',
    'pets': '🐾', 'bakery': '🥐', 'electronics': '📱',
    'furniture': '🛋️', 'medical': '🏥', 'jewellery': '💎',
};

function getCategoryIcon(name = '') {
    const lower = name.toLowerCase();
    for (const [key, icon] of Object.entries(CATEGORY_ICONS)) {
        if (lower.includes(key)) return icon;
    }
    return '🏷️';
}

// ── Category pill button ──────────────────────────────────────────────────────
function CategoryPill({ category, isActive, onClick }) {
    return (
        <button
            type="button"
            onClick={() => onClick(category)}
            aria-pressed={isActive}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex-shrink-0 ${
                isActive
                    ? 'bg-indigo-600 text-white shadow-sm -translate-y-0.5'
                    : 'bg-white text-slate-700 border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 shadow-xs'
            }`}
        >
            <span className="text-sm leading-none">
                {getCategoryIcon(category.name)}
            </span>
            <span>{category.name}</span>
        </button>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────
const GlobalCouponSection = ({ userId }) => {
    const [session] = useState(true);
    const [detailsOpen, setDetailsOpen] = useState(null);

    // ── Category state ────────────────────────────────────────────────────
    const [categories, setCategories] = useState([]);
    const [catLoading, setCatLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState(null); // null = All
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);
    const scrollRef = useRef(null);

    // ── Existing hooks ────────────────────────────────────────────────────
    const {
        coupons,
        expiresSoonCoupons = [],
        forYouCoupons = [],
        loading,
        lastRefreshed,
        error,
        hasMore,
        totalCount,
        locationSource,
        locationName,
        setError,
        refreshCouponData,
        loadMoreCoupons,
    } = useCouponData(selectedCategory?.id);

    // Display coupons are directly driven by useCouponData with category and locality
    const displayCoupons = coupons;

    const {
        claimingCoupons,
        pendingClaim,
        showModal,
        setShowModal,
        handleClaimCouponClick,
        handleConfirmClaim,
    } = useCouponClaim(refreshCouponData);

    const isCouponClaimed = (couponId) => {
        if (!couponId) return false;
        const allLoaded = [...(coupons || []), ...(forYouCoupons || []), ...(expiresSoonCoupons || [])];
        const found = allLoaded.find((c) => c.id === couponId);
        return Boolean(found?.is_claimed);
    };

    const {
        isQROpen,
        selectedCoupon,
        qrData,
        showQrCode,
        closeQRModal,
        showConfirmation,
    } = useQRCode();

    // ── Infinite scroll ───────────────────────────────────────────────────
    const { targetRef, isFetchingMore } = useInfiniteScroll(
        loadMoreCoupons,
        hasMore,
        loading
    );

    // ── Realtime updates ──────────────────────────────────────────────────
    useRealtimeUpdates({
        onCouponChange: () => refreshCouponData(),
        onClaimChange: () => refreshCouponData(),
    });

    // ── Fetch active categories from Supabase ─────────────────────────────
    useEffect(() => {
        let isMounted = true;
        async function fetchCategories() {
            try {
                setCatLoading(true);
                const { data, error } = await supabase
                    .from('business_categories')
                    .select('id, name')
                    .order('name');
                if (error) throw error;
                if (isMounted) setCategories(data || []);
            } catch (err) {
                console.error('[GlobalCouponSection] category fetch error:', err);
            } finally {
                if (isMounted) setCatLoading(false);
            }
        }
        fetchCategories();
        return () => { isMounted = false; };
    }, []);

    // ── Scroll arrows visibility check ────────────────────────────────────
    const updateScrollButtons = () => {
        const el = scrollRef.current;
        if (!el) return;
        setCanScrollLeft(el.scrollLeft > 4);
        setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    };

    useEffect(() => {
        updateScrollButtons();
        const el = scrollRef.current;
        if (el) el.addEventListener('scroll', updateScrollButtons, { passive: true });
        return () => {
            if (el) el.removeEventListener('scroll', updateScrollButtons);
        };
    }, [categories, catLoading]);

    const scrollBy = (direction) => {
        const el = scrollRef.current;
        if (el) el.scrollBy({ left: direction * 240, behavior: 'smooth' });
    };

    // ── Handlers ──────────────────────────────────────────────────────────
    const handleCategoryClick = (category) => {
        if (selectedCategory?.id === category.id) {
            setSelectedCategory(null);
        } else {
            setSelectedCategory(category);
        }
    };

    const handleClearCategory = () => {
        setSelectedCategory(null);
    };

    const toggleDetails = (couponId) => {
        setDetailsOpen(detailsOpen === couponId ? null : couponId);
    };

    return (
        <div className="w-full">

            {/* ── CATEGORY BAR ─────────────────────────────────────────────── */}
            <div className="mb-6">

                {/* Header row */}
                <div className="flex items-center justify-between mb-3.5 flex-wrap gap-2">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                            Discover Local Deals
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-500 font-normal mt-0.5">
                            {selectedCategory
                                ? `Showing deals in "${selectedCategory.name}"`
                                : 'Browse by category or explore all handpicked deals'}
                        </p>
                    </div>

                    {selectedCategory && (
                        <button
                            type="button"
                            onClick={handleClearCategory}
                            title="Clear filter"
                            aria-label="Clear filter"
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200/80 hover:bg-rose-100 transition cursor-pointer"
                        >
                            <span>{getCategoryIcon(selectedCategory.name)} {selectedCategory.name}</span>
                            <span className="text-[11px] font-medium text-rose-600/90 ml-0.5">✕ Clear filter</span>
                        </button>
                    )}
                </div>

                {/* Scrollable pill row */}
                <div className="relative">

                    {/* Left arrow */}
                    {canScrollLeft && (
                        <button
                            type="button"
                            onClick={() => scrollBy(-1)}
                            aria-label="Scroll left"
                            className="absolute left-[-12px] top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-700 hover:text-indigo-600 hover:bg-slate-50 shadow-sm flex items-center justify-center cursor-pointer transition"
                        >
                            <ChevronLeft size={16} />
                        </button>
                    )}

                    {/* Pills track */}
                    <div
                        ref={scrollRef}
                        className="flex gap-2 overflow-x-auto scroll-smooth py-1 px-1"
                        style={{
                            scrollbarWidth: 'none',
                            msOverflowStyle: 'none',
                        }}
                    >
                        {/* All Coupons pill */}
                        <button
                            type="button"
                            onClick={handleClearCategory}
                            aria-pressed={!selectedCategory}
                            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex-shrink-0 ${
                                !selectedCategory
                                    ? 'bg-indigo-600 text-white shadow-sm -translate-y-0.5'
                                    : 'bg-white text-slate-700 border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 shadow-xs'
                            }`}
                        >
                            <LayoutGrid size={13} />
                            All Deals
                        </button>

                        {/* Skeleton pills while loading */}
                        {catLoading && Array.from({ length: 7 }).map((_, i) => (
                            <div
                                key={i}
                                className="h-8 rounded-full bg-slate-100 animate-pulse flex-shrink-0"
                                style={{ width: 90 + (i % 3) * 35 }}
                            />
                        ))}

                        {/* Real category pills */}
                        {!catLoading && categories.map(cat => (
                            <CategoryPill
                                key={cat.id}
                                category={cat}
                                isActive={selectedCategory?.id === cat.id}
                                onClick={handleCategoryClick}
                            />
                        ))}
                    </div>

                    {/* Right arrow */}
                    {canScrollRight && (
                        <button
                            type="button"
                            onClick={() => scrollBy(1)}
                            aria-label="Scroll right"
                            className="absolute right-[-12px] top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-700 hover:text-indigo-600 hover:bg-slate-50 shadow-sm flex items-center justify-center cursor-pointer transition"
                        >
                            <ChevronRight size={16} />
                        </button>
                    )}
                </div>

                {/* Hide webkit scrollbar */}
                <style>{`
                    div::-webkit-scrollbar { display: none; }
                `}</style>

                {/* Result count when category selected */}
                {selectedCategory && !loading && (
                    <p className="text-xs text-slate-500 font-medium mt-2 ml-1">
                        {displayCoupons.length === 0
                            ? `No ${selectedCategory.name} coupons in ${locationName || 'your area'}`
                            : `${displayCoupons.length} coupon${displayCoupons.length !== 1 ? 's' : ''} found in ${locationName || 'your area'}`}
                    </p>
                )}
            </div>

            {/* ── DIVIDER ──────────────────────────────────────────────────── */}
            <div className="border-t border-slate-200/80 my-6" />

            {/* ── STATUS, HEADER & ERROR ───────────────────────────────────── */}
            <ErrorDisplay error={error} onClose={() => setError(null)} />

            <CouponHeader
                lastRefreshed={lastRefreshed}
                loading={loading}
                onRefresh={refreshCouponData}
                totalCount={totalCount}
                currentCount={displayCoupons.length}
                locationSource={locationSource}
                locationName={locationName}
            />

            {loading && displayCoupons.length === 0 && expiresSoonCoupons.length === 0 && forYouCoupons.length === 0 && (
                <LoadingSpinner />
            )}

            {!loading && displayCoupons.length === 0 && expiresSoonCoupons.length === 0 && forYouCoupons.length === 0 && (
                <EmptyState
                    locationSource={locationSource}
                    locationName={locationName}
                    categoryName={selectedCategory?.name}
                    onClearFilters={handleClearCategory}
                    onRefresh={refreshCouponData}
                />
            )}

            {/* ── FOR YOU SECTION ─────────────────────────────────────────── */}
            {(!loading || forYouCoupons.length > 0) && (displayCoupons.length > 0 || expiresSoonCoupons.length > 0 || forYouCoupons.length > 0) && (
                <div className="mb-10" id="for-you-section">
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                        <div className="flex items-center gap-2.5">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-xs">
                                <Sparkles size={13} className="text-indigo-600" />
                                FOR YOU
                            </span>
                            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                                Recommended For You
                            </h3>
                        </div>
                        {forYouCoupons.length > 0 && (
                            <span className="text-xs font-medium text-slate-500">
                                {forYouCoupons.length} curated deal{forYouCoupons.length !== 1 ? 's' : ''}
                            </span>
                        )}
                    </div>

                    {forYouCoupons.length > 0 ? (
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
                            {forYouCoupons.map((coupon, index) => (
                                <CouponCard
                                    key={`foryou-${coupon.id}`}
                                    coupon={coupon}
                                    index={index}
                                    isClaimed={isCouponClaimed(coupon.id)}
                                    claimingStatus={claimingCoupons[coupon.id]}
                                    session={session}
                                    onClaimClick={handleClaimCouponClick}
                                    onShowQR={showQrCode}
                                    onToggleDetails={toggleDetails}
                                    detailsOpen={detailsOpen === coupon.id}
                                    userId={userId}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl border border-dashed border-indigo-100 p-6 text-center shadow-xs">
                            <p className="text-sm font-semibold text-slate-800">No Recommendations Available</p>
                            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                                No personalized deals match this filter yet. Explore all newest deals below or try another category!
                            </p>
                        </div>
                    )}

                    {/* Section separator if either expires soon or main feed has items */}
                    {(expiresSoonCoupons.length > 0 || displayCoupons.length > 0) && (
                        <div className="mt-8 pt-6 border-t border-slate-200/70" />
                    )}
                </div>
            )}

            {/* ── EXPIRES SOON SECTION ─────────────────────────────────── */}
            {expiresSoonCoupons.length > 0 && (
                <div className="mb-10" id="expires-soon-section">
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                        <div className="flex items-center gap-2.5">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 shadow-xs">
                                <Timer size={13} className="text-rose-600" />
                                EXPIRES SOON
                            </span>
                            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                                Ending in 24 Hours
                            </h3>
                        </div>
                        <span className="text-xs font-medium text-slate-500">
                            {expiresSoonCoupons.length} deal{expiresSoonCoupons.length !== 1 ? 's' : ''} ending soon
                        </span>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
                        {expiresSoonCoupons.map((coupon, index) => (
                            <CouponCard
                                key={`expiring-${coupon.id}`}
                                coupon={coupon}
                                index={index}
                                isClaimed={isCouponClaimed(coupon.id)}
                                claimingStatus={claimingCoupons[coupon.id]}
                                session={session}
                                onClaimClick={handleClaimCouponClick}
                                onShowQR={showQrCode}
                                onToggleDetails={toggleDetails}
                                detailsOpen={detailsOpen === coupon.id}
                                userId={userId}
                            />
                        ))}
                    </div>

                    {/* Section separator before main feed */}
                    {displayCoupons.length > 0 && (
                        <div className="mt-8 pt-6 border-t border-slate-200/70 flex items-center justify-between">
                            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                                {selectedCategory ? `${selectedCategory.name} Deals` : "All Local Deals"}
                            </h3>
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                <ArrowUpDown size={12} className="text-slate-500" />
                                <span>Newest First</span>
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* If expires soon had no items but we have For You and Main feed, show main feed header */}
            {expiresSoonCoupons.length === 0 && displayCoupons.length > 0 && forYouCoupons.length > 0 && (
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                    <h3 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                        {selectedCategory ? `${selectedCategory.name} Deals` : "All Local Deals"}
                    </h3>
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        <ArrowUpDown size={12} className="text-slate-500" />
                        <span>Newest First</span>
                    </span>
                </div>
            )}

            {/* ── ALL DEALS GRID ───────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 relative">
                {displayCoupons.map((coupon, index) => (
                    <CouponCard
                        key={coupon.id}
                        coupon={coupon}
                        index={index}
                        isClaimed={isCouponClaimed(coupon.id)}
                        claimingStatus={claimingCoupons[coupon.id]}
                        session={session}
                        onClaimClick={handleClaimCouponClick}
                        onShowQR={showQrCode}
                        onToggleDetails={toggleDetails}
                        detailsOpen={detailsOpen === coupon.id}
                        userId={userId}
                    />
                ))}
            </div>

            {/* Infinite Scroll Trigger */}
            {hasMore && (
                <div ref={targetRef} className="flex justify-center py-8">
                    {isFetchingMore ? (
                        <div className="flex items-center space-x-2">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600" />
                            <span className="text-xs font-medium text-slate-500">Loading more deals...</span>
                        </div>
                    ) : (
                        <div className="text-slate-400 text-xs font-medium">Scroll down to load more deals</div>
                    )}
                </div>
            )}

            {/* End of results */}
            {!hasMore && displayCoupons.length > 0 && (
                <div className="text-center py-8 text-slate-400 text-xs font-medium">
                    <div className="border-t border-slate-200/80 pt-4">
                        You've reached the end! No more coupons to load.
                    </div>
                </div>
            )}

            {/* QR Code Modal */}
            {isQROpen && selectedCoupon && (
                <QRModal
                    isOpen={isQROpen}
                    onClose={closeQRModal}
                    coupon={selectedCoupon}
                    qrValue={qrData}
                    showConfirmation={showConfirmation}
                />
            )}

            {/* Confirmation Modal */}
            {showModal && pendingClaim && (
                <ConfirmationModal
                    isOpen={showModal}
                    onClose={() => setShowModal(false)}
                    onConfirm={handleConfirmClaim}
                    coupon={pendingClaim}
                    title="Confirm Coupon Claim"
                    message={`Are you sure you want to claim "${pendingClaim.title}"?`}
                />
            )}
        </div>
    );
};

export default GlobalCouponSection;
