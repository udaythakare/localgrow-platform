package com.localgrow.v2.coupon.dto;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Customer-safe, read-only projection of an active coupon offer.
 * Deliberately omits: user_id, internal ownership, service-role fields.
 */
public record ActiveOfferDto(
        UUID id,
        String title,
        String description,
        String couponType,
        Integer maxClaims,
        Integer currentClaims,
        LocalDateTime endDate,
        String redemptionTimeType,
        String redemptionStartTime,
        String redemptionEndTime,
        String imageUrl
) {
    /**
     * Backward-compatible constructor for 10-argument callers.
     */
    public ActiveOfferDto(
            UUID id,
            String title,
            String description,
            String couponType,
            Integer maxClaims,
            Integer currentClaims,
            LocalDateTime endDate,
            String redemptionTimeType,
            String redemptionStartTime,
            String redemptionEndTime
    ) {
        this(id, title, description, couponType, maxClaims, currentClaims, endDate,
                redemptionTimeType, redemptionStartTime, redemptionEndTime, null);
    }
}
