import { NextResponse } from "next/server";
import { options } from "@/app/api/auth/[...nextauth]/options";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerSession } from "next-auth";
import { verifyAdminSession } from "@/lib/superadminAuth";

// Strict allowlist of fields a vendor is permitted to edit on their business
const ALLOWED_VENDOR_UPDATE_FIELDS = [
    'name',
    'description',
    'category_id',
    'website',
    'phone',
    'email',
    'logo_url',
    'logo_public_id',
];

async function checkIsSuperadmin(session) {
    if (session?.user?.roles?.includes('superadmin')) {
        return true;
    }
    try {
        const adminSession = await verifyAdminSession();
        if (adminSession?.valid) {
            return true;
        }
    } catch {
        // Not superadmin
    }
    return false;
}

/**
 * GET /api/vendors/[vendorId]
 * Get vendor details by ID (enforces ownership or superadmin)
 */
export async function GET(request, props) {
    try {
        const session = await getServerSession(options);
        const isSuperadmin = await checkIsSuperadmin(session);

        if (!session && !isSuperadmin) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Authentication required. Please log in to continue.",
                },
                { status: 401 }
            );
        }

        const resolvedParams = await props?.params;
        const vendorId = resolvedParams?.vendorId;

        if (!vendorId) {
            return NextResponse.json(
                { success: false, message: "Vendor ID required." },
                { status: 400 }
            );
        }

        const { data, error } = await supabaseAdmin
            .from("businesses")
            .select(`
                *,
                business_locations(*),
                business_categories(name, id)
            `)
            .eq("id", vendorId)
            .maybeSingle();

        if (error || !data) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Vendor not found.",
                },
                { status: 404 }
            );
        }

        // Authorization: Vendor must own the business OR caller must be superadmin
        const isOwner = session?.user?.id && data.user_id === session.user.id;
        if (!isOwner && !isSuperadmin) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Unauthorized: You do not have permission to view this business.",
                },
                { status: 403 }
            );
        }

        // Omit internal user_id to prevent leaking customer/owner account IDs
        const { user_id, ...safeBusinessData } = data;

        return NextResponse.json(
            {
                success: true,
                data: safeBusinessData,
            },
            { status: 200 }
        );

    } catch (error) {
        console.error("Server action error:", error);
        return NextResponse.json(
            {
                success: false,
                message: "An unexpected error occurred. Please try again later.",
            },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/vendors/[vendorId]
 * Update vendor details (enforces ownership and strictly allowlisted fields)
 */
export async function PUT(request, props) {
    try {
        const session = await getServerSession(options);
        if (!session?.user?.id) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Authentication required. Please log in to continue.",
                },
                { status: 401 }
            );
        }

        const resolvedParams = await props?.params;
        const vendorId = resolvedParams?.vendorId;

        if (!vendorId) {
            return NextResponse.json(
                { success: false, message: "Vendor ID required." },
                { status: 400 }
            );
        }

        const updateData = await request.json();

        // Check if the business exists and belongs to the current user
        const { data: existingBusiness, error: checkError } = await supabaseAdmin
            .from("businesses")
            .select("id, user_id")
            .eq("id", vendorId)
            .maybeSingle();

        if (checkError || !existingBusiness) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Business not found.",
                },
                { status: 404 }
            );
        }

        if (existingBusiness.user_id !== session.user.id) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Unauthorized to update this business.",
                },
                { status: 403 }
            );
        }

        // Filter to strict allowlist of vendor-editable fields
        const sanitizedData = {};
        for (const field of ALLOWED_VENDOR_UPDATE_FIELDS) {
            if (Object.prototype.hasOwnProperty.call(updateData, field)) {
                sanitizedData[field] = updateData[field];
            }
        }

        // Explicitly strip any forbidden or server-controlled fields
        delete sanitizedData.status;
        delete sanitizedData.user_id;
        delete sanitizedData.created_at;
        delete sanitizedData.updated_at;
        delete sanitizedData.rejection_reason;
        delete sanitizedData.id;

        if (Object.keys(sanitizedData).length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "No valid editable fields provided.",
                },
                { status: 400 }
            );
        }

        // Update business data safely
        const { data, error } = await supabaseAdmin
            .from("businesses")
            .update(sanitizedData)
            .eq("id", vendorId)
            .select()
            .single();

        if (error) {
            console.error("Error updating vendor:", error);
            return NextResponse.json(
                {
                    success: false,
                    message: "Failed to update vendor. Please try again later.",
                },
                { status: 500 }
            );
        }

        const { user_id, ...safeUpdatedData } = data;

        return NextResponse.json(
            {
                success: true,
                message: "Vendor updated successfully!",
                data: safeUpdatedData,
            },
            { status: 200 }
        );

    } catch (error) {
        console.error("Server action error:", error);
        return NextResponse.json(
            {
                success: false,
                message: "An unexpected error occurred. Please try again later.",
            },
            { status: 500 }
        );
    }
}