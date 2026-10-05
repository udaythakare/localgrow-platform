import React, { Suspense } from 'react';
import Navbar from '@/components/Navbar';
import MobileBottomNav from '@/components/BottomBar';
import CustomerThemeWrapper from '@/components/customer/CustomerThemeWrapper';
import BusinessDetailsView, { BusinessDetailsSkeleton } from '@/components/business/BusinessDetailsView';
import { getUserId } from '@/helpers/userHelper';

export const metadata = {
  title: 'Business Details - LocalGrow',
  description: 'View verified local business details, operating hours, locations, and active offers on LocalGrow.',
};

/**
 * Customer-Facing Business Details Page
 * Next.js App Router dynamic route: /businesses/[id]?locationId={locationId}
 */
export default async function BusinessDetailsPage({ params, searchParams }) {
  // Await params and searchParams for Next.js 15 App Router compatibility
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  const businessId = resolvedParams?.id;
  const locationId = resolvedSearchParams?.locationId || null;

  // Retrieve current user id if logged in for Navbar session state
  const rawUserId = await getUserId();
  const userId = typeof rawUserId === 'string' ? rawUserId : null;

  return (
    <CustomerThemeWrapper className="flex flex-col justify-between">
      <Navbar userId={userId} />

      <main className="flex-1 pb-24 md:pb-12">
        <Suspense fallback={<BusinessDetailsSkeleton />}>
          <BusinessDetailsView
            businessId={businessId}
            initialLocationId={locationId}
          />
        </Suspense>
      </main>

      <MobileBottomNav />
    </CustomerThemeWrapper>
  );
}
