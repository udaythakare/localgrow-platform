package com.localgrow.v2.business.dto;

import com.localgrow.v2.coupon.dto.ActiveOfferDto;

import java.util.List;
import java.util.UUID;

/**
 * Public customer-facing projection of business details, including branding logo and ordered photos.
 *
 * <p>Deliberately omits vendor user_id, approval status, rejection reasons, and Cloudinary public IDs.</p>
 */
public record BusinessDetailsDto(
        UUID id,
        String name,
        String description,
        CategoryDto category,
        String logoUrl,
        String phone,
        String email,
        String website,
        List<BusinessLocationDto> locations,
        BusinessLocationDto selectedLocation,
        OperatingHoursStatusDto operatingHours,
        List<ActiveOfferDto> activeOffers,
        List<BusinessPhotoDto> photos,
        ReviewSummaryDto ratingSummary
) {
    /**
     * Backward-compatible constructor for 13-argument callers (Sprint 9).
     * Defaults {@code ratingSummary} to empty.
     */
    public BusinessDetailsDto(
            UUID id,
            String name,
            String description,
            CategoryDto category,
            String logoUrl,
            String phone,
            String email,
            String website,
            List<BusinessLocationDto> locations,
            BusinessLocationDto selectedLocation,
            OperatingHoursStatusDto operatingHours,
            List<ActiveOfferDto> activeOffers,
            List<BusinessPhotoDto> photos
    ) {
        this(id, name, description, category, logoUrl, phone, email, website,
                locations, selectedLocation, operatingHours, activeOffers, photos, ReviewSummaryDto.empty());
    }

    /**
     * Backward-compatible constructor for 11-argument callers (Sprint 8).
     * Defaults {@code logoUrl} to {@code null}, {@code photos} to an empty list, and {@code ratingSummary} to empty.
     */
    public BusinessDetailsDto(
            UUID id,
            String name,
            String description,
            CategoryDto category,
            String phone,
            String email,
            String website,
            List<BusinessLocationDto> locations,
            BusinessLocationDto selectedLocation,
            OperatingHoursStatusDto operatingHours,
            List<ActiveOfferDto> activeOffers
    ) {
        this(id, name, description, category, null, phone, email, website,
                locations, selectedLocation, operatingHours, activeOffers, List.of(), ReviewSummaryDto.empty());
    }
}
