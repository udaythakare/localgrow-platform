'use client';

import React from 'react';
import { MapPin, Navigation, AlertTriangle, AlertCircle, Loader2 } from 'lucide-react';

export default function LocationPermissionPrompt({
  loading = false,
  error = null,
  permissionStatus = 'prompt',
  onRequestLocation,
}) {
  // 1. Loading State
  if (loading) {
    return (
      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-8 max-w-md mx-auto text-center my-12">
        <div className="w-16 h-16 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto mb-4">
          <Loader2 className="animate-spin text-indigo-600" size={32} />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">
          Getting your location...
        </h2>
        <p className="text-sm text-slate-500 font-medium">
          Please check your browser prompt and allow location access.
        </p>
      </div>
    );
  }

  // 2. Permission Denied State
  if (permissionStatus === 'denied') {
    return (
      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 sm:p-8 max-w-lg mx-auto text-center my-12">
        <div className="w-16 h-16 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="text-rose-500" size={32} />
        </div>

        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">
          Location Access Blocked
        </h2>

        <p className="text-sm text-slate-600 font-medium mb-4 leading-relaxed">
          Nearby businesses require your location to calculate distances. Your browser currently has location access blocked for this site.
        </p>

        {/* Clear Instructions */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left mb-6 text-xs text-amber-900 font-medium">
          <p className="font-bold text-sm mb-1.5 flex items-center gap-1.5">
            <AlertTriangle size={15} className="text-amber-600" /> How to enable location:
          </p>
          <ol className="list-decimal list-inside space-y-1 text-amber-800/80">
            <li>Click the <strong>Lock / Settings</strong> icon in your browser address bar.</li>
            <li>Change <strong>Location</strong> permission to <strong>Allow</strong>.</li>
            <li>Reload the page or click &ldquo;Try Again&rdquo; below.</li>
          </ol>
        </div>

        <button
          type="button"
          onClick={onRequestLocation}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 shadow-sm hover:bg-indigo-700 hover:shadow active:scale-[0.98] transition-all"
        >
          <Navigation size={16} />
          Try Again
        </button>
      </div>
    );
  }

  // 3. Unsupported State
  if (permissionStatus === 'unsupported') {
    return (
      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 sm:p-8 max-w-md mx-auto text-center my-12">
        <div className="w-16 h-16 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="text-slate-400" size={32} />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">
          Geolocation Unavailable
        </h2>
        <p className="text-sm text-slate-500 font-medium">
          Browser geolocation is not supported on this device or environment.
        </p>
      </div>
    );
  }

  // 4. Initial State or Error State
  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 sm:p-10 max-w-lg mx-auto text-center my-12">
      <div className="w-16 h-16 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto mb-4">
        <MapPin size={32} className="text-indigo-600" />
      </div>

      <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-2">
        Find Businesses Near You
      </h2>

      <p className="text-sm sm:text-base text-slate-500 font-medium mb-6 leading-relaxed">
        Allow location access to discover local stores, verified shops, and exclusive deals right around your neighborhood.
      </p>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold p-3 rounded-xl mb-6">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={onRequestLocation}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl text-base font-semibold text-white bg-indigo-600 shadow-sm hover:shadow hover:bg-indigo-700 active:scale-[0.98] transition-all cursor-pointer"
      >
        <Navigation size={18} />
        Use My Location
      </button>
    </div>
  );
}
