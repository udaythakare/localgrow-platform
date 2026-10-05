// app/coupons/actions/couponActions.ts
'use server';
import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { options } from '@/app/api/auth/[...nextauth]/options';
import { getServerSession } from 'next-auth';
import { getUserId } from '@/helpers/userHelper';
import { sendNotificationToAllUsers } from '@/lib/pushNotifications';
import { cookies } from 'next/headers';

// Initialize Supabase client
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Fetch businesses owned by the current user
export async function getUserBusinesses() {
    const session = await getServerSession(options);

    if (!session?.user?.id) {
        return { error: 'Unauthorized' };
    }

    try {
        const { data: businesses, error } = await supabase
            .from('businesses')
            .select('id, name')
            .eq('user_id', session.user.id);

        if (error) throw error;

        return { businesses };
    } catch (error) {
        console.error('Error fetching user businesses:', error);
        return { error: 'Failed to fetch businesses' };
    }
}

// Create a new coupon
// export async function createCoupon(formData) {
//     const session = await getServerSession(options);
//     if (!session?.user?.id) {
//         return { error: 'Unauthorized' };
//     }
//     try {
//         // First verify that the user owns this business
//         const { data: business, error: businessError } = await supabase
//             .from('businesses')
//             .select('id')
//             .eq('id', formData.business_id)
//             .eq('user_id', session.user.id)
//             .single();
//         if (businessError || !business) {
//             return { error: 'Unauthorized access to this business' };
//         }
//         // Create the coupon
//         const { data: coupon, error: couponError } = await supabase
//             .from('coupons')
//             .insert({
//                 business_id: formData.business_id,
//                 title: formData.title,
//                 description: formData.description || null,
//                 start_date: formData.start_date,
//                 end_date: formData.end_date,
//                 is_active: formData.is_active,
//                 image_url: formData.image_url || null,
//                 coupon_type: formData.coupon_type,
//                 redeem_duration: formData.redeem_duration || null,
//                 max_claims: formData.max_claims || null,
//                 user_id: session.user.id,
//                 redemption_time_type: formData.redemption_time_type,
//                 redemption_end_time: formData.redemption_end_time,
//                 redemption_start_time: formData.redemption_start_time
//             })
//             .select('id')
//             .single();
//         if (couponError) throw couponError;

//         revalidatePath('/business/dashboard/coupons');
//         return { success: true, id: coupon.id };
//     } catch (error) {
//         console.error('Error creating coupon:', error);
//         return { error: 'Failed to create coupon' };
//     }
// }

export async function createCoupon(formData) {
    const session = await getServerSession(options);

    if (!session?.user?.id) {
        return { error: 'Unauthorized' };
    }

    try {

        // Verify user owns the business
        const { data: business, error: businessError } = await supabase
            .from('businesses')
            .select('id, name')
            .eq('id', formData.business_id)
            .eq('user_id', session.user.id)
            .single();

        if (businessError || !business) {
            return { error: 'Unauthorized access to this business' };
        }

        // Create coupon (NO city/state here)
        const { data: coupon, error: couponError } = await supabase
            .from('coupons')
            .insert({
                business_id: formData.business_id,
                title: formData.title,
                description: formData.description || null,
                start_date: formData.start_date,
                end_date: formData.end_date,
                is_active: formData.is_active,
                image_url: formData.image_url || null,
                coupon_type: 'redeem_at_store', // enforce store redeem
                redeem_duration: formData.redeem_duration || null,
                max_claims: formData.max_claims || null,
                user_id: session.user.id,
                redemption_time_type: formData.redemption_time_type,
                redemption_end_time: formData.redemption_end_time,
                redemption_start_time: formData.redemption_start_time
            })
            .select('id, title, description')
            .single();

        if (couponError) throw couponError;

        // Send push notification (non-blocking)
        if (formData.is_active) {
            sendPushNotificationForNewCoupon(
                business,
                coupon,
                formData.business_id
            ).catch(error => {
                console.error('Push notification failed:', error);
            });
        }

        revalidatePath('/business/dashboard/coupons');

        return { success: true, id: coupon.id };

    } catch (error) {
        console.error('Error creating coupon:', error);
        return { error: 'Failed to create coupon' };
    }
}


