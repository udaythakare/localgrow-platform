import cloudinary from './cloudinary.js';
import { supabaseAdmin } from './supabaseAdmin.js';
import {
    validateImageFile,
    validateCaption,
    validateDisplayOrder,
    MAX_LOGO_SIZE_BYTES,
    MAX_PHOTO_SIZE_BYTES,
    MAX_GALLERY_PHOTOS
} from './validations/businessImageValidation.js';

/**
 * Uploads a Buffer to Cloudinary using upload_stream.
 *
 * @param {Buffer} buffer - File buffer
 * @param {Object} options - Cloudinary options (folder, etc.)
 * @returns {Promise<{secure_url: string, public_id: string}>}
 */
export async function uploadBufferToCloudinary(buffer, options = {}) {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                resource_type: 'image',
                ...options
            },
            (error, result) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(result);
                }
            }
        );
        uploadStream.end(buffer);
    });
}

/**
 * Safely deletes an asset from Cloudinary by its public ID.
 * Suppresses and logs errors so that database consistency is prioritized.
 *
 * @param {string} publicId - Cloudinary public ID
 * @returns {Promise<boolean>}
 */
export async function safeDeleteFromCloudinary(publicId) {
    if (!publicId) return true;
    try {
        const res = await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
        return res?.result === 'ok' || res?.result === 'not found';
    } catch (err) {
        console.error(`Warning: Failed to delete Cloudinary asset "${publicId}":`, err?.message || err);
        return false;
    }
}

/**
 * Authorizes that the user owns a registered business.
 *
 * @param {string} userId - Authenticated user ID from NextAuth session
 * @param {string|null} [requestedBusinessId] - Optional businessId to check against
 * @returns {Promise<{success: boolean, business?: Object, status?: number, error?: string}>}
 */
export async function getVendorBusiness(userId, requestedBusinessId = null) {
    if (!userId) {
        return { success: false, status: 401, error: "Authentication required" };
    }

    let query = supabaseAdmin
        .from('businesses')
        .select('id, user_id, name, status')
        .eq('user_id', userId);

    if (requestedBusinessId) {
        query = query.eq('id', requestedBusinessId);
    }

    const { data: business, error } = await query.maybeSingle();

    if (error) {
        console.error("Database error looking up vendor business:", error);
        return { success: false, status: 500, error: "Failed to verify business ownership" };
    }

    if (!business) {
        return {
            success: false,
            status: requestedBusinessId ? 403 : 404,
            error: requestedBusinessId
                ? "Unauthorized: You do not own this business"
                : "No registered business found for your account"
        };
    }

    // Attempt to read logo columns if available in the database
    let logoUrl = null;
    let logoPublicId = null;
    try {
        const { data: logoData, error: logoErr } = await supabaseAdmin
            .from('businesses')
            .select('logo_url, logo_public_id')
            .eq('id', business.id)
            .maybeSingle();

        if (!logoErr && logoData) {
            logoUrl = logoData.logo_url || null;
            logoPublicId = logoData.logo_public_id || null;
        }
    } catch {
        // Logo columns not yet migrated; fallback to null
    }

    return {
        success: true,
        business: {
            ...business,
            logo_url: logoUrl,
            logo_public_id: logoPublicId
        }
    };
}

/**
 * Fetches vendor business details, current logo, and ordered gallery photos.
 *
 * @param {string} userId
 * @param {string|null} [requestedBusinessId]
 */
export async function getBusinessBranding(userId, requestedBusinessId = null) {
    const auth = await getVendorBusiness(userId, requestedBusinessId);
    if (!auth.success) return auth;

    const business = auth.business;

    // Fetch gallery photos ordered by display_order ascending, then created_at ascending
    let formattedPhotos = [];
    try {
        const { data: photos, error: photosError } = await supabaseAdmin
            .from('business_photos')
            .select('id, image_url, caption, display_order, created_at')
            .eq('business_id', business.id)
            .order('display_order', { ascending: true })
            .order('created_at', { ascending: true });

        if (!photosError && Array.isArray(photos)) {
            formattedPhotos = photos.map(p => ({
                id: p.id,
                imageUrl: p.image_url,
                caption: p.caption,
                displayOrder: p.display_order,
                createdAt: p.created_at
            }));
        } else if (photosError && photosError.code !== '42P01' && !photosError.message?.includes('business_photos')) {
            console.error("Error fetching gallery photos:", photosError);
        }
    } catch {
        // Migration not yet applied; return empty photos list
    }

    return {
        success: true,
        businessId: business.id,
        businessName: business.name,
        logoUrl: business.logo_url || null,
        photos: formattedPhotos
    };
}

