'use client';

import React from 'react';
import { useRealtimeClaimsCount } from '@/hooks/useRealtimeClaimsCount';
import { useLanguage } from '@/context/LanguageContext';
import { Flame } from 'lucide-react';

/**
 * CustomerClaimsCounter
 * - Decoupled customer presentation for coupon claim counts and real-time progress.
 * - Leaves the vendor ClaimCounter component completely untouched.
 * - Displays clean, modern micro-copy and a smooth progress bar.
 */
export default function CustomerClaimsCounter({
  couponId,
  initialCount = 0,
  maxClaims,
  userId,
  className = '',
  showProgressBar = true,
}) {
  const ctx = useLanguage();
  const t = ctx?.t;

  const currentClaims = useRealtimeClaimsCount(couponId, initialCount, userId);

  const isBounded = typeof maxClaims === 'number' && maxClaims > 0;
  const remaining = isBounded ? Math.max(0, maxClaims - (currentClaims ?? 0)) : null;
  const progressPercent = isBounded
    ? Math.min(((currentClaims ?? 0) / maxClaims) * 100, 100)
    : 0;

  const isNearlyFull = isBounded && remaining !== null && remaining <= 5 && remaining > 0;

  return (
    <div className={`w-full ${className}`}>
      {/* Label and Count Info */}
      <div className="flex items-center justify-between text-xs mb-1.5">
        <div className="flex items-center gap-1.5 font-medium text-slate-600">
          {isNearlyFull && (
            <Flame size={13} className="text-amber-500 animate-pulse flex-shrink-0" />
          )}
          <span>
            <strong className="font-semibold text-slate-800">{currentClaims ?? 0}</strong>{' '}
            {t?.coupons?.claimed ?? 'claimed'}
          </span>
        </div>

        {isBounded && (
          <span className={`text-[11px] font-medium ${isNearlyFull ? 'text-amber-600 font-semibold' : 'text-slate-500'}`}>
            {remaining} left
          </span>
        )}
      </div>

      {/* Modern Slim Progress Bar */}
      {showProgressBar && isBounded && (
        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              isNearlyFull
                ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                : 'bg-gradient-to-r from-indigo-500 to-violet-500'
            }`}
            style={{ width: `${progressPercent}%` }}
            role="progressbar"
            aria-valuenow={currentClaims ?? 0}
            aria-valuemin={0}
            aria-valuemax={maxClaims}
          />
        </div>
      )}
    </div>
  );
}
