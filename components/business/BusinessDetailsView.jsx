'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  MapPin,
  Navigation,
  Tag,
  Ticket,
  Clock,
  Store,
  Phone,
  Mail,
  Globe,
  ArrowLeft,
  AlertTriangle,
  RotateCw,
  CheckCircle2,
  Calendar,
  Building2,
  ExternalLink,
  Star,
  Check,
  Scissors,
} from 'lucide-react';
import { claimCoupon } from '@/actions/couponActions';

import {
  WEEKDAYS,
  formatTime12h,
  formatDisplayDate,
  normalizeUrl,
  buildBusinessDetailsApiUrl,
  formatDirectionsUrl,
  parseBusinessApiError,
  evaluateOperatingHoursStatus,
  getBusinessInitials,
  getValidLogoUrl,
  sanitizeGalleryPhotos,
  resolveSelectedPhoto,
} from '@/helpers/businessDetailsHelpers';

import BusinessPhotoGallery from './BusinessPhotoGallery';
import BusinessReviewsSection from './BusinessReviewsSection';

export {
  WEEKDAYS,
  formatTime12h,
  formatDisplayDate,
  normalizeUrl,
  buildBusinessDetailsApiUrl,
  formatDirectionsUrl,
  parseBusinessApiError,
  evaluateOperatingHoursStatus,
  getBusinessInitials,
  getValidLogoUrl,
  sanitizeGalleryPhotos,
  resolveSelectedPhoto,
};

/**
 * Modern Customer Loading Skeleton
 */
