import { getServerSession } from 'next-auth';
import { options } from '@/app/api/auth/[...nextauth]/options';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
    operatingHoursUpdateSchema,
    normalizeTimeString
} from '@/lib/validations/operatingHoursSchema';

/**
 * Validates UUID format for request params.
 */
function isValidUuid(id) {
    if (typeof id !== 'string') return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
}

/**
 * GET /api/vendors/operating-hours?locationId=<UUID>
 *
 * Fetches the configured timezone and 7-day weekly schedule for a location.
 * Requires:
 * 1. Authenticated session.
 * 2. Location belongs to the user's business.
 * 3. Business is in 'approved' status.
 */
export async function GET(request) {
    try {
        const session = await getServerSession(options);
        if (!session?.user?.id) {
            return Response.json(
                { success: false, message: "Authentication required" },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);
        const locationId = searchParams.get('locationId');

        if (!locationId || !isValidUuid(locationId)) {
            return Response.json(
                { success: false, message: "Valid locationId parameter is required" },
                { status: 400 }
            );
        }

        // Authorize: location must belong to user's business
        const { data: locationData, error: locationError } = await supabaseAdmin
            .from('business_locations')
            .select(`
                id,
                timezone,
                business_id,
                businesses!inner(id, user_id, status)
            `)
            .eq('id', locationId)
            .maybeSingle();

        if (locationError || !locationData || locationData.businesses?.user_id !== session.user.id) {
            return Response.json(
                { success: false, message: "Location not found or does not belong to your business" },
                { status: 404 }
            );
        }

        if (locationData.businesses?.status !== 'approved') {
            return Response.json(
                { success: false, message: "Only approved businesses can manage operating hours" },
                { status: 403 }
            );
        }

        // Fetch weekly operating hours
        const { data: hours, error: hoursError } = await supabaseAdmin
            .from('business_hours')
            .select('day_of_week, open_time, close_time, is_closed, is_24_hours')
            .eq('location_id', locationId)
            .order('day_of_week', { ascending: true });

        if (hoursError) {
            console.error("Error querying business_hours:", hoursError);
            return Response.json(
                { success: false, message: "Failed to load operating hours" },
                { status: 500 }
            );
        }

        const hasHoursConfigured = Array.isArray(hours) && hours.length > 0;
        const schedule = hasHoursConfigured
            ? hours.map(h => ({
                dayOfWeek: h.day_of_week,
                openTime: h.open_time ? h.open_time.slice(0, 5) : "00:00",
                closeTime: h.close_time ? h.close_time.slice(0, 5) : "00:00",
                isClosed: Boolean(h.is_closed),
                is24Hours: Boolean(h.is_24_hours)
            }))
            : [];

        return Response.json({
            success: true,
            data: {
                locationId: locationData.id,
                timezone: locationData.timezone || "Asia/Kolkata",
                hasHoursConfigured,
                schedule
            }
        });

    } catch (err) {
        console.error("Unexpected error in GET /api/vendors/operating-hours:", err);
        return Response.json(
            { success: false, message: "An unexpected error occurred" },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/vendors/operating-hours
 *
 * Atomically updates a location's timezone and replaces its 7-day schedule.
 * Requires:
 * 1. Authenticated session.
 * 2. Zod validation of payload (UUID, valid IANA timezone, exactly 7 days).
 * 3. Location belongs to user's business and business is 'approved'.
 */
export async function PUT(request) {
    try {
        const session = await getServerSession(options);
        if (!session?.user?.id) {
            return Response.json(
                { success: false, message: "Authentication required" },
                { status: 401 }
            );
        }

        let body;
        try {
            body = await request.json();
        } catch {
            return Response.json(
                { success: false, message: "Malformed JSON body" },
                { status: 400 }
            );
        }

        // Validate payload with Zod
        const validation = operatingHoursUpdateSchema.safeParse(body);
        if (!validation.success) {
            return Response.json(
                {
                    success: false,
                    message: "Validation failed",
                    errors: validation.error.flatten().fieldErrors
                },
                { status: 400 }
            );
        }

        const { locationId, timezone, schedule } = validation.data;

        // Authorize: location must belong to user's business and business must be approved
        const { data: locationData, error: locationError } = await supabaseAdmin
            .from('business_locations')
            .select(`
                id,
                timezone,
                business_id,
                businesses!inner(id, user_id, status)
            `)
            .eq('id', locationId)
            .maybeSingle();

        if (locationError || !locationData || locationData.businesses?.user_id !== session.user.id) {
            return Response.json(
                { success: false, message: "Location not found or does not belong to your business" },
                { status: 404 }
            );
        }

        if (locationData.businesses?.status !== 'approved') {
            return Response.json(
                { success: false, message: "Only approved businesses can manage operating hours" },
                { status: 403 }
            );
        }

        // Normalize schedule entries for database consistency
        const normalizedSchedule = schedule.map(entry => {
            const isClosed = Boolean(entry.isClosed);
            const is24Hours = Boolean(entry.is24Hours);
            const openTime = isClosed || is24Hours ? "00:00:00" : normalizeTimeString(entry.openTime);
            const closeTime = isClosed || is24Hours ? "00:00:00" : normalizeTimeString(entry.closeTime);

            return {
                dayOfWeek: entry.dayOfWeek,
                openTime,
                closeTime,
                isClosed,
                is24Hours
            };
        });

        // Atomic persistence via PostgreSQL RPC in a single transaction
        const { error: rpcError } = await supabaseAdmin.rpc('save_vendor_operating_hours', {
            p_location_id: locationId,
            p_timezone: timezone,
            p_schedule: normalizedSchedule
        });

        if (rpcError) {
            console.error("Error executing save_vendor_operating_hours RPC:", rpcError);
            return Response.json(
                { success: false, message: "Failed to save operating hours" },
                { status: 500 }
            );
        }

        return Response.json({
            success: true,
            message: "Operating hours updated successfully",
            data: {
                locationId,
                timezone,
                hasHoursConfigured: true,
                schedule: normalizedSchedule.map(s => ({
                    dayOfWeek: s.dayOfWeek,
                    openTime: s.openTime.slice(0, 5),
                    closeTime: s.closeTime.slice(0, 5),
                    isClosed: s.isClosed,
                    is24Hours: s.is24Hours
                }))
            }
        });

    } catch (err) {
        console.error("Unexpected error in PUT /api/vendors/operating-hours:", err);
        return Response.json(
            { success: false, message: "An unexpected error occurred" },
            { status: 500 }
        );
    }
}
