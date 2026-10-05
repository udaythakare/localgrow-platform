package com.localgrow.v2.coupon.service;

import com.localgrow.v2.coupon.dto.ActiveOfferDto;
import com.localgrow.v2.coupon.entity.CouponEntity;
import com.localgrow.v2.coupon.repository.CouponRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Read-only service for active coupon offers.
 *
 * <p>This service is the sole V2 access point for the V1 {@code coupons} table.
 * It never writes, claims, redeems, or modifies any coupon data.</p>
 *
 * <p><strong>Timezone:</strong> {@code start_date} / {@code end_date} are stored
 * as {@code TIMESTAMP WITHOUT TIME ZONE} in Asia/Kolkata (IST). All comparisons
 * are made against the current IST wall-clock time to avoid UTC-offset errors.</p>
 */
@Service
@Transactional(readOnly = true)
public class CouponService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm:ss");

    private final CouponRepository couponRepository;

    public CouponService(CouponRepository couponRepository) {
        this.couponRepository = couponRepository;
    }

    /**
     * Batch-fetches all currently active offers for the given business IDs and
     * groups them by {@code businessId}.
     *
     * <p>Security guarantee: callers must only pass business IDs that were already
     * returned by the nearby PostGIS query, which filters {@code status = 'approved'}.
     * This ensures rejected and pending business offers are never exposed.</p>
     *
     * <p>Performance guarantee: exactly one SQL query is issued regardless of the
     * number of business IDs supplied (no N+1).</p>
     *
     * @param businessIds list of approved-business IDs from the nearby query page;
     *                    if empty an empty map is returned immediately without
     *                    executing an invalid {@code IN ()} query
     * @return map of businessId → list of {@link ActiveOfferDto}; never {@code null};
     *         businesses without active offers will not have a key in the map
     *         (callers should use {@code getOrDefault(id, List.of())})
     */
    public Map<UUID, List<ActiveOfferDto>> findActiveOffersGroupedByBusiness(
            List<UUID> businessIds
    ) {
        if (businessIds == null || businessIds.isEmpty()) {
            return Collections.emptyMap();
        }

        LocalDateTime nowIst = LocalDateTime.now(IST);

        List<CouponEntity> coupons = couponRepository
                .findActiveOffersByBusinessIds(businessIds, nowIst);

        return coupons.stream()
                .collect(Collectors.groupingBy(
                        CouponEntity::getBusinessId,
                        Collectors.mapping(this::toDto, Collectors.toList())
                ));
    }

    /**
     * Fetches all currently active offers for a single business.
     *
     * @param businessId ID of the approved business
     * @return list of active offers; empty list if business has no active offers or businessId is null
     */
    public List<ActiveOfferDto> findActiveOffersByBusiness(UUID businessId) {
        if (businessId == null) {
            return Collections.emptyList();
        }
        return findActiveOffersGroupedByBusiness(List.of(businessId))
                .getOrDefault(businessId, Collections.emptyList());
    }

    // ── Private mapping ────────────────────────────────────────────────────────

    private ActiveOfferDto toDto(CouponEntity c) {
        return new ActiveOfferDto(
                c.getId(),
                c.getTitle(),
                c.getDescription(),
                c.getCouponType(),
                c.getMaxClaims(),
                c.getCurrentClaims(),
                c.getEndDate(),
                c.getRedemptionTimeType(),
                c.getRedemptionStartTime() != null ? c.getRedemptionStartTime().format(TIME_FORMATTER) : null,
                c.getRedemptionEndTime() != null ? c.getRedemptionEndTime().format(TIME_FORMATTER) : null,
                c.getImageUrl()
        );
    }
}
