package com.localgrow.v2.business.dto;

import com.localgrow.v2.coupon.dto.ActiveOfferDto;

import java.util.List;
import java.util.UUID;

public record NearbyBusinessDto(
        UUID businessId,
        String name,
        String description,
        UUID locationId,
        String address,
        String area,
        String city,
        String state,
        String postalCode,
        Double latitude,
        Double longitude,
        Double distanceKm,
        CategoryDto category,
        List<ActiveOfferDto> activeOffers,
        OperatingHoursStatusDto operatingHours,
        String logoUrl,
        String photoUrl,
        ReviewSummaryDto ratingSummary
) {
    /**
     * Backward-compatible constructor for 15-argument callers.
     */
    public NearbyBusinessDto(
            UUID businessId,
            String name,
            String description,
            UUID locationId,
            String address,
            String area,
            String city,
            String state,
            String postalCode,
            Double latitude,
            Double longitude,
            Double distanceKm,
            CategoryDto category,
            List<ActiveOfferDto> activeOffers,
            OperatingHoursStatusDto operatingHours
    ) {
        this(
                businessId,
                name,
                description,
                locationId,
                address,
                area,
                city,
                state,
                postalCode,
                latitude,
                longitude,
                distanceKm,
                category,
                activeOffers,
                operatingHours,
                null,
                null,
                ReviewSummaryDto.empty()
        );
    }

    /**
     * Backward-compatible constructor for 14-argument callers.
     * Defaults {@code operatingHours} to {@link OperatingHoursStatusDto#unconfigured()}.
     */
    public NearbyBusinessDto(
            UUID businessId,
            String name,
            String description,
            UUID locationId,
            String address,
            String area,
            String city,
            String state,
            String postalCode,
            Double latitude,
            Double longitude,
            Double distanceKm,
            CategoryDto category,
            List<ActiveOfferDto> activeOffers
    ) {
        this(
                businessId,
                name,
                description,
                locationId,
                address,
                area,
                city,
                state,
                postalCode,
                latitude,
                longitude,
                distanceKm,
                category,
                activeOffers,
                OperatingHoursStatusDto.unconfigured(),
                null,
                null,
                ReviewSummaryDto.empty()
        );
    }
}