export function BusinessDetailsSkeleton() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 animate-pulse">
      {/* Top back button skeleton */}
      <div className="h-8 w-28 bg-slate-200/80 rounded-xl mb-5" />

      {/* Hero business header skeleton */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm mb-6 overflow-hidden">
        <div className="h-48 sm:h-56 md:h-64 w-full bg-slate-200/80" />
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3 -mt-10 sm:-mt-12 px-4 sm:px-6 md:px-8 pb-5 relative z-10">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-200/90 rounded-2xl border-2 border-white shadow-sm shrink-0" />
          <div className="flex-1 w-full pt-1">
            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
              <div className="h-4 w-20 bg-slate-200/80 rounded-full" />
              <div className="h-4 w-24 bg-slate-200/80 rounded-full" />
            </div>
            <div className="h-7 w-2/3 sm:w-1/2 bg-slate-300 rounded-lg mb-1.5" />
            <div className="h-4 w-1/3 bg-slate-200 rounded" />
          </div>
        </div>
      </div>

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        {/* Left Column (8 cols = ~2/3) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="h-56 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm">
            <div className="h-5 w-32 bg-slate-200 rounded mb-4" />
            <div className="space-y-3">
              <div className="h-16 bg-slate-100 rounded-xl" />
              <div className="h-16 bg-slate-100 rounded-xl" />
            </div>
          </div>
          <div className="h-64 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm">
            <div className="h-5 w-36 bg-slate-200 rounded mb-4" />
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-6 bg-slate-100 rounded" />
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (4 cols = ~1/3) */}
        <div className="lg:col-span-4 flex flex-col gap-5">
          <div className="h-48 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm">
            <div className="h-5 w-28 bg-slate-200 rounded mb-3" />
            <div className="h-4 w-3/4 bg-slate-100 rounded mb-2" />
            <div className="h-4 w-1/2 bg-slate-100 rounded mb-5" />
            <div className="h-9 w-full bg-slate-200 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Main Customer-Facing Business Details Component
 */
export default function BusinessDetailsView({ businessId, initialLocationId = null }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read locationId from URL searchParams or fallback to initialLocationId
  const locationId = searchParams?.get('locationId') || initialLocationId || null;

  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isLocationError, setIsLocationError] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  // Track claim status per offer ID: { [offerId]: 'claiming' | 'claimed' }
  const [claimedOffersStatus, setClaimedOffersStatus] = useState({});

  const handleClaimOffer = async (offer) => {
    if (!offer || !offer.id) return;
    const offerId = offer.id;

    setClaimedOffersStatus((prev) => ({ ...prev, [offerId]: 'claiming' }));

    try {
      const response = await claimCoupon(offerId);

      if (!response || !response.success) {
        // If the coupon was already claimed by this user previously, immediately mark as claimed
        if (response?.message?.toLowerCase().includes('already claimed')) {
          setClaimedOffersStatus((prev) => ({ ...prev, [offerId]: 'claimed' }));
          alert('You have already claimed this coupon! You can view and redeem it in My Coupons.');
          return;
        }

        const errorMessage = response?.message || 'Error claiming coupon';
        alert(errorMessage);
        setClaimedOffersStatus((prev) => {
          const next = { ...prev };
          delete next[offerId];
          return next;
        });
        return;
      }

      // Success
      setClaimedOffersStatus((prev) => ({ ...prev, [offerId]: 'claimed' }));
      alert('Coupon claimed successfully! View and redeem it anytime before its campaign expiry in My Coupons.');
    } catch (err) {
      console.error('Error claiming offer in BusinessDetailsView:', err);
      alert(err.message || 'Error claiming coupon');
      setClaimedOffersStatus((prev) => {
        const next = { ...prev };
        delete next[offerId];
        return next;
      });
    }
  };

  // Fetch business details from Spring Boot V2 endpoint via Next.js rewrite
  const fetchDetails = useCallback(async () => {
    if (!businessId) {
      setLoading(false);
      setError('Business ID is required.');
      return;
    }

    setLoading(true);
    setError(null);
    setIsLocationError(false);
    setLogoFailed(false);

    const endpoint = buildBusinessDetailsApiUrl(businessId, locationId);

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        let errorJson = null;
        try {
          errorJson = await response.json();
        } catch {
          // Non-JSON error body
        }

        const parsed = parseBusinessApiError(response.status, errorJson);
        setIsLocationError(parsed.isLocationError);
        setError(parsed.errorMessage);
        setBusiness(null);
        return;
      }

      const data = await response.json();
      setBusiness(data);
    } catch (err) {
      setError(err?.message || 'Unable to connect to the server. Please check your connection.');
      setBusiness(null);
    } finally {
      setLoading(false);
    }
  }, [businessId, locationId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  // Determine current day of week (ISO 1 = Mon .. 7 = Sun)
  const currentIsoDay = useMemo(() => {
    const day = new Date().getDay();
    return day === 0 ? 7 : day;
  }, []);

  // 1. Loading State
  if (loading) {
    return <BusinessDetailsSkeleton />;
  }

  // 2. Not Found / Error State
  if (error || !business) {
    return (
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-10 shadow-sm text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-600 flex items-center justify-center mx-auto mb-4 shadow-xs">
            <AlertTriangle size={28} />
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2 tracking-tight">
            {isLocationError ? 'Location Not Found' : 'Store Unavailable'}
          </h2>

          <p className="text-slate-500 text-sm sm:text-base font-normal max-w-md mx-auto mb-6 leading-relaxed">
            {error || 'We could not find the business details you requested.'}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {isLocationError && businessId && (
              <Link
                href={`/businesses/${encodeURIComponent(businessId)}`}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-all"
              >
                <Store size={16} />
                View Main Location
              </Link>
            )}

            {!isLocationError && (
              <button
                type="button"
                onClick={fetchDetails}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-all cursor-pointer"
              >
                <RotateCw size={16} />
                Retry Loading
              </button>
            )}

            <Link
              href="/nearby"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 shadow-sm transition-all"
            >
              <ArrowLeft size={16} />
              Back to Nearby Stores
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const {
    id: bId,
    name,
    description,
    category,
    logoUrl,
    phone,
    email,
    website,
    locations = [],
    selectedLocation,
    operatingHours,
    activeOffers = [],
    photos = [],
    ratingSummary,
  } = business;

  const hasMultipleLocations = Array.isArray(locations) && locations.length > 1;

  // Selected Location details
  const locationAddress = selectedLocation?.address;
  const locationSubtext = [
    selectedLocation?.area,
    selectedLocation?.city,
    selectedLocation?.state,
    selectedLocation?.postalCode,
  ]
    .filter(Boolean)
    .join(', ');

  const directionsUrl = formatDirectionsUrl(
    selectedLocation?.latitude,
    selectedLocation?.longitude
  );

  const hasContactInfo = Boolean(phone || email || website);

  // Cover photo logic: use primary photo if available
  const primaryCoverPhoto = photos && photos.length > 0 ? photos[0] : null;
  const operatingStatus = evaluateOperatingHoursStatus(operatingHours);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
      {/* ── Top Navigation Bar / Breadcrumb ────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 mb-4 sm:mb-5">
        <Link
          href="/nearby"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium text-slate-700 bg-white border border-slate-200/90 shadow-xs hover:bg-slate-50 hover:text-slate-900 transition-all"
        >
          <ArrowLeft size={15} />
          Back to Nearby
        </Link>

        {category?.name && (
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200/70">
            <Tag size={12} className="text-slate-500" />
            {category.name}
          </span>
        )}
      </div>

      {/* ── Business Hero Profile Card (Compact Mobile Height ~190-220px) ─────────────────────────────────── */}
      <section
        aria-label="Business overview"
        className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden mb-6 sm:mb-8"
      >
        {/* Cover Photo Banner (190–220px on mobile) */}
        {primaryCoverPhoto?.imageUrl ? (
          <div className="relative h-48 sm:h-56 md:h-64 w-full bg-slate-900 overflow-hidden">
            <img
              src={primaryCoverPhoto.imageUrl}
              alt={primaryCoverPhoto.caption || `${name} storefront`}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/20 to-transparent" />
          </div>
        ) : (
          <div className="relative h-40 sm:h-48 md:h-56 w-full bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 overflow-hidden flex items-center justify-center">
            <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:16px_16px] opacity-40" />
            <Store size={44} className="text-white/10" />
          </div>
        )}

        {/* Profile Info Overlay Row */}
        <div className="-mt-10 sm:-mt-12 px-4 sm:px-6 md:px-8 pb-5 sm:pb-7 relative z-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3 sm:gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3 sm:gap-4 flex-1 min-w-0 w-full sm:w-auto">
              {/* Business Logo */}
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white p-1 shadow-md border-2 border-white ring-1 ring-slate-200/80 overflow-hidden flex items-center justify-center flex-shrink-0">
                {logoUrl && !logoFailed ? (
                  <img
                    src={logoUrl}
                    alt={`${name} logo`}
                    className="w-full h-full object-contain p-0.5"
                    onError={() => setLogoFailed(true)}
                  />
                ) : (
                  <div
                    className="w-full h-full bg-indigo-50 flex items-center justify-center text-indigo-700 font-bold text-lg sm:text-xl tracking-tight select-none"
                    aria-label={`${name} brand icon`}
                  >
                    {getBusinessInitials(name)}
                  </div>
                )}
              </div>

              {/* Title & Status Metadata */}
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
                  {category?.name && (
                    <span className="sm:hidden inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200/70">
                      <Tag size={10} className="text-slate-500" />
                      {category.name}
                    </span>
                  )}

                  {/* Operating Hours Status Badge */}
                  {operatingHours && (
                    <div>
                      {operatingStatus.type === 'open' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          {operatingHours.statusText || 'Open now'}
                        </span>
                      ) : operatingStatus.type === 'closed' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/80">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          {operatingHours.statusText || 'Closed'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200/70">
                          <Clock size={11} className="text-slate-400" />
                          Hours unconfigured
                        </span>
                      )}
                    </div>
                  )}

                  {/* Primary Branch Indicator */}
                  {selectedLocation?.isPrimary && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                      <CheckCircle2 size={11} className="text-indigo-600" />
                      Primary Store
                    </span>
                  )}
                </div>

                <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
                  {name}
                </h1>

                {/* Rating & Review Summary */}
                {ratingSummary && ratingSummary.totalReviews > 0 && (
                  <div className="flex items-center gap-1.5 mt-1 text-xs sm:text-sm font-semibold text-slate-800">
                    <Star size={14} className="fill-amber-400 text-amber-400" />
                    <span>{ratingSummary.averageRating.toFixed(1)}</span>
                    <span className="text-slate-400 font-normal">
                      ({ratingSummary.totalReviews} {ratingSummary.totalReviews === 1 ? 'review' : 'reviews'})
                    </span>
                  </div>
                )}

                {/* Selected Location Address Line (max 1-2 lines) */}
                {locationAddress && (
                  <div className="flex items-center gap-1.5 mt-1 text-xs sm:text-sm text-slate-600 font-normal">
                    <MapPin size={14} className="text-indigo-600 shrink-0" />
                    <span className="line-clamp-2">
                      {locationAddress}
                      {locationSubtext && <span className="text-slate-400"> • {locationSubtext}</span>}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Primary Action Buttons (Responsive Layout: Get Directions full on mobile, Call + Website paired) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 sm:pt-0 w-full sm:w-auto">
              {directionsUrl && (
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Get directions to ${name} on Google Maps`}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-all text-center"
                >
                  <Navigation size={15} />
                  <span>Get Directions</span>
                  <ExternalLink size={12} className="opacity-70" />
                </a>
              )}

              {(phone || website) && (
                <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
                  {phone && (
                    <a
                      href={`tel:${phone}`}
                      aria-label={`Call ${name}`}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 shadow-sm transition-all text-center"
                    >
                      <Phone size={14} className="text-slate-500" />
                      <span>Call</span>
                    </a>
                  )}

                  {website && (
                    <a
                      href={normalizeUrl(website)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Visit ${name} website`}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 shadow-sm transition-all text-center"
                    >
                      <Globe size={14} className="text-slate-500" />
                      <span>Website</span>
                      <ExternalLink size={11} className="opacity-60 text-slate-400" />
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* About Section */}
          {description && (
            <div className="mt-4 pt-3.5 border-t border-slate-100">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                About
              </h2>
              <p className="text-slate-600 text-xs sm:text-sm leading-relaxed max-w-3xl">
                {description}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── Main Content Grid (8 cols Main Content / 4 cols Sidebar on Desktop) ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* ── LEFT COLUMN (8 cols = ~2/3) ───────────────────────────────── */}
        <div className="lg:col-span-8 flex flex-col gap-6 lg:gap-8">
          {/* Active Offers Section */}
          <section
            aria-label="Active store offers"
            className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Ticket size={16} />
                </div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                  Active Offers ({activeOffers.length})
                </h2>
              </div>
            </div>

            <div className="p-4 sm:p-5">
              {activeOffers.length === 0 ? (
                <div className="text-center py-6 px-4 bg-slate-50/60 border border-dashed border-slate-200 rounded-xl">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center mx-auto mb-2.5">
                    <Ticket size={20} />
                  </div>
                  <h3 className="text-xs sm:text-sm font-semibold text-slate-800 mb-1">
                    No Active Offers Right Now
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto font-normal">
                    This store currently has no active promotional coupons. Check back soon for new discounts and deals!
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {activeOffers.map((offer) => {
                    const expiry = formatDisplayDate(offer.endDate);
                    const hasSpecificHours =
                      offer.redemptionTimeType === 'specific_hours' &&
                      offer.redemptionStartTime &&
                      offer.redemptionEndTime;
                    const remainingClaims =
                      offer.maxClaims != null
                        ? Math.max(0, offer.maxClaims - (offer.currentClaims ?? 0))
                        : null;

                    const isClaimedLocally = claimedOffersStatus[offer.id] === 'claimed';
                    const isClaimedFromDto = Boolean(offer.is_claimed || offer.isClaimed);
                    const isClaimed = isClaimedLocally || isClaimedFromDto;
                    const isClaiming = claimedOffersStatus[offer.id] === 'claiming';

                    return (
                      <article
                        key={offer.id}
                        className="rounded-xl border border-slate-200/90 bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden flex flex-col sm:flex-row"
                      >
                        {/* Offer Deal Image (Compact ~110-130px on mobile) */}
                        <div className="relative w-full sm:w-36 md:w-40 h-28 sm:h-auto shrink-0 bg-slate-100 overflow-hidden">
                          {offer.imageUrl ? (
                            <img
                              src={offer.imageUrl}
                              alt={offer.title}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full min-h-[90px] flex items-center justify-center bg-indigo-50/60 text-indigo-400">
                              <Ticket size={28} strokeWidth={1.5} />
                            </div>
                          )}

                          {offer.couponType && (
                            <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md text-[9px] font-semibold bg-white/95 text-slate-700 backdrop-blur-sm shadow-xs uppercase tracking-wider">
                              {offer.couponType.replace(/_/g, ' ')}
                            </span>
                          )}
                        </div>

                        {/* Offer Details */}
                        <div className="p-3 sm:p-3.5 flex-1 flex flex-col justify-between">
                          <div>
                            <h3 className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-2 leading-snug">
                              {offer.title}
                            </h3>

                            {offer.description && (
                              <p className="text-[11px] sm:text-xs text-slate-600 line-clamp-2 mt-0.5 leading-relaxed font-normal">
                                {offer.description}
                              </p>
                            )}
                          </div>

                          {/* Metadata row */}
                          <div className="flex flex-wrap items-center gap-1.5 pt-2 mt-2 border-t border-slate-100 text-xs">
                            {expiry && (
                              <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-medium text-slate-500 bg-slate-50 border border-slate-200/70 px-1.5 py-0.5 rounded">
                                <Calendar size={10} className="text-slate-400" />
                                Expires {expiry}
                              </span>
                            )}

                            {hasSpecificHours && (
                              <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-medium text-slate-500 bg-slate-50 border border-slate-200/70 px-1.5 py-0.5 rounded">
                                <Clock size={10} className="text-slate-400" />
                                {formatTime12h(offer.redemptionStartTime)} – {formatTime12h(offer.redemptionEndTime)}
                              </span>
                            )}

                            {remainingClaims != null && (
                              <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.5 rounded">
                                {remainingClaims} claims remaining
                              </span>
                            )}

                            <div className="ml-auto pt-1 sm:pt-0">
                              {isClaimed ? (
                                <span
                                  id={`claimed-badge-${offer.id}`}
                                  className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"
                                >
                                  <Check size={12} className="stroke-[2.5]" />
                                  Claimed
                                </span>
                              ) : isClaiming ? (
                                <button
                                  type="button"
                                  disabled
                                  id={`claiming-button-${offer.id}`}
                                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-indigo-100 text-indigo-500 cursor-wait"
                                >
                                  Claiming...
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  id={`claim-button-${offer.id}`}
                                  onClick={() => handleClaimOffer(offer)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 shadow-xs transition-all cursor-pointer"
                                  aria-label={`Claim ${offer.title}`}
                                >
                                  <Scissors size={12} />
                                  Claim
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Photo Gallery (rendered only when photos exist) */}
          <BusinessPhotoGallery photos={photos} businessName={name} />

          {/* Operating Hours Section (Denser schedule table) */}
          <section
            aria-label="Operating hours schedule"
            className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Clock size={16} />
                </div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                  Operating Hours
                </h2>
              </div>
              {operatingHours?.hasHoursConfigured && (
                <span
                  className={`text-[11px] sm:text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                    operatingHours.isOpenNow
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                      : 'bg-rose-50 text-rose-700 border-rose-200/80'
                  }`}
                >
                  {operatingHours.isOpenNow ? 'Store is open' : 'Store is closed'}
                </span>
              )}
            </div>

            <div className="p-4 sm:p-5">
              {!operatingHours?.hasHoursConfigured ||
              !Array.isArray(operatingHours.weeklySchedule) ||
              operatingHours.weeklySchedule.length === 0 ? (
                /* Unconfigured state */
                <div className="p-4 bg-slate-50/70 border border-dashed border-slate-200 rounded-xl text-center">
                  <Clock size={22} className="text-slate-400 mx-auto mb-1.5" />
                  <h3 className="text-xs sm:text-sm font-semibold text-slate-700 mb-0.5">
                    Hours Unconfigured
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto font-normal">
                    Operating hours have not been configured for this location yet. Please contact the store directly for open hours.
                  </p>
                </div>
              ) : (
                /* Weekly schedule table (compact density) */
                <div className="overflow-hidden border border-slate-200/80 rounded-xl">
                  <table className="w-full text-left text-xs sm:text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200/80 font-semibold text-slate-700">
                        <th className="py-2 px-3 sm:px-4 font-semibold text-[11px] sm:text-xs">Day</th>
                        <th className="py-2 px-3 sm:px-4 text-right font-semibold text-[11px] sm:text-xs">Hours</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {WEEKDAYS.map((w) => {
                        const sched = operatingHours.weeklySchedule.find(
                          (s) => s.dayOfWeek === w.day
                        );
                        const isToday = w.day === currentIsoDay;

                        return (
                          <tr
                            key={w.day}
                            className={`transition-colors ${
                              isToday
                                ? 'bg-indigo-50/40 font-semibold text-indigo-950'
                                : 'hover:bg-slate-50/70 text-slate-700'
                            }`}
                          >
                            <td className="py-1.5 sm:py-2 px-3 sm:px-4">
                              <div className="flex items-center gap-1.5">
                                <span>{w.name}</span>
                                {isToday && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] sm:text-[10px] font-semibold bg-indigo-100 text-indigo-700">
                                    Today
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-1.5 sm:py-2 px-3 sm:px-4 text-right">
                              {!sched ? (
                                <span className="text-slate-400">Not set</span>
                              ) : sched.is24Hours ? (
                                <span className="font-semibold text-emerald-600">
                                  Open 24 Hours
                                </span>
                              ) : sched.isClosed ? (
                                <span className="font-semibold text-rose-600">
                                  Closed
                                </span>
                              ) : (
                                <span className="text-slate-900 font-medium">
                                  {formatTime12h(sched.openTime)} – {formatTime12h(sched.closeTime)}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          {/* Customer Reviews Section */}
          <BusinessReviewsSection 
            businessId={bId} 
            onReviewSubmitted={fetchDetails} 
          />
        </div>

        {/* ── RIGHT COLUMN (4 cols = ~1/3, sticky on desktop) ───────────── */}
        <div className="lg:col-span-4 flex flex-col gap-5 lg:gap-6 lg:sticky lg:top-20 self-start">
          {/* Selected Location Details Card */}
          <section
            aria-label="Selected location and directions"
            className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-sm"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <MapPin size={16} />
                </div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                  Store Location
                </h2>
              </div>
              {selectedLocation?.isPrimary && (
                <span className="text-[10px] font-semibold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200/80">
                  Primary
                </span>
              )}
            </div>

            {selectedLocation ? (
              <div>
                <p className="text-xs sm:text-sm font-semibold text-slate-900 mb-0.5 line-clamp-2">
                  {selectedLocation.address || 'Address not specified'}
                </p>
                {locationSubtext && (
                  <p className="text-xs text-slate-500 mb-4 leading-relaxed font-normal line-clamp-2">
                    {locationSubtext}
                    {selectedLocation.country && <span>, {selectedLocation.country}</span>}
                  </p>
                )}

                {directionsUrl ? (
                  <a
                    href={directionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Get directions to ${name} on Google Maps`}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-all text-center"
                  >
                    <Navigation size={15} />
                    Get Directions
                    <ExternalLink size={12} className="ml-0.5 opacity-70" />
                  </a>
                ) : (
                  <div className="p-2.5 text-center text-xs text-slate-400 bg-slate-50 border border-slate-200/70 rounded-xl font-normal">
                    Map coordinates unavailable
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500 font-normal">
                No location details available for this store.
              </p>
            )}
          </section>

          {/* Multiple Branches / Locations Card (if business has > 1 location) */}
          {hasMultipleLocations && (
            <section
              aria-label="Other store locations"
              className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-sm"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Building2 size={16} />
                </div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                  All Branches ({locations.length})
                </h2>
              </div>
              <p className="text-xs text-slate-500 mb-3 font-normal">
                Select a branch to view its location and schedule.
              </p>

              <div className="flex flex-col gap-2">
                {locations.map((loc) => {
                  const isCurrent = loc.id === selectedLocation?.id;
                  const locLabel = [loc.area, loc.city].filter(Boolean).join(', ') || loc.address;

                  return (
                    <Link
                      key={loc.id}
                      href={`/businesses/${encodeURIComponent(bId)}?locationId=${encodeURIComponent(loc.id)}`}
                      className={`
                        p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2.5 text-xs sm:text-sm
                        ${
                          isCurrent
                            ? 'bg-indigo-50/50 border-indigo-200 text-slate-900 font-semibold shadow-xs'
                            : 'bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50 text-slate-700'
                        }
                      `}
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate">{locLabel}</div>
                        {loc.address && loc.address !== locLabel && (
                          <div className="text-[11px] text-slate-500 truncate">{loc.address}</div>
                        )}
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        {loc.isPrimary && (
                          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                            Primary
                          </span>
                        )}
                        {isCurrent ? (
                          <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                            Viewing
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-indigo-600">
                            Switch &rarr;
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* Contact Details Card (if present) */}
          {hasContactInfo && (
            <section
              aria-label="Store contact information"
              className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-sm"
            >
              <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight mb-3">
                Contact Information
              </h2>

              <div className="flex flex-col gap-2 text-xs sm:text-sm">
                {phone && (
                  <a
                    href={`tel:${phone}`}
                    className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200/80 hover:border-slate-300 hover:bg-slate-50 text-slate-700 transition-all font-medium"
                  >
                    <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                      <Phone size={14} />
                    </div>
                    <span className="truncate">{phone}</span>
                  </a>
                )}

                {email && (
                  <a
                    href={`mailto:${email}`}
                    className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200/80 hover:border-slate-300 hover:bg-slate-50 text-slate-700 transition-all font-medium"
                  >
                    <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center flex-shrink-0">
                      <Mail size={14} />
                    </div>
                    <span className="truncate">{email}</span>
                  </a>
                )}

                {website && (
                  <a
                    href={normalizeUrl(website)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200/80 hover:border-slate-300 hover:bg-slate-50 text-slate-700 transition-all font-medium"
                  >
                    <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                      <Globe size={14} />
                    </div>
                    <span className="truncate flex-1">{website}</span>
                    <ExternalLink size={12} className="text-slate-400 flex-shrink-0" />
                  </a>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
