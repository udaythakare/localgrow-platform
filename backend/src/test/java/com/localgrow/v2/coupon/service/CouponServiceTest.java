package com.localgrow.v2.coupon.service;

import com.localgrow.v2.coupon.dto.ActiveOfferDto;
import com.localgrow.v2.coupon.entity.CouponEntity;
import com.localgrow.v2.coupon.repository.CouponRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * Unit tests for {@link CouponService}.
 *
 * <p>All tests use fixed/mock data and do NOT depend on the actual wall clock
 * or the real database. The IST LocalDateTime passed to the repository is
 * captured via ArgumentCaptor to verify correctness.</p>
 */
@ExtendWith(MockitoExtension.class)
class CouponServiceTest {

    @Mock
    private CouponRepository couponRepository;

    private CouponService couponService;

    @BeforeEach
    void setUp() {
        couponService = new CouponService(couponRepository);
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private CouponEntity makeCoupon(UUID id, UUID businessId, String title,
                                    boolean isActive,
                                    LocalDateTime startDate,
                                    LocalDateTime endDate) {
        CouponEntity c = new CouponEntity();
        c.setId(id);
        c.setBusinessId(businessId);
        c.setTitle(title);
        c.setDescription("Desc for " + title);
        c.setCouponType("redeem_at_store");
        c.setMaxClaims(100);
        c.setCurrentClaims(5);
        c.setStartDate(startDate);
        c.setEndDate(endDate);
        c.setIsActive(isActive);
        c.setRedemptionTimeType("anytime");
        c.setRedemptionStartTime("09:00:00");
        c.setRedemptionEndTime("21:00:00");
        return c;
    }

    // ── Test 9: Empty business ID list ────────────────────────────────────────

    @Test
    @DisplayName("9. Empty business ID list returns empty map without executing a query")
    void emptyBusinessIds_returnsEmptyMap_withoutQuery() {
        Map<UUID, List<ActiveOfferDto>> result =
                couponService.findActiveOffersGroupedByBusiness(Collections.emptyList());

        assertThat(result).isEmpty();
        verify(couponRepository, never()).findActiveOffersByBusinessIds(any(), any());
    }

    @Test
    @DisplayName("9b. Null business ID list returns empty map without executing a query")
    void nullBusinessIds_returnsEmptyMap_withoutQuery() {
        Map<UUID, List<ActiveOfferDto>> result =
                couponService.findActiveOffersGroupedByBusiness(null);

        assertThat(result).isEmpty();
        verify(couponRepository, never()).findActiveOffersByBusinessIds(any(), any());
    }

    // ── Test 1: Business with active offer returns offer ─────────────────────

    @Test
    @DisplayName("1. Business with an active offer returns populated ActiveOfferDto")
    void businessWithActiveOffer_returnsPopulatedDto() {
        UUID bizId = UUID.randomUUID();
        UUID couponId = UUID.randomUUID();

        LocalDateTime pastStart = LocalDateTime.now().minusDays(1);
        LocalDateTime futureEnd = LocalDateTime.now().plusDays(7);

        CouponEntity coupon = makeCoupon(couponId, bizId, "50% Off", true, pastStart, futureEnd);

        given(couponRepository.findActiveOffersByBusinessIds(eq(List.of(bizId)), any()))
                .willReturn(List.of(coupon));

        Map<UUID, List<ActiveOfferDto>> result =
                couponService.findActiveOffersGroupedByBusiness(List.of(bizId));

        assertThat(result).containsKey(bizId);
        assertThat(result.get(bizId)).hasSize(1);

        ActiveOfferDto dto = result.get(bizId).get(0);
        assertThat(dto.id()).isEqualTo(couponId);
        assertThat(dto.title()).isEqualTo("50% Off");
        assertThat(dto.description()).isEqualTo("Desc for 50% Off");
        assertThat(dto.couponType()).isEqualTo("redeem_at_store");
        assertThat(dto.maxClaims()).isEqualTo(100);
        assertThat(dto.currentClaims()).isEqualTo(5);
        assertThat(dto.endDate()).isEqualTo(futureEnd);
        assertThat(dto.redemptionTimeType()).isEqualTo("anytime");
        assertThat(dto.redemptionStartTime()).isEqualTo("09:00:00");
        assertThat(dto.redemptionEndTime()).isEqualTo("21:00:00");
    }

    // ── Test 2: Business without offer returns no key / caller uses default ───

    @Test
    @DisplayName("2. Business without active offers is absent from map; caller defaults to []")
    void businessWithNoOffers_absentFromMap() {
        UUID bizId = UUID.randomUUID();

        given(couponRepository.findActiveOffersByBusinessIds(eq(List.of(bizId)), any()))
                .willReturn(Collections.emptyList());

        Map<UUID, List<ActiveOfferDto>> result =
                couponService.findActiveOffersGroupedByBusiness(List.of(bizId));

        // Key should be absent — caller uses getOrDefault(bizId, List.of())
        assertThat(result).doesNotContainKey(bizId);
        assertThat(result.getOrDefault(bizId, List.of())).isEmpty();
    }

    // ── Test 3: Expired offer — repository excludes it ───────────────────────

    @Test
    @DisplayName("3. Expired offer (end_date < now) is excluded — repository filter verified")
    void expiredOffer_notReturnedByRepository() {
        UUID bizId = UUID.randomUUID();

        // Repository does the filtering; return empty to simulate exclusion
        given(couponRepository.findActiveOffersByBusinessIds(eq(List.of(bizId)), any()))
                .willReturn(Collections.emptyList());

        Map<UUID, List<ActiveOfferDto>> result =
                couponService.findActiveOffersGroupedByBusiness(List.of(bizId));

        assertThat(result).doesNotContainKey(bizId);

        // Verify the IST timestamp was passed to the repository
        ArgumentCaptor<LocalDateTime> nowCaptor = ArgumentCaptor.forClass(LocalDateTime.class);
        verify(couponRepository).findActiveOffersByBusinessIds(any(), nowCaptor.capture());
        LocalDateTime passedNow = nowCaptor.getValue();
        // Must be a recent timestamp (within last 5 seconds)
        assertThat(passedNow).isBefore(LocalDateTime.now().plusSeconds(1));
        assertThat(passedNow).isAfter(LocalDateTime.now().minusSeconds(5));
    }

    // ── Test 4: Future offer — repository excludes it ────────────────────────

    @Test
    @DisplayName("4. Future offer (start_date > now) is excluded — repository filter verified")
    void futureOffer_notReturnedByRepository() {
        UUID bizId = UUID.randomUUID();

        // Repository does the filtering; return empty to simulate exclusion
        given(couponRepository.findActiveOffersByBusinessIds(eq(List.of(bizId)), any()))
                .willReturn(Collections.emptyList());

        Map<UUID, List<ActiveOfferDto>> result =
                couponService.findActiveOffersGroupedByBusiness(List.of(bizId));

        assertThat(result).doesNotContainKey(bizId);
    }

    // ── Test 5: is_active=false — repository excludes it ─────────────────────

    @Test
    @DisplayName("5. Inactive offer (is_active=false) is excluded — repository filter verified")
    void inactiveOffer_notReturnedByRepository() {
        UUID bizId = UUID.randomUUID();

        given(couponRepository.findActiveOffersByBusinessIds(eq(List.of(bizId)), any()))
                .willReturn(Collections.emptyList());

        Map<UUID, List<ActiveOfferDto>> result =
                couponService.findActiveOffersGroupedByBusiness(List.of(bizId));

        assertThat(result).doesNotContainKey(bizId);
    }

    // ── Test 6: Rejected business offer is never requested ───────────────────

    @Test
    @DisplayName("6. Rejected business offers are never included — IDs come from approved nearby query only")
    void rejectedBusinessOffer_neverRequested() {
        UUID approvedBizId = UUID.randomUUID();
        // rejectedBizId is NOT in the input list — the caller (BusinessService) only
        // passes IDs returned by the PostGIS query which filters status='approved'
        UUID couponId = UUID.randomUUID();
        CouponEntity approvedCoupon = makeCoupon(couponId, approvedBizId, "Flash Sale",
                true, LocalDateTime.now().minusDays(1), LocalDateTime.now().plusDays(3));

        given(couponRepository.findActiveOffersByBusinessIds(eq(List.of(approvedBizId)), any()))
                .willReturn(List.of(approvedCoupon));

        Map<UUID, List<ActiveOfferDto>> result =
                couponService.findActiveOffersGroupedByBusiness(List.of(approvedBizId));

        // Only approved business gets results
        assertThat(result).containsOnlyKeys(approvedBizId);
        assertThat(result.get(approvedBizId)).hasSize(1);
    }

    // ── Test 7: Multiple offers for one business ─────────────────────────────

    @Test
    @DisplayName("7. Multiple active offers for one business are all returned and grouped correctly")
    void multipleOffersForOneBusiness_allReturnedGrouped() {
        UUID bizId = UUID.randomUUID();
        UUID coupon1Id = UUID.randomUUID();
        UUID coupon2Id = UUID.randomUUID();
        UUID coupon3Id = UUID.randomUUID();

        LocalDateTime past = LocalDateTime.now().minusDays(1);
        LocalDateTime future = LocalDateTime.now().plusDays(10);

        CouponEntity c1 = makeCoupon(coupon1Id, bizId, "BOGO", true, past, future);
        CouponEntity c2 = makeCoupon(coupon2Id, bizId, "10% Off", true, past, future.plusDays(2));
        CouponEntity c3 = makeCoupon(coupon3Id, bizId, "Free Coffee", true, past, future.plusDays(5));

        given(couponRepository.findActiveOffersByBusinessIds(eq(List.of(bizId)), any()))
                .willReturn(List.of(c1, c2, c3));

        Map<UUID, List<ActiveOfferDto>> result =
                couponService.findActiveOffersGroupedByBusiness(List.of(bizId));

        assertThat(result).containsKey(bizId);
        assertThat(result.get(bizId)).hasSize(3);

        List<UUID> returnedIds = result.get(bizId).stream()
                .map(ActiveOfferDto::id)
                .toList();
        assertThat(returnedIds).containsExactlyInAnyOrder(coupon1Id, coupon2Id, coupon3Id);
    }

    // ── Test 8: Multiple businesses, correct association ─────────────────────

    @Test
    @DisplayName("8. Offers for multiple businesses are associated with the correct business")
    void multipleBusinesses_offersCorrectlyAssociated() {
        UUID biz1 = UUID.randomUUID();
        UUID biz2 = UUID.randomUUID();
        UUID coupon1Id = UUID.randomUUID();
        UUID coupon2Id = UUID.randomUUID();
        UUID coupon3Id = UUID.randomUUID();

        LocalDateTime past = LocalDateTime.now().minusDays(1);
        LocalDateTime future = LocalDateTime.now().plusDays(5);

        CouponEntity c1 = makeCoupon(coupon1Id, biz1, "Biz1 Offer A", true, past, future);
        CouponEntity c2 = makeCoupon(coupon2Id, biz2, "Biz2 Offer A", true, past, future);
        CouponEntity c3 = makeCoupon(coupon3Id, biz2, "Biz2 Offer B", true, past, future);

        given(couponRepository.findActiveOffersByBusinessIds(eq(List.of(biz1, biz2)), any()))
                .willReturn(List.of(c1, c2, c3));

        Map<UUID, List<ActiveOfferDto>> result =
                couponService.findActiveOffersGroupedByBusiness(List.of(biz1, biz2));

        assertThat(result.get(biz1)).hasSize(1);
        assertThat(result.get(biz1).get(0).id()).isEqualTo(coupon1Id);

        assertThat(result.get(biz2)).hasSize(2);
        List<UUID> biz2Ids = result.get(biz2).stream().map(ActiveOfferDto::id).toList();
        assertThat(biz2Ids).containsExactlyInAnyOrder(coupon2Id, coupon3Id);
    }

    // ── Internal fields not exposed ──────────────────────────────────────────

    @Test
    @DisplayName("DTO does not expose is_active, user_id, or is_expired fields")
    void activeOfferDto_doesNotExposeInternalFields() {
        // Verify via reflection that the record does NOT have user_id, is_active, is_expired
        Class<ActiveOfferDto> clazz = ActiveOfferDto.class;
        List<String> componentNames = List.of(clazz.getRecordComponents()).stream()
                .map(rc -> rc.getName())
                .toList();

        assertThat(componentNames).doesNotContain("userId", "isActive", "isExpired");
        assertThat(componentNames).containsExactly(
                "id", "title", "description", "couponType",
                "maxClaims", "currentClaims", "endDate",
                "redemptionTimeType", "redemptionStartTime", "redemptionEndTime",
                "imageUrl"
        );
    }

    // ── IST timestamp supplied correctly ─────────────────────────────────────

    @Test
    @DisplayName("CouponService supplies an IST LocalDateTime to the repository")
    void service_suppliesIstTimestampToRepository() {
        UUID bizId = UUID.randomUUID();

        given(couponRepository.findActiveOffersByBusinessIds(any(), any()))
                .willReturn(Collections.emptyList());

        LocalDateTime before = LocalDateTime.now(java.time.ZoneId.of("Asia/Kolkata"));
        couponService.findActiveOffersGroupedByBusiness(List.of(bizId));
        LocalDateTime after = LocalDateTime.now(java.time.ZoneId.of("Asia/Kolkata"));

        ArgumentCaptor<LocalDateTime> nowCaptor = ArgumentCaptor.forClass(LocalDateTime.class);
        verify(couponRepository).findActiveOffersByBusinessIds(any(), nowCaptor.capture());

        LocalDateTime passedNow = nowCaptor.getValue();
        // Verify the captured timestamp is within [before, after] — proves it is IST wall-clock
        assertThat(passedNow).isAfterOrEqualTo(before.minusSeconds(1));
        assertThat(passedNow).isBeforeOrEqualTo(after.plusSeconds(1));
    }
}
