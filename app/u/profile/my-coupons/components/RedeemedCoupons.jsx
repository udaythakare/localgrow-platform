'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { RefreshCw, CheckCircle2, ArrowRight } from 'lucide-react';
import { getUserId } from '@/helpers/userHelper';
import { supabase } from '@/lib/supabase';
import { revalidateMyCouponPage } from '@/actions/revalidateActions';
import MyCouponCard from './MyCouponCard';

/**
 * RedeemedCoupons
 * Modernized customer component for redeemed coupons.
 * Displays user's redemption history using modern customer design system.
 */
export default function RedeemedCoupons({ data: initialData, onDataUpdate }) {
  const [data, setData] = useState(initialData);
  const { success, coupons } = data || { success: false, coupons: [] };
  const [userId, setUserId] = useState(null);
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
      const response = await fetch('/api/profile/user-redeemed-coupon', {
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
      .channel(`redeemed_coupons_changes_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_coupons',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          refreshData();
          revalidateMyCouponPage();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const redeemedList = coupons || [];

  return (
    <div className="space-y-6">
      {/* Header / Refresh Row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
            <span>Redeemed Coupons</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200/80">
              {redeemedList.length}
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {redeemedList.length} coupon{redeemedList.length !== 1 ? 's' : ''} redeemed
          </p>
        </div>

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

      {/* Cards Grid */}
      {redeemedList.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {redeemedList.map((coupon) => (
            <MyCouponCard
              key={coupon.id}
              userCoupon={coupon}
              status="redeemed"
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 text-center shadow-2xs">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto mb-2">
            <CheckCircle2 size={20} />
          </div>
          <p className="text-sm font-bold text-slate-900">No redeemed coupons yet</p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Redeem your claimed coupons at participating stores to see them here.
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
    </div>
  );
}