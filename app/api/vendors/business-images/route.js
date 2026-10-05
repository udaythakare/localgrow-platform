import { getServerSession } from 'next-auth';
import { options } from '@/app/api/auth/[...nextauth]/options';
import { getBusinessBranding } from '@/lib/businessImageService';

/**
 * GET /api/vendors/business-images
 *
 * Retrieves current branding information (logo and ordered gallery photos)
 * for the authenticated vendor's business.
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
            businessId: result.businessId,
            businessName: result.businessName,
            logoUrl: result.logoUrl,
            photos: result.photos
        });
    } catch (err) {
        console.error("Unhandled error in GET /api/vendors/business-images:", err);
        return Response.json(
            { success: false, message: "Internal server error" },
            { status: 500 }
        );
    }
}
