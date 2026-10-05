package com.localgrow.v2.coupon.repository;

import com.localgrow.v2.coupon.entity.CouponEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Read-only repository for the V1 coupons table.
 *
 * <p>V2 never writes to this table. The single query method batch-loads
 * all currently active offers for a given set of business IDs in one
 * round trip, avoiding N+1.</p>
 *
 * <p><strong>Timezone note:</strong> The {@code start_date} and {@code end_date}
 * columns are stored as {@code TIMESTAMP WITHOUT TIME ZONE} in Asia/Kolkata (IST).
 * Callers must supply {@code nowIst} as the current IST wall-clock time so that
 * the comparison is always IST-to-IST and never suffers a UTC offset error.</p>
 */
@Repository
public interface CouponRepository extends JpaRepository<CouponEntity, UUID> {

    /**
     * Batch-fetches all currently active coupons for the given business IDs.
     *
     * <p>Active means:
     * <ul>
     *   <li>{@code is_active = true} (vendor-controlled enable flag)</li>
     *   <li>{@code start_date IS NULL OR start_date <= :nowIst}</li>
     *   <li>{@code end_date IS NULL OR end_date >= :nowIst}</li>
     * </ul>
     *
     * <p>{@code is_expired} is intentionally NOT used: the DB state has all rows
     * set to {@code is_expired = true}, making it unusable as a live filter.
     * Date-based validity is evaluated directly against the supplied IST timestamp.</p>
     *
     * <p>Results are ordered by {@code business_id, end_date ASC} for
     * deterministic grouping.</p>
     *
     * @param businessIds set of business IDs already returned by the nearby query
     *                    (guaranteed {@code status = 'approved'} by the caller)
     * @param nowIst      current IST wall-clock time; must be computed by the
     *                    caller as {@code LocalDateTime.now(ZoneId.of("Asia/Kolkata"))}
     * @return list of matching CouponEntity rows; empty if none found
     */
    @Query("""
            SELECT c FROM CouponEntity c
            WHERE c.businessId IN :businessIds
              AND c.isActive = true
              AND (c.startDate IS NULL OR c.startDate <= :nowIst)
              AND (c.endDate IS NULL OR c.endDate >= :nowIst)
            ORDER BY c.businessId ASC, c.endDate ASC NULLS LAST
            """)
    List<CouponEntity> findActiveOffersByBusinessIds(
            @Param("businessIds") List<UUID> businessIds,
            @Param("nowIst") LocalDateTime nowIst
    );
}
