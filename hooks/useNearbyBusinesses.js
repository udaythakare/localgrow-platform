'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook to fetch nearby businesses from Spring Boot V2 via Next.js rewrite.
 * Includes AbortController cancellation and monotonic request-ID guard
 * to prevent race conditions when radius or coordinates change rapidly.
 */
export function useNearbyBusinesses({
  latitude,
  longitude,
  radiusKm = 2,
  page: initialPage = 0,
  size = 20,
} = {}) {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  // Guards against race conditions
  const abortControllerRef = useRef(null);
  const requestIdRef = useRef(0);

  // Sync internal page if initialPage changes from parent
  useEffect(() => {
    setPage(initialPage);
  }, [initialPage]);

  const fetchNearby = useCallback(async () => {
    // Cannot query without valid numeric coordinates
    if (
      typeof latitude !== 'number' ||
      typeof longitude !== 'number' ||
      isNaN(latitude) ||
      isNaN(longitude)
    ) {
      setBusinesses([]);
      setLoading(false);
      setError(null);
      return;
    }

    // 1. Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // 2. Prepare new controller and increment monotonic request ID
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const currentRequestId = ++requestIdRef.current;

    setLoading(true);
    setError(null);

    const queryParams = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      radiusKm: String(radiusKm),
      page: String(page),
      size: String(size),
    });

    try {
      const response = await fetch(`/api/v2/businesses/nearby?${queryParams.toString()}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      // Ignore response if a newer request was dispatched while this was in-flight
      if (currentRequestId !== requestIdRef.current) {
        return;
      }

      if (!response.ok) {
        let errorMessage = `Failed to fetch nearby businesses (HTTP ${response.status})`;
        try {
          const errorData = await response.json();
          if (errorData?.message) {
            errorMessage = errorData.message;
          }
        } catch {
          // Response body was not JSON
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      // Guard again before committing state update
      if (currentRequestId !== requestIdRef.current) {
        return;
      }

      setBusinesses(Array.isArray(data.content) ? data.content : []);
      setTotalPages(typeof data.totalPages === 'number' ? data.totalPages : 1);
      setTotalElements(typeof data.totalElements === 'number' ? data.totalElements : (data.content?.length || 0));
      setError(null);
    } catch (err) {
      // Intentionally aborted requests MUST NOT appear as an error
      if (err.name === 'AbortError') {
        return;
      }

      // Check request ID guard
      if (currentRequestId === requestIdRef.current) {
        setError(err.message || 'An unexpected error occurred while fetching nearby businesses.');
        setBusinesses([]);
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [latitude, longitude, radiusKm, page, size]);

  // Trigger fetch whenever coordinates, radius, or page change
  useEffect(() => {
    fetchNearby();

    return () => {
      // Abort in-flight request when component unmounts
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchNearby]);

  const retry = useCallback(() => {
    fetchNearby();
  }, [fetchNearby]);

  return {
    businesses,
    loading,
    error,
    page,
    size,
    totalElements,
    totalPages,
    setPage,
    retry,
  };
}