/**
 * Uploads or replaces the vendor's business logo.
 *
 * Clean-up guarantee:
 * - If the DB update fails, the newly uploaded asset is immediately deleted from Cloudinary.
 * - The previous logo asset is NEVER deleted until the DB update has succeeded.
 *
 * @param {string} userId - Authenticated user ID
 * @param {File|Blob} file - Uploaded logo file
 * @param {string|null} [requestedBusinessId] - Optional businessId
 */
export async function uploadBusinessLogo(userId, file, requestedBusinessId = null) {
    // 1. Validate file constraints
    const validation = validateImageFile(file, {
        maxSize: MAX_LOGO_SIZE_BYTES,
        label: "Logo"
    });
    if (!validation.valid) {
        return { success: false, status: 400, error: validation.error };
    }

    // 2. Authorize business ownership
    const auth = await getVendorBusiness(userId, requestedBusinessId);
    if (!auth.success) return auth;

    const business = auth.business;
    const oldLogoPublicId = business.logo_public_id;

    // 3. Read buffer and upload to Cloudinary
    let uploadResult;
    try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        uploadResult = await uploadBufferToCloudinary(buffer, {
            folder: 'businesses/logos',
            tags: ['business_logo', `biz_${business.id}`]
        });
    } catch (uploadErr) {
        console.error("Cloudinary logo upload failed:", uploadErr);
        return { success: false, status: 502, error: "Failed to upload logo to media storage" };
    }

    // 4. Update database record with new logo
    const { error: dbError } = await supabaseAdmin
        .from('businesses')
        .update({
            logo_url: uploadResult.secure_url,
            logo_public_id: uploadResult.public_id
        })
        .eq('id', business.id)
        .eq('user_id', userId);

    if (dbError) {
        console.error("Database update for business logo failed:", dbError);
        // Roll back: clean up the newly uploaded asset so we don't leak orphaned files
        await safeDeleteFromCloudinary(uploadResult.public_id);
        return { success: false, status: 500, error: "Failed to save logo to business profile" };
    }

    // 5. Database update succeeded -> safely clean up previous logo asset
    if (oldLogoPublicId && oldLogoPublicId !== uploadResult.public_id) {
        await safeDeleteFromCloudinary(oldLogoPublicId);
    }

    return {
        success: true,
        logoUrl: uploadResult.secure_url,
        message: "Logo uploaded successfully"
    };
}

/**
 * Removes the vendor's business logo.
 *
 * Clean-up guarantee:
 * - The logo asset on Cloudinary is only deleted after the DB update has succeeded.
 *
 * @param {string} userId - Authenticated user ID
 * @param {string|null} [requestedBusinessId] - Optional businessId
 */
export async function removeBusinessLogo(userId, requestedBusinessId = null) {
    const auth = await getVendorBusiness(userId, requestedBusinessId);
    if (!auth.success) return auth;

    const business = auth.business;
    const oldLogoPublicId = business.logo_public_id;

    if (!business.logo_url && !oldLogoPublicId) {
        return { success: true, message: "No logo configured" };
    }

    // 1. Clear logo in DB first
    const { error: dbError } = await supabaseAdmin
        .from('businesses')
        .update({
            logo_url: null,
            logo_public_id: null
        })
        .eq('id', business.id)
        .eq('user_id', userId);

    if (dbError) {
        console.error("Failed to remove logo from database:", dbError);
        return { success: false, status: 500, error: "Failed to update business profile" };
    }

    // 2. Safely destroy asset on Cloudinary
    if (oldLogoPublicId) {
        await safeDeleteFromCloudinary(oldLogoPublicId);
    }

    return { success: true, message: "Logo removed successfully" };
}

/**
 * Uploads a photo to the business gallery.
 *
 * @param {string} userId - Authenticated user ID
 * @param {File|Blob} file - Uploaded photo file
 * @param {Object} [options]
 * @param {string|null} [options.caption]
 * @param {number|null} [options.displayOrder]
 * @param {string|null} [options.requestedBusinessId]
 */
