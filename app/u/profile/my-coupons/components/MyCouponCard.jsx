'use client';

import React, { useState } from 'react';
import {
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  MapPin,
  QrCode,
  Store,
  Tag,
  Ticket,
} from 'lucide-react';
import { formatDisplayDate, getBusinessInitials } from '@/helpers/myCouponHelpers';

/**
 * MyCouponCard
 * Compact, responsive customer card for My Coupons page:
 * - Mobile: Fits seamlessly in a 2-column grid without horizontal overflow
 * - Desktop: Scales comfortably in 3-4 column layouts
 * - Adheres strictly to the modern customer design system (white surfaces, slate typography, indigo primary, emerald/rose/purple status accents)
 * - Properly handles coupon.image_url and business.logo_url with graceful fallbacks
 */
export default function MyCouponCard({
  userCoupon,
  status = 'active',
  onShowQR,
}) {
  const [logoFailed, setLogoFailed] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  if (!userCoupon) return null;

  const coupon = userCoupon.coupons || userCoupon;
  const business = coupon.businesses || {};
  const businessName = business.name || 'Local Merchant';
  const businessLogoUrl = business.logo_url || null;
  const couponImageUrl = coupon.image_url || null;

  // Resolve store address if present
  const locations = business.business_locations;
  const primaryLocation = Array.isArray(locations) && locations.length > 0
    ? locations[0]
    : (locations && typeof locations === 'object' ? locations : null);
  const storeCity = primaryLocation?.city || primaryLocation?.area || null;

  // Formatted date string
  const expiryFormatted = coupon.end_date ? formatDisplayDate(coupon.end_date) : null;
  const usedFormatted = userCoupon.updated_at ? formatDisplayDate(userCoupon.updated_at) : null;

  const isExpired = status === 'expired';
  const isRedeemed = status === 'redeemed';
  const isActive = status === 'active';

  return (
    <article
      id={`my-coupon-card-${userCoupon.id}`}
      className={`group relative flex flex-col h-full rounded-2xl border transition-all duration-200 overflow-hidden ${
        isExpired
          ? 'bg-slate-50/70 border-slate-200/70 opacity-90'
          : isRedeemed
          ? 'bg-white border-purple-100 shadow-xs'
          : 'bg-white border-slate-200/90 shadow-xs hover:shadow-md hover:-translate-y-0.5'
      }`}
    >
      {/* 1. DEAL IMAGE AREA (Compact 80-96px upper image banner) */}
      <div className="relative w-full h-20 sm:h-24 bg-slate-100 flex-shrink-0 overflow-hidden">
        {couponImageUrl && !imageFailed ? (
          <img
            src={couponImageUrl}
            alt={coupon.title || 'Coupon deal'}
            className={`w-full h-full object-cover transition-transform duration-300 ${
              isExpired
                ? 'grayscale-[45%] opacity-65'
                : 'group-hover:scale-105'
            }`}
            onError={() => setImageFailed(true)}
            loading="lazy"
          />
        ) : (
          <div
            className={`w-full h-full flex items-center justify-center ${
              isExpired
                ? 'bg-slate-100 text-slate-400'
                : isRedeemed
                ? 'bg-purple-50/70 text-purple-400'
                : 'bg-indigo-50/70 text-indigo-400'
            }`}
          >
            <Ticket size={24} className="opacity-45" />
          </div>
        )}

        {/* Status Pill Badge Over Image */}
        <div className="absolute top-2 right-2 z-10">
          {isActive && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-emerald-500 text-white shadow-xs">
              <Check size={11} strokeWidth={3} />
              <span>Active</span>
            </span>
          )}
          {isExpired && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-rose-600 text-white shadow-xs">
              <span>Expired</span>
            </span>
          )}
          {isRedeemed && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-purple-600 text-white shadow-xs">
              <CheckCircle2 size={11} strokeWidth={2.5} />
              <span>Redeemed</span>
            </span>
          )}
        </div>
      </div>

      {/* 2. CARD CONTENT AREA */}
      <div className="p-2.5 sm:p-3.5 flex-1 flex flex-col justify-between gap-2">
        <div>
          {/* Business Logo & Name */}
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1 min-w-0">
            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-slate-100 border border-slate-200/80 flex items-center justify-center flex-shrink-0 overflow-hidden text-[9px] sm:text-[10px] font-bold text-slate-700">
              {businessLogoUrl && !logoFailed ? (
                <img
                  src={businessLogoUrl}
                  alt={businessName}
                  className="w-full h-full object-cover"
                  onError={() => setLogoFailed(true)}
                  loading="lazy"
                />
              ) : (
                <span>{getBusinessInitials(businessName)}</span>
              )}
            </div>
            <span className="text-[11px] sm:text-xs font-semibold text-slate-600 truncate">
              {businessName}
            </span>
          </div>

          {/* Coupon Title */}
          <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug line-clamp-2">
            {coupon.title || 'Deal Offer'}
          </h3>

          {/* Short Description */}
          {coupon.description && (
            <p className="mt-1 text-[10px] sm:text-xs text-slate-500 line-clamp-1 sm:line-clamp-2 leading-relaxed">
              {coupon.description}
            </p>
          )}

          {/* Store Location if available */}
          {storeCity && (
            <div className="mt-1 flex items-center gap-1 text-[10px] sm:text-[11px] text-slate-400">
              <MapPin size={11} className="flex-shrink-0" />
              <span className="truncate">{storeCity}</span>
            </div>
          )}
        </div>

        {/* 3. METADATA & ACTIONS */}
        <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
          {/* Expiry / Redemption Date */}
          <div className="flex items-center gap-1 text-[10px] sm:text-xs text-slate-500">
            <Calendar size={12} className="text-slate-400 flex-shrink-0" />
            <span className="truncate">
              {isRedeemed
                ? (usedFormatted ? `Redeemed ${usedFormatted}` : (expiryFormatted ? `Ended ${expiryFormatted}` : 'Redeemed'))
                : isExpired
                ? (expiryFormatted ? `Expired ${expiryFormatted}` : 'Expired')
                : (expiryFormatted ? `Expires ${expiryFormatted}` : 'Valid anytime')}
            </span>
          </div>

          {/* Claims Counter if applicable */}
          {coupon.max_claims != null && (
            <div className="text-[10px] text-slate-400 font-medium">
              {coupon.current_claims ?? 0} / {coupon.max_claims} claimed
            </div>
          )}

          {/* Action CTA */}
          <div className="mt-1">
            {isActive ? (
              <button
                type="button"
                onClick={() => onShowQR && onShowQR(userCoupon)}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 sm:py-2 px-2.5 sm:px-3 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-[11px] sm:text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                aria-label={`Show QR code for ${coupon.title}`}
              >
                <QrCode size={14} />
                <span>SHOW QR CODE</span>
              </button>
            ) : isExpired ? (
              <div className="w-full py-1.5 px-2 rounded-xl bg-slate-100 text-slate-500 text-center text-[11px] sm:text-xs font-semibold border border-slate-200/80">
                EXPIRED
              </div>
            ) : (
              <div className="w-full py-1.5 px-2 rounded-xl bg-purple-50 text-purple-700 text-center text-[11px] sm:text-xs font-semibold border border-purple-200/80 flex items-center justify-center gap-1">
                <CheckCircle2 size={13} className="text-purple-600" />
                <span>SUCCESSFULLY REDEEMED</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
