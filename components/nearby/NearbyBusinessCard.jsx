'use client';

import React from 'react';
import Link from 'next/link';
import { MapPin, Navigation, Tag, Ticket, Clock, Store, Star, Check, Scissors } from 'lucide-react';
import { claimCoupon } from '@/actions/couponActions';

/**
 * Formats distance from backend-provided distanceKm.
 * - < 1 km: formatted in meters (e.g. "500 m away")
 * - >= 1 km: formatted in kilometers with 2 decimals (e.g. "1.25 km away")
 */
function formatDistance(distanceKm) {
  if (typeof distanceKm !== 'number' || isNaN(distanceKm)) {
    return null;
  }

  if (distanceKm < 1) {
    const meters = Math.round(distanceKm * 1000);
    return `${meters} m away`;
  }

  return `${distanceKm.toFixed(2)} km away`;
}

/**
 * Formats an ISO date string for display.
 * Returns null if endDate is missing or invalid.
 */
function formatEndDate(endDate) {
  if (!endDate) return null;
  try {
    const d = new Date(endDate);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return null;
  }
}

export default function NearbyBusinessCard({
  business,
  isSelected = false,
  onSelect,
  claimedCouponIds,
  onClaimSuccess,
}) {
  const [logoFailed, setLogoFailed] = React.useState(false);
  const [localClaimedStatus, setLocalClaimedStatus] = React.useState({});

  if (!business) return null;

  const {
    businessId,
    locationId,
    name,
    description,
    address,
    area,
    city,
    state,
    postalCode,
    latitude,
    longitude,
    distanceKm,
    category,
    activeOffers = [],
    operatingHours,
  } = business;

  const distanceText = formatDistance(distanceKm);
  const hasOffers = Array.isArray(activeOffers) && activeOffers.length > 0;
  const primaryOffer = hasOffers ? activeOffers[0] : null;
  const primaryOfferId = primaryOffer?.id;

  const isClaimedFromParent = Boolean(
    claimedCouponIds &&
      (typeof claimedCouponIds.has === 'function'
        ? claimedCouponIds.has(primaryOfferId)
        : Array.isArray(claimedCouponIds) && claimedCouponIds.includes(primaryOfferId))
  );
  const isClaimedLocally = localClaimedStatus[primaryOfferId] === 'claimed';
  const isClaimedFromDto = Boolean(primaryOffer?.is_claimed || primaryOffer?.isClaimed);
  const isOfferClaimed = isClaimedFromParent || isClaimedLocally || isClaimedFromDto;
  const isOfferClaiming = localClaimedStatus[primaryOfferId] === 'claiming';

  const handleClaimOffer = async (e, offer) => {
    if (!offer || !offer.id) return;
    e.preventDefault();
    e.stopPropagation();

    const offerId = offer.id;
    setLocalClaimedStatus((prev) => ({ ...prev, [offerId]: 'claiming' }));

    try {
      const response = await claimCoupon(offerId);

      if (!response || !response.success) {
        // If the coupon was already claimed previously by this user, mark as claimed immediately
        if (response?.message?.toLowerCase().includes('already claimed')) {
          setLocalClaimedStatus((prev) => ({ ...prev, [offerId]: 'claimed' }));
          if (onClaimSuccess) onClaimSuccess(offerId);
          alert('You have already claimed this coupon! You can view and redeem it in My Coupons.');
          return;
        }

        const errorMessage = response?.message || 'Error claiming coupon';
        alert(errorMessage);
        setLocalClaimedStatus((prev) => {
          const next = { ...prev };
          delete next[offerId];
          return next;
        });
        return;
      }

      // Success
      setLocalClaimedStatus((prev) => ({ ...prev, [offerId]: 'claimed' }));
      if (onClaimSuccess) {
        onClaimSuccess(offerId);
      }
      alert('Coupon claimed successfully! View and redeem it anytime before its campaign expiry in My Coupons.');
    } catch (err) {
      console.error('Error claiming coupon in nearby:', err);
      alert(err.message || 'Error claiming coupon');
      setLocalClaimedStatus((prev) => {
        const next = { ...prev };
        delete next[offerId];
        return next;
      });
    }
  };

  const storeUrl = locationId
    ? `/businesses/${businessId}?locationId=${locationId}`
    : `/businesses/${businessId}`;

  // Build clean location string
  const locationParts = [area, city].filter(Boolean);
  const locationSubtext = locationParts.join(', ');

  const hasCoordinates =
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    !isNaN(latitude) &&
    !isNaN(longitude);

  const directionsUrl = hasCoordinates
    ? `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`
    : null;

  const handleClick = (e) => {
    // If clicking on an anchor tag (View Store or directions) or button (Claim), do not trigger card selection
    if (e.target.closest('a') || e.target.closest('button')) return;
    if (onSelect && businessId) {
      onSelect(businessId);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      if (e.target.closest('a') || e.target.closest('button')) return;
      e.preventDefault();
      if (onSelect && businessId) {
        onSelect(businessId);
      }
    }
  };

  // Resolve best available images & ratings from backend DTO
  const logoUrl = business.logoUrl || business.logo_url || null;
  const businessImage = business.photoUrl || business.businessPhotoUrl || business.imageUrl || business.image_url || (business.photos && business.photos[0]?.url) || null;
  const rating = business.ratingSummary?.averageRating ?? business.averageRating ?? business.businessRating ?? business.rating ?? 0;
  const reviewCount = business.ratingSummary?.totalReviews ?? business.totalReviews ?? business.reviewCount ?? 0;

  return (
    <article
      id={`business-card-${businessId}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={onSelect ? 0 : undefined}
      role={onSelect ? 'button' : undefined}
      aria-label={`Select ${name}`}
      className={`
        flex flex-col h-full rounded-xl border transition-all duration-200 overflow-hidden cursor-pointer
        ${
          isSelected
            ? 'border-indigo-500 bg-indigo-50/50 ring-2 ring-indigo-500/20 shadow-md -translate-y-0.5'
            : 'border-slate-200 bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5'
        }
      `}
    >
      {/* 1. BUSINESS IMAGE AREA (Compact ~4:3 aspect / controlled height) */}
      <div className="relative w-full h-32 sm:h-36 bg-slate-100 flex-shrink-0 overflow-hidden">
        {businessImage ? (
          <img src={businessImage} alt={name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-indigo-50 text-indigo-200">
            <Store size={36} className="opacity-50" />
          </div>
        )}
        
        {/* Subtle gradient overlay for readability of badges */}
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-black/40 via-transparent to-transparent pointer-events-none" />
        
        <div className="absolute top-2 left-2 right-2 flex justify-between items-start pointer-events-none">
          {/* Top Left: Category */}
          {category?.name ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/95 text-slate-700 shadow-xs backdrop-blur-sm uppercase tracking-wide">
              <Tag size={9} className="text-slate-500" />
              {category.name}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/95 text-slate-700 shadow-xs backdrop-blur-sm uppercase tracking-wide">
              Store
            </span>
          )}

          {/* Top Right: Distance */}
          {distanceText && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-600/95 text-white shadow-xs backdrop-blur-sm"
              aria-label={`Distance: ${distanceText}`}
            >
              <MapPin size={9} />
              {distanceText}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col flex-1 p-3 sm:p-3.5">
        {/* 2. MERCHANT IDENTITY & RATING */}
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-8 h-8 rounded-full border border-slate-100 bg-slate-50 overflow-hidden shadow-xs flex-shrink-0 flex items-center justify-center">
            {logoUrl && !logoFailed ? (
              <img
                src={logoUrl}
                alt={`${name} logo`}
                className="w-full h-full object-contain p-0.5"
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <div
                className="w-full h-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs select-none"
                aria-label={`${name} brand icon`}
              >
                {name ? name.charAt(0).toUpperCase() : 'S'}
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight truncate">
                <Link
                  href={storeUrl}
                  className="hover:text-indigo-600 transition-colors"
                >
                  {name}
                </Link>
              </h3>
              {rating > 0 && (
                <div className="flex items-center gap-0.5 font-bold text-[11px] text-slate-800 flex-shrink-0">
                  <Star size={10} className="fill-amber-400 text-amber-400" />
                  <span>{Number(rating).toFixed(1)}</span>
                  {reviewCount > 0 && <span className="text-slate-400 font-normal text-[10px]">({reviewCount})</span>}
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-slate-500 mt-0.5">
              {/* Operating Status */}
              {operatingHours && (
                <>
                  {operatingHours.hasHoursConfigured && operatingHours.isOpenNow === true ? (
                    <span className="text-emerald-700 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Open now
                    </span>
                  ) : operatingHours.hasHoursConfigured && operatingHours.isOpenNow === false ? (
                    <span className="text-rose-600 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      Closed
                    </span>
                  ) : null}
                  {operatingHours.hasHoursConfigured && locationSubtext && <span className="text-slate-300">•</span>}
                </>
              )}
              {locationSubtext && (
                <span className="truncate">{locationSubtext}</span>
              )}
            </div>
          </div>
        </div>

        {/* 3. CONCISE ACTIVE OFFERS & DIRECT CLAIM */}
        {hasOffers && (
          <div className="mb-2.5 flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-md bg-indigo-50/70 border border-indigo-100/70 text-[11px]">
            <div className="flex items-center gap-1 min-w-0 text-indigo-900 flex-1">
              <Ticket size={11} className="text-indigo-600 flex-shrink-0" />
              <span className="font-semibold truncate">
                {primaryOffer?.title || 'Active offer'}
              </span>
              {activeOffers.length > 1 && (
                <span className="text-[10px] font-bold text-indigo-600 bg-white/90 px-1 py-0.5 rounded shadow-xs flex-shrink-0">
                  +{activeOffers.length - 1} more
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              {isOfferClaimed ? (
                <span
                  id={`claimed-badge-${primaryOfferId}`}
                  className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200"
                >
                  <Check size={10} className="stroke-[2.5]" />
                  Claimed
                </span>
              ) : isOfferClaiming ? (
                <button
                  type="button"
                  disabled
                  id={`claiming-button-${primaryOfferId}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-500 cursor-wait"
                >
                  Claiming...
                </button>
              ) : (
                <button
                  type="button"
                  id={`claim-button-${primaryOfferId}`}
                  onClick={(e) => handleClaimOffer(e, primaryOffer)}
                  className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 shadow-xs transition-all cursor-pointer"
                  aria-label={`Claim ${primaryOffer?.title || 'offer'}`}
                >
                  <Scissors size={10} />
                  Claim
                </button>
              )}
            </div>
          </div>
        )}

        {/* 4. ACTIONS */}
        <div className="pt-2 border-t border-slate-100 mt-auto flex gap-2">
          <Link
            href={storeUrl}
            aria-label={`View store details for ${name}`}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 active:scale-[0.98] shadow-xs transition-all text-center"
          >
            <Store size={13} className="text-indigo-600" />
            <span className="hidden sm:inline">View Store</span>
            <span className="sm:hidden">View</span>
          </Link>
          
          {directionsUrl ? (
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Get directions to ${name} on Google Maps (opens in a new tab)`}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] shadow-xs transition-all text-center"
            >
              <Navigation size={13} />
              Directions
            </a>
          ) : (
            <div className="flex-1 text-center text-[10px] text-slate-400 font-medium py-1.5">
              Directions unavailable
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
