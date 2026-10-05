package com.localgrow.v2.business.dto;

import java.util.List;

/**
 * Paginated response wrapper for customer reviews with pagination metadata and rating summary.
 */
public record BusinessReviewPageResponse(
        List<BusinessReviewDto> content,
        int page,
        int size,
        long totalElements,
        int totalPages,
        ReviewSummaryDto summary
) {
    public BusinessReviewPageResponse(
            List<BusinessReviewDto> content,
            int page,
            int size,
            long totalElements,
            int totalPages
    ) {
        this(content, page, size, totalElements, totalPages, null);
    }
}
