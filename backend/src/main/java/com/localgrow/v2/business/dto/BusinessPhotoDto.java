package com.localgrow.v2.business.dto;

import com.localgrow.v2.business.entity.BusinessPhotoEntity;

import java.util.UUID;

/**
 * Customer-safe, read-only projection of a business gallery photo.
 *
 * <p>Deliberately omits Cloudinary public ID, internal ownership, and backend metadata.</p>
 */
public record BusinessPhotoDto(
        UUID id,
        String imageUrl,
        String caption,
        int displayOrder
) {
    public static BusinessPhotoDto fromEntity(BusinessPhotoEntity entity) {
        if (entity == null) {
            return null;
        }
        return new BusinessPhotoDto(
                entity.getId(),
                entity.getImageUrl(),
                entity.getCaption(),
                entity.getDisplayOrder()
        );
    }
}
