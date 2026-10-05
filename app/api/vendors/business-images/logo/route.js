import { getServerSession } from 'next-auth';
import { options } from '@/app/api/auth/[...nextauth]/options';
import { uploadBusinessLogo, removeBusinessLogo } from '@/lib/businessImageService';

/**
 * POST /api/vendors/business-images/logo
 *
 * Uploads or replaces the logo for the authenticated vendor's business.
 * Expects multipart/form-data with 'file' and optional 'businessId'.
 */
export async function POST(request) {
    try {
        const session = await getServerSession(options);
        if (!session?.user?.id) {
            return Response.json(
                { success: false, message: "Authentication required" },
                { status: 401 }
            );
        }

        let formData;
        try {
            formData = await request.formData();
        } catch {
            return Response.json(
                { success: false, message: "Invalid form data payload" },
                { status: 400 }
            );
        }

        const file = formData.get('file');
        if (!file || typeof file === 'string') {
            return Response.json(
                { success: false, message: "Logo file is required" },
                { status: 400 }
            );
        }

        const businessId = formData.get('businessId') || null;

        const result = await uploadBusinessLogo(session.user.id, file, businessId);

        if (!result.success) {
            return Response.json(
                { success: false, message: result.error },
                { status: result.status || 400 }
            );
        }

        return Response.json({
            success: true,
            logoUrl: result.logoUrl,
            message: result.message
        });
    } catch (err) {
        console.error("Unhandled error in POST /api/vendors/business-images/logo:", err);
        return Response.json(
            { success: false, message: "Internal server error" },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/vendors/business-images/logo
 *
 * Removes the logo for the authenticated vendor's business.
 * Accepts optional ?businessId query param or JSON { businessId }.
 */
export async function DELETE(request) {
    try {
        const session = await getServerSession(options);
        if (!session?.user?.id) {
            return Response.json(
                { success: false, message: "Authentication required" },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);
        let businessId = searchParams.get('businessId');

        if (!businessId && request.headers.get('content-type')?.includes('application/json')) {
            try {
                const body = await request.json();
                businessId = body?.businessId;
            } catch {
                // Ignore empty json body
            }
        }

        const result = await removeBusinessLogo(session.user.id, businessId);

        if (!result.success) {
            return Response.json(
                { success: false, message: result.error },
                { status: result.status || 400 }
            );
        }

        return Response.json({
            success: true,
            message: result.message
        });
    } catch (err) {
        console.error("Unhandled error in DELETE /api/vendors/business-images/logo:", err);
        return Response.json(
            { success: false, message: "Internal server error" },
            { status: 500 }
        );
    }
}
