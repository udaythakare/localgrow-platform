package com.localgrow.v2.business.dto;

/**
 * Aggregate rating summary calculated dynamically from public.business_reviews.
 *
 * @param averageRating Dynamic average rating rounded to 1 decimal place (1.0 to 5.0), or null if no reviews exist
 * @param totalReviews Total number of customer reviews for the business
 */
public record ReviewSummaryDto(
        Double averageRating,
        long totalReviews
) {
    public static ReviewSummaryDto empty() {
        return new ReviewSummaryDto(null, 0L);
    }
}
