package com.localgrow.v2.business.dto;

import java.util.List;

/**
 * DTO representing the operating-hours status of a location, including whether
 * the store is currently open, a representation of today's schedule, and human-readable copy.
 */
public record OperatingHoursStatusDto(
        boolean hasHoursConfigured,
        Boolean isOpenNow,
        String statusText,
        OperatingHoursDto todaySchedule,
        List<OperatingHoursDto> weeklySchedule
) {
    /**
     * Returns an explicit unconfigured state when a location has no schedule rows.
     *
     * <p>{@code isOpenNow} is strictly {@code null} to signify unconfigured rather than
     * falsely claiming the store is open or closed.</p>
     */
    public static OperatingHoursStatusDto unconfigured() {
        return new OperatingHoursStatusDto(
                false,
                null,
                "Hours not configured",
                null,
                List.of()
        );
    }
}
