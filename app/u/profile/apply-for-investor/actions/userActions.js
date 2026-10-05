'use server';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getServerSession } from 'next-auth';
import { options } from '@/app/api/auth/[...nextauth]/options';
import { getUserId } from '@/helpers/userHelper';
import { supabase } from '@/lib/supabase';

// Cache the server session to avoid redundant authentication
let cachedSession = null;
let sessionExpiry = 0;
const SESSION_TTL = 60 * 1000; // 1 minute cache

// Helper function to get authenticated user ID with caching
async function getAuthenticatedUserId() {
    const now = Date.now();

    // Use cached session if still valid
    if (cachedSession && now < sessionExpiry) {
        return cachedSession.user.id;
    }

    // Otherwise fetch new session
    const session = await getServerSession(options);
    if (!session) {
        return null;
    }

    // Update cache
    cachedSession = session;
    sessionExpiry = now + SESSION_TTL;

    return session.user.id;
}

export async function fetchUserData() {
    try {
        const userId = await getAuthenticatedUserId();
        if (!userId) {
            return { success: false, message: 'Login first' };
        }

        // Use single query with optimized selection
        const { data: user, error } = await supabaseAdmin
            .from('users')
            .select('id, email, username, created_at') // Select only needed fields
            .eq('id', userId)
            .single();

        if (error) {
            console.error('fetchUserData error:', error);
            return {
                success: false,
                message: 'Could not fetch user data',
                error: error.message,
            };
        }

        return { success: true, user };
    } catch (err) {
        console.error('Unexpected error in fetchUserData:', err);
        return { success: false, message: 'An unexpected error occurred' };
    }
}

export async function fetchUserCoupons() {
    try {
        const userId = await getAuthenticatedUserId();
        if (!userId) {
            return { success: false, message: 'Login first', coupons: [] };
        }

        // Use prepared statement for better performance
        const { data, error } = await supabaseAdmin.rpc('get_active_user_coupons', {
            user_id_param: userId
        });

        if (error) {
            console.error('fetchUserCoupons error:', error);
            return {
                success: false,
                message: 'Could not fetch your coupons',
                error: error.message,
                coupons: [],
            };
        }

        // Return already processed data from the stored procedure
        return {
            success: true,
            coupons: data || [],
        };
    } catch (err) {
        console.error('Unexpected error in fetchUserCoupons:', err);
        return { success: false, message: 'An unexpected error occurred', coupons: [] };
    }
}

export async function updateUserLocation(locationData) {
    try {
        const rawUserId = await getUserId();
        const userId = typeof rawUserId === 'string' && rawUserId.trim().length > 0 ? rawUserId.trim() : null;
        if (!userId) {
            return { success: false, message: 'Login first' };
        }

        // Validate that city is present (crucial for /coupons and locality filtering)
        if (!locationData || !locationData.city || typeof locationData.city !== 'string' || locationData.city.trim().length === 0) {
            return { success: false, error: 'City is required' };
        }

        const lat = typeof locationData.latitude === 'number'
            ? locationData.latitude
            : (locationData.latitude !== undefined && locationData.latitude !== null && locationData.latitude !== '' ? parseFloat(locationData.latitude) : null);
        const lon = typeof locationData.longitude === 'number'
            ? locationData.longitude
            : (locationData.longitude !== undefined && locationData.longitude !== null && locationData.longitude !== '' ? parseFloat(locationData.longitude) : null);

        const upsertData = {
            user_id: userId,
            city: locationData.city.trim(),
            address: locationData.address ? String(locationData.address).trim() : null,
            state: locationData.state ? String(locationData.state).trim() : null,
            area: locationData.area ? String(locationData.area).trim() : null,
            postal_code: locationData.postal_code ? String(locationData.postal_code).trim() : null,
            country: locationData.country ? String(locationData.country).trim() : 'India',
            latitude: (lat !== null && !isNaN(lat)) ? lat : null,
            longitude: (lon !== null && !isNaN(lon)) ? lon : null,
            is_primary: true,
        };

        const { error } = await supabaseAdmin
            .from('user_locations')
            .upsert(upsertData, { onConflict: 'user_id' });

        if (error) {
            throw new Error(`Database error: ${error.message}`);
        }

        revalidatePath('/u/profile');

        return { success: true, data: upsertData };
    } catch (error) {
        console.error('Error updating user location:', error);
        return { success: false, error: error.message };
    }
}

import { revalidatePath } from 'next/cache'
import { toast } from 'react-hot-toast'

export async function updateUserPersonalInfo(personalInfo) {
    try {
        const userId = await getUserId();
        if (!userId) {
            return { success: false, message: 'Login first' };
        }

        // Validate required fields
        const requiredFields = ['username', 'full_name', 'mobile_number'];
        const missingField = requiredFields.find(field => !personalInfo[field]);
        if (missingField) {
            return {
                success: false,
                error: `${missingField} is required`,
                fieldErrors: { [missingField]: `${missingField} is required` }
            };
        }

        // Validate mobile number format
        const mobileNumberPattern = /^\d{10}$/;
        if (!mobileNumberPattern.test(personalInfo.mobile_number)) {
            return {
                success: false,
                error: 'Mobile number must be exactly 10 digits',
                fieldErrors: { mobile_number: 'Mobile number must be exactly 10 digits' }
            };
        }

        // Update user information in the database
        const { error } = await supabaseAdmin
            .from('users')
            .update({
                mobile_number: personalInfo.mobile_number,
                username: personalInfo.username,
                full_name: personalInfo.full_name,
            })
            .eq('id', userId);

        if (error) {
            throw new Error(`Database error: ${error.message}`);
        }

        // Revalidate the profile page to clear cached data
        revalidatePath('/u/profile');

        return { success: true };
    } catch (error) {
        console.error('Error updating user personal info:', error);
        return {
            success: false,
            error: error.message,
            fieldErrors: error.fieldErrors || {}
        };
    }
}