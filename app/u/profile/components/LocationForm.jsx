'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useGeolocation } from '@/hooks/useGeolocation';
import { reverseGeocode } from '@/helpers/geocoding';
import {
  MapPin,
  Navigation,
  CheckCircle2,
  AlertCircle,
  RotateCw,
  X,
  Compass,
  Building2,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function LocationForm({ initialData = null, onSubmit }) {
  const router = useRouter();

  // Current saved location state (from database)
  const [savedLocation, setSavedLocation] = useState(initialData);

  // Detected location preview awaiting user confirmation
  const [previewLocation, setPreviewLocation] = useState(null);

  // Loading & interaction states
  const [isDetecting, setIsDetecting] = useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Status & error messages
  const [statusMessage, setStatusMessage] = useState(null);

  // Fallback manual city state
  const [showManualFallback, setShowManualFallback] = useState(false);
  const [manualCity, setManualCity] = useState('');

  // Geolocation hook
  const {
    coordinates,
    loading: geoLoading,
    error: geoError,
    permissionStatus,
    requestLocation,
  } = useGeolocation();

  // Sync state if initialData changes
  useEffect(() => {
    if (initialData) {
      setSavedLocation(initialData);
    }
  }, [initialData]);

  // Handle detection trigger
  const handleDetectLocation = useCallback(() => {
    setStatusMessage(null);
    setPreviewLocation(null);
    setIsDetecting(true);
    requestLocation();
  }, [requestLocation]);

  // When coordinates resolve, reverse geocode them
  useEffect(() => {
    if (!isDetecting || !coordinates?.latitude || !coordinates?.longitude) {
      return;
    }

    let isCancelled = false;

    const resolveAddress = async () => {
      setIsReverseGeocoding(true);
      try {
        const result = await reverseGeocode(coordinates.latitude, coordinates.longitude);
        if (isCancelled) return;

        if (result && (result.city || result.area || result.address)) {
          setPreviewLocation(result);
          setStatusMessage(null);
        } else {
          setStatusMessage({
            type: 'error',
            text: 'Could not automatically determine your address from GPS. Please enter your city manually below.',
          });
          setShowManualFallback(true);
        }
      } catch (err) {
        if (isCancelled) return;
        console.error('Reverse geocoding error:', err);
        setStatusMessage({
          type: 'error',
          text: 'Unable to fetch address details for your location. Please enter your city manually below.',
        });
        setShowManualFallback(true);
      } finally {
        if (!isCancelled) {
          setIsReverseGeocoding(false);
          setIsDetecting(false);
        }
      }
    };

    resolveAddress();

    return () => {
      isCancelled = true;
    };
  }, [coordinates, isDetecting]);

  // Handle GPS errors or permission denials
  useEffect(() => {
    if (isDetecting && (geoError || permissionStatus === 'denied' || permissionStatus === 'error')) {
      setIsDetecting(false);
      const errorText =
        geoError ||
        (permissionStatus === 'denied'
          ? 'Location access was denied. Please allow location permissions in your browser or enter your city manually below.'
          : 'Unable to retrieve location. Please check device settings or enter your city manually below.');

      setStatusMessage({
        type: 'error',
        text: errorText,
      });
      setShowManualFallback(true);
    }
  }, [geoError, permissionStatus, isDetecting]);

  // Confirm and persist detected location
  const handleConfirmAndSave = async () => {
    if (!previewLocation || !previewLocation.city) {
      toast.error('Location is missing city. Please enter city manually.');
      return;
    }

    setIsSaving(true);
    try {
      if (onSubmit) {
        const res = await onSubmit(previewLocation);
        if (res && res.error) {
          throw new Error(res.error);
        }
      }

      setSavedLocation(previewLocation);
      setPreviewLocation(null);
      setStatusMessage({
        type: 'success',
        text: 'Location updated and saved successfully!',
      });
      toast.success('Location updated successfully!');
      router.refresh();
    } catch (err) {
      console.error('Error saving location:', err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to save location. Please try again.',
      });
      toast.error(err.message || 'Failed to save location');
    } finally {
      setIsSaving(false);
    }
  };

  // Save city from fallback input
  const handleSaveManualCity = async (e) => {
    e?.preventDefault();
    const cleanCity = manualCity.trim();
    if (!cleanCity) {
      toast.error('Please enter a valid city name');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        city: cleanCity,
        country: 'India',
      };

      if (onSubmit) {
        const res = await onSubmit(payload);
        if (res && res.error) {
          throw new Error(res.error);
        }
      }

      setSavedLocation({
        ...(savedLocation || {}),
        city: cleanCity,
        country: 'India',
      });
      setManualCity('');
      setShowManualFallback(false);
      setStatusMessage({
        type: 'success',
        text: `City updated to ${cleanCity}! Local deals will now be filtered for this city.`,
      });
      toast.success(`City updated to ${cleanCity}`);
      router.refresh();
    } catch (err) {
      console.error('Error saving manual city:', err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to update city.',
      });
      toast.error('Failed to update city');
    } finally {
      setIsSaving(false);
    }
  };

  const isDetectingLocation = isDetecting || geoLoading || isReverseGeocoding;

  return (
    <div className="space-y-6">
      {/* ── SAVED LOCATION CARD ────────────────────────────────────────────── */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 sm:p-6 transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0 text-indigo-600 mt-0.5">
              <MapPin className="w-5 h-5" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Saved Location
                </span>
                {savedLocation?.latitude && savedLocation?.longitude && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    GPS Verified
                  </span>
                )}
              </div>

              {savedLocation?.city ? (
                <div className="mt-1">
                  <h3 className="text-base sm:text-lg font-semibold text-slate-800">
                    {savedLocation.area ? `${savedLocation.area}, ` : ''}
                    {savedLocation.city}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                    {savedLocation.address ? `${savedLocation.address} • ` : ''}
                    {savedLocation.state ? `${savedLocation.state}, ` : ''}
                    {savedLocation.country || 'India'}
                    {savedLocation.postal_code ? ` ${savedLocation.postal_code}` : ''}
                  </p>
                </div>
              ) : (
                <div className="mt-1">
                  <h3 className="text-base font-semibold text-slate-700">Location not set</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Detect your location to discover local coupons and deals near you.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Action button */}
          <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
            <button
              type="button"
              onClick={handleDetectLocation}
              disabled={isDetectingLocation || isSaving}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {isDetectingLocation ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin text-white" />
                  <span>Detecting...</span>
                </>
              ) : (
                <>
                  <Navigation className="w-4 h-4 text-white" />
                  <span>{savedLocation?.city ? 'Update Location' : 'Detect Current Location'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── STATUS / ERROR FEEDBACK ────────────────────────────────────────── */}
      {statusMessage && (
        <div
          className={`flex items-start gap-3 p-4 rounded-xl border text-sm transition-all ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800'
              : 'bg-rose-50/80 border-rose-200 text-rose-800'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
          )}
          <div className="flex-1">
            <p className="font-medium">{statusMessage.text}</p>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
            aria-label="Dismiss message"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── DETECTED LOCATION PREVIEW CARD ─────────────────────────────────── */}
      {previewLocation && (
        <div className="border border-indigo-200 bg-indigo-50/40 rounded-2xl p-5 sm:p-6 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Compass className="w-5 h-5 text-indigo-600" />
              <h4 className="text-sm font-bold uppercase tracking-wider text-indigo-900">
                Detected Location
              </h4>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
              Preview • Not saved yet
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm bg-white border border-indigo-100 rounded-xl p-4">
            <div>
              <span className="text-xs text-slate-400 block font-medium">Address</span>
              <span className="text-slate-800 font-medium break-words">
                {previewLocation.address || '—'}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block font-medium">Area / Neighborhood</span>
              <span className="text-slate-800 font-medium">
                {previewLocation.area || '—'}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block font-medium">City</span>
              <span className="text-slate-800 font-bold text-indigo-700">
                {previewLocation.city || '—'}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block font-medium">State</span>
              <span className="text-slate-800 font-medium">
                {previewLocation.state || '—'}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block font-medium">Postal Code</span>
              <span className="text-slate-800 font-medium">
                {previewLocation.postal_code || '—'}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block font-medium">Country</span>
              <span className="text-slate-800 font-medium">
                {previewLocation.country || 'India'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setPreviewLocation(null)}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmAndSave}
              disabled={isSaving || !previewLocation.city}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin text-white" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span>Confirm & Save</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── MANUAL CITY FALLBACK ACCORDION / SECTION ──────────────────────── */}
      <div className="pt-2 border-t border-slate-100">
        {!showManualFallback ? (
          <button
            type="button"
            onClick={() => setShowManualFallback(true)}
            className="text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors inline-flex items-center gap-1 cursor-pointer"
          >
            <span>Having trouble with GPS? Set city manually</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <form
            onSubmit={handleSaveManualCity}
            className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3 mt-2"
          >
            <div className="flex items-center justify-between">
              <label htmlFor="manualCityInput" className="text-xs font-bold uppercase tracking-wider text-slate-700">
                City Name (Locality Fallback)
              </label>
              <button
                type="button"
                onClick={() => setShowManualFallback(false)}
                className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                Close
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Enter your city to discover active coupons and local deals even if device GPS is unavailable.
            </p>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="manualCityInput"
                type="text"
                value={manualCity}
                onChange={(e) => setManualCity(e.target.value)}
                placeholder="e.g. Mumbai, Navi Mumbai, Thane"
                className="flex-1 px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-medium text-slate-800"
              />
              <button
                type="submit"
                disabled={isSaving || !manualCity.trim()}
                className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
              >
                {isSaving ? 'Saving...' : 'Save City'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}