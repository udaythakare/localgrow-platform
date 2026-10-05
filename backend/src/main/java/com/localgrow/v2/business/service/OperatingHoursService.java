package com.localgrow.v2.business.service;

import com.localgrow.v2.business.dto.OperatingHoursDto;
import com.localgrow.v2.business.dto.OperatingHoursStatusDto;
import com.localgrow.v2.business.entity.BusinessHourEntity;
import com.localgrow.v2.business.repository.BusinessHourRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.DateTimeException;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Service for managing, batch-loading, and evaluating business operating hours.
 *
 * <p>Evaluation is strictly timezone-aware and deterministic, driven by an injected
 * {@link Clock}. The JVM default timezone is never referenced.</p>
 */
@Service
@Transactional(readOnly = true)
public class OperatingHoursService {

    private static final Logger log = LoggerFactory.getLogger(OperatingHoursService.class);

    public static final ZoneId DEFAULT_ZONE = ZoneId.of("Asia/Kolkata");
    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm");

    private final BusinessHourRepository businessHourRepository;
    private final Clock clock;

    public OperatingHoursService(BusinessHourRepository businessHourRepository, Clock clock) {
        this.businessHourRepository = businessHourRepository;
        this.clock = clock;
    }

    /**
     * Batch-loads operating hours for a collection of location IDs in a single query
     * and evaluates each location's current open/closed status.
     *
     * <p>Performance guarantee: exactly one query is executed for the entire batch (zero N+1).</p>
     *
     * @param locationIds list of location IDs
     * @return map of locationId -> OperatingHoursStatusDto; unconfigured locations return
     *         {@link OperatingHoursStatusDto#unconfigured()}
     */
    public Map<UUID, OperatingHoursStatusDto> getOperatingHoursForLocations(Collection<UUID> locationIds) {
        if (locationIds == null || locationIds.isEmpty()) {
            return Collections.emptyMap();
        }

        // 1. Single batch query for all schedules
        List<BusinessHourEntity> allHours = businessHourRepository.findByLocationIdIn(locationIds);

        // 2. Fetch location timezones safely
        Map<UUID, String> timezoneByLocation = loadTimezonesSafely(locationIds);

        // 3. Group by locationId
        Map<UUID, List<BusinessHourEntity>> grouped = allHours.stream()
                .collect(Collectors.groupingBy(BusinessHourEntity::getLocationId));

        Map<UUID, OperatingHoursStatusDto> result = new HashMap<>();

        for (UUID locId : locationIds) {
            List<BusinessHourEntity> schedule = grouped.get(locId);
            if (schedule == null || schedule.isEmpty()) {
                result.put(locId, OperatingHoursStatusDto.unconfigured());
            } else {
                String tzStr = timezoneByLocation.get(locId);
                result.put(locId, evaluateLocationSchedule(schedule, tzStr));
            }
        }

        return result;
    }

    /**
     * Loads and evaluates operating hours for a single location.
     *
     * @param locationId location ID
     * @return OperatingHoursStatusDto; defaults to unconfigured if locationId is null or has no schedule
     */
    public OperatingHoursStatusDto getOperatingHoursForLocation(UUID locationId) {
        if (locationId == null) {
            return OperatingHoursStatusDto.unconfigured();
        }
        return getOperatingHoursForLocations(List.of(locationId))
                .getOrDefault(locationId, OperatingHoursStatusDto.unconfigured());
    }

    /**
     * Evaluates a single location's operating schedule against the current time in the given timezone.
     *
     * @param schedule weekly schedule records
     * @param timezone IANA timezone identifier string
     * @return evaluation status DTO
     */
    public OperatingHoursStatusDto evaluateLocationSchedule(List<BusinessHourEntity> schedule, String timezone) {
        return evaluateLocationSchedule(schedule, timezone, clock.instant());
    }

    /**
     * Package-private evaluation method accepting an explicit {@link Instant} for unit testing.
     */
    public OperatingHoursStatusDto evaluateLocationSchedule(List<BusinessHourEntity> schedule, String timezone, Instant nowInstant) {
        if (schedule == null || schedule.isEmpty()) {
            return OperatingHoursStatusDto.unconfigured();
        }

        ZoneId zoneId = resolveZoneId(timezone);
        ZonedDateTime zdt = nowInstant.atZone(zoneId);
        LocalTime nowTime = zdt.toLocalTime();
        int todayDow = zdt.getDayOfWeek().getValue(); // 1 = Monday .. 7 = Sunday
        int yesterdayDow = todayDow == 1 ? 7 : todayDow - 1;

        // Index schedule by weekday (1..7)
        Map<Integer, BusinessHourEntity> scheduleByDay = schedule.stream()
                .collect(Collectors.toMap(
                        BusinessHourEntity::getDayOfWeek,
                        e -> e,
                        (existing, replacement) -> existing
                ));

        BusinessHourEntity today = scheduleByDay.get(todayDow);
        BusinessHourEntity yesterday = scheduleByDay.get(yesterdayDow);

        boolean isOpen = false;
        String statusText;

        // ── Rule 1: Check spillover from yesterday's overnight shift ─────────
        // An overnight shift from yesterday has openTime > closeTime and extends
        // past midnight until closeTime on today. Boundary: closed at exactly closeTime.
        if (yesterday != null && !yesterday.isClosed() && !yesterday.is24Hours()) {
            if (yesterday.getOpenTime().isAfter(yesterday.getCloseTime())) {
                if (nowTime.isBefore(yesterday.getCloseTime())) {
                    isOpen = true;
                }
            }
        }

        // ── Rule 2: Check today's shift (if not already open via spillover) ──
        if (!isOpen && today != null && !today.isClosed()) {
            if (today.is24Hours()) {
                // 24-hour schedule is open all day
                isOpen = true;
            } else if (today.getOpenTime().isBefore(today.getCloseTime())) {
                // Normal same-day shift: [openTime, closeTime)
                // Boundary: open at exactly openTime, closed at exactly closeTime
                if (!nowTime.isBefore(today.getOpenTime()) && nowTime.isBefore(today.getCloseTime())) {
                    isOpen = true;
                }
            } else if (today.getOpenTime().isAfter(today.getCloseTime())) {
                // Overnight shift starting today: open from openTime through midnight
                if (!nowTime.isBefore(today.getOpenTime())) {
                    isOpen = true;
                }
            }
            // Note: If openTime == closeTime and !is24Hours, it evaluates as closed.
        }

        // ── Human-readable statusText computation ───────────────────────────
        if (isOpen) {
            if (today != null && today.is24Hours()) {
                statusText = "Open 24 hours";
            } else if (yesterday != null && !yesterday.isClosed() && !yesterday.is24Hours()
                    && yesterday.getOpenTime().isAfter(yesterday.getCloseTime())
                    && nowTime.isBefore(yesterday.getCloseTime())) {
                // Currently in yesterday's overnight spillover
                statusText = "Open now • Closes at " + TIME_FMT.format(yesterday.getCloseTime());
            } else if (today != null) {
                statusText = "Open now • Closes at " + TIME_FMT.format(today.getCloseTime());
            } else {
                statusText = "Open now";
            }
        } else {
            if (today == null || today.isClosed()) {
                statusText = "Closed today";
            } else if (nowTime.isBefore(today.getOpenTime())) {
                statusText = "Closed • Opens today at " + TIME_FMT.format(today.getOpenTime());
            } else {
                // Closed for the day; find next opening day
                int tomorrowDow = todayDow == 7 ? 1 : todayDow + 1;
                BusinessHourEntity tomorrow = scheduleByDay.get(tomorrowDow);
                if (tomorrow != null && !tomorrow.isClosed()) {
                    if (tomorrow.is24Hours()) {
                        statusText = "Closed • Opens tomorrow at 00:00";
                    } else {
                        statusText = "Closed • Opens tomorrow at " + TIME_FMT.format(tomorrow.getOpenTime());
                    }
                } else {
                    statusText = "Closed";
                }
            }
        }

        // Build DTOs
        OperatingHoursDto todayDto = today != null ? OperatingHoursDto.fromEntity(today) : null;
        List<OperatingHoursDto> weekly = schedule.stream()
                .sorted(Comparator.comparingInt(BusinessHourEntity::getDayOfWeek))
                .map(OperatingHoursDto::fromEntity)
                .toList();

        return new OperatingHoursStatusDto(
                true,
                isOpen,
                statusText,
                todayDto,
                weekly
        );
    }

    /**
     * Resolves an IANA timezone identifier safely. If null, blank, or invalid,
     * logs a warning and falls back to {@link #DEFAULT_ZONE} (Asia/Kolkata).
     */
    public ZoneId resolveZoneId(String timezone) {
        if (timezone == null || timezone.isBlank()) {
            return DEFAULT_ZONE;
        }
        try {
            return ZoneId.of(timezone.trim());
        } catch (DateTimeException e) {
            log.warn("Invalid timezone identifier '{}', falling back to {}", timezone, DEFAULT_ZONE);
            return DEFAULT_ZONE;
        }
    }

    // ── Safe timezone loader ─────────────────────────────────────────────────

    private Map<UUID, String> loadTimezonesSafely(Collection<UUID> locationIds) {
        if (locationIds == null || locationIds.isEmpty()) {
            return Collections.emptyMap();
        }
        Map<UUID, String> map = new HashMap<>();
        try {
            List<Object[]> rows = businessHourRepository.findTimezonesByLocationIds(locationIds);
            if (rows != null) {
                for (Object[] row : rows) {
                    if (row != null && row.length >= 2) {
                        UUID id = null;
                        if (row[0] instanceof UUID u) {
                            id = u;
                        } else if (row[0] instanceof String s) {
                            id = UUID.fromString(s);
                        }
                        String tz = row[1] != null ? row[1].toString() : null;
                        if (id != null && tz != null && !tz.isBlank()) {
                            map.put(id, tz);
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.debug("Unable to read location timezones from database, defaulting to {}: {}",
                    DEFAULT_ZONE, e.getMessage());
        }
        return map;
    }
}
