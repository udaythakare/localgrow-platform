import { z } from 'zod';

/**
 * MIME types allowed for business logos and gallery photos.
 */
export const ALLOWED_IMAGE_MIME_TYPES = Object.freeze([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp'
]);

/**
 * Maximum file size limits in bytes.
 */
export const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_GALLERY_PHOTOS = 10;
export const MAX_CAPTION_LENGTH = 150;

/**
 * Validates an uploaded File or Blob against MIME type and size constraints.
 *
 * @param {File|Blob|{type: string, size: number}} file - The file to validate
 * @param {Object} options - Validation options
 * @param {number} [options.maxSize] - Maximum allowed size in bytes
 * @param {string} [options.label] - Field label for error messages
 * @returns {{valid: boolean, error?: string}} Validation result
 */
export function validateImageFile(file, { maxSize = MAX_PHOTO_SIZE_BYTES, label = "Image" } = {}) {
    if (!file) {
        return { valid: false, error: `${label} file is required.` };
    }

    const mimeType = (file.type || '').toLowerCase();
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(mimeType)) {
        return {
            valid: false,
            error: `Invalid file format${mimeType ? ` (${mimeType})` : ''}. Allowed formats: JPEG, PNG, WebP.`
        };
    }

    if (typeof file.size === 'number') {
        if (file.size <= 0) {
            return { valid: false, error: `${label} file is empty (0 bytes).` };
        }
        if (file.size > maxSize) {
            const maxMb = Math.round(maxSize / (1024 * 1024));
            const actualMb = (file.size / (1024 * 1024)).toFixed(2);
            return {
                valid: false,
                error: `${label} file size exceeds the ${maxMb}MB limit (file is ${actualMb}MB).`
            };
        }
    }

    return { valid: true };
}

/**
 * Validates and sanitizes photo captions.
 *
 * @param {string|null|undefined} caption - Photo caption
 * @returns {{valid: boolean, sanitized?: string|null, error?: string}}
 */
export function validateCaption(caption) {
    if (caption === null || caption === undefined || caption === '') {
        return { valid: true, sanitized: null };
    }

    if (typeof caption !== 'string') {
        return { valid: false, error: "Caption must be text." };
    }

    const trimmed = caption.trim();
    if (trimmed.length > MAX_CAPTION_LENGTH) {
        return {
            valid: false,
            error: `Caption exceeds maximum length of ${MAX_CAPTION_LENGTH} characters (actual: ${trimmed.length}).`
        };
    }

    return { valid: true, sanitized: trimmed.length > 0 ? trimmed : null };
}

/**
 * Validates display order number.
 *
 * @param {number|string|null|undefined} displayOrder
 * @returns {{valid: boolean, order: number, error?: string}}
 */
export function validateDisplayOrder(displayOrder) {
    if (displayOrder === null || displayOrder === undefined || displayOrder === '') {
        return { valid: true, order: 0 };
    }
    const num = Number(displayOrder);
    if (!Number.isInteger(num) || num < 0) {
        return { valid: false, order: 0, error: "Display order must be a non-negative integer." };
    }
    return { valid: true, order: num };
}
