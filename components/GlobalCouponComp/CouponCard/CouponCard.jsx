'use client';

import React, { useState } from "react";
import Link from "next/link";
import {
  Check,
  QrCode,
  Scissors,
  Store,
  X,
  MapPin,
  Tag,
  Ticket,
  Clock,
  Star,
  Calendar,
} from "lucide-react";

import { joinAddress } from "@/utils/addressUtils";
import {
  getBusinessInitials,
  formatDisplayDate,
  formatTime12h,
} from "@/helpers/businessDetailsHelpers";
import CustomerClaimsCounter from "@/components/GlobalCouponComp/CustomerClaimsCounter";

export const CouponCard = ({
  coupon,
  isClaimed,
  claimingStatus,
  session = true,
  onClaimClick,
  onShowQR,
  onToggleDetails,
  detailsOpen,
  userId,
}) => {
  const [logoFailed, setLogoFailed] = useState(false);

  if (!coupon) return null;

  const business = coupon.businesses || {};
  const businessId = business.id || coupon.business_id;
  const businessName = business.name || "Local Merchant";
  const logoUrl = business.logo_url || null;
  const categoryName = business.business_categories?.name || null;

  // Primary location resolution
  const primaryLocation = Array.isArray(business.business_locations) && business.business_locations.length > 0
    ? business.business_locations[0]
    : null;

  const locationId = primaryLocation?.id || null;
  const storeAddress = primaryLocation ? joinAddress(primaryLocation) : null;
  const locationCity = primaryLocation?.city || primaryLocation?.area || null;

  // Store details URL
  const storeUrl = businessId
    ? (locationId ? `/businesses/${businessId}?locationId=${locationId}` : `/businesses/${businessId}`)
    : '#';

  // Business rating from reviews
  const businessRating = typeof coupon.business_rating === 'number'
    ? coupon.business_rating
    : (typeof business.rating === 'number' ? business.rating : 0);
  const ratingCount = typeof coupon.rating_count === 'number' ? coupon.rating_count : 0;

  // Dates and timings
  const expiryFormatted = formatDisplayDate(coupon.end_date);
  const startFormatted = formatDisplayDate(coupon.start_date);
  const validityRange = startFormatted && expiryFormatted
    ? `${startFormatted} – ${expiryFormatted}`
    : (expiryFormatted ? `Ends ${expiryFormatted}` : null);

  const hasSpecificHours =
    coupon.redemption_time_type === 'specific_hours' &&
    coupon.redemption_start_time &&
    coupon.redemption_end_time;

  const isFullyClaimed =
    coupon.max_claims != null &&
    (coupon.current_claims ?? 0) >= coupon.max_claims;

  const isClaiming = claimingStatus === 'claiming';

  const couponImageUrl = coupon.image_url;

  return (
    <article
      id={`coupon-card-${coupon.id}`}
      className="flex flex-col h-full rounded-xl border border-slate-200/90 bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
    >
      {/* 1. DEAL IMAGE AREA (Upper 25-30% compact image) */}
      <div className="relative w-full h-24 sm:h-28 bg-slate-100 flex-shrink-0 overflow-hidden">
        {couponImageUrl ? (
          <img
            src={couponImageUrl}
            alt={coupon.title || "Coupon offer"}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-indigo-50 text-indigo-200">
            <Ticket size={24} className="opacity-50" />
          </div>
        )}
        
        {/* Subtle gradient overlay for readability of badges */}
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-black/40 via-transparent to-transparent pointer-events-none" />
        
        <div className="absolute top-1.5 left-1.5 right-1.5 flex justify-between items-start pointer-events-none">
          {/* Top Left: Category */}
          {categoryName ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] font-semibold bg-slate-100/95 text-slate-700 shadow-sm backdrop-blur-sm uppercase tracking-wide">
              <Tag size={8} className="text-slate-500" />
              {categoryName}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] font-semibold bg-slate-100/95 text-slate-700 shadow-sm backdrop-blur-sm uppercase tracking-wide">
              Deal
            </span>
          )}

          {/* Top Right: Locality */}
          {locationCity && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] font-semibold bg-indigo-50/95 text-indigo-700 shadow-sm backdrop-blur-sm"
              aria-label={`Location: ${locationCity}`}
            >
              <MapPin size={8} />
              {locationCity}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col flex-1 p-2 sm:p-2.5">
        {/* 2. MERCHANT IDENTITY */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border border-slate-100 bg-slate-50 overflow-hidden shadow-xs flex-shrink-0 flex items-center justify-center">
            {logoUrl && !logoFailed ? (
              <img
                src={logoUrl}
                alt={`${businessName} logo`}
                className="w-full h-full object-contain p-0.5"
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <div
                className="w-full h-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[9px] select-none"
                aria-label={`${businessName} brand icon`}
              >
                {getBusinessInitials(businessName)}
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <h3 className="text-xs font-bold text-slate-900 tracking-tight truncate">
                <Link
                  href={storeUrl}
                  className="hover:text-indigo-600 transition-colors"
                >
                  {businessName}
                </Link>
              </h3>
              {businessRating > 0 && (
                <div className="flex items-center gap-0.5 font-semibold text-[9px] text-slate-700 flex-shrink-0">
                  <Star size={8} className="fill-amber-400 text-amber-400" />
                  <span>{Number(businessRating).toFixed(1)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 3. OFFER */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1 mb-0.5">
            <span className="text-[9px] font-bold text-indigo-600 uppercase tracking-wider truncate">
              {coupon.coupon_type ? coupon.coupon_type.replace(/_/g, ' ') : 'Offer'}
            </span>
            {expiryFormatted && (
              <span className="text-[9px] font-medium text-slate-400 whitespace-nowrap">
                Exp {expiryFormatted}
              </span>
            )}
          </div>
          
          <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug line-clamp-2 mb-0.5">
            {coupon.title}
          </h4>
          
          {coupon.description && (
            <p className="text-[10px] text-slate-500 line-clamp-1 leading-normal mb-1">
              {coupon.description}
            </p>
          )}

          {hasSpecificHours && (
            <div className="flex items-center gap-1 text-[9px] text-slate-500 mb-1">
              <Clock size={8} className="text-slate-400 flex-shrink-0" />
              <span className="truncate">{formatTime12h(coupon.redemption_start_time)}–{formatTime12h(coupon.redemption_end_time)}</span>
            </div>
          )}
        </div>

        {/* 4. CLAIMS PROGRESS */}
        <div className="my-1.5">
          <CustomerClaimsCounter
            couponId={coupon.id}
            initialCount={coupon.current_claims}
            maxClaims={coupon.max_claims}
            userId={userId}
          />
        </div>

        {/* 5. ACTIONS */}
        <div className="pt-1.5 border-t border-slate-100 mt-auto flex gap-1.5">
          <Link
            href={storeUrl}
            aria-label={`View store details for ${businessName}`}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-lg text-[10px] sm:text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 active:scale-[0.98] transition-all text-center"
          >
            <Store size={11} className="text-indigo-600 flex-shrink-0" />
            <span className="hidden sm:inline">View Details</span>
            <span className="sm:hidden">Details</span>
          </Link>

          {isClaimed ? (
            <div className="flex-1 flex gap-1">
              <button
                disabled
                className="flex-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] sm:text-xs font-semibold py-1.5 px-1 rounded-lg flex items-center justify-center gap-1 cursor-default"
              >
                <Check size={11} className="stroke-[2.5]" />
                Claimed
              </button>
              <button
                type="button"
                onClick={() => onShowQR(coupon)}
                title="Show QR Code"
                className="px-1.5 bg-slate-900 text-white text-[10px] sm:text-xs font-semibold py-1.5 rounded-lg hover:bg-slate-800 active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-xs"
              >
                <QrCode size={12} />
              </button>
            </div>
          ) : isFullyClaimed ? (
            <button
              disabled
              className="flex-1 bg-slate-100 text-slate-400 text-[10px] sm:text-xs font-semibold py-1.5 px-1.5 rounded-lg flex items-center justify-center gap-1 cursor-not-allowed"
            >
              <X size={11} />
              <span className="hidden sm:inline">Fully Claimed</span>
              <span className="sm:hidden">Full</span>
            </button>
          ) : isClaiming ? (
            <button
              disabled
              className="flex-1 bg-indigo-50 text-indigo-400 text-[10px] sm:text-xs font-semibold py-1.5 px-1.5 rounded-lg flex items-center justify-center gap-1 cursor-wait"
            >
              Claiming...
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onClaimClick(coupon)}
              disabled={!session}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-lg text-[10px] sm:text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] shadow-xs hover:shadow transition-all text-center ${
                !session ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              <Scissors size={11} />
              <span className="hidden sm:inline">Claim Deal</span>
              <span className="sm:hidden">Claim</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
};