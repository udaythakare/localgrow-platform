'use server';

import { getUserId } from '@/helpers/userHelper';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { revalidatePath } from 'next/cache';
import { validateReviewInput, normalizeUserId } from '@/helpers/reviewValidation';

/**
 * Submit or edit a customer review for a business.
 */
export async function submitReview(businessId, rating, comment = null) {
    const rawUserId = await getUserId();
    const userId = normalizeUserId(rawUserId);
    if (!userId) {
        return { success: false, message: 'Must be logged in to submit a review' };
    }

    const { valid, message } = validateReviewInput(rating, comment);
    if (!valid) {
        return { success: false, message };
    }

    // Server-side check: Business must exist and be approved
    const { data: business, error: bizError } = await supabaseAdmin
        .from('businesses')
        .select('status')
        .eq('id', businessId)
        .single();

    if (bizError || !business) {
        return { success: false, message: 'Business not found' };
    }

    if (business.status !== 'approved') {
        return { success: false, message: 'Cannot review an unapproved business' };
    }

    // Upsert the review using the unique constraint (business_id, user_id)
    const { data: review, error: upsertError } = await supabaseAdmin
        .from('business_reviews')
        .upsert({
            business_id: businessId,
            user_id: userId,
            rating: Math.floor(rating),
            comment: comment && comment.trim().length > 0 ? comment.trim() : null,
            updated_at: new Date().toISOString() // Let DB trigger handle updated_at, but we can pass it
        }, {
            onConflict: 'business_id, user_id',
        })
        .select()
        .single();

    if (upsertError) {
        console.error('Error submitting review:', upsertError);
        return { success: false, message: 'Failed to submit review' };
    }

    // Revalidate the business details page
    revalidatePath(`/businesses/${businessId}`);
    
    return { success: true, review };
}

/**
 * Fetch the current authenticated user's review for a given business.
 */
export async function getUserReview(businessId) {
    const rawUserId = await getUserId();
    const userId = normalizeUserId(rawUserId);
    if (!userId) {
        return { success: false, message: 'Not logged in', review: null, userId: null };
    }

    const { data: review, error } = await supabaseAdmin
        .from('business_reviews')
        .select('*')
        .eq('business_id', businessId)
        .eq('user_id', userId)
        .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is not found
        console.error('Error fetching user review:', error);
        return { success: false, message: 'Failed to fetch review', review: null };
    }

    return { success: true, review: review || null, userId };
}
