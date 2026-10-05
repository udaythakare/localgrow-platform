package com.localgrow.v2.business.dto;

import com.localgrow.v2.business.entity.BusinessHourEntity;

import java.time.LocalTime;

/**
 * DTO representing an operating schedule for a single ISO weekday (Monday = 1 .. Sunday = 7).
 */
public record OperatingHoursDto(
        int dayOfWeek,
        LocalTime openTime,
        LocalTime closeTime,
        boolean isClosed,
        boolean is24Hours
) {
    public static OperatingHoursDto fromEntity(BusinessHourEntity entity) {
        if (entity == null) {
            return null;
        }
        return new OperatingHoursDto(
                entity.getDayOfWeek(),
                entity.getOpenTime(),
                entity.getCloseTime(),
                entity.isClosed(),
                entity.is24Hours()
        );
    }
}
