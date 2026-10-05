'use client';

import React, { useState, useEffect, useMemo, useTransition } from 'react';
import Link from 'next/link';
import {
  Ticket,
  CheckCircle2,
  Clock,
  RefreshCw,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Inbox,
  AlertCircle
} from 'lucide-react';
import MyCouponCard from './MyCouponCard';
import QRModal from '../../components/QRModal';
import { supabase } from '@/lib/supabase';
import { getUserId } from '@/helpers/userHelper';
import { classifyUserCoupons } from '@/helpers/myCouponHelpers';
import { revalidateMyCouponPage } from '@/actions/revalidateActions';

/**
 * MyCouponsView
 * Main interactive customer view for /u/profile/my-coupons:
 * - Real-time IST date classification
 * - Live summary counts [ X Active ] [ Y Expired ] [ Z Redeemed ]
 * - 3 distinct sections: Active Coupons, Expired Coupons, Redeemed Coupons
 * - Mobile-first 2-column compact grid, scaling to 3-4 columns on desktop
 * - Seamless QR show-code modal with real-time redemption confirmation
 */
export default function MyCouponsView({
  initialClaimed = [],
  initialRedeemed = [],
  userId: initialUserId = null,
}) {
  const [claimedList, setClaimedList] = useState(initialClaimed);
  const [redeemedList, setRedeemedList] = useState(initialRedeemed);
  const [userId, setUserId] = useState(initialUserId);
  const [refreshing, setRefreshing] = useState(false);

  // QR Modal state
  const [isQROpen, setIsQROpen] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Resolve user id if not passed from server
  useEffect(() => {
    if (userId) return;
    const resolveUser = async () => {
      try {
        const id = await getUserId();
        if (typeof id === 'string') {
          setUserId(id);
        }
      } catch (err) {
        console.error('Failed to resolve current user ID:', err);
      }
    };
    resolveUser();
  }, [userId]);

  // Sync state if initial props change
  useEffect(() => {
    setClaimedList(initialClaimed || []);
  }, [initialClaimed]);

  useEffect(() => {
    setRedeemedList(initialRedeemed || []);
  }, [initialRedeemed]);

  // Fetch updated data from API endpoints
  const refreshData = async () => {
    setRefreshing(true);
    try {
      const [claimedRes, redeemedRes] = await Promise.all([
        fetch('/api/profile/user-claimed-coupon', { credentials: 'include' }),
        fetch('/api/profile/user-redeemed-coupon', { credentials: 'include' }),
      ]);

      if (claimedRes.ok) {
        const claimedJson = await claimedRes.json();
        if (claimedJson?.coupons) {
          setClaimedList(claimedJson.coupons);
        }
      }

      if (redeemedRes.ok) {
        const redeemedJson = await redeemedRes.json();
        if (redeemedJson?.coupons) {
          setRedeemedList(redeemedJson.coupons);
        }
      }
    } catch (err) {
      console.error('Failed to refresh coupon data:', err);
    } finally {
      setRefreshing(false);
    }
  };

  // Real-time Supabase subscription for instant redemption updates
  useEffect(() => {
    if (!userId || typeof userId !== 'string') return;

    const channel = supabase
      .channel(`user_coupons_view_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_coupons',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          refreshData();
          const updated = payload.new;
          if (
            payload.eventType === 'UPDATE' &&
            updated?.coupon_status === 'redeemed'
          ) {
            if (
              isQROpen &&
              selectedCoupon &&
              (selectedCoupon.id === updated.id ||
                selectedCoupon.coupon_id === updated.coupon_id)
            ) {
              setShowConfirmation(true);
              setTimeout(() => {
                setIsQROpen(false);
                setShowConfirmation(false);
                setSelectedCoupon(null);
              }, 3000);
            }
            revalidateMyCouponPage();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, isQROpen, selectedCoupon]);

  // Classify all user coupons (combining claimed and redeemed records)
  // Ensures REDEEMED takes priority, and claimed are strictly split into Active vs Expired
  const { activeCoupons, expiredCoupons, redeemedCoupons, counts } = useMemo(() => {
    // Combine all user coupons for unified deterministic classification
    const allUserCoupons = [...(claimedList || []), ...(redeemedList || [])];

    // Deduplicate by user_coupons.id if any overlap exists
    const seen = new Set();
    const uniqueRecords = [];
    for (const uc of allUserCoupons) {
      if (uc && uc.id && !seen.has(uc.id)) {
        seen.add(uc.id);
        uniqueRecords.push(uc);
      }
    }

    const classified = classifyUserCoupons(uniqueRecords, new Date());

    return {
      activeCoupons: classified.active,
      expiredCoupons: classified.expired,
      redeemedCoupons: classified.redeemed,
      counts: classified.counts,
    };
  }, [claimedList, redeemedList]);

  // QR Modal Handlers
  const handleShowQR = (userCoupon) => {
    setSelectedCoupon(userCoupon);
    setShowConfirmation(false);
    setIsQROpen(true);
  };

  const handleCloseQR = () => {
    setIsQROpen(false);
    setShowConfirmation(false);
    setSelectedCoupon(null);
  };

  const qrValue = useMemo(() => {
    if (!selectedCoupon || !userId) return '';
    return JSON.stringify({
      userId,
      couponId: selectedCoupon.coupon_id || selectedCoupon.coupons?.id,
    });
  }, [selectedCoupon, userId]);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-28 md:pb-16 text-slate-900">
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <header className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 sm:gap-3 mb-1">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
                <Ticket size={20} />
              </div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
                My Coupons
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 font-medium ml-11 sm:ml-13">
              Your claimed deals in one place
            </p>
          </div>

          {/* Right Header: Summary Counts & Refresh Button */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* Stat Pills */}
            <div className="flex items-center gap-2 flex-wrap">
              <div
                id="summary-active-count"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-bold shadow-2xs"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>{counts.active} Active</span>
              </div>
              <div
                id="summary-expired-count"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold shadow-2xs"
              >
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                <span>{counts.expired} Expired</span>
              </div>
              <div
                id="summary-redeemed-count"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-50 border border-purple-200/80 text-purple-800 text-xs font-bold shadow-2xs"
              >
                <span className="w-2 h-2 rounded-full bg-purple-500" />
                <span>{counts.redeemed} Redeemed</span>
              </div>
            </div>

            {/* Refresh Action */}
            <button
              onClick={refreshData}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:scale-95 text-xs font-semibold text-slate-700 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
              aria-label="Refresh coupons"
            >
              <RefreshCw
                size={13}
                className={refreshing ? 'animate-spin text-indigo-600' : 'text-slate-500'}
              />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── SECTIONS CONTAINER ────────────────────────────────────────── */}
      <div className="space-y-8 sm:space-y-10">

        {/* ── 1. ACTIVE COUPONS SECTION ───────────────────────────────── */}
        <section id="section-active-coupons" className="space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                Active Coupons
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                  {activeCoupons.length}
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Currently available to use</p>
            </div>
          </div>

          {activeCoupons.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4">
              {activeCoupons.map((uc) => (
                <MyCouponCard
                  key={uc.id}
                  userCoupon={uc}
                  status="active"
                  onShowQR={handleShowQR}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 text-center shadow-2xs">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                <Ticket size={24} />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                You&apos;re all caught up
              </h3>
              <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                You don&apos;t have any active coupons right now. Explore local discounts to save on your next visit!
              </p>
              <div className="mt-4">
                <Link
                  href="/coupons"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all"
                >
                  <span>Browse Available Coupons</span>
                  <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          )}
        </section>

        {/* ── 2. EXPIRED COUPONS SECTION ──────────────────────────────── */}
        <section id="section-expired-coupons" className="space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                Expired Coupons
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  {expiredCoupons.length}
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Claimed deals that are no longer valid</p>
            </div>
          </div>

          {expiredCoupons.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4">
              {expiredCoupons.map((uc) => (
                <MyCouponCard
                  key={uc.id}
                  userCoupon={uc}
                  status="expired"
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 text-center shadow-2xs">
              <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto mb-3">
                <Clock size={24} />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                No expired coupons
              </h3>
              <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                You have no claimed deals that have expired. Great job using your coupons on time!
              </p>
            </div>
          )}
        </section>

        {/* ── 3. REDEEMED COUPONS SECTION ─────────────────────────────── */}
        <section id="section-redeemed-coupons" className="space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                Redeemed Coupons
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200/80">
                  {redeemedCoupons.length}
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Deals you have successfully used</p>
            </div>
          </div>

          {redeemedCoupons.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4">
              {redeemedCoupons.map((uc) => (
                <MyCouponCard
                  key={uc.id}
                  userCoupon={uc}
                  status="redeemed"
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 text-center shadow-2xs">
              <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 size={24} />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                No redeemed coupons yet
              </h3>
              <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                Redeem your claimed coupons at participating neighborhood stores to see your savings history here.
              </p>
              <div className="mt-4">
                <Link
                  href="/coupons"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all"
                >
                  <span>Explore Deals</span>
                  <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          )}
        </section>

      </div>

      {/* ── QR REDEMPTION MODAL ─────────────────────────────────────── */}
      {isQROpen && selectedCoupon && (
        <QRModal
          isOpen={isQROpen}
          onClose={handleCloseQR}
          qrValue={qrValue}
          couponTitle={selectedCoupon.coupons?.title || 'Coupon Deal'}
          showConfirmation={showConfirmation}
        />
      )}
    </div>
  );
}
