package com.localgrow.v2.business.repository;

import com.localgrow.v2.business.dto.BusinessReviewDto;
import com.localgrow.v2.business.dto.ReviewSummaryDto;

import java.util.List;
import java.util.UUID;

/**
 * Repository interface for customer reviews and dynamic rating summary retrieval.
 */
public interface ReviewRepository {

    /**
     * Calculates the dynamic average rating (rounded to 1 decimal place) and total review count
     * for a business from {@code public.business_reviews}.
     *
     * @param businessId ID of the business
     * @return ReviewSummaryDto containing dynamic averageRating and totalReviews
     */
    ReviewSummaryDto getReviewSummary(UUID businessId);

    /**
     * Retrieves paginated reviews with deterministic ordering (newest first, id tie-breaker)
     * joined with {@code public.users} to obtain reviewer display names.
     *
     * @param businessId ID of the business
     * @param limit maximum records to return
     * @param offset record offset for pagination
     * @return ordered list of BusinessReviewDto
     */
    List<BusinessReviewDto> findReviewsByBusinessId(UUID businessId, int limit, int offset);

    /**
     * Returns total review count for a business.
     *
     * @param businessId ID of the business
     * @return total review count
     */
    long countReviewsByBusinessId(UUID businessId);
}
