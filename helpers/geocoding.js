export async function geocodeAddress(address, city, state, postalCode, country) {
    // Check if we have the essential components
    if (!address && !city) {
        console.error('Missing required address components');
        return null;
    }

    // Build address with only available components
    let addressParts = [];
    if (city) addressParts.push(city);
    if (state) addressParts.push(state);
    if (postalCode) addressParts.push(postalCode);
    if (country) addressParts.push(country);
    const formattedAddress = addressParts.join(', ');

    try {
        const headers = {};
        if (typeof window === 'undefined') {
            headers['User-Agent'] = 'LocalGrow/1.0 (contact@localgrow.com)';
        }

        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(formattedAddress)}&format=json&addressdetails=1&limit=1`,
            { headers }
        );

        if (!response.ok) {
            throw new Error(`API responded with status: ${response.status}`);
        }

        const data = await response.json();

        if (data && data.length > 0) {
            const result = data[0];
            return {
                latitude: parseFloat(result.lat),
                longitude: parseFloat(result.lon),
                displayName: result.display_name,
                placeId: result.place_id,
                osmType: result.osm_type,
                osmId: result.osm_id,
                type: result.type,
                class: result.class,
                importance: result.importance,
                addressDetails: result.address,
                boundingBox: result.boundingbox,
                license: result.licence
            };
        } else {
            console.warn('No geocoding results found for address:', formattedAddress);
            return null;
        }
    } catch (error) {
        console.error('Geocoding error:', error);
        return null;
    }
}

/**
 * Reverse geocodes coordinates (latitude, longitude) using OpenStreetMap Nominatim.
 * Maps result to the LocalGrow location schema: city, area, state, postal_code, country, address.
 *
 * @param {number|string} latitude
 * @param {number|string} longitude
 * @returns {Promise<{ latitude: number, longitude: number, city: string, area: string, state: string, postal_code: string, country: string, address: string, displayName: string }|null>}
 */
export async function reverseGeocode(latitude, longitude) {
    if (latitude === undefined || latitude === null || longitude === undefined || longitude === null) {
        console.error('Missing required coordinates for reverse geocoding');
        return null;
    }

    const lat = typeof latitude === 'number' ? latitude : parseFloat(latitude);
    const lon = typeof longitude === 'number' ? longitude : parseFloat(longitude);

    if (isNaN(lat) || isNaN(lon)) {
        console.error('Invalid latitude or longitude passed to reverseGeocode');
        return null;
    }

    try {
        const headers = {};
        if (typeof window === 'undefined') {
            headers['User-Agent'] = 'LocalGrow/1.0 (contact@localgrow.com)';
        }

        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&format=json&addressdetails=1`,
            { headers }
        );

        if (!response.ok) {
            throw new Error(`Nominatim reverse geocoding error: ${response.status}`);
        }

        const data = await response.json();
        if (!data) {
            console.warn('Empty reverse geocoding response for:', lat, lon);
            return null;
        }

        const addr = data.address || {};
        const city = addr.city || addr.town || addr.village || addr.municipality || addr.county || '';
        const area = addr.suburb || addr.neighbourhood || addr.city_district || '';
        const state = addr.state || '';
        const postal_code = addr.postcode || '';
        const country = addr.country || 'India';

        let formattedStreet = '';
        if (addr.road) {
            formattedStreet = addr.house_number ? `${addr.house_number}, ${addr.road}` : addr.road;
            if (addr.neighbourhood && !formattedStreet.includes(addr.neighbourhood)) {
                formattedStreet += `, ${addr.neighbourhood}`;
            }
        } else if (area) {
            formattedStreet = area;
        } else {
            formattedStreet = data.display_name || '';
        }

        return {
            latitude: lat,
            longitude: lon,
            city,
            area,
            state,
            postal_code,
            country,
            address: formattedStreet,
            displayName: data.display_name || ''
        };
    } catch (error) {
        console.error('Error during reverse geocoding:', error);
        return null;
    }
}