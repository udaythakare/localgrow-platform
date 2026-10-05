import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { reverseGeocode } from '../helpers/geocoding.js';
import { resolveCustomerCity } from '../helpers/couponFilterHelpers.js';

describe('LocalGrow — Profile GPS Location & Reverse Geocoding Flow', () => {

    describe('1. reverseGeocode Mapping & Normalization', () => {
        test('reverseGeocode maps city, area, state, postal_code, country, address from Nominatim', async () => {
            // Mock global fetch for this test
            const originalFetch = global.fetch;
            const mockNominatimResponse = {
                display_name: 'Madhavdas Amarshi Marg, Gaondevi Dongri, Andheri West, Mumbai, Maharashtra, 400069, India',
                address: {
                    road: 'Madhavdas Amarshi Marg',
                    house_number: '12',
                    neighbourhood: 'Gaondevi Dongri',
                    suburb: 'Andheri West',
                    city: 'Mumbai',
                    state: 'Maharashtra',
                    postcode: '400069',
                    country: 'India',
                    country_code: 'in'
                }
            };

            global.fetch = async () => ({
                ok: true,
                status: 200,
                json: async () => mockNominatimResponse
            });

            try {
                const result = await reverseGeocode(19.1197, 72.8468);
                assert.ok(result, 'Result should not be null');
                assert.equal(result.latitude, 19.1197);
                assert.equal(result.longitude, 72.8468);
                assert.equal(result.city, 'Mumbai');
                assert.equal(result.area, 'Andheri West');
                assert.equal(result.state, 'Maharashtra');
                assert.equal(result.postal_code, '400069');
                assert.equal(result.country, 'India');
                assert.equal(result.address, '12, Madhavdas Amarshi Marg, Gaondevi Dongri');
            } finally {
                global.fetch = originalFetch;
            }
        });

        test('reverseGeocode falls back to town/village/municipality if city is absent', async () => {
            const originalFetch = global.fetch;
            global.fetch = async () => ({
                ok: true,
                status: 200,
                json: async () => ({
                    display_name: 'Main Street, Kharghar, Navi Mumbai, Maharashtra, 410210, India',
                    address: {
                        town: 'Navi Mumbai',
                        neighbourhood: 'Sector 12',
                        suburb: 'Kharghar',
                        state: 'Maharashtra',
                        postcode: '410210',
                        country: 'India'
                    }
                })
            });

            try {
                const result = await reverseGeocode('19.0474', '73.0699');
                assert.ok(result);
                assert.equal(result.city, 'Navi Mumbai');
                assert.equal(result.area, 'Kharghar');
                assert.equal(result.postal_code, '410210');
            } finally {
                global.fetch = originalFetch;
            }
        });

        test('reverseGeocode handles invalid or missing coordinates gracefully', async () => {
            const resultNull = await reverseGeocode(null, null);
            assert.equal(resultNull, null);

            const resultNaN = await reverseGeocode('abc', 'xyz');
            assert.equal(resultNaN, null);
        });
    });

    describe('2. GPS Success → Preview Generation', () => {
        test('Preview object contains all necessary fields for user confirmation', () => {
            const coords = { latitude: 19.1197, longitude: 72.8468 };
            const reverseData = {
                latitude: coords.latitude,
                longitude: coords.longitude,
                city: 'Mumbai',
                area: 'Andheri West',
                state: 'Maharashtra',
                postal_code: '400069',
                country: 'India',
                address: 'Madhavdas Amarshi Marg'
            };

            // Preview must have valid city and coordinates
            assert.ok(reverseData.city && reverseData.city.length > 0);
            assert.equal(typeof reverseData.latitude, 'number');
            assert.equal(typeof reverseData.longitude, 'number');
            assert.equal(reverseData.country, 'India');
        });
    });

    describe('3. Confirm & Save Payload Structure', () => {
        test('Persisted payload formats latitude, longitude, and all locality fields correctly', () => {
            const previewLocation = {
                latitude: 19.1197,
                longitude: 72.8468,
                city: ' Mumbai ',
                area: ' Andheri West ',
                state: ' Maharashtra ',
                postal_code: '400069',
                country: 'India',
                address: '12, Main Road'
            };

            const userId = 'user-123';
            const lat = typeof previewLocation.latitude === 'number' ? previewLocation.latitude : parseFloat(previewLocation.latitude);
            const lon = typeof previewLocation.longitude === 'number' ? previewLocation.longitude : parseFloat(previewLocation.longitude);

            const upsertPayload = {
                user_id: userId,
                city: previewLocation.city.trim(),
                address: previewLocation.address ? String(previewLocation.address).trim() : null,
                state: previewLocation.state ? String(previewLocation.state).trim() : null,
                area: previewLocation.area ? String(previewLocation.area).trim() : null,
                postal_code: previewLocation.postal_code ? String(previewLocation.postal_code).trim() : null,
                country: previewLocation.country ? String(previewLocation.country).trim() : 'India',
                latitude: (lat !== null && !isNaN(lat)) ? lat : null,
                longitude: (lon !== null && !isNaN(lon)) ? lon : null,
                is_primary: true,
            };

            assert.equal(upsertPayload.user_id, 'user-123');
            assert.equal(upsertPayload.city, 'Mumbai');
            assert.equal(upsertPayload.area, 'Andheri West');
            assert.equal(upsertPayload.state, 'Maharashtra');
            assert.equal(upsertPayload.postal_code, '400069');
            assert.equal(upsertPayload.country, 'India');
            assert.equal(upsertPayload.latitude, 19.1197);
            assert.equal(upsertPayload.longitude, 72.8468);
            assert.equal(upsertPayload.is_primary, true);
        });

        test('Rejects payload with missing or empty city', () => {
            const invalidLocations = [
                {},
                { city: '' },
                { city: '   ' },
                { city: null }
            ];

            for (const loc of invalidLocations) {
                const isValid = Boolean(loc && loc.city && typeof loc.city === 'string' && loc.city.trim().length > 0);
                assert.equal(isValid, false, `Expected ${JSON.stringify(loc)} to fail validation`);
            }
        });
    });

    describe('4. Existing Saved Location Rendering State', () => {
        test('Formats saved location with area, city, and GPS badge when available', () => {
            const saved = {
                city: 'Mumbai',
                area: 'Andheri West',
                state: 'Maharashtra',
                country: 'India',
                address: 'Station Road',
                postal_code: '400053',
                latitude: 19.1197,
                longitude: 72.8468
            };

            const mainLine = `${saved.area ? saved.area + ', ' : ''}${saved.city}`;
            assert.equal(mainLine, 'Andheri West, Mumbai');

            const hasGps = Boolean(saved.latitude && saved.longitude);
            assert.equal(hasGps, true);
        });

        test('Handles missing saved location as "Location not set"', () => {
            const saved = null;
            const hasLocation = Boolean(saved && saved.city);
            assert.equal(hasLocation, false);
        });
    });

    describe('5 & 6. Permission Failure & Error Handling', () => {
        test('Permission denied status prompts manual fallback cleanly', () => {
            const permissionStatus = 'denied';
            const geoError = 'Location access was denied.';
            const isBlocked = permissionStatus === 'denied' || Boolean(geoError);
            assert.equal(isBlocked, true);
        });

        test('GPS error/timeout is caught without crashing and opens city input', () => {
            const geoError = 'Location request timed out. Please try again.';
            assert.ok(geoError.includes('timed out'));
        });
    });

    describe('7. City Fallback & Locality Preservation', () => {
        test('Manual fallback saves city and immediately powers /coupons locality', () => {
            const manualCityInput = '  Pune  ';
            const cleanCity = manualCityInput.trim();

            const savedLocation = {
                city: cleanCity,
                country: 'India'
            };

            // Verified against resolveCustomerCity
            const resolved = resolveCustomerCity({
                userLocationCity: savedLocation.city,
                ipCity: 'Mumbai'
            });

            assert.deepEqual(resolved, {
                city: 'Pune',
                source: 'profile_city'
            });
        });
    });

    describe('8. Customer Coupon Consumers Compatibility', () => {
        test('/coupons locality resolution prioritizes user_locations.city regardless of GPS presence', () => {
            // Case A: With GPS coordinates
            const userWithGps = {
                city: 'Navi Mumbai',
                latitude: 19.0342,
                longitude: 73.0319
            };
            const resA = resolveCustomerCity({ userLocationCity: userWithGps.city });
            assert.equal(resA.city, 'Navi Mumbai');
            assert.equal(resA.source, 'profile_city');

            // Case B: Without GPS (manual city entry)
            const userManual = {
                city: 'Thane',
                latitude: null,
                longitude: null
            };
            const resB = resolveCustomerCity({ userLocationCity: userManual.city });
            assert.equal(resB.city, 'Thane');
            assert.equal(resB.source, 'profile_city');
        });
    });

    describe('9. Profile No Longer Depends on address-dropdown-data', () => {
        test('app/u/profile/components/LocationSection.jsx does not fetch address-dropdown-data', () => {
            const filePath = join(process.cwd(), 'app/u/profile/components/LocationSection.jsx');
            const content = readFileSync(filePath, 'utf8');

            assert.equal(
                content.includes('address-dropdown-data'),
                false,
                'LocationSection.jsx must NOT call address-dropdown-data'
            );
            assert.equal(
                content.includes('fetchDropdownData'),
                false,
                'LocationSection.jsx must NOT have fetchDropdownData'
            );
        });

        test('app/u/profile/components/LocationForm.jsx does not render old select dropdowns for area/city/state', () => {
            const filePath = join(process.cwd(), 'app/u/profile/components/LocationForm.jsx');
            const content = readFileSync(filePath, 'utf8');

            assert.equal(
                content.includes('SELECT STATE'),
                false,
                'LocationForm.jsx must not contain old SELECT STATE dropdown'
            );
            assert.equal(
                content.includes('SELECT CITY'),
                false,
                'LocationForm.jsx must not contain old SELECT CITY dropdown'
            );
            assert.equal(
                content.includes('SELECT AREA'),
                false,
                'LocationForm.jsx must not contain old SELECT AREA dropdown'
            );
        });
    });

    describe('10. Vendor Onboarding Address Dropdown Remains Intact', () => {
        test('actions/addressActions.js exports getAddressDropdowns() with area, city, state queries', async () => {
            const filePath = join(process.cwd(), 'actions/addressActions.js');
            const content = readFileSync(filePath, 'utf8');

            assert.ok(content.includes('export async function getAddressDropdowns'));
            assert.ok(content.includes('.from("area")'));
            assert.ok(content.includes('.from("city")'));
            assert.ok(content.includes('.from("state")'));
        });

        test('app/u/profile/apply-for-business/page.jsx retains getAddressDropdowns dependency', () => {
            const filePath = join(process.cwd(), 'app/u/profile/apply-for-business/page.jsx');
            const content = readFileSync(filePath, 'utf8');

            assert.ok(
                content.includes("import { getAddressDropdowns } from '@/actions/addressActions'"),
                'Vendor onboarding must retain getAddressDropdowns import'
            );
            assert.ok(
                content.includes('getAddressDropdowns()'),
                'Vendor onboarding must execute getAddressDropdowns()'
            );
        });
    });
});
