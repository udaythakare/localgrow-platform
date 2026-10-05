/**
 * Review validation helpers for LocalGrow customer reviews.
 */

/**
 * Validates rating and comment for customer reviews.
 * - Rating: required, integer between 1 and 5.
 * - Comment: optional, string max 1000 characters.
 * 
 * @param {number} rating 
 * @param {string|null|undefined} comment 
 * @returns {{ valid: boolean, message?: string }}
 */
export function validateReviewInput(rating, comment) {
    if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) {
        return { valid: false, message: 'Rating must be an integer between 1 and 5' };
    }
    if (comment !== null && comment !== undefined && typeof comment === 'string' && comment.length > 1000) {
        return { valid: false, message: 'Comment cannot exceed 1000 characters' };
    }
    return { valid: true };
}

/**
 * Normalizes and validates the user ID returned by authentication session helpers.
 * Returns a valid non-empty string user ID, or null if the user is unauthenticated or invalid.
 * 
 * @param {unknown} rawUserId 
 * @returns {string|null}
 */
export function normalizeUserId(rawUserId) {
    if (typeof rawUserId === 'string' && rawUserId.trim().length > 0) {
        return rawUserId.trim();
    }
    return null;
}