export async function uploadGalleryPhoto(userId, file, { caption = null, displayOrder = null, requestedBusinessId = null } = {}) {
    // 1. Validate file constraints
    const fileValidation = validateImageFile(file, {
        maxSize: MAX_PHOTO_SIZE_BYTES,
        label: "Gallery photo"
    });
    if (!fileValidation.valid) {
        return { success: false, status: 400, error: fileValidation.error };
    }

    // 2. Validate caption
    const captionValidation = validateCaption(caption);
    if (!captionValidation.valid) {
        return { success: false, status: 400, error: captionValidation.error };
    }

    // 3. Authorize business ownership
    const auth = await getVendorBusiness(userId, requestedBusinessId);
    if (!auth.success) return auth;

    const business = auth.business;

    // 4. Check gallery photo count limit
    let currentPhotoCount = 0;
    try {
        const { count, error: countError } = await supabaseAdmin
            .from('business_photos')
            .select('*', { count: 'exact', head: true })
            .eq('business_id', business.id);

        if (!countError && typeof count === 'number') {
            currentPhotoCount = count;
            if (currentPhotoCount >= MAX_GALLERY_PHOTOS) {
                return {
                    success: false,
                    status: 400,
                    error: `Maximum gallery limit of ${MAX_GALLERY_PHOTOS} photos reached. Delete existing photos to add new ones.`
                };
            }
        }
    } catch {
        // Table not yet migrated
    }

    // 5. Determine display order
    let resolvedOrder = 0;
    if (displayOrder !== null && displayOrder !== undefined && displayOrder !== '') {
        const orderValidation = validateDisplayOrder(displayOrder);
        if (!orderValidation.valid) {
            return { success: false, status: 400, error: orderValidation.error };
        }
        resolvedOrder = orderValidation.order;
    } else {
        resolvedOrder = currentPhotoCount;
    }

    // 6. Upload photo to Cloudinary
    let uploadResult;
    try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        uploadResult = await uploadBufferToCloudinary(buffer, {
            folder: 'businesses/photos',
            tags: ['business_photo', `biz_${business.id}`]
        });
    } catch (uploadErr) {
        console.error("Cloudinary photo upload failed:", uploadErr);
        return { success: false, status: 502, error: "Failed to upload photo to media storage" };
    }

    // 7. Insert photo record into business_photos
    const { data: photoRecord, error: dbError } = await supabaseAdmin
        .from('business_photos')
        .insert({
            business_id: business.id,
            image_url: uploadResult.secure_url,
            public_id: uploadResult.public_id,
            caption: captionValidation.sanitized,
            display_order: resolvedOrder
        })
        .select('id, image_url, caption, display_order, created_at')
        .single();

    if (dbError) {
        console.error("Database insert for business photo failed:", dbError);
        // Roll back Cloudinary asset
        await safeDeleteFromCloudinary(uploadResult.public_id);
        return { success: false, status: 500, error: "Failed to save photo metadata" };
    }

    return {
        success: true,
        photo: {
            id: photoRecord.id,
            imageUrl: photoRecord.image_url,
            caption: photoRecord.caption,
            displayOrder: photoRecord.display_order,
            createdAt: photoRecord.created_at
        },
        message: "Photo uploaded successfully"
    };
}

/**
 * Deletes a gallery photo belonging to the vendor's business.
 *
 * Security:
 * - Verifies user owns the business.
 * - Verifies the photo belongs to the user's business before deletion.
 * - Prevents deleting another vendor's photos under all circumstances.
 * - Deletes from DB first; only deletes from Cloudinary if DB deletion succeeds.
 *
 * @param {string} userId - Authenticated user ID
 * @param {string} photoId - Photo UUID
 */
export async function deleteGalleryPhoto(userId, photoId) {
    if (!userId) {
        return { success: false, status: 401, error: "Authentication required" };
    }

    if (!photoId) {
        return { success: false, status: 400, error: "Photo ID is required" };
    }

    // 1. Authorize: verify user owns a business
    const auth = await getVendorBusiness(userId);
    if (!auth.success) {
        return auth;
    }
    const business = auth.business;

    // 2. Authorize: verify photo exists and belongs to this business
    let photo = null;
    try {
        const { data: photoData, error: lookupError } = await supabaseAdmin
            .from('business_photos')
            .select('id, business_id, public_id')
            .eq('id', photoId)
            .maybeSingle();

        if (lookupError) {
            if (lookupError.code === '42P01' || lookupError.code === 'PGRST200' || lookupError.message?.includes('business_photos')) {
                return {
                    success: false,
                    status: 404,
                    error: "Photo not found or does not belong to your business"
                };
            }
            console.error("Error looking up gallery photo:", lookupError);
            return { success: false, status: 500, error: "Failed to verify photo ownership" };
        }

        photo = photoData;
    } catch {
        return {
            success: false,
            status: 404,
            error: "Photo not found or does not belong to your business"
        };
    }

    if (!photo || photo.business_id !== business.id) {
        return {
            success: false,
            status: 404,
            error: "Photo not found or does not belong to your business"
        };
    }

    // 3. Delete photo record from DB first
    const { error: dbError } = await supabaseAdmin
        .from('business_photos')
        .delete()
        .eq('id', photoId)
        .eq('business_id', business.id);

    if (dbError) {
        console.error("Database deletion of business photo failed:", dbError);
        return { success: false, status: 500, error: "Failed to delete photo from database" };
    }

    // 4. DB deletion succeeded -> safely delete asset from Cloudinary
    if (photo.public_id) {
        await safeDeleteFromCloudinary(photo.public_id);
    }

    return {
        success: true,
        message: "Photo deleted successfully"
    };
}
