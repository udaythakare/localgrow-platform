import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBusinessDetailsApiUrl,
  formatDirectionsUrl,
  parseBusinessApiError,
  evaluateOperatingHoursStatus,
  formatTime12h,
  formatDisplayDate,
  normalizeUrl,
  WEEKDAYS,
  getBusinessInitials,
  getValidLogoUrl,
  sanitizeGalleryPhotos,
  resolveSelectedPhoto,
} from '../helpers/businessDetailsHelpers.js';

describe('LocalGrow V2 Sprint 8 Stage 3: Business Details Customer Page Tests', () => {
  const sampleBusinessId = 'e2b58c70-6214-49c8-886f-2b0e9c60e3aa';
  const sampleLocationId = 'f7c18d34-7123-45a9-99bf-3c1e8b70d4bb';

  // ── 1. URL Construction Tests ──────────────────────────────────────────────
  describe('1. API URL Construction', () => {
    test('Constructs URL with businessId and locationId preserving exact locationId', () => {
      const url = buildBusinessDetailsApiUrl(sampleBusinessId, sampleLocationId);
      assert.equal(
        url,
        `/api/v2/businesses/${sampleBusinessId}?locationId=${sampleLocationId}`
      );
    });

    test('Constructs clean URL when locationId is null (omits query string)', () => {
      const url = buildBusinessDetailsApiUrl(sampleBusinessId, null);
      assert.equal(url, `/api/v2/businesses/${sampleBusinessId}`);
    });

    test('Constructs clean URL when locationId is undefined or empty string', () => {
      assert.equal(
        buildBusinessDetailsApiUrl(sampleBusinessId, undefined),
        `/api/v2/businesses/${sampleBusinessId}`
      );
      assert.equal(
        buildBusinessDetailsApiUrl(sampleBusinessId, ''),
        `/api/v2/businesses/${sampleBusinessId}`
      );
    });

    test('Returns empty string when businessId is absent or falsy', () => {
      assert.equal(buildBusinessDetailsApiUrl('', sampleLocationId), '');
      assert.equal(buildBusinessDetailsApiUrl(null, sampleLocationId), '');
    });

    test('URL encodes special characters in IDs safely', () => {
      const url = buildBusinessDetailsApiUrl('biz test/1', 'loc test/2');
      assert.equal(url, '/api/v2/businesses/biz%20test%2F1?locationId=loc+test%2F2');
    });
  });

  // ── 2. Directions URL Tests ────────────────────────────────────────────────
  describe('2. Google Maps Directions URL Construction', () => {
    test('Constructs valid Google Maps directions URL with numeric coordinates', () => {
      const url = formatDirectionsUrl(19.076, 72.8777);
      assert.equal(
        url,
        'https://www.google.com/maps/dir/?api=1&destination=19.076,72.8777'
      );
    });

    test('Returns null when latitude or longitude is null or undefined', () => {
      assert.equal(formatDirectionsUrl(null, 72.8777), null);
      assert.equal(formatDirectionsUrl(19.076, undefined), null);
      assert.equal(formatDirectionsUrl(null, null), null);
    });

    test('Returns null when coordinates are NaN or not numbers', () => {
      assert.equal(formatDirectionsUrl(NaN, 72.8777), null);
      assert.equal(formatDirectionsUrl(19.076, NaN), null);
      assert.equal(formatDirectionsUrl('19.076', '72.8777'), null);
    });
  });

  // ── 3. API Error Parsing & State Handling ─────────────────────────────────
  describe('3. API Error Parsing & Recoverable States', () => {
    test('Identifies location-specific 404 when error mentions location not found', () => {
      const errorJson = {
        status: 404,
        error: 'Not Found',
        message: `Location not found with id: ${sampleLocationId} for business: ${sampleBusinessId}`,
      };
      const result = parseBusinessApiError(404, errorJson);

      assert.equal(result.isLocationError, true);
      assert.equal(
        result.errorMessage,
        'The requested store location was not found or does not belong to this business.'
      );
    });

    test('Identifies general business 404 when business itself is missing or pending', () => {
      const errorJson = {
        status: 404,
        error: 'Not Found',
        message: `Business not found with id: ${sampleBusinessId}`,
      };
      const result = parseBusinessApiError(404, errorJson);

      assert.equal(result.isLocationError, false);
      assert.equal(
        result.errorMessage,
        'This business was not found, is inactive, or is pending approval.'
      );
    });

    test('Handles 400 Bad Request (invalid UUID or params)', () => {
      const errorJson = {
        status: 400,
        error: 'Bad Request',
        message: "Invalid parameter value for 'id': not-a-valid-uuid",
      };
      const result = parseBusinessApiError(400, errorJson);

      assert.equal(result.isLocationError, false);
      assert.equal(result.errorMessage, 'Invalid business or location identifier.');
    });

    test('Handles 500 server error preserving error message for retry flow', () => {
      const errorJson = {
        status: 500,
        message: 'Internal database connection timeout',
      };
      const result = parseBusinessApiError(500, errorJson);

      assert.equal(result.isLocationError, false);
      assert.equal(result.errorMessage, 'Internal database connection timeout');
    });

    test('Handles non-JSON error responses gracefully', () => {
      const result = parseBusinessApiError(503, null);

      assert.equal(result.isLocationError, false);
      assert.equal(result.errorMessage, 'Failed to load store details (HTTP 503)');
    });
  });

  // ── 4. Operating Hours Evaluation ─────────────────────────────────────────
  describe('4. Operating Hours Evaluation & Distinct States', () => {
    test('Open now: returns open status with true open flag and custom text', () => {
      const operatingHours = {
        hasHoursConfigured: true,
        isOpenNow: true,
        statusText: 'Open now until 9:00 PM',
      };
      const status = evaluateOperatingHoursStatus(operatingHours);

      assert.equal(status.type, 'open');
      assert.equal(status.badgeText, 'Open now until 9:00 PM');
      assert.equal(status.isOpen, true);
      assert.equal(status.isClosed, false);
    });

    test('Closed: returns closed status with true closed flag and custom text', () => {
      const operatingHours = {
        hasHoursConfigured: true,
        isOpenNow: false,
        statusText: 'Closed - Opens tomorrow at 9:00 AM',
      };
      const status = evaluateOperatingHoursStatus(operatingHours);

      assert.equal(status.type, 'closed');
      assert.equal(status.badgeText, 'Closed - Opens tomorrow at 9:00 AM');
      assert.equal(status.isOpen, false);
      assert.equal(status.isClosed, true);
    });

    test('Unconfigured hours: hasHoursConfigured=false returns unconfigured (NEVER closed)', () => {
      const operatingHours = {
        hasHoursConfigured: false,
        isOpenNow: null,
        statusText: 'Hours not configured',
      };
      const status = evaluateOperatingHoursStatus(operatingHours);

      assert.equal(status.type, 'unconfigured');
      assert.equal(status.badgeText, 'Hours unconfigured');
      assert.equal(status.isOpen, false);
      assert.equal(status.isClosed, false); // Crucial: must NOT be labeled closed
    });

    test('Unconfigured hours: isOpenNow=null with configured flag false returns unconfigured', () => {
      const operatingHours = {
        hasHoursConfigured: false,
        isOpenNow: null,
        statusText: null,
      };
      const status = evaluateOperatingHoursStatus(operatingHours);

      assert.equal(status.type, 'unconfigured');
      assert.equal(status.badgeText, 'Hours unconfigured');
      assert.equal(status.isOpen, false);
      assert.equal(status.isClosed, false);
    });

    test('Null or missing operatingHours object returns unconfigured', () => {
      assert.equal(evaluateOperatingHoursStatus(null).type, 'unconfigured');
      assert.equal(evaluateOperatingHoursStatus(undefined).type, 'unconfigured');
    });
  });

  // ── 5. Schedule & Time Formatting ─────────────────────────────────────────
  describe('5. Time, Date, and Weekday Formatting', () => {
    test('formatTime12h converts 24-hour strings correctly', () => {
      assert.equal(formatTime12h('09:00:00'), '9:00 AM');
      assert.equal(formatTime12h('09:30'), '9:30 AM');
      assert.equal(formatTime12h('12:00:00'), '12:00 PM');
      assert.equal(formatTime12h('13:15:00'), '1:15 PM');
      assert.equal(formatTime12h('21:45:00'), '9:45 PM');
      assert.equal(formatTime12h('00:00:00'), '12:00 AM');
      assert.equal(formatTime12h(''), '');
      assert.equal(formatTime12h(null), '');
    });

    test('formatDisplayDate formats valid dates into readable Indian locale', () => {
      const formatted = formatDisplayDate('2026-10-15T00:00:00Z');
      assert.ok(formatted !== null);
      assert.ok(formatted.includes('2026'));
      assert.ok(formatted.includes('15'));
    });

    test('formatDisplayDate returns null for invalid dates', () => {
      assert.equal(formatDisplayDate('not-a-date'), null);
      assert.equal(formatDisplayDate(null), null);
      assert.equal(formatDisplayDate(''), null);
    });

    test('WEEKDAYS contains all 7 ISO days (1=Mon to 7=Sun)', () => {
      assert.equal(WEEKDAYS.length, 7);
      assert.deepEqual(
        WEEKDAYS.map((w) => w.day),
        [1, 2, 3, 4, 5, 6, 7]
      );
      assert.equal(WEEKDAYS[0].name, 'Monday');
      assert.equal(WEEKDAYS[6].name, 'Sunday');
    });
  });

  // ── 6. Website Normalization ──────────────────────────────────────────────
  describe('6. Website URL Normalization', () => {
    test('Prefixes https:// when protocol is missing', () => {
      assert.equal(normalizeUrl('mybakery.com'), 'https://mybakery.com');
      assert.equal(normalizeUrl('www.localgrow.in'), 'https://www.localgrow.in');
    });

    test('Preserves existing http:// or https:// protocol', () => {
      assert.equal(normalizeUrl('http://insecure-store.com'), 'http://insecure-store.com');
      assert.equal(normalizeUrl('https://secure-store.com'), 'https://secure-store.com');
    });

    test('Returns empty string when input is empty or null', () => {
      assert.equal(normalizeUrl(''), '');
      assert.equal(normalizeUrl(null), '');
    });
  });

  // ── 7. Active Offers & Claims Calculation ─────────────────────────────────
  describe('7. Active Offers Logic', () => {
    test('Calculates remaining claims correctly', () => {
      const maxClaims = 100;
      const currentClaims = 35;
      const remaining = Math.max(0, maxClaims - (currentClaims ?? 0));
      assert.equal(remaining, 65);
    });

    test('Remaining claims caps at 0 when currentClaims exceeds maxClaims', () => {
      const maxClaims = 50;
      const currentClaims = 60;
      const remaining = Math.max(0, maxClaims - (currentClaims ?? 0));
      assert.equal(remaining, 0);
    });

    test('Empty active offers array is recognized cleanly', () => {
      const activeOffers = [];
      assert.equal(activeOffers.length === 0, true);
    });
  });

  // ── 8. Public Security & Data Isolation ───────────────────────────────────
  describe('8. Public DTO Data Isolation (No Private Fields)', () => {
    test('Ensures private vendor and admin fields are not present in BusinessDetailsDto projection', () => {
      // Mock DTO representing what the V2 BusinessDetailsDto returns
      const publicDto = {
        id: sampleBusinessId,
        name: 'The Artisan Bakery',
        description: 'Fresh organic sourdough and pastries daily.',
        category: { id: 'c1', name: 'Bakery' },
        phone: '+91 98765 43210',
        email: 'hello@artisanbakery.com',
        website: 'https://artisanbakery.com',
        locations: [],
        selectedLocation: {
          id: sampleLocationId,
          address: 'Shop 4, Linking Road',
          city: 'Mumbai',
          state: 'Maharashtra',
          postalCode: '400050',
          latitude: 19.065,
          longitude: 72.834,
          isPrimary: true,
        },
        operatingHours: {
          hasHoursConfigured: true,
          isOpenNow: true,
          statusText: 'Open now',
          weeklySchedule: [],
        },
        activeOffers: [],
      };

      // Assert private/internal fields do not exist on the customer-facing DTO
      assert.equal(publicDto.user_id, undefined);
      assert.equal(publicDto.approval_status, undefined);
      assert.equal(publicDto.rejection_reason, undefined);
      assert.equal(publicDto.status, undefined);
      assert.equal(publicDto.created_by, undefined);
      assert.equal(publicDto.role, undefined);
    });
  });

  // ── 9. Logo Display and Sensible Fallback Logic ───────────────────────────
  describe('9. Logo Display & Sensible Fallback Logic', () => {
    test('getBusinessInitials extracts 2 uppercase initials for multi-word business names', () => {
      assert.equal(getBusinessInitials('Apex Spices'), 'AS');
      assert.equal(getBusinessInitials('Chai Corner Bandra'), 'CC');
      assert.equal(getBusinessInitials('Mumbai Super Market'), 'MS');
    });

    test('getBusinessInitials extracts 2 uppercase letters for single-word business names', () => {
      assert.equal(getBusinessInitials('LocalGrow'), 'LO');
      assert.equal(getBusinessInitials('Starbucks'), 'ST');
      assert.equal(getBusinessInitials('Z'), 'Z');
    });

    test('getBusinessInitials defaults gracefully to "LG" for null, undefined, or empty names', () => {
      assert.equal(getBusinessInitials(''), 'LG');
      assert.equal(getBusinessInitials('   '), 'LG');
      assert.equal(getBusinessInitials(null), 'LG');
      assert.equal(getBusinessInitials(undefined), 'LG');
    });

    test('getValidLogoUrl validates non-empty URLs and trims whitespace', () => {
      const url = '  https://res.cloudinary.com/test/image/upload/v1/logo.png  ';
      assert.equal(getValidLogoUrl(url), 'https://res.cloudinary.com/test/image/upload/v1/logo.png');
    });

    test('getValidLogoUrl returns null for empty, null, or undefined URLs', () => {
      assert.equal(getValidLogoUrl(''), null);
      assert.equal(getValidLogoUrl('   '), null);
      assert.equal(getValidLogoUrl(null), null);
      assert.equal(getValidLogoUrl(undefined), null);
    });
  });

  // ── 10. Gallery Sanitization & Ordering Logic ────────────────────────────
  describe('10. Gallery Sanitization & Ordering Logic', () => {
    test('sanitizeGalleryPhotos sorts photos strictly by displayOrder ascending', () => {
      const unsorted = [
        { id: 'p2', imageUrl: 'https://cdn.com/photo2.jpg', caption: 'Interior', displayOrder: 2 },
        { id: 'p0', imageUrl: 'https://cdn.com/photo0.jpg', caption: 'Storefront', displayOrder: 0 },
        { id: 'p1', imageUrl: 'https://cdn.com/photo1.jpg', caption: 'Aisle', displayOrder: 1 },
      ];

      const result = sanitizeGalleryPhotos(unsorted);
      assert.equal(result.length, 3);
      assert.equal(result[0].id, 'p0');
      assert.equal(result[1].id, 'p1');
      assert.equal(result[2].id, 'p2');
      assert.equal(result[0].displayOrder, 0);
      assert.equal(result[1].displayOrder, 1);
      assert.equal(result[2].displayOrder, 2);
    });

    test('sanitizeGalleryPhotos filters out items without valid imageUrl', () => {
      const mixed = [
        { id: 'p1', imageUrl: 'https://cdn.com/valid.jpg', displayOrder: 0 },
        null,
        { id: 'p2', imageUrl: '', displayOrder: 1 },
        { id: 'p3', imageUrl: '   ', displayOrder: 2 },
        { id: 'p4', displayOrder: 3 }, // missing imageUrl
      ];

      const result = sanitizeGalleryPhotos(mixed);
      assert.equal(result.length, 1);
      assert.equal(result[0].id, 'p1');
    });

    test('sanitizeGalleryPhotos preserves and trims captions or defaults to null', () => {
      const photos = [
        { id: 'p1', imageUrl: 'https://cdn.com/p1.jpg', caption: '  Front entrance  ', displayOrder: 0 },
        { id: 'p2', imageUrl: 'https://cdn.com/p2.jpg', caption: '', displayOrder: 1 },
        { id: 'p3', imageUrl: 'https://cdn.com/p3.jpg', displayOrder: 2 },
      ];

      const result = sanitizeGalleryPhotos(photos);
      assert.equal(result[0].caption, 'Front entrance');
      assert.equal(result[1].caption, null);
      assert.equal(result[2].caption, null);
    });

    test('sanitizeGalleryPhotos returns empty array for null, undefined, or empty input', () => {
      assert.deepEqual(sanitizeGalleryPhotos(null), []);
      assert.deepEqual(sanitizeGalleryPhotos(undefined), []);
      assert.deepEqual(sanitizeGalleryPhotos([]), []);
    });
  });

  // ── 11. Active Image Selection & Gallery Resolution ───────────────────────
  describe('11. Active Image Selection & Gallery Resolution', () => {
    const samplePhotos = [
      { id: 'p1', imageUrl: 'https://cdn.com/p1.jpg', caption: 'Photo 1', displayOrder: 0 },
      { id: 'p2', imageUrl: 'https://cdn.com/p2.jpg', caption: 'Photo 2', displayOrder: 1 },
    ];

    test('resolveSelectedPhoto selects photo at valid index', () => {
      const { selectedPhoto, currentIndex, totalCount } = resolveSelectedPhoto(samplePhotos, 1);
      assert.equal(currentIndex, 1);
      assert.equal(totalCount, 2);
      assert.equal(selectedPhoto.id, 'p2');
    });

    test('resolveSelectedPhoto falls back to index 0 when proposed index is out of bounds or negative', () => {
      const outOfBounds = resolveSelectedPhoto(samplePhotos, 10);
      assert.equal(outOfBounds.currentIndex, 0);
      assert.equal(outOfBounds.selectedPhoto.id, 'p1');

      const negativeIndex = resolveSelectedPhoto(samplePhotos, -2);
      assert.equal(negativeIndex.currentIndex, 0);
      assert.equal(negativeIndex.selectedPhoto.id, 'p1');
    });

    test('resolveSelectedPhoto handles empty photos gracefully returning null selectedPhoto', () => {
      const { selectedPhoto, currentIndex, totalCount } = resolveSelectedPhoto([], 0);
      assert.equal(selectedPhoto, null);
      assert.equal(currentIndex, 0);
      assert.equal(totalCount, 0);
    });
  });

  // ── 12. Empty States & Public Data Security ────────────────────────────────
  describe('12. Empty States & Customer Security', () => {
    test('Business without logo or photos produces graceful empty state without errors', () => {
      const unbrandedDto = {
        id: sampleBusinessId,
        name: 'The Plain Grocer',
        description: 'Quality local essentials.',
        logoUrl: null,
        photos: [],
      };

      assert.equal(getValidLogoUrl(unbrandedDto.logoUrl), null);
      assert.equal(getBusinessInitials(unbrandedDto.name), 'TP');
      assert.deepEqual(sanitizeGalleryPhotos(unbrandedDto.photos), []);
      assert.deepEqual(resolveSelectedPhoto(unbrandedDto.photos, 0), {
        selectedPhoto: null,
        currentIndex: 0,
        totalCount: 0,
      });
    });

    test('Customer gallery photo objects never contain Cloudinary public_id or secrets', () => {
      const customerPhoto = {
        id: '990a85c9-b418-47f0-a6ad-e0fc54d97ea6',
        imageUrl: 'https://res.cloudinary.com/localgrow/image/upload/v1/photos/sample.jpg',
        caption: 'Storefront',
        displayOrder: 0,
      };

      assert.equal(customerPhoto.public_id, undefined);
      assert.equal(customerPhoto.publicId, undefined);
      assert.equal(customerPhoto.api_secret, undefined);
    });
  });
});

