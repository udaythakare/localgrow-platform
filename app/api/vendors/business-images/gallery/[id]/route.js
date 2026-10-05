import { getServerSession } from 'next-auth';
import { options } from '@/app/api/auth/[...nextauth]/options';
import { deleteGalleryPhoto } from '@/lib/businessImageService';

/**
 * DELETE /api/vendors/business-images/gallery/[id]
 *
 * Deletes a gallery photo belonging to the authenticated vendor's business.
 * Prevents deleting assets belonging to other businesses.
 */
export async function DELETE(request, context) {
    try {
        const session = await getServerSession(options);
        if (!session?.user?.id) {
            return Response.json(
                { success: false, message: "Authentication required" },
                { status: 401 }
            );
        }

        // Support Next.js 15 async params while being backward-compatible
        const params = context?.params ? await context.params : {};
        const photoId = params?.id;

        if (!photoId) {
            return Response.json(
                { success: false, message: "Photo ID is required" },
                { status: 400 }
            );
        }

        const result = await deleteGalleryPhoto(session.user.id, photoId);

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
        console.error("Unhandled error in DELETE /api/vendors/business-images/gallery/[id]:", err);
        return Response.json(
            { success: false, message: "Internal server error" },
            { status: 500 }
        );
    }
}
