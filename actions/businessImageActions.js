'use server';

import { getServerSession } from 'next-auth';
import { options } from '@/app/api/auth/[...nextauth]/options';
import {
    uploadBusinessLogo,
    removeBusinessLogo,
    uploadGalleryPhoto,
    deleteGalleryPhoto,
    getBusinessBranding
} from '@/lib/businessImageService';

/**
 * Server Action: Uploads or replaces the vendor's business logo.
 */
export async function uploadLogoAction(formData) {
    const session = await getServerSession(options);
    if (!session?.user?.id) {
        return { success: false, error: "Authentication required" };
    }
    const file = formData?.get('file');
    const businessId = formData?.get('businessId') || null;
    return await uploadBusinessLogo(session.user.id, file, businessId);
}

/**
 * Server Action: Removes the vendor's business logo.
 */
export async function removeLogoAction(businessId = null) {
    const session = await getServerSession(options);
    if (!session?.user?.id) {
        return { success: false, error: "Authentication required" };
    }
    return await removeBusinessLogo(session.user.id, businessId);
}

/**
 * Server Action: Uploads a photo to the vendor's business gallery.
 */
export async function uploadGalleryPhotoAction(formData) {
    const session = await getServerSession(options);
    if (!session?.user?.id) {
        return { success: false, error: "Authentication required" };
    }
    const file = formData?.get('file');
    const caption = formData?.get('caption');
    const displayOrder = formData?.get('displayOrder');
    const businessId = formData?.get('businessId');
    return await uploadGalleryPhoto(session.user.id, file, {
        caption,
        displayOrder,
        requestedBusinessId: businessId
    });
}

/**
 * Server Action: Deletes a gallery photo.
 */
export async function deleteGalleryPhotoAction(photoId) {
    const session = await getServerSession(options);
    if (!session?.user?.id) {
        return { success: false, error: "Authentication required" };
    }
    return await deleteGalleryPhoto(session.user.id, photoId);
}

/**
 * Server Action: Retrieves branding and gallery photos for the vendor.
 */
export async function getBusinessBrandingAction(businessId = null) {
    const session = await getServerSession(options);
    if (!session?.user?.id) {
        return { success: false, error: "Authentication required" };
    }
    return await getBusinessBranding(session.user.id, businessId);
}
