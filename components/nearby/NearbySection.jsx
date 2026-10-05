'use client';

import React, { useState, useCallback } from 'react';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useNearbyBusinesses } from '@/hooks/useNearbyBusinesses';
import RadiusSelector, { RADIUS_OPTIONS } from '@/components/nearby/RadiusSelector';
import NearbyBusinessCard from '@/components/nearby/NearbyBusinessCard';
import NearbyMap from '@/components/nearby/NearbyMap';
import LocationPermissionPrompt from '@/components/nearby/LocationPermissionPrompt';
import {
  SearchX,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Store,
  LayoutGrid,
  Columns2,
  Map,
  List,
} from 'lucide-react';

const RADIUS_VALUES = [0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export default function NearbySection() {
  const {
    coordinates,
    loading: geoLoading,
    error: geoError,
    permissionStatus,
    requestLocation,
  } = useGeolocation();

  const [radiusKm, setRadiusKm] = useState(2);
  const [currentPage, setCurrentPage] = useState(0);

  // Layout View State:
  // Desktop: 'split' (List + Map), 'grid' (3-col cards), 'map' (Full map)
  const [viewMode, setViewMode] = useState('split');
  // Mobile: 'list' | 'map'
  const [mobileTab, setMobileTab] = useState('list');

  // Currently focused / selected business
  const [selectedBusinessId, setSelectedBusinessId] = useState(null);

  // Synchronized Claimed Offers state across cards in list/map view
  const [claimedCouponIds, setClaimedCouponIds] = useState(() => new Set());

  const handleClaimSuccess = useCallback((couponId) => {
    if (!couponId) return;
    setClaimedCouponIds((prev) => new Set([...prev, couponId]));
  }, []);

  const {
    businesses,
    loading: apiLoading,
    error: apiError,
    totalPages,
    totalElements,
    setPage,
    retry,
  } = useNearbyBusinesses({
    latitude: coordinates?.latitude,
    longitude: coordinates?.longitude,
    radiusKm,
    page: currentPage,
    size: 20,
  });

  const handleRadiusChange = (newRadius) => {
    setRadiusKm(newRadius);
    setCurrentPage(0);
    setPage(0);
    setSelectedBusinessId(null);
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    setPage(newPage);
    setSelectedBusinessId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Synchronized Selection (Marker -> Card or Card -> Marker)
  const handleSelectBusiness = useCallback((businessId) => {
    setSelectedBusinessId(businessId);
    if (typeof document !== 'undefined') {
      const card = document.getElementById(`business-card-${businessId}`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, []);

  const currentRadiusIndex = RADIUS_VALUES.indexOf(radiusKm);
  const canIncreaseRadius =
    currentRadiusIndex !== -1 && currentRadiusIndex < RADIUS_VALUES.length - 1;
  const nextRadius = canIncreaseRadius ? RADIUS_VALUES[currentRadiusIndex + 1] : null;
  const currentRadiusLabel =
    RADIUS_OPTIONS.find((o) => o.value === radiusKm)?.label || `${radiusKm} km`;
  const nextRadiusLabel = nextRadius
    ? RADIUS_OPTIONS.find((o) => o.value === nextRadius)?.label || `${nextRadius} km`
    : null;

  const handleIncreaseRadius = () => {
    if (nextRadius !== null) {
      handleRadiusChange(nextRadius);
    }
  };

  // 1. Initial State: No coordinates yet -> Permission prompt
  if (!coordinates) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <LocationPermissionPrompt
          loading={geoLoading}
          error={geoError}
          permissionStatus={permissionStatus}
          onRequestLocation={requestLocation}
        />
      </div>
    );
  }

  // Find currently selected business object for mobile preview if in mobile map mode
  const selectedBusiness = businesses.find((b) => b.businessId === selectedBusinessId);

  // 2. Coordinates acquired -> Discovery UI with Map Integration
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Header section */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 mb-2">
              <Store size={14} />
              Geospatial Discovery
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Nearby Businesses
            </h1>
            <p className="text-sm text-slate-500 font-medium mt-1">
              Find verified stores and vendors close to your current location.
            </p>
          </div>

          {/* Quick Refresh Location Button */}
          <button
            type="button"
            onClick={requestLocation}
            disabled={geoLoading}
            title="Refresh current location"
            className="self-start sm:self-center inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 hover:shadow active:scale-95 transition-all cursor-pointer"
          >
            <RotateCw size={14} className={geoLoading ? 'animate-spin' : ''} />
            {geoLoading ? 'Updating GPS...' : 'Update GPS'}
          </button>
        </div>

        {/* Radius Selector */}
        <RadiusSelector value={radiusKm} onChange={handleRadiusChange} />

        {/* Controls row: Result Count + View Mode Switches */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="text-xs sm:text-sm font-semibold text-slate-600">
            {apiLoading ? (
              <span className="text-indigo-600 animate-pulse">Searching nearby stores...</span>
            ) : (
              <span>
                Found <strong className="text-slate-900">{totalElements}</strong>{' '}
                {totalElements === 1 ? 'business' : 'businesses'} within{' '}
                <strong className="text-indigo-600">{currentRadiusLabel}</strong>
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Desktop View Switcher (Hidden on Mobile) */}
            <div
              className="hidden lg:inline-flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200"
              role="radiogroup"
              aria-label="Desktop view mode"
            >
              <button
                type="button"
                role="radio"
                aria-checked={viewMode === 'split'}
                onClick={() => setViewMode('split')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === 'split'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Columns2 size={14} />
                Split View
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={viewMode === 'grid'}
                onClick={() => setViewMode('grid')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid size={14} />
                Grid View
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={viewMode === 'map'}
                onClick={() => setViewMode('map')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === 'map'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Map size={14} />
                Map Only
              </button>
            </div>

            {/* Mobile View Switcher (Visible on Mobile / Tablet) */}
            <div
              className="inline-flex lg:hidden items-center bg-slate-100 p-1 rounded-xl border border-slate-200"
              role="radiogroup"
              aria-label="Mobile view tab"
            >
              <button
                type="button"
                role="radio"
                aria-checked={mobileTab === 'list'}
                onClick={() => setMobileTab('list')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  mobileTab === 'list'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <List size={14} />
                List ({totalElements})
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={mobileTab === 'map'}
                onClick={() => setMobileTab('map')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  mobileTab === 'map'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Map size={14} />
                Map View
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {apiLoading ? (
        /* Loading skeleton grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 my-6">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-60 bg-white border border-slate-200 rounded-2xl animate-pulse shadow-sm p-5 flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between mb-3">
                  <div className="h-6 w-20 bg-slate-100 rounded" />
                  <div className="h-6 w-24 bg-slate-100 rounded" />
                </div>
                <div className="h-6 w-3/4 bg-slate-200 rounded mb-2" />
                <div className="h-4 w-full bg-slate-100 rounded mb-1" />
                <div className="h-4 w-2/3 bg-slate-100 rounded mb-4" />
              </div>
              <div className="h-10 w-full bg-slate-100 rounded-lg" />
            </div>
          ))}
        </div>
      ) : apiError ? (
        /* Error state with retry */
        <div className="my-8 p-6 sm:p-8 bg-rose-50 border border-rose-200 rounded-2xl text-center shadow-sm">
          <h3 className="text-lg font-bold text-rose-800 mb-2">
            Unable to Load Nearby Businesses
          </h3>
          <p className="text-sm text-rose-600 font-medium max-w-md mx-auto mb-6">{apiError}</p>
          <button
            type="button"
            onClick={retry}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-rose-600 shadow-sm hover:bg-rose-700 hover:shadow active:scale-95 transition-all cursor-pointer"
          >
            <RotateCw size={15} />
            Retry Search
          </button>
        </div>
      ) : businesses.length === 0 ? (
        /* Empty State with incremental radius increase CTA */
        <div className="flex flex-col items-center justify-center text-center py-16 px-6 bg-white border border-slate-200 rounded-2xl shadow-sm my-6">
          <div className="mb-4 p-4 rounded-full bg-slate-50 border border-slate-100 text-slate-400">
            <SearchX size={36} strokeWidth={2} />
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">
            No Businesses Found Nearby
          </h3>
          <p className="text-slate-500 max-w-md mb-6 text-xs sm:text-sm font-medium">
            We couldn&apos;t find any registered businesses within {currentRadiusLabel}. Try
            expanding your search radius to discover stores located further away.
          </p>
          {canIncreaseRadius && (
            <button
              type="button"
              onClick={handleIncreaseRadius}
              className="text-white font-semibold px-6 py-3 rounded-xl bg-indigo-600 shadow-sm hover:shadow hover:bg-indigo-700 active:scale-95 transition-all cursor-pointer"
            >
              Increase Radius to {nextRadiusLabel}
            </button>
          )}

          {/* Interactive Map preview even on empty results to show search area */}
          <div className="w-full mt-8 h-80 rounded-2xl overflow-hidden shadow-sm">
            <NearbyMap
              businesses={[]}
              userLocation={coordinates}
              radiusKm={radiusKm}
              viewMode="map"
            />
          </div>
        </div>
      ) : (
        /* Results View */
        <>
          {/* ────────────────────────────────────────────────────────── */}
          {/* MOBILE VIEW RENDERING (Below lg breakpoint)                */}
          {/* ────────────────────────────────────────────────────────── */}
          <div className="lg:hidden my-6">
            {mobileTab === 'list' ? (
              /* Mobile List Mode */
              <div className="flex flex-col gap-4">
                {businesses.map((business) => (
                  <NearbyBusinessCard
                    key={business.locationId || business.businessId}
                    business={business}
                    isSelected={selectedBusinessId === business.businessId}
                    onSelect={handleSelectBusiness}
                    claimedCouponIds={claimedCouponIds}
                    onClaimSuccess={handleClaimSuccess}
                  />
                ))}
              </div>
            ) : (
              /* Mobile Map Mode */
              <div className="flex flex-col gap-4">
                <div className="w-full h-[calc(100dvh-17rem)] min-h-[380px] rounded-2xl overflow-hidden">
                  <NearbyMap
                    businesses={businesses}
                    userLocation={coordinates}
                    radiusKm={radiusKm}
                    selectedBusinessId={selectedBusinessId}
                    onSelectBusiness={handleSelectBusiness}
                    viewMode="map"
                  />
                </div>

                {/* Selected store mini bottom preview card on mobile */}
                {selectedBusiness && (
                  <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <NearbyBusinessCard
                      business={selectedBusiness}
                      isSelected={true}
                      onSelect={handleSelectBusiness}
                      claimedCouponIds={claimedCouponIds}
                      onClaimSuccess={handleClaimSuccess}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ────────────────────────────────────────────────────────── */}
          {/* DESKTOP VIEW RENDERING (lg and above)                      */}
          {/* ────────────────────────────────────────────────────────── */}
          <div className="hidden lg:block my-6">
            {viewMode === 'split' ? (
              /* Split View: Left List (48%), Right Sticky Map (52%) */
              <div className="flex flex-row gap-6 items-start">
                <div className="w-[48%] flex flex-col gap-4">
                  {businesses.map((business) => (
                    <NearbyBusinessCard
                      key={business.locationId || business.businessId}
                      business={business}
                      isSelected={selectedBusinessId === business.businessId}
                      onSelect={handleSelectBusiness}
                      claimedCouponIds={claimedCouponIds}
                      onClaimSuccess={handleClaimSuccess}
                    />
                  ))}
                </div>

                <div className="w-[52%] sticky top-20 h-[calc(100vh-6.5rem)] min-h-[480px]">
                  <NearbyMap
                    businesses={businesses}
                    userLocation={coordinates}
                    radiusKm={radiusKm}
                    selectedBusinessId={selectedBusinessId}
                    onSelectBusiness={handleSelectBusiness}
                    viewMode={viewMode}
                  />
                </div>
              </div>
            ) : viewMode === 'grid' ? (
              /* Grid View: 3-column cards grid */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {businesses.map((business) => (
                  <NearbyBusinessCard
                    key={business.locationId || business.businessId}
                    business={business}
                    isSelected={selectedBusinessId === business.businessId}
                    onSelect={handleSelectBusiness}
                    claimedCouponIds={claimedCouponIds}
                    onClaimSuccess={handleClaimSuccess}
                  />
                ))}
              </div>
            ) : (
              /* Map Only View */
              <div className="w-full h-[calc(100vh-14rem)] min-h-[520px]">
                <NearbyMap
                  businesses={businesses}
                  userLocation={coordinates}
                  radiusKm={radiusKm}
                  selectedBusinessId={selectedBusinessId}
                  onSelectBusiness={handleSelectBusiness}
                  viewMode={viewMode}
                />
              </div>
            )}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 my-8">
              <button
                type="button"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 0 || apiLoading}
                aria-label="Previous page"
                className={`
                  inline-flex items-center gap-1 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold border
                  transition-all cursor-pointer
                  ${
                    currentPage === 0 || apiLoading
                      ? 'bg-slate-50 text-slate-400 cursor-not-allowed border-slate-200'
                      : 'bg-white text-slate-700 border-slate-200 shadow-sm hover:bg-slate-50 hover:shadow active:scale-95'
                  }
                `}
              >
                <ChevronLeft size={16} />
                Previous
              </button>

              <span className="text-xs sm:text-sm font-semibold text-slate-700 px-3 py-1.5 bg-white border border-slate-200 rounded-xl shadow-sm">
                Page {currentPage + 1} of {totalPages}
              </span>

              <button
                type="button"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages - 1 || apiLoading}
                aria-label="Next page"
                className={`
                  inline-flex items-center gap-1 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold border
                  transition-all cursor-pointer
                  ${
                    currentPage >= totalPages - 1 || apiLoading
                      ? 'bg-slate-50 text-slate-400 cursor-not-allowed border-slate-200'
                      : 'bg-white text-slate-700 border-slate-200 shadow-sm hover:bg-slate-50 hover:shadow active:scale-95'
                  }
                `}
              >
                Next
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