async function sendPushNotificationForNewCoupon(business, coupon, businessId) {
    console.log(business, coupon, businessId);
    try {
        // Prepare the notification data
        const notificationData = {
            title: `🎉 New Coupon from ${business.name}!`,
            body: `${coupon.title}${coupon.description ? ` - ${coupon.description}` : ' - Check it out now!'}`,
            url: `/coupons/${coupon.id}`,
            // Optional: Add additional data for your service worker
            tag: 'new-coupon',
            data: {
                couponId: coupon.id,
                businessId: businessId,
                type: 'new_coupon'
            }
        };

        console.log('Sending notification via API:', notificationData);

        // Call your API endpoint (internal-only — passes the server secret)
        const notifBaseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
        const response = await fetch(`${notifBaseUrl}/api/send-notification`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-internal-secret': process.env.INTERNAL_API_SECRET || '',
                Cookie: (await cookies()).toString()
            },
            body: JSON.stringify(notificationData),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API call failed: ${response.status} - ${errorData.error || 'Unknown error'}`);
        }

        const result = await response.json();
        console.log('Notification sent successfully:', result);
        return result;

    } catch (error) {
        console.error('Error calling notification API:', error);
        throw error; // Re-throw so the parent function can catch it
    }
}

export async function updateCoupon(id, formData) {


    const session = await getServerSession(options);
    if (!session?.user?.id) {
        return { error: 'Unauthorized' };
    }

    try {
        // Verify that the user owns the business that owns this coupon
        const { data: coupon, error: couponError } = await supabase
            .from('coupons')
            .select('id, business_id, businesses!inner(id, user_id)')
            .eq('id', id)
            .eq('businesses.user_id', session.user.id)
            .single();

        if (couponError || !coupon) {
            return { error: 'Unauthorized access to this coupon' };
        }

        // Format dates properly before saving to database
        // Ensure dates are in the correct format for PostgreSQL
        let formattedData = {
            ...formData,
            start_date: formatDateForDatabase(formData.start_date),
            end_date: formatDateForDatabase(formData.end_date),
            redemption_end_time: formatTimeForDatabase(formData.redemption_end_time),
            redemption_start_time: formatTimeForDatabase(formData.redemption_start_time)
        };

        console.log('Formatted for database:', {
            start_date: formattedData.start_date,
            end_date: formattedData.end_date
        });

        // Update the coupon
        const { error: updateError } = await supabase
            .from('coupons')
            .update({
                title: formattedData.title,
                description: formattedData.description || null,
                start_date: formattedData.start_date,
                end_date: formattedData.end_date,
                is_active: formattedData.is_active,
                image_url: formattedData.image_url || null,
                coupon_type: formattedData.coupon_type,
                redeem_duration: formattedData.redeem_duration || null,
                max_claims: formattedData.max_claims || null,
                user_id: session.user.id,
                redemption_time_type: formData.redemption_time_type,
                redemption_end_time: formData.redemption_end_time,
                redemption_start_time: formData.redemption_start_time
            })
            .eq('id', id);

        if (updateError) throw updateError;

        revalidatePath('/business/dashboard/coupons/edit/[id]', 'layout');

        return { success: true };
    } catch (error) {
        console.error('Error updating coupon:', error);
        return { error: 'Failed to update coupon' };
    }
}

// Helper function to format dates for PostgreSQL
function formatDateForDatabase(dateValue) {
    if (!dateValue) return null;

    // Handle various input formats
    let dateObj;

    if (typeof dateValue === 'string') {
        // If it's an ISO string like "2025-05-09T21:00:00.000Z"
        if (dateValue.endsWith('Z') || dateValue.includes('+')) {
            dateObj = new Date(dateValue);
        }
        // If it's a format like "2025-05-09 21:00:00"
        else if (dateValue.includes(' ')) {
            dateObj = new Date(dateValue.replace(' ', 'T'));
        }
        // If it's a format like "2025-05-09T21:00:00"
        else if (dateValue.includes('T')) {
            dateObj = new Date(dateValue);
        }
        // Some other string format
        else {
            dateObj = new Date(dateValue);
        }
    } else {
        // If it's already a Date object
        dateObj = new Date(dateValue);
    }

    // Check if we have a valid date
    if (isNaN(dateObj.getTime())) {
        console.error('Invalid date encountered:', dateValue);
        return null;
    }

    // Format for PostgreSQL: YYYY-MM-DD HH:MM:SS
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    const seconds = String(dateObj.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function formatTimeForDatabase(timeValue) {
    console.log(timeValue)
    if (/^\d{2}:\d{2}$/.test(timeValue)) {
        return timeValue + ":00"
    }

    if (/^\d{2}:\d{2}:\d{2}$/.test(timeValue)) {
        return timeValue
    }


    throw new Error("Invalid time format couponActions ")
}

export async function getBusinessLocations(businessId) {
    const session = await getServerSession(options);

    if (!session?.user?.id) {
        return { error: 'Unauthorized' };
    }

    try {
        // Verify user has access to this business
        const { data: business, error: businessError } = await supabase
            .from('businesses')
            .select('id')
            .eq('id', businessId)
            .eq('user_id', session.user.id)
            .single();

        if (businessError || !business) {
            return { error: 'Unauthorized access to this business' };
        }

        const { data: locations, error: locationsError } = await supabase
            .from('business_locations')
            .select('id, address, city, state, postal_code, country, is_primary')
            .eq('business_id', businessId);

        if (locationsError) throw locationsError;

        return { locations };
    } catch (error) {
        console.error('Error fetching business locations:', error);
        return { error: 'Failed to fetch locations' };
    }
}

// Get product categories for a business
// export async function getBusinessCategories(businessId) {
//     const session = await getServerSession(options);

//     if (!session?.user?.id) {
//         return { error: 'Unauthorized' };
//     }

//     try {
//         const { data: categories, error } = await supabase
//             .from('product_categories')
//             .select('id, name')
//             .eq('business_id', businessId)
//             .in('business_id', supabase
//                 .from('businesses')
//                 .select('id')
//                 .eq('user_id', session.user.id)
//             );

//         if (error) throw error;

//         return { categories };
//     } catch (error) {
//         console.error('Error fetching product categories:', error);
//         return { error: 'Failed to fetch categories' };
//     }
// }

// Get product categories for a business
export async function getBusinessCategories(businessId) {
    const session = await getServerSession(options);

    if (!session?.user?.id) {
        return { error: 'Unauthorized' };
    }

    try {
        // First verify user has access to this business
        const { data: business, error: businessError } = await supabase
            .from('businesses')
            .select('id')
            .eq('id', businessId)
            .eq('user_id', session.user.id)
            .single();

        if (businessError || !business) {
            return { error: 'Unauthorized access to this business' };
        }

        // Now fetch the categories
        const { data: categories, error } = await supabase
            .from('product_categories')
            .select('id, name')
            .eq('business_id', businessId);

        if (error) throw error;

        return { categories };
    } catch (error) {
        console.error('Error fetching product categories:', error);
        return { error: 'Failed to fetch categories' };
    }
}

// Get products for a business
// export async function getBusinessProducts(businessId) {
//     const session = await getServerSession(options);

//     if (!session?.user?.id) {
//         return { error: 'Unauthorized' };
//     }

//     try {
//         const { data: products, error } = await supabase
//             .from('products')
//             .select('id, name')
//             .eq('business_id', businessId)
//             .in('business_id', supabase
//                 .from('businesses')
//                 .select('id')
//                 .eq('user_id', session.user.id)
//             );

//         if (error) throw error;

//         return { products };
//     } catch (error) {
//         console.error('Error fetching products:', error);
//         return { error: 'Failed to fetch products' };
//     }
// }

// Get products for a business
export async function getBusinessProducts(businessId) {
    const session = await getServerSession(options);

    if (!session?.user?.id) {
        return { error: 'Unauthorized' };
    }

    try {
        // First verify user has access to this business
        const { data: business, error: businessError } = await supabase
            .from('businesses')
            .select('id')
            .eq('id', businessId)
            .eq('user_id', session.user.id)
            .single();

        if (businessError || !business) {
            return { error: 'Unauthorized access to this business' };
        }

        // Now fetch the products
        const { data: products, error } = await supabase
            .from('products')
            .select('id, name')
            .eq('business_id', businessId);

        if (error) throw error;

        return { products };
    } catch (error) {
        console.error('Error fetching products:', error);
        return { error: 'Failed to fetch products' };
    }
}

// Get all coupon tags
export async function getCouponTags() {
    try {
        const { data: tags, error } = await supabase
            .from('coupon_tags')
            .select('id, name');

        if (error) throw error;

        return { tags };
    } catch (error) {
        console.error('Error fetching coupon tags:', error);
        return { error: 'Failed to fetch tags' };
    }
}

export async function getAllCoupons(query = '', page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    // const session = await getServerSession(options);
    // const userId = session?.user?.id;
    const userId = await getUserId(); // Assuming you have a function to get the user ID
    let supabaseQuery = supabase
        .from('coupons')
        .select('*', { count: 'exact' }) // select all fields + count
        .order('created_at', { ascending: false })
        .eq("user_id", userId)
        .eq("is_active", true)
        .range(offset, offset + limit - 1);

    if (query) {
        const lowerQuery = query.toLowerCase();
        supabaseQuery = supabaseQuery.or(`
            code.ilike.%${lowerQuery}%,
            title.ilike.%${lowerQuery}%,
            description.ilike.%${lowerQuery}%
        `);
    }

    const { data: coupons, count: totalCount, error } = await supabaseQuery;

    if (error) {
        console.error('Error fetching coupons:', error.message);
        return { coupons: [], totalCount: 0 };
    }

    console.log(coupons, 'this is coupons')

    return { coupons, totalCount };
}

export async function getCouponById(id) {
    const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        console.error('Error fetching coupon by ID:', error.message);
        return null;
    }

    return data;
}
export async function deleteCoupon(id) {
    const { error } = await supabase
        .from('coupons')
        .update({ is_active: false })  // This should be an object, not two parameters
        .eq('id', id);

    if (error) {
        console.error('Error deleting coupon:', error.message);
        return { success: false, error: error.message };
    }

    return { success: true };
}