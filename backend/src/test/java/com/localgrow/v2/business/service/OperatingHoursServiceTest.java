package com.localgrow.v2.business.service;

import com.localgrow.v2.business.dto.OperatingHoursStatusDto;
import com.localgrow.v2.business.entity.BusinessHourEntity;
import com.localgrow.v2.business.repository.BusinessHourRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class OperatingHoursServiceTest {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    @Mock
    private BusinessHourRepository businessHourRepository;

    private OperatingHoursService operatingHoursService;

    @BeforeEach
    void setUp() {
        // Use system UTC clock by default in service; tests pass explicit Instants for determinism
        operatingHoursService = new OperatingHoursService(businessHourRepository, Clock.systemUTC());
    }

    // ── Helper to build entity ───────────────────────────────────────────────

    private BusinessHourEntity makeHour(UUID locationId, int dayOfWeek,
                                        LocalTime open, LocalTime close,
                                        boolean isClosed, boolean is24Hours) {
        return new BusinessHourEntity(
                UUID.randomUUID(),
                locationId,
                dayOfWeek,
                open,
                close,
                isClosed,
                is24Hours
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Normal opening-hours boundaries
    // ─────────────────────────────────────────────────────────────────────────
    @Test
    @DisplayName("1. Normal opening-hours: open at open_time, open during interval, closed before open_time")
    void normalOpeningHoursBoundaries() {
        UUID locId = UUID.randomUUID();
        // Monday (day 1): 09:00 to 17:00
        List<BusinessHourEntity> schedule = List.of(
                makeHour(locId, 1, LocalTime.of(9, 0), LocalTime.of(17, 0), false, false)
        );

        // 2026-09-28 is a Monday
        // 08:59:59 IST -> Closed
        Instant beforeOpen = Instant.parse("2026-09-28T03:29:59Z"); // 08:59:59 IST
        OperatingHoursStatusDto statusBefore = operatingHoursService.evaluateLocationSchedule(schedule, "Asia/Kolkata", beforeOpen);
        assertThat(statusBefore.isOpenNow()).isFalse();
        assertThat(statusBefore.statusText()).contains("Closed • Opens today at 09:00");

        // 09:00:00 IST -> Open (inclusive start)
        Instant atOpen = Instant.parse("2026-09-28T03:30:00Z"); // 09:00:00 IST
        OperatingHoursStatusDto statusAtOpen = operatingHoursService.evaluateLocationSchedule(schedule, "Asia/Kolkata", atOpen);
        assertThat(statusAtOpen.isOpenNow()).isTrue();
        assertThat(statusAtOpen.statusText()).isEqualTo("Open now • Closes at 17:00");

        // 12:00:00 IST -> Open
        Instant midday = Instant.parse("2026-09-28T06:30:00Z"); // 12:00:00 IST
        OperatingHoursStatusDto statusMidday = operatingHoursService.evaluateLocationSchedule(schedule, "Asia/Kolkata", midday);
        assertThat(statusMidday.isOpenNow()).isTrue();

        // 16:59:59 IST -> Open
        Instant justBeforeClose = Instant.parse("2026-09-28T11:29:59Z"); // 16:59:59 IST
        OperatingHoursStatusDto statusJustBefore = operatingHoursService.evaluateLocationSchedule(schedule, "Asia/Kolkata", justBeforeClose);
        assertThat(statusJustBefore.isOpenNow()).isTrue();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Closed weekday
    // ─────────────────────────────────────────────────────────────────────────
    @Test
    @DisplayName("2. Closed weekday: explicitly closed day evaluates to closed")
    void closedWeekday() {
        UUID locId = UUID.randomUUID();
        // Tuesday (day 2): isClosed = true
        List<BusinessHourEntity> schedule = List.of(
                makeHour(locId, 2, LocalTime.MIDNIGHT, LocalTime.MIDNIGHT, true, false)
        );

        // 2026-09-29 is a Tuesday
        Instant tuesdayNoon = Instant.parse("2026-09-29T06:30:00Z"); // 12:00:00 IST
        OperatingHoursStatusDto status = operatingHoursService.evaluateLocationSchedule(schedule, "Asia/Kolkata", tuesdayNoon);

        assertThat(status.isOpenNow()).isFalse();
        assertThat(status.hasHoursConfigured()).isTrue();
        assertThat(status.statusText()).isEqualTo("Closed today");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. 24-hour schedule
    // ─────────────────────────────────────────────────────────────────────────
    @Test
    @DisplayName("3. 24-hour schedule: open at start of day, midday, and end of day")
    void twentyFourHourSchedule() {
        UUID locId = UUID.randomUUID();
        // Wednesday (day 3): is24Hours = true
        List<BusinessHourEntity> schedule = List.of(
                makeHour(locId, 3, LocalTime.MIDNIGHT, LocalTime.of(23, 59, 59), false, true)
        );

        // 2026-09-30 is a Wednesday
        // Midnight IST (00:00:00)
        Instant startOfDay = Instant.parse("2026-09-29T18:30:00Z");
        OperatingHoursStatusDto statusStart = operatingHoursService.evaluateLocationSchedule(schedule, "Asia/Kolkata", startOfDay);
        assertThat(statusStart.isOpenNow()).isTrue();
        assertThat(statusStart.statusText()).isEqualTo("Open 24 hours");

        // Midday IST (12:00:00)
        Instant midday = Instant.parse("2026-09-30T06:30:00Z");
        OperatingHoursStatusDto statusMidday = operatingHoursService.evaluateLocationSchedule(schedule, "Asia/Kolkata", midday);
        assertThat(statusMidday.isOpenNow()).isTrue();

        // End of day IST (23:59:59)
        Instant endOfDay = Instant.parse("2026-09-30T18:29:59Z");
        OperatingHoursStatusDto statusEnd = operatingHoursService.evaluateLocationSchedule(schedule, "Asia/Kolkata", endOfDay);
        assertThat(statusEnd.isOpenNow()).isTrue();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Overnight opening before midnight
    // ─────────────────────────────────────────────────────────────────────────
    @Test
    @DisplayName("4. Overnight opening before midnight: open from open_time through 23:59:59")
    void overnightOpeningBeforeMidnight() {
        UUID locId = UUID.randomUUID();
        // Thursday (day 4): 20:00 to 02:00 (overnight)
        List<BusinessHourEntity> schedule = List.of(
                makeHour(locId, 4, LocalTime.of(20, 0), LocalTime.of(2, 0), false, false)
        );

        // 2026-10-01 is a Thursday
        // 19:59:59 IST -> Closed
        Instant beforeShift = Instant.parse("2026-10-01T14:29:59Z"); // 19:59:59 IST
        OperatingHoursStatusDto statusBefore = operatingHoursService.evaluateLocationSchedule(schedule, "Asia/Kolkata", beforeShift);
        assertThat(statusBefore.isOpenNow()).isFalse();

        // 20:00:00 IST -> Open
        Instant atShift = Instant.parse("2026-10-01T14:30:00Z"); // 20:00:00 IST
        OperatingHoursStatusDto statusAt = operatingHoursService.evaluateLocationSchedule(schedule, "Asia/Kolkata", atShift);
        assertThat(statusAt.isOpenNow()).isTrue();
        assertThat(statusAt.statusText()).isEqualTo("Open now • Closes at 02:00");

        // 23:59:59 IST -> Open
        Instant lateNight = Instant.parse("2026-10-01T18:29:59Z"); // 23:59:59 IST
        OperatingHoursStatusDto statusLate = operatingHoursService.evaluateLocationSchedule(schedule, "Asia/Kolkata", lateNight);
        assertThat(statusLate.isOpenNow()).isTrue();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. Overnight spillover after midnight
    // ─────────────────────────────────────────────────────────────────────────
    @Test
    @DisplayName("5. Overnight spillover after midnight: open in early morning from yesterday's shift")
    void overnightSpilloverAfterMidnight() {
        UUID locId = UUID.randomUUID();
        // Thursday (day 4): 20:00 to 02:00
        // Friday (day 5): 09:00 to 17:00
        List<BusinessHourEntity> schedule = List.of(
                makeHour(locId, 4, LocalTime.of(20, 0), LocalTime.of(2, 0), false, false),
                makeHour(locId, 5, LocalTime.of(9, 0), LocalTime.of(17, 0), false, false)
        );

        // 2026-10-02 is Friday
        // 00:30:00 IST Friday -> Open (spillover from Thursday)
        Instant spillover1 = Instant.parse("2026-10-01T19:00:00Z"); // 00:30:00 IST
        OperatingHoursStatusDto status1 = operatingHoursService.evaluateLocationSchedule(schedule, "Asia/Kolkata", spillover1);
        assertThat(status1.isOpenNow()).isTrue();
        assertThat(status1.statusText()).isEqualTo("Open now • Closes at 02:00");

        // 01:59:59 IST Friday -> Open (spillover still active)
        Instant spillover2 = Instant.parse("2026-10-01T20:29:59Z"); // 01:59:59 IST
        OperatingHoursStatusDto status2 = operatingHoursService.evaluateLocationSchedule(schedule, "Asia/Kolkata", spillover2);
        assertThat(status2.isOpenNow()).isTrue();

        // 02:00:00 IST Friday -> Closed (Thursday spillover ended, Friday shift starts at 09:00)
        Instant afterSpillover = Instant.parse("2026-10-01T20:30:00Z"); // 02:00:00 IST
        OperatingHoursStatusDto status3 = operatingHoursService.evaluateLocationSchedule(schedule, "Asia/Kolkata", afterSpillover);
        assertThat(status3.isOpenNow()).isFalse();
        assertThat(status3.statusText()).isEqualTo("Closed • Opens today at 09:00");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. Exact closing time boundary
    // ─────────────────────────────────────────────────────────────────────────
    @Test
    @DisplayName("6. Exact closing time: closed at exactly close_time")
    void exactClosingTime() {
        UUID locId = UUID.randomUUID();
        // Monday (day 1): 09:00 to 17:00
        List<BusinessHourEntity> schedule = List.of(
                makeHour(locId, 1, LocalTime.of(9, 0), LocalTime.of(17, 0), false, false)
        );

        // 2026-09-28 Monday at exactly 17:00:00 IST -> Closed
        Instant exactlyClose = Instant.parse("2026-09-28T11:30:00Z"); // 17:00:00 IST
        OperatingHoursStatusDto status = operatingHoursService.evaluateLocationSchedule(schedule, "Asia/Kolkata", exactlyClose);
        assertThat(status.isOpenNow()).isFalse();

        // 17:00:01 IST -> Closed
        Instant pastClose = Instant.parse("2026-09-28T11:30:01Z"); // 17:00:01 IST
        OperatingHoursStatusDto statusPast = operatingHoursService.evaluateLocationSchedule(schedule, "Asia/Kolkata", pastClose);
        assertThat(statusPast.isOpenNow()).isFalse();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 7. Unconfigured schedule
    // ─────────────────────────────────────────────────────────────────────────
    @Test
    @DisplayName("7. Unconfigured schedule: empty schedule returns hasHoursConfigured=false and isOpenNow=null")
    void unconfiguredSchedule() {
        OperatingHoursStatusDto status = operatingHoursService.evaluateLocationSchedule(
                Collections.emptyList(), "Asia/Kolkata", Instant.now()
        );

        assertThat(status.hasHoursConfigured()).isFalse();
        assertThat(status.isOpenNow()).isNull();
        assertThat(status.statusText()).isEqualTo("Hours not configured");
        assertThat(status.todaySchedule()).isNull();
        assertThat(status.weeklySchedule()).isEmpty();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 8. Invalid timezone fallback
    // ─────────────────────────────────────────────────────────────────────────
    @Test
    @DisplayName("8. Invalid timezone: falls back to Asia/Kolkata without throwing exception")
    void invalidTimezoneFallback() {
        UUID locId = UUID.randomUUID();
        List<BusinessHourEntity> schedule = List.of(
                makeHour(locId, 1, LocalTime.of(9, 0), LocalTime.of(17, 0), false, false)
        );

        // 2026-09-28 Monday 12:00:00 IST
        Instant middayIst = Instant.parse("2026-09-28T06:30:00Z");

        // Pass invalid timezone string
        OperatingHoursStatusDto status = operatingHoursService.evaluateLocationSchedule(
                schedule, "Invalid/Nonexistent_Timezone", middayIst
        );

        assertThat(status.hasHoursConfigured()).isTrue();
        assertThat(status.isOpenNow()).isTrue(); // evaluated using Asia/Kolkata fallback
        assertThat(status.statusText()).isEqualTo("Open now • Closes at 17:00");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 9. Missing weekday record
    // ─────────────────────────────────────────────────────────────────────────
    @Test
    @DisplayName("9. Missing weekday record: missing day treated as closed")
    void missingWeekdayRecord() {
        UUID locId = UUID.randomUUID();
        // Location configured for Monday and Friday only (Wednesday day 3 missing)
        List<BusinessHourEntity> schedule = List.of(
                makeHour(locId, 1, LocalTime.of(9, 0), LocalTime.of(17, 0), false, false),
                makeHour(locId, 5, LocalTime.of(9, 0), LocalTime.of(17, 0), false, false)
        );

        // 2026-09-30 is Wednesday (day 3)
        Instant wednesdayNoon = Instant.parse("2026-09-30T06:30:00Z");
        OperatingHoursStatusDto status = operatingHoursService.evaluateLocationSchedule(schedule, "Asia/Kolkata", wednesdayNoon);

        assertThat(status.hasHoursConfigured()).isTrue();
        assertThat(status.isOpenNow()).isFalse();
        assertThat(status.statusText()).isEqualTo("Closed today");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 10. Invalid schedule combinations
    // ─────────────────────────────────────────────────────────────────────────
    @Test
    @DisplayName("10. Invalid schedule combinations: equal open and close time without 24h flag evaluates as closed")
    void invalidScheduleCombinations_equalTimesNot24h() {
        UUID locId = UUID.randomUUID();
        // Monday with open_time == close_time (e.g. 09:00 == 09:00), is24Hours = false
        List<BusinessHourEntity> schedule = List.of(
                makeHour(locId, 1, LocalTime.of(9, 0), LocalTime.of(9, 0), false, false)
        );

        // 2026-09-28 Monday 09:00:00 IST
        Instant atNine = Instant.parse("2026-09-28T03:30:00Z");
        OperatingHoursStatusDto status = operatingHoursService.evaluateLocationSchedule(schedule, "Asia/Kolkata", atNine);

        // Must NOT accidentally mean 24 hours
        assertThat(status.isOpenNow()).isFalse();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Batch loading test (single query, zero N+1)
    // ─────────────────────────────────────────────────────────────────────────
    @Test
    @DisplayName("Batch loading: retrieves hours for multiple location IDs in one query")
    void batchLoading_retrievesInSingleQuery() {
        UUID loc1 = UUID.randomUUID();
        UUID loc2 = UUID.randomUUID();
        UUID locUnconfigured = UUID.randomUUID();

        List<BusinessHourEntity> hours = List.of(
                makeHour(loc1, 1, LocalTime.of(9, 0), LocalTime.of(17, 0), false, false),
                makeHour(loc2, 1, LocalTime.MIDNIGHT, LocalTime.of(23, 59, 59), false, true)
        );

        given(businessHourRepository.findByLocationIdIn(any())).willReturn(hours);
        given(businessHourRepository.findTimezonesByLocationIds(any())).willReturn(Collections.emptyList());

        Map<UUID, OperatingHoursStatusDto> result = operatingHoursService.getOperatingHoursForLocations(
                List.of(loc1, loc2, locUnconfigured)
        );

        verify(businessHourRepository).findByLocationIdIn(any());

        assertThat(result).hasSize(3);
        assertThat(result.get(loc1).hasHoursConfigured()).isTrue();
        assertThat(result.get(loc2).hasHoursConfigured()).isTrue();
        assertThat(result.get(locUnconfigured).hasHoursConfigured()).isFalse();
        assertThat(result.get(locUnconfigured).isOpenNow()).isNull();
    }
}
