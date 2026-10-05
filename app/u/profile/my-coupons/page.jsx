import React from 'react';
import Link from 'next/link';
import { Shield, ArrowRight, LogIn } from 'lucide-react';
import CustomerThemeWrapper from '@/components/customer/CustomerThemeWrapper';
import MyCouponsView from './components/MyCouponsView';
import { getUserId } from '@/helpers/userHelper';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const metadata = {
  title: 'My Coupons - LocalGrow',
  description: 'View and manage your claimed, active, and redeemed local discount coupons on LocalGrow.',
};

export const dynamic = 'force-dynamic';

/**
 * Customer /u/profile/my-coupons Page
 * Server component that fetches customer claimed and redeemed coupons,
 * applies CustomerThemeWrapper (Plus Jakarta Sans, light neutral surface),
 * and delegates to MyCouponsView for interactive rendering and real-time updates.
 */
export default async function MyCouponsPage() {
  const rawUserId = await getUserId();
  const userId = typeof rawUserId === 'string' && rawUserId.trim().length > 0 ? rawUserId.trim() : null;

  // Unauthenticated customer handling
  if (!userId) {
    return (
      <CustomerThemeWrapper className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 text-center shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4">
            <Shield size={24} />
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Sign In Required
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-slate-500 leading-relaxed">
            Please sign in to your LocalGrow account to view your claimed, active, and redeemed coupons.
          </p>
          <div className="mt-6 flex justify-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-all"
            >
              <LogIn size={15} />
              <span>Sign In</span>
            </Link>
          </div>
        </div>
      </CustomerThemeWrapper>
    );
  }

  // Fetch claimed and redeemed records scoped to authenticated userId
  const [claimedResult, redeemedResult] = await Promise.all([
    supabaseAdmin
      .from('user_coupons')
      .select('*, coupons(*, businesses(id, name, logo_url, status, business_locations(*)))')
      .eq('user_id', userId)
      .eq('coupon_status', 'claimed')
      .order('id', { ascending: false }),
    supabaseAdmin
      .from('user_coupons')
      .select('*, coupons(*, businesses(id, name, logo_url, status, business_locations(*)))')
      .eq('user_id', userId)
      .eq('coupon_status', 'redeemed')
      .order('id', { ascending: false }),
  ]);

  const claimedCoupons = claimedResult.data || [];
  const redeemedCoupons = redeemedResult.data || [];

  return (
    <CustomerThemeWrapper className="min-h-screen">
      <main>
        <MyCouponsView
          initialClaimed={claimedCoupons}
          initialRedeemed={redeemedCoupons}
          userId={userId}
        />
      </main>
    </CustomerThemeWrapper>
  );
}