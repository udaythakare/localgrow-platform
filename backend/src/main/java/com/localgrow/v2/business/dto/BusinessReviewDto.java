package com.localgrow.v2.business.dto;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Public customer-facing projection of an individual business review.
 * Deliberately excludes sensitive customer account data (email, phone, password hash).
 */
public record BusinessReviewDto(
        UUID id,
        UUID businessId,
        UUID userId,
        String reviewerName,
        int rating,
        String comment,
        LocalDateTime createdAt
) {}
