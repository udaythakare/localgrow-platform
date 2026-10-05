import { getServerSession } from 'next-auth';
import { options } from '@/app/api/auth/[...nextauth]/options';
import { uploadGalleryPhoto, getBusinessBranding } from '@/lib/businessImageService';

/**
 * GET /api/vendors/business-images/gallery
 *
 * Retrieves gallery photos for the vendor's business.
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
        const businessId = searchParams.get('businessId');

        const result = await getBusinessBranding(session.user.id, businessId);

        if (!result.success) {
            return Response.json(
                { success: false, message: result.error },
                { status: result.status || 400 }
            );
        }

        return Response.json({
            success: true,
            photos: result.photos
        });
    } catch (err) {
        console.error("Unhandled error in GET /api/vendors/business-images/gallery:", err);
        return Response.json(
            { success: false, message: "Internal server error" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/vendors/business-images/gallery
 *
 * Uploads a photo to the vendor's business gallery.
 * Expects multipart/form-data with 'file', optional 'caption', optional 'displayOrder', optional 'businessId'.
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
                { success: false, message: "Gallery photo file is required" },
                { status: 400 }
            );
        }

        const caption = formData.get('caption');
        const displayOrder = formData.get('displayOrder');
        const businessId = formData.get('businessId');

        const result = await uploadGalleryPhoto(session.user.id, file, {
            caption,
            displayOrder,
            requestedBusinessId: businessId
        });

        if (!result.success) {
            return Response.json(
                { success: false, message: result.error },
                { status: result.status || 400 }
            );
        }

        return Response.json({
            success: true,
            photo: result.photo,
            message: result.message
        });
    } catch (err) {
        console.error("Unhandled error in POST /api/vendors/business-images/gallery:", err);
        return Response.json(
            { success: false, message: "Internal server error" },
            { status: 500 }
        );
    }
}
