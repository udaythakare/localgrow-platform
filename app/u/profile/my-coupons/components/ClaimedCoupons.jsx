'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Ticket, Clock, CheckCircle2 } from 'lucide-react';
import { getUserId } from '@/helpers/userHelper';
import QRModal from '../../components/QRModal';
import { supabase } from '@/lib/supabase';
import { revalidateMyCouponPage } from '@/actions/revalidateActions';
import MyCouponCard from './MyCouponCard';
import { classifyUserCoupons } from '@/helpers/myCouponHelpers';

/**
 * ClaimedCoupons
 * Modernized customer component for claimed coupons.
 * Correctly classifies claimed coupons into Active vs Expired.
 * Expired coupons are NEVER displayed as active.
 */
export default function ClaimedCoupons({ data: initialData, onDataUpdate }) {
  const [data, setData] = useState(initialData);
  const { success, coupons } = data || { success: false, coupons: [] };

  const [isQROpen, setIsQROpen] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState(null);
  const [userId, setUserId] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  useEffect(() => {
    const fetchUserId = async () => {
      try {
        const id = await getUserId();
        if (typeof id === 'string') {
          setUserId(id);
        }
      } catch (error) {
        console.error('Failed to get user ID:', error);
      }
    };
    fetchUserId();
  }, []);

  const refreshData = async () => {
    setRefreshing(true);
    try {
      const response = await fetch('/api/profile/user-claimed-coupon', {
        credentials: 'include',
      });
      if (response.ok) {
        const newData = await response.json();
        setData(newData);
        if (onDataUpdate) onDataUpdate(newData);
      }
    } catch (error) {
      console.error('Failed to refresh data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`claimed_coupons_changes_${userId}`)
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
          const updatedCoupon = payload.new;
          if (
            payload.eventType === 'UPDATE' &&
            updatedCoupon?.coupon_status === 'redeemed'
          ) {
            if (
              isQROpen &&
              selectedCoupon &&
              (selectedCoupon.id === updatedCoupon.id ||
                selectedCoupon.coupon_id === updatedCoupon.coupon_id)
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

  const showQrCode = (coupon) => {
    setIsQROpen(true);
    setSelectedCoupon(coupon);
    setShowConfirmation(false);
  };

  const closeQRModal = () => {
    setIsQROpen(false);
    setShowConfirmation(false);
    setSelectedCoupon(null);
  };

  const getQrValue = () => {
    if (!selectedCoupon || !userId) return '';
    return JSON.stringify({
      userId,
      couponId: selectedCoupon.coupon_id || selectedCoupon.coupons?.id,
    });
  };

  // Classify coupons: strictly split claimed into active vs expired
  const { active, expired } = useMemo(() => {
    const list = coupons || [];
    const classified = classifyUserCoupons(list, new Date());
    return {
      active: classified.active,
      expired: classified.expired,
    };
  }, [coupons]);

  return (
    <div className="space-y-6">
      {/* Refresh Row */}
      <div className="flex justify-end">
        <button
          onClick={refreshData}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw
            size={13}
            className={refreshing ? 'animate-spin text-indigo-600' : 'text-slate-500'}
          />
          <span>Refresh</span>
        </button>
      </div>

      {/* Active Coupons Section */}
      <div>
        <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
          <span>Active Coupons</span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80">
            {active.length}
          </span>
        </h3>

        {active.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {active.map((coupon) => (
              <MyCouponCard
                key={coupon.id}
                userCoupon={coupon}
                status="active"
                onShowQR={showQrCode}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 text-center shadow-2xs">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2">
              <Ticket size={20} />
            </div>
            <p className="text-sm font-bold text-slate-900">You&apos;re all caught up</p>
            <p className="text-xs text-slate-500 mt-1">No active coupons available right now.</p>
          </div>
        )}
      </div>

      {/* Expired Coupons Section */}
      {expired.length > 0 && (
        <div className="pt-4 border-t border-slate-200/60">
          <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
            <span>Expired Coupons</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              {expired.length}
            </span>
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {expired.map((coupon) => (
              <MyCouponCard
                key={coupon.id}
                userCoupon={coupon}
                status="expired"
              />
            ))}
          </div>
        </div>
      )}

      {/* QR Modal */}
      {isQROpen && selectedCoupon && (
        <QRModal
          isOpen={isQROpen}
          onClose={closeQRModal}
          qrValue={getQrValue()}
          couponTitle={selectedCoupon.coupons?.title || 'Coupon Deal'}
          showConfirmation={showConfirmation}
        />
      )}
    </div>
  );
}