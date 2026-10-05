package com.localgrow.v2.business.dto;

import com.localgrow.v2.business.entity.BusinessLocationEntity;

import java.util.UUID;

public record BusinessLocationDto(
        UUID id,
        String address,
        String area,
        String city,
        String state,
        String postalCode,
        String country,
        Double latitude,
        Double longitude,
        boolean isPrimary
) {
    public static BusinessLocationDto fromEntity(BusinessLocationEntity entity) {
        if (entity == null) {
            return null;
        }
        Double lat = entity.getLatitude() != null ? entity.getLatitude().doubleValue() : null;
        Double lng = entity.getLongitude() != null ? entity.getLongitude().doubleValue() : null;
        boolean primary = Boolean.TRUE.equals(entity.getIsPrimary());

        return new BusinessLocationDto(
                entity.getId(),
                entity.getAddress(),
                entity.getArea(),
                entity.getCity(),
                entity.getState(),
                entity.getPostalCode(),
                entity.getCountry(),
                lat,
                lng,
                primary
        );
    }
}
