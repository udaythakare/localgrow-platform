/**
 * Helper functions and constants for Business Details customer experience.
 */

/**
 * Maps ISO weekday integer (1 = Monday .. 7 = Sunday) to human-readable names.
 */
export const WEEKDAYS = [
  { day: 1, name: 'Monday', shortName: 'Mon' },
  { day: 2, name: 'Tuesday', shortName: 'Tue' },
  { day: 3, name: 'Wednesday', shortName: 'Wed' },
  { day: 4, name: 'Thursday', shortName: 'Thu' },
  { day: 5, name: 'Friday', shortName: 'Fri' },
  { day: 6, name: 'Saturday', shortName: 'Sat' },
  { day: 7, name: 'Sunday', shortName: 'Sun' },
];

/**
 * Formats time string (HH:mm:ss or HH:mm) into 12-hour format with AM/PM.
 */
export function formatTime12h(timeStr) {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  let hour = parseInt(parts[0], 10);
  const minute = parts[1];
  if (isNaN(hour)) return timeStr;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  hour = hour ? hour : 12; // 0 becomes 12
  return `${hour}:${minute} ${ampm}`;
}

/**
 * Formats date into Indian locale display (e.g. "15 Oct, 2026").
 */
export function formatDisplayDate(dateStr) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return null;
  }
}

/**
 * Normalizes website URL by ensuring http/https protocol is present.
 */
export function normalizeUrl(url) {
  if (!url) return '';
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

/**
 * Constructs the V2 business details API URL preserving businessId and locationId.
 */
export function buildBusinessDetailsApiUrl(businessId, locationId) {
  if (!businessId) return '';
  const queryParams = new URLSearchParams();
  if (locationId) {
    queryParams.set('locationId', locationId);
  }
  const queryStr = queryParams.toString() ? `?${queryParams.toString()}` : '';
  return `/api/v2/businesses/${encodeURIComponent(businessId)}${queryStr}`;
}

/**
 * Constructs Google Maps directions URL from latitude and longitude.
 */
export function formatDirectionsUrl(latitude, longitude) {
  const hasCoordinates =
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    !isNaN(latitude) &&
    !isNaN(longitude);

  return hasCoordinates
    ? `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`
    : null;
}

/**
 * Parses API error responses into user-friendly messages and location-error flag.
 */
export function parseBusinessApiError(status, errorJson) {
  let isLocErr = false;
  let message = errorJson?.message || `Failed to load store details (HTTP ${status})`;

  if (errorJson?.message) {
    const lower = errorJson.message.toLowerCase();
    if (lower.includes('location') && lower.includes('not found')) {
      isLocErr = true;
    }
  }

  let userFriendlyError = message;
  if (status === 404) {
    userFriendlyError = isLocErr
      ? 'The requested store location was not found or does not belong to this business.'
      : 'This business was not found, is inactive, or is pending approval.';
  } else if (status === 400) {
    userFriendlyError = 'Invalid business or location identifier.';
  }

  return {
    isLocationError: isLocErr,
    errorMessage: userFriendlyError,
    rawMessage: message,
  };
}

/**
 * Evaluates operating hours status into normalized type and badge text.
 */
export function evaluateOperatingHoursStatus(operatingHours) {
  if (!operatingHours || !operatingHours.hasHoursConfigured || operatingHours.isOpenNow == null) {
    return {
      type: 'unconfigured',
      badgeText: 'Hours unconfigured',
      isOpen: false,
      isClosed: false,
    };
  }
  if (operatingHours.isOpenNow === true) {
    return {
      type: 'open',
      badgeText: operatingHours.statusText || 'Open now',
      isOpen: true,
      isClosed: false,
    };
  }
  return {
    type: 'closed',
    badgeText: operatingHours.statusText || 'Closed',
    isOpen: false,
    isClosed: true,
  };
}

/**
 * Extracts 1-2 letter initials from a business name for logo fallback avatar.
 *
 * @param {string|null|undefined} name - Business name
 * @returns {string} Initials (e.g. "Apex Spices" -> "AS", "LocalGrow" -> "LO")
 */
export function getBusinessInitials(name) {
  if (!name || typeof name !== 'string') return 'LG';
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'LG';
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * Validates and normalizes business logo URL.
 *
 * @param {string|null|undefined} logoUrl
 * @returns {string|null}
 */
export function getValidLogoUrl(logoUrl) {
  if (!logoUrl || typeof logoUrl !== 'string') return null;
  const trimmed = logoUrl.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Sanitizes and sorts gallery photos by display order.
 *
 * @param {Array|null|undefined} photos - Photos array from BusinessDetailsDto
 * @returns {Array<{id: string, imageUrl: string, caption: string|null, displayOrder: number}>}
 */
export function sanitizeGalleryPhotos(photos) {
  if (!Array.isArray(photos)) return [];
  return photos
    .filter((p) => p && typeof p.imageUrl === 'string' && p.imageUrl.trim().length > 0)
    .map((p, idx) => ({
      id: p.id || `photo-${idx}`,
      imageUrl: p.imageUrl.trim(),
      caption: p.caption ? String(p.caption).trim() : null,
      displayOrder: typeof p.displayOrder === 'number' ? p.displayOrder : idx,
    }))
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

/**
 * Safely resolves the currently selected photo and its index.
 *
 * @param {Array} photos - Photos array
 * @param {number} selectedIndex - Requested photo index
 * @returns {{selectedPhoto: Object|null, currentIndex: number, totalCount: number}}
 */
export function resolveSelectedPhoto(photos, selectedIndex = 0) {
  const sanitized = sanitizeGalleryPhotos(photos);
  if (sanitized.length === 0) {
    return { selectedPhoto: null, currentIndex: 0, totalCount: 0 };
  }
  const safeIndex =
    typeof selectedIndex === 'number' && selectedIndex >= 0 && selectedIndex < sanitized.length
      ? selectedIndex
      : 0;
  return {
    selectedPhoto: sanitized[safeIndex],
    currentIndex: safeIndex,
    totalCount: sanitized.length,
  };
}

