'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'localgrow_user_coords';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function useGeolocation() {
  const [coordinates, setCoordinates] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [permissionStatus, setPermissionStatus] = useState('prompt'); // 'prompt' | 'granted' | 'denied' | 'unsupported' | 'error'

  // Attempt to restore valid cached coordinates from sessionStorage safely
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const cached = sessionStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        const isFresh = parsed?.timestamp && (Date.now() - parsed.timestamp < CACHE_TTL_MS);
        if (isFresh && parsed.latitude && parsed.longitude) {
          setCoordinates({
            latitude: parsed.latitude,
            longitude: parsed.longitude,
          });
          setPermissionStatus('granted');
          return;
        }
      }
    } catch {
      // Ignore sessionStorage read errors (e.g. private browsing mode)
    }

    // Check navigator.permissions if available
    if (navigator?.permissions?.query) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((status) => {
          setPermissionStatus(status.state); // 'granted', 'prompt', 'denied'
          status.onchange = () => {
            setPermissionStatus(status.state);
          };
        })
        .catch(() => {
          // Permissions API might reject for geolocation on some browsers
        });
    }
  }, []);

  const requestLocation = useCallback(() => {
    if (typeof window === 'undefined' || !navigator?.geolocation) {
      setError('Geolocation is not supported by your browser.');
      setPermissionStatus('unsupported');
      return;
    }

    setLoading(true);
    setError(null);

    const geoOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000,
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setCoordinates(coords);
        setLoading(false);
        setError(null);
        setPermissionStatus('granted');

        try {
          sessionStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
              latitude: coords.latitude,
              longitude: coords.longitude,
              timestamp: Date.now(),
            })
          );
        } catch {
          // Ignore sessionStorage write errors
        }
      },
      (err) => {
        setLoading(false);
        switch (err.code) {
          case 1: // PERMISSION_DENIED
            setError('Location access was denied. Please allow location permissions in your browser settings to find nearby businesses.');
            setPermissionStatus('denied');
            break;
          case 2: // POSITION_UNAVAILABLE
            setError('Location information is currently unavailable. Please check your device location settings and try again.');
            setPermissionStatus('error');
            break;
          case 3: // TIMEOUT
            setError('Location request timed out. Please try again.');
            setPermissionStatus('error');
            break;
          default:
            setError('An unknown error occurred while retrieving your location.');
            setPermissionStatus('error');
            break;
        }
      },
      geoOptions
    );
  }, []);

  return {
    coordinates,
    loading,
    error,
    permissionStatus,
    requestLocation,
  };
}
