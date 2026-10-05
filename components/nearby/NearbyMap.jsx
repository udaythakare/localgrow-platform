'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, MapPin } from 'lucide-react';

const LEAFLET_JS_URL = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const LEAFLET_CSS_URL = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';

/**
 * Formats distance for popup display.
 */
function formatDistance(distanceKm) {
  if (typeof distanceKm !== 'number' || isNaN(distanceKm)) return '';
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m away`;
  }
  return `${distanceKm.toFixed(2)} km away`;
}

/**
 * Escapes HTML characters for safe Leaflet popup markup.
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default function NearbyMap({
  businesses = [],
  userLocation = null,
  radiusKm = 2,
  selectedBusinessId = null,
  onSelectBusiness,
  viewMode = 'split',
  className = '',
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const userLayerGroupRef = useRef(null);
  const businessLayerGroupRef = useRef(null);
  const markersMapRef = useRef(new Map()); // businessId -> L.Marker

  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);

  // 1. Dynamic Leaflet CDN Loading (Browser-only, SSR-safe, no duplicates)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (window.L) {
      setLeafletLoaded(true);
      return;
    }

    // Inject CSS if not already present
    if (!document.querySelector(`link[href="${LEAFLET_CSS_URL}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = LEAFLET_CSS_URL;
      document.head.appendChild(link);
    }

    // Inject JS if not already present
    let script = document.querySelector(`script[src="${LEAFLET_JS_URL}"]`);
    if (!script) {
      script = document.createElement('script');
      script.src = LEAFLET_JS_URL;
      script.async = true;
      document.head.appendChild(script);
    }

    const onLoad = () => setLeafletLoaded(true);
    const onError = () => setLoadError('Failed to load map library from CDN');

    script.addEventListener('load', onLoad);
    script.addEventListener('error', onError);

    return () => {
      script?.removeEventListener('load', onLoad);
      script?.removeEventListener('error', onError);
    };
  }, []);

  // 2. Initialize Single Leaflet Map Instance
  useEffect(() => {
    if (!leafletLoaded || !mapContainerRef.current || mapInstanceRef.current || !window.L) {
      return;
    }

    const L = window.L;

    // Default initial center (User location or Mumbai default fallback)
    const initialLat = userLocation?.latitude || 19.076;
    const initialLng = userLocation?.longitude || 72.8777;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 14,
      zoomControl: true,
      scrollWheelZoom: true,
    });

    // Standard OpenStreetMap tiles with required visible attribution
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // Layer groups for clean updates without full map reconstruction
    userLayerGroupRef.current = L.layerGroup().addTo(map);
    businessLayerGroupRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        userLayerGroupRef.current = null;
        businessLayerGroupRef.current = null;
        markersMapRef.current.clear();
      }
    };
  }, [leafletLoaded]);

  // 3. Render / Update User Location Marker & Radius Circle
  useEffect(() => {
    if (!mapInstanceRef.current || !userLayerGroupRef.current || !window.L) return;
    const L = window.L;
    const layer = userLayerGroupRef.current;
    layer.clearLayers();

    if (!userLocation?.latitude || !userLocation?.longitude) return;

    const lat = userLocation.latitude;
    const lng = userLocation.longitude;

    // A. Pulse ring user location marker
    const userIcon = L.divIcon({
      className: 'user-location-marker-container',
      html: `
        <div style="position: relative; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 28px; height: 28px; background: rgba(59, 130, 246, 0.4); border-radius: 50%; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="position: relative; width: 16px; height: 16px; background: #2563EB; border: 3px solid #ffffff; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.5);"></div>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    const userMarker = L.marker([lat, lng], {
      icon: userIcon,
      zIndexOffset: 1000,
      title: 'Your Location',
    });

    userMarker.bindTooltip('<strong>Your Location</strong>', {
      direction: 'top',
      offset: [0, -14],
    });

    layer.addLayer(userMarker);

    // B. Search Radius Circle
    if (typeof radiusKm === 'number' && radiusKm > 0) {
      const radiusMeters = radiusKm * 1000;
      const circle = L.circle([lat, lng], {
        radius: radiusMeters,
        color: '#4f46e5',
        weight: 2,
        dashArray: '6, 6',
        fillColor: '#4f46e5',
        fillOpacity: 0.05,
        interactive: false,
      });
      layer.addLayer(circle);
    }
  }, [userLocation, radiusKm, leafletLoaded]);

  // Helper to construct custom modern marker divIcon
  const createBusinessIcon = useCallback((isSelected = false) => {
    if (!window.L) return null;
    const L = window.L;

    const bg = isSelected ? '#4f46e5' : '#ffffff';
    const text = isSelected ? '#ffffff' : '#4f46e5';
    const scale = isSelected ? 'transform: scale(1.15); z-index: 1000;' : '';
    const shadow = isSelected ? '0 4px 6px -1px rgba(0,0,0,0.1)' : '0 1px 3px rgba(0,0,0,0.1)';
    const border = isSelected ? 'border: 2px solid #ffffff;' : 'border: 1px solid #e2e8f0;';

    return L.divIcon({
      className: 'nearby-biz-marker',
      html: `
        <div style="
          width: 32px;
          height: 32px;
          background: ${bg};
          ${border}
          border-radius: 50%;
          box-shadow: ${shadow};
          display: flex;
          align-items: center;
          justify-content: center;
          color: ${text};
          transition: all 0.2s ease;
          ${scale}
        ">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/>
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
            <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/>
            <path d="M2 7h20"/>
          </svg>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -18],
    });
  }, []);

  // 4. Render / Update Business Markers from API Content
  useEffect(() => {
    if (!mapInstanceRef.current || !businessLayerGroupRef.current || !window.L) return;
    const L = window.L;
    const layer = businessLayerGroupRef.current;
    layer.clearLayers();
    markersMapRef.current.clear();

    const validBusinesses = businesses.filter(
      (b) =>
        typeof b?.latitude === 'number' &&
        typeof b?.longitude === 'number' &&
        !isNaN(b.latitude) &&
        !isNaN(b.longitude)
    );

    validBusinesses.forEach((b) => {
      const isSelected = selectedBusinessId === b.businessId;
      const icon = createBusinessIcon(isSelected);

      const marker = L.marker([b.latitude, b.longitude], {
        icon,
        title: b.name || 'Store',
        riseOnHover: true,
      });

      // Accessible Neo-brutalist Popup Content
      const dist = formatDistance(b.distanceKm);
      const cat = escapeHtml(b.category?.name || 'Store');
      const name = escapeHtml(b.name || 'Business');
      const addr = escapeHtml([b.area, b.city].filter(Boolean).join(', ') || b.address || '');
      const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${b.latitude},${b.longitude}`;
      const offerCount = Array.isArray(b.activeOffers) ? b.activeOffers.length : 0;
      const storeUrl = b.locationId
        ? `/businesses/${encodeURIComponent(b.businessId)}?locationId=${encodeURIComponent(b.locationId)}`
        : `/businesses/${encodeURIComponent(b.businessId)}`;

      let hoursBadgeHtml = '';
      if (b.operatingHours) {
        if (b.operatingHours.hasHoursConfigured && b.operatingHours.isOpenNow === true) {
          hoursBadgeHtml = `
            <div style="display: inline-flex; align-items: center; gap: 4px; background: #ecfdf5; color: #047857; font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 6px; margin-bottom: 6px;">
              <span style="width: 6px; height: 6px; border-radius: 50%; background: #10b981; display: inline-block;"></span>
              ${escapeHtml(b.operatingHours.statusText || 'Open now')}
            </div>`;
        } else if (b.operatingHours.hasHoursConfigured && b.operatingHours.isOpenNow === false) {
          hoursBadgeHtml = `
            <div style="display: inline-flex; align-items: center; gap: 4px; background: #fff1f2; color: #e11d48; font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 6px; margin-bottom: 6px;">
              <span style="width: 6px; height: 6px; border-radius: 50%; background: #f43f5e; display: inline-block;"></span>
              ${escapeHtml(b.operatingHours.statusText || 'Closed')}
            </div>`;
        } else {
          hoursBadgeHtml = `
            <div style="display: inline-flex; align-items: center; gap: 4px; color: #64748b; font-size: 10px; font-weight: 500; margin-bottom: 6px;">
              Hours unconfigured
            </div>`;
        }
      }

      const popupHtml = `
        <div style="font-family: inherit; min-width: 200px; padding: 2px;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px;">
            <span style="background: #f8fafc; color: #475569; font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 2px 6px; border-radius: 6px; border: 1px solid #e2e8f0;">
              ${cat}
            </span>
            ${
              dist
                ? `<span style="background: #eef2ff; color: #4f46e5; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 6px;">
                    ${dist}
                  </span>`
                : ''
            }
          </div>
          <h4 style="font-size: 14px; font-weight: 700; color: #0f172a; margin: 0 0 4px 0; line-height: 1.2;">
            <a href="${storeUrl}" style="color: inherit; text-decoration: none;">
              ${name}
            </a>
          </h4>
          ${
            addr
              ? `<p style="font-size: 11px; color: #64748b; margin: 0 0 6px 0; line-height: 1.3;">
                  ${addr}
                </p>`
              : ''
          }
          ${hoursBadgeHtml}
          ${
            offerCount > 0
              ? `<div style="display: inline-flex; align-items: center; gap: 4px; color: #4f46e5; font-size: 10px; font-weight: 700; margin-bottom: 8px;">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 5H3"/><path d="M21 12H3"/><path d="M21 19H3"/><rect x="9" y="1" width="6" height="22" rx="1"/></svg>
                  Active Offers (${offerCount})
                </div>`
              : ''
          }
          <div style="display: flex; flex-direction: column; gap: 5px; margin-top: 4px;">
            <a
              href="${storeUrl}"
              aria-label="View store details for ${name}"
              style="
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                width: 100%;
                box-sizing: border-box;
                background: #ffffff;
                color: #334155;
                font-size: 11px;
                font-weight: 600;
                text-decoration: none;
                padding: 6px 10px;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                box-shadow: 0 1px 2px rgba(0,0,0,0.05);
              "
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/></svg>
              View Store Details
            </a>
            <a
              href="${directionsUrl}"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Get directions to ${name} on Google Maps (opens in a new tab)"
              style="
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                width: 100%;
                box-sizing: border-box;
                background: #4f46e5;
                color: #ffffff;
                font-size: 11px;
                font-weight: 600;
                text-decoration: none;
                padding: 6px 10px;
                border: none;
                border-radius: 8px;
                box-shadow: 0 1px 2px rgba(0,0,0,0.05);
              "
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
              Get Directions
            </a>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml, {
        maxWidth: 240,
        className: 'nearby-leaflet-popup',
      });

      marker.on('click', () => {
        if (onSelectBusiness) {
          onSelectBusiness(b.businessId);
        }
      });

      layer.addLayer(marker);
      markersMapRef.current.set(b.businessId, marker);
    });

    // 5. Initial Map Bounds / Fit
    const map = mapInstanceRef.current;
    if (!map) return;

    if (validBusinesses.length > 0) {
      const boundsPoints = validBusinesses.map((b) => [b.latitude, b.longitude]);
      if (userLocation?.latitude && userLocation?.longitude) {
        boundsPoints.push([userLocation.latitude, userLocation.longitude]);
      }
      try {
        const bounds = L.latLngBounds(boundsPoints);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      } catch {
        // Fallback
      }
    } else if (userLocation?.latitude && userLocation?.longitude) {
      // Empty results: center on user location with radius-appropriate zoom
      let zoom = 14;
      if (radiusKm <= 0.5) zoom = 16;
      else if (radiusKm <= 1) zoom = 15;
      else if (radiusKm <= 2) zoom = 14;
      else if (radiusKm <= 5) zoom = 13;
      else zoom = 12;

      map.setView([userLocation.latitude, userLocation.longitude], zoom);
    }
  }, [businesses, userLocation, radiusKm, createBusinessIcon, onSelectBusiness, leafletLoaded]);

  // 6. Selected Business Focus Synchronization
  useEffect(() => {
    if (!selectedBusinessId || !mapInstanceRef.current || !window.L) return;
    const map = mapInstanceRef.current;
    const marker = markersMapRef.current.get(selectedBusinessId);

    // Update marker icons to show selected highlight
    markersMapRef.current.forEach((m, id) => {
      const isSelected = id === selectedBusinessId;
      const icon = createBusinessIcon(isSelected);
      if (icon) m.setIcon(icon);
    });

    if (marker) {
      const latLng = marker.getLatLng();
      map.flyTo(latLng, Math.max(map.getZoom(), 15), { duration: 0.8 });
      marker.openPopup();
    }
  }, [selectedBusinessId, createBusinessIcon]);

  // 7. Handle View Mode & Container Resize (invalidateSize avoids grey tiles)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 200);

    const handleResize = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [viewMode, leafletLoaded]);

  return (
    <div
      className={`nearby-map-wrapper relative w-full h-full border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-slate-50 ${className}`}
      role="region"
      aria-label="Nearby businesses interactive map"
    >
      {/* Scoped Z-Index overrides so Leaflet controls never cover Navbar (z-50) or BottomBar (z-40) */}
      <style jsx global>{`
        .nearby-map-wrapper .leaflet-pane {
          z-index: 10 !important;
        }
        .nearby-map-wrapper .leaflet-top,
        .nearby-map-wrapper .leaflet-bottom {
          z-index: 20 !important;
        }
        .nearby-map-wrapper .leaflet-control {
          z-index: 20 !important;
        }
        .nearby-leaflet-popup .leaflet-popup-content-wrapper {
          border: 1px solid #e2e8f0 !important;
          border-radius: 12px !important;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05) !important;
          padding: 8px !important;
        }
        .nearby-leaflet-popup .leaflet-popup-tip {
          background: #ffffff !important;
          border-right: 1px solid #e2e8f0 !important;
          border-bottom: 1px solid #e2e8f0 !important;
        }
        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }
      `}</style>

      {/* Loading state before CDN Leaflet script finishes loading */}
      {!leafletLoaded && !loadError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 z-30">
          <Loader2 className="animate-spin text-indigo-600 mb-2" size={32} />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Initializing Map...
          </span>
        </div>
      )}

      {/* CDN Load Error Fallback */}
      {loadError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-gray-50 z-30">
          <MapPin size={32} className="text-gray-400 mb-2" />
          <p className="text-sm font-bold text-gray-700 mb-1">Map display unavailable</p>
          <p className="text-xs text-gray-500 max-w-xs">{loadError}</p>
        </div>
      )}

      {/* Leaflet Mount Container */}
      <div ref={mapContainerRef} className="w-full h-full min-h-[350px]" tabIndex={0} />
    </div>
  );
}
