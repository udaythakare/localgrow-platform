package com.localgrow.v2.business.service;

import com.localgrow.v2.business.dto.BusinessDetailsDto;
import com.localgrow.v2.business.dto.BusinessLocationDto;
import com.localgrow.v2.business.dto.CategoryDto;
import com.localgrow.v2.business.dto.NearbyBusinessDto;
import com.localgrow.v2.business.dto.NearbyBusinessesResponse;
import com.localgrow.v2.business.dto.OperatingHoursStatusDto;
import com.localgrow.v2.business.dto.BusinessPhotoDto;
import com.localgrow.v2.business.dto.ReviewSummaryDto;
import com.localgrow.v2.business.entity.BusinessCategoryEntity;
import com.localgrow.v2.business.entity.BusinessEntity;
import com.localgrow.v2.business.entity.BusinessLocationEntity;
import com.localgrow.v2.business.entity.BusinessPhotoEntity;
import com.localgrow.v2.business.repository.BusinessPhotoRepository;
import com.localgrow.v2.business.repository.BusinessRepository;
import com.localgrow.v2.business.repository.projection.NearbyBusinessProjection;
import com.localgrow.v2.common.exception.ResourceNotFoundException;
import com.localgrow.v2.coupon.dto.ActiveOfferDto;
import com.localgrow.v2.coupon.service.CouponService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class BusinessServiceTest {

    @Mock
    private BusinessRepository businessRepository;

    @Mock
    private CouponService couponService;

    @Mock
    private OperatingHoursService operatingHoursService;

    @Mock
    private BusinessPhotoRepository businessPhotoRepository;

    @Mock
    private ReviewService reviewService;

    private BusinessService businessService;

    @BeforeEach
    void setUp() {
        businessService = new BusinessService(businessRepository, couponService, operatingHoursService, businessPhotoRepository, reviewService);
        // Default stubs: return empty maps/lists so existing tests are unaffected.
        // Use lenient() because tests that throw early never consume these stubs.
        lenient().when(couponService.findActiveOffersGroupedByBusiness(any()))
                .thenReturn(Collections.emptyMap());
        lenient().when(operatingHoursService.getOperatingHoursForLocations(any()))
                .thenReturn(Collections.emptyMap());
        lenient().when(businessPhotoRepository.findByBusinessIdOrderByDisplayOrderAscCreatedAtAsc(any()))
                .thenReturn(Collections.emptyList());
        lenient().when(reviewService.getReviewSummary(any()))
                .thenReturn(ReviewSummaryDto.empty());
    }

    private NearbyBusinessProjection createMockProjection(
            UUID businessId,
            String businessName,
            String description,
            UUID locationId,
            String address,
            String area,
            String city,
            String state,
            String postalCode,
            BigDecimal lat,
            BigDecimal lng,
            Double distanceKm,
            UUID categoryId,
            String categoryName
    ) {
        return new NearbyBusinessProjection() {
            @Override public UUID getBusinessId() { return businessId; }
            @Override public String getBusinessName() { return businessName; }
            @Override public String getBusinessDescription() { return description; }
            @Override public UUID getLocationId() { return locationId; }
            @Override public String getLocationAddress() { return address; }
            @Override public String getLocationArea() { return area; }
            @Override public String getLocationCity() { return city; }
            @Override public String getLocationState() { return state; }
            @Override public String getLocationPostalCode() { return postalCode; }
            @Override public BigDecimal getLocationLatitude() { return lat; }
            @Override public BigDecimal getLocationLongitude() { return lng; }
            @Override public Boolean getLocationIsPrimary() { return true; }
            @Override public Double getDistanceKm() { return distanceKm; }
            @Override public UUID getCategoryId() { return categoryId; }
            @Override public String getCategoryName() { return categoryName; }
            @Override public String getBusinessLogoUrl() { return null; }
            @Override public String getBusinessPhotoUrl() { return null; }
            @Override public Double getAverageRating() { return null; }
            @Override public Integer getTotalReviews() { return null; }
        };
    }

    @Test
    @DisplayName("Valid nearby search converts km to meters, queries repository, and maps to DTO")
    void validNearbySearch_convertsKmToMetersAndMapsToDto() {
        UUID businessId = UUID.randomUUID();
        UUID locationId = UUID.randomUUID();
        UUID categoryId = UUID.randomUUID();

        NearbyBusinessProjection proj = createMockProjection(
                businessId,
                "Chai Corner",
                "Best cutting chai",
                locationId,
                "45 Station Rd",
                "Dadar",
                "Mumbai",
                "Maharashtra",
                "400028",
                new BigDecimal("19.0178"),
                new BigDecimal("72.8478"),
                0.8765,
                categoryId,
                "Cafe"
        );

        Page<NearbyBusinessProjection> page = new PageImpl<>(List.of(proj), PageRequest.of(0, 20), 1);
        given(businessRepository.findNearbyApprovedBusinesses(eq(72.8478), eq(19.0178), eq(2000.0), any(PageRequest.class)))
                .willReturn(page);

        NearbyBusinessesResponse response = businessService.findNearbyBusinesses(
                19.0178, 72.8478, 2.0, 0, 20
        );

        assertThat(response).isNotNull();
        assertThat(response.content()).hasSize(1);
        assertThat(response.page()).isEqualTo(0);
        assertThat(response.size()).isEqualTo(20);
        assertThat(response.totalElements()).isEqualTo(1L);
        assertThat(response.totalPages()).isEqualTo(1);

        var dto = response.content().getFirst();
        assertThat(dto.businessId()).isEqualTo(businessId);
        assertThat(dto.name()).isEqualTo("Chai Corner");
        assertThat(dto.description()).isEqualTo("Best cutting chai");
        assertThat(dto.locationId()).isEqualTo(locationId);
        assertThat(dto.address()).isEqualTo("45 Station Rd");
        assertThat(dto.area()).isEqualTo("Dadar");
        assertThat(dto.city()).isEqualTo("Mumbai");
        assertThat(dto.state()).isEqualTo("Maharashtra");
        assertThat(dto.postalCode()).isEqualTo("400028");
        assertThat(dto.latitude()).isEqualTo(19.0178);
        assertThat(dto.longitude()).isEqualTo(72.8478);
        assertThat(dto.distanceKm()).isEqualTo(0.88); // Rounded to 2 decimals
        assertThat(dto.category()).isNotNull();
        assertThat(dto.category().id()).isEqualTo(categoryId);
        assertThat(dto.category().name()).isEqualTo("Cafe");
        // Sprint 6: activeOffers is always an array, never null
        assertThat(dto.activeOffers()).isNotNull().isEmpty();
    }

    @Test
    @DisplayName("Default radius is 2 km (2000.0 meters) when radiusKm is null")
    void defaultRadius_is2Km() {
        given(businessRepository.findNearbyApprovedBusinesses(anyDouble(), anyDouble(), anyDouble(), any(PageRequest.class)))
                .willReturn(Page.empty());

        businessService.findNearbyBusinesses(19.0760, 72.8777, null, 0, 20);

        ArgumentCaptor<Double> radiusCaptor = ArgumentCaptor.forClass(Double.class);
        verify(businessRepository).findNearbyApprovedBusinesses(
                eq(72.8777), eq(19.0760), radiusCaptor.capture(), any(PageRequest.class)
        );

        assertThat(radiusCaptor.getValue()).isEqualTo(2000.0);
    }

    @ParameterizedTest(name = "radiusKm = {0} km maps to {0} * 1000 meters")
    @ValueSource(doubles = {0.5, 1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0})
    @DisplayName("All supported radius values pass validation and convert correctly to meters")
    void supportedRadiusValues_convertCorrectly(double radiusKm) {
        given(businessRepository.findNearbyApprovedBusinesses(anyDouble(), anyDouble(), anyDouble(), any(PageRequest.class)))
                .willReturn(Page.empty());

        businessService.findNearbyBusinesses(19.0760, 72.8777, radiusKm, 0, 20);

        ArgumentCaptor<Double> radiusCaptor = ArgumentCaptor.forClass(Double.class);
        verify(businessRepository).findNearbyApprovedBusinesses(
                eq(72.8777), eq(19.0760), radiusCaptor.capture(), any(PageRequest.class)
        );

        assertThat(radiusCaptor.getValue()).isEqualTo(radiusKm * 1000.0);
    }

    @ParameterizedTest(name = "unsupported radiusKm = {0}")
    @ValueSource(doubles = {0.1, 0.4, 1.5, 2.5, 7.5, 10.5, 15.0, -1.0})
    @DisplayName("Unsupported radius values throw IllegalArgumentException")
    void unsupportedRadius_throwsException(double invalidRadius) {
        assertThatThrownBy(() -> businessService.findNearbyBusinesses(19.0760, 72.8777, invalidRadius, 0, 20))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Invalid radiusKm");
    }

    @Test
    @DisplayName("Latitude out of range [-90, 90] throws IllegalArgumentException")
    void latitudeOutOfRange_throwsException() {
        assertThatThrownBy(() -> businessService.findNearbyBusinesses(-90.001, 72.8777, 2.0, 0, 20))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("latitude must be between -90 and 90");

        assertThatThrownBy(() -> businessService.findNearbyBusinesses(90.001, 72.8777, 2.0, 0, 20))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("latitude must be between -90 and 90");
    }

    @Test
    @DisplayName("Longitude out of range [-180, 180] throws IllegalArgumentException")
    void longitudeOutOfRange_throwsException() {
        assertThatThrownBy(() -> businessService.findNearbyBusinesses(19.0760, -180.001, 2.0, 0, 20))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("longitude must be between -180 and 180");

        assertThatThrownBy(() -> businessService.findNearbyBusinesses(19.0760, 180.001, 2.0, 0, 20))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("longitude must be between -180 and 180");
    }

    @Test
    @DisplayName("Negative page throws IllegalArgumentException")
    void negativePage_throwsException() {
        assertThatThrownBy(() -> businessService.findNearbyBusinesses(19.0760, 72.8777, 2.0, -1, 20))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Page index must not be less than zero");
    }

    @Test
    @DisplayName("Page size <= 0 or > 50 throws IllegalArgumentException")
    void invalidPageSize_throwsException() {
        assertThatThrownBy(() -> businessService.findNearbyBusinesses(19.0760, 72.8777, 2.0, 0, 0))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Page size must be between 1 and 50");

        assertThatThrownBy(() -> businessService.findNearbyBusinesses(19.0760, 72.8777, 2.0, 0, 51))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Page size must be between 1 and 50");
    }

    @Test
    @DisplayName("Null category is handled gracefully without exception")
    void nullCategory_handledGracefully() {
        UUID businessId = UUID.randomUUID();
        UUID locationId = UUID.randomUUID();

        NearbyBusinessProjection proj = createMockProjection(
                businessId,
                "Uncategorized Shop",
                "General items",
                locationId,
                "10 Main Rd",
                "Fort",
                "Mumbai",
                "Maharashtra",
                "400001",
                new BigDecimal("18.9322"),
                new BigDecimal("72.8335"),
                1.5,
                null,
                null
        );

        given(businessRepository.findNearbyApprovedBusinesses(anyDouble(), anyDouble(), anyDouble(), any(PageRequest.class)))
                .willReturn(new PageImpl<>(List.of(proj), PageRequest.of(0, 20), 1));

        NearbyBusinessesResponse response = businessService.findNearbyBusinesses(18.9322, 72.8335, 2.0, 0, 20);

        assertThat(response.content().getFirst().category()).isNull();
        // activeOffers is still always an array
        assertThat(response.content().getFirst().activeOffers()).isNotNull().isEmpty();
    }

    // ── Sprint 6 contract tests ───────────────────────────────────────────────

    @Test
    @DisplayName("10. Business with an active offer → offer is attached to the correct DTO")
    void businessWithActiveOffer_offerAttachedToDto() {
        UUID businessId = UUID.randomUUID();
        UUID locationId = UUID.randomUUID();
        UUID couponId   = UUID.randomUUID();

        NearbyBusinessProjection proj = createMockProjection(
                businessId, "Chai Corner", null, locationId,
                "45 Stn Rd", "Dadar", "Mumbai", "Maharashtra", "400028",
                new BigDecimal("19.0178"), new BigDecimal("72.8478"), 0.5, null, null
        );

        Page<NearbyBusinessProjection> page =
                new PageImpl<>(List.of(proj), PageRequest.of(0, 20), 1);
        given(businessRepository.findNearbyApprovedBusinesses(
                anyDouble(), anyDouble(), anyDouble(), any(PageRequest.class))
        ).willReturn(page);

        ActiveOfferDto offer = new ActiveOfferDto(
                couponId, "10% Off", "Bring coupon", "redeem_at_store",
                50, 3, LocalDateTime.now().plusDays(5),
                "anytime", "09:00:00", "21:00:00"
        );
        given(couponService.findActiveOffersGroupedByBusiness(List.of(businessId)))
                .willReturn(Map.of(businessId, List.of(offer)));

        NearbyBusinessesResponse response =
                businessService.findNearbyBusinesses(19.0178, 72.8478, 2.0, 0, 20);

        var dto = response.content().getFirst();
        assertThat(dto.activeOffers()).hasSize(1);
        assertThat(dto.activeOffers().getFirst().id()).isEqualTo(couponId);
        assertThat(dto.activeOffers().getFirst().title()).isEqualTo("10% Off");
    }

    @Test
    @DisplayName("2. Business without active offers → activeOffers is empty list, never null")
    void businessWithNoActiveOffers_activeOffersIsEmptyList() {
        UUID businessId = UUID.randomUUID();
        UUID locationId = UUID.randomUUID();

        NearbyBusinessProjection proj = createMockProjection(
                businessId, "Empty Store", null, locationId,
                "1 Lane", "Kurla", "Mumbai", "Maharashtra", "400070",
                new BigDecimal("19.0760"), new BigDecimal("72.8777"), 1.0, null, null
        );

        given(businessRepository.findNearbyApprovedBusinesses(
                anyDouble(), anyDouble(), anyDouble(), any(PageRequest.class))
        ).willReturn(new PageImpl<>(List.of(proj), PageRequest.of(0, 20), 1));

        // Default stub returns empty map (configured in @BeforeEach)

        NearbyBusinessesResponse response =
                businessService.findNearbyBusinesses(19.0760, 72.8777, 2.0, 0, 20);

        assertThat(response.content().getFirst().activeOffers())
                .isNotNull()
                .isEmpty();
    }

    @Test
    @DisplayName("11. CouponService is called exactly once (batch) per nearby request — no N+1")
    void couponService_calledExactlyOnce_forEntirePage() {
        UUID biz1 = UUID.randomUUID();
        UUID biz2 = UUID.randomUUID();
        UUID loc1 = UUID.randomUUID();
        UUID loc2 = UUID.randomUUID();

        NearbyBusinessProjection p1 = createMockProjection(
                biz1, "Store A", null, loc1, "Addr1", null, "Mumbai", "MH", "400001",
                new BigDecimal("19.0760"), new BigDecimal("72.8777"), 0.5, null, null);
        NearbyBusinessProjection p2 = createMockProjection(
                biz2, "Store B", null, loc2, "Addr2", null, "Mumbai", "MH", "400001",
                new BigDecimal("19.0761"), new BigDecimal("72.8778"), 0.8, null, null);

        given(businessRepository.findNearbyApprovedBusinesses(
                anyDouble(), anyDouble(), anyDouble(), any(PageRequest.class))
        ).willReturn(new PageImpl<>(List.of(p1, p2), PageRequest.of(0, 20), 2));

        businessService.findNearbyBusinesses(19.0760, 72.8777, 2.0, 0, 20);

        // CouponService must be called exactly once with both business IDs
        ArgumentCaptor<List<UUID>> idsCaptor = ArgumentCaptor.forClass(List.class);
        verify(couponService).findActiveOffersGroupedByBusiness(idsCaptor.capture());
        assertThat(idsCaptor.getValue()).containsExactlyInAnyOrder(biz1, biz2);
    }

    @Test
    @DisplayName("12. OperatingHoursService is called exactly once (batch) per nearby request — no N+1")
    void operatingHoursService_calledExactlyOnce_forEntirePage() {
        UUID biz1 = UUID.randomUUID();
        UUID biz2 = UUID.randomUUID();
        UUID loc1 = UUID.randomUUID();
        UUID loc2 = UUID.randomUUID();

        NearbyBusinessProjection p1 = createMockProjection(
                biz1, "Store A", null, loc1, "Addr1", null, "Mumbai", "MH", "400001",
                new BigDecimal("19.0760"), new BigDecimal("72.8777"), 0.5, null, null);
        NearbyBusinessProjection p2 = createMockProjection(
                biz2, "Store B", null, loc2, "Addr2", null, "Mumbai", "MH", "400001",
                new BigDecimal("19.0761"), new BigDecimal("72.8778"), 0.8, null, null);

        given(businessRepository.findNearbyApprovedBusinesses(
                anyDouble(), anyDouble(), anyDouble(), any(PageRequest.class))
        ).willReturn(new PageImpl<>(List.of(p1, p2), PageRequest.of(0, 20), 2));

        OperatingHoursStatusDto status1 = new OperatingHoursStatusDto(true, true, "Open now", null, List.of());
        given(operatingHoursService.getOperatingHoursForLocations(any()))
                .willReturn(Map.of(loc1, status1));

        NearbyBusinessesResponse response =
                businessService.findNearbyBusinesses(19.0760, 72.8777, 2.0, 0, 20);

        // OperatingHoursService must be called with both location IDs
        ArgumentCaptor<List<UUID>> locIdsCaptor = ArgumentCaptor.forClass(List.class);
        verify(operatingHoursService).getOperatingHoursForLocations(locIdsCaptor.capture());
        assertThat(locIdsCaptor.getValue()).containsExactlyInAnyOrder(loc1, loc2);

        // Loc1 has configured status; Loc2 defaults to unconfigured
        NearbyBusinessDto dto1 = response.content().stream()
                .filter(d -> d.locationId().equals(loc1)).findFirst().orElseThrow();
        assertThat(dto1.operatingHours().hasHoursConfigured()).isTrue();
        assertThat(dto1.operatingHours().isOpenNow()).isTrue();
        assertThat(dto1.operatingHours().statusText()).isEqualTo("Open now");

        NearbyBusinessDto dto2 = response.content().stream()
                .filter(d -> d.locationId().equals(loc2)).findFirst().orElseThrow();
        assertThat(dto2.operatingHours().hasHoursConfigured()).isFalse();
        assertThat(dto2.operatingHours().isOpenNow()).isNull();
        assertThat(dto2.operatingHours().statusText()).isEqualTo("Hours not configured");
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // SPRINT 8 STAGE 1: BUSINESS DETAILS TESTS
    // ═════════════════════════════════════════════════════════════════════════════

    private BusinessEntity createTestBusiness(UUID id, String name, String status) {
        BusinessEntity b = new BusinessEntity();
        b.setId(id);
        b.setName(name);
        b.setDescription("Quality local products and services");
        b.setStatus(status);
        b.setUserId(UUID.randomUUID());
        b.setRejectionReason("Sensitive internal notes");
        b.setPhone("+91 9876543210");
        b.setEmail("hello@apexspices.com");
        b.setWebsite("https://apexspices.com");
        return b;
    }

    private BusinessLocationEntity createTestLocation(UUID id, BusinessEntity business, String address, boolean isPrimary) {
        BusinessLocationEntity loc = new BusinessLocationEntity();
        loc.setId(id);
        loc.setBusiness(business);
        loc.setAddress(address);
        loc.setArea("Bandra");
        loc.setCity("Mumbai");
        loc.setState("Maharashtra");
        loc.setPostalCode("400050");
        loc.setCountry("India");
        loc.setLatitude(new BigDecimal("19.0760"));
        loc.setLongitude(new BigDecimal("72.8777"));
        loc.setIsPrimary(isPrimary);
        return loc;
    }

    @Test
    @DisplayName("getBusinessDetails: null businessId throws IllegalArgumentException")
    void getBusinessDetails_nullBusinessId_throwsIllegalArgumentException() {
        assertThatThrownBy(() -> businessService.getBusinessDetails(null, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("businessId is required");
    }

    @Test
    @DisplayName("getBusinessDetails: missing business throws ResourceNotFoundException (404)")
    void getBusinessDetails_missingBusiness_throwsResourceNotFoundException() {
        UUID bizId = UUID.randomUUID();
        given(businessRepository.findApprovedBusinessById(bizId)).willReturn(Optional.empty());

        assertThatThrownBy(() -> businessService.getBusinessDetails(bizId, null))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Business not found with id: " + bizId);
    }

    @Test
    @DisplayName("getBusinessDetails: pending business throws ResourceNotFoundException (404)")
    void getBusinessDetails_pendingBusiness_throwsResourceNotFoundException() {
        UUID bizId = UUID.randomUUID();
        BusinessEntity pendingBiz = createTestBusiness(bizId, "Pending Store", "pending");
        given(businessRepository.findApprovedBusinessById(bizId)).willReturn(Optional.of(pendingBiz));

        assertThatThrownBy(() -> businessService.getBusinessDetails(bizId, null))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Business not found with id: " + bizId);
    }

    @Test
    @DisplayName("getBusinessDetails: rejected business throws ResourceNotFoundException (404)")
    void getBusinessDetails_rejectedBusiness_throwsResourceNotFoundException() {
        UUID bizId = UUID.randomUUID();
        BusinessEntity rejectedBiz = createTestBusiness(bizId, "Rejected Store", "rejected");
        given(businessRepository.findApprovedBusinessById(bizId)).willReturn(Optional.of(rejectedBiz));

        assertThatThrownBy(() -> businessService.getBusinessDetails(bizId, null))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Business not found with id: " + bizId);
    }

    @Test
    @DisplayName("getBusinessDetails: approved business returns expected public DTO without sensitive fields")
    void getBusinessDetails_approvedBusiness_returnsExpectedPublicDto() {
        UUID bizId = UUID.randomUUID();
        UUID locId = UUID.randomUUID();
        UUID catId = UUID.randomUUID();

        BusinessEntity business = createTestBusiness(bizId, "Apex Spices", "approved");
        BusinessCategoryEntity category = new BusinessCategoryEntity(catId, "Grocery", "Food and grocery", LocalDateTime.now());
        business.setCategory(category);

        BusinessLocationEntity location = createTestLocation(locId, business, "123 Spice Market", true);
        business.setLocations(List.of(location));

        given(businessRepository.findApprovedBusinessById(bizId)).willReturn(Optional.of(business));

        OperatingHoursStatusDto hours = new OperatingHoursStatusDto(true, true, "Open now • Closes at 21:00", null, List.of());
        given(operatingHoursService.getOperatingHoursForLocation(locId)).willReturn(hours);

        ActiveOfferDto offer = new ActiveOfferDto(UUID.randomUUID(), "10% Off", "Get 10% off", "percentage", 100, 10, LocalDateTime.now().plusDays(5), "all_day", null, null);
        given(couponService.findActiveOffersByBusiness(bizId)).willReturn(List.of(offer));

        BusinessDetailsDto dto = businessService.getBusinessDetails(bizId, null);

        assertThat(dto.id()).isEqualTo(bizId);
        assertThat(dto.name()).isEqualTo("Apex Spices");
        assertThat(dto.description()).isEqualTo("Quality local products and services");
        assertThat(dto.category()).isNotNull();
        assertThat(dto.category().id()).isEqualTo(catId);
        assertThat(dto.category().name()).isEqualTo("Grocery");
        assertThat(dto.phone()).isEqualTo("+91 9876543210");
        assertThat(dto.email()).isEqualTo("hello@apexspices.com");
        assertThat(dto.website()).isEqualTo("https://apexspices.com");
        assertThat(dto.locations()).hasSize(1);
        assertThat(dto.selectedLocation()).isNotNull();
        assertThat(dto.selectedLocation().id()).isEqualTo(locId);
        assertThat(dto.selectedLocation().isPrimary()).isTrue();
        assertThat(dto.operatingHours().isOpenNow()).isTrue();
        assertThat(dto.operatingHours().statusText()).isEqualTo("Open now • Closes at 21:00");
        assertThat(dto.activeOffers()).hasSize(1);
        assertThat(dto.activeOffers().get(0).title()).isEqualTo("10% Off");
    }

    @Test
    @DisplayName("getBusinessDetails: omitted locationId selects primary location")
    void getBusinessDetails_omittedLocationId_selectsPrimaryLocation() {
        UUID bizId = UUID.randomUUID();
        UUID branch1 = UUID.fromString("00000000-0000-0000-0000-000000000001");
        UUID branch2 = UUID.fromString("00000000-0000-0000-0000-000000000002");

        BusinessEntity business = createTestBusiness(bizId, "Multi Branch Store", "approved");
        BusinessLocationEntity loc1 = createTestLocation(branch1, business, "Branch Non-Primary", false);
        BusinessLocationEntity loc2 = createTestLocation(branch2, business, "Branch Primary", true);
        business.setLocations(List.of(loc1, loc2));

        given(businessRepository.findApprovedBusinessById(bizId)).willReturn(Optional.of(business));

        BusinessDetailsDto dto = businessService.getBusinessDetails(bizId, null);

        assertThat(dto.selectedLocation()).isNotNull();
        assertThat(dto.selectedLocation().id()).isEqualTo(branch2);
        assertThat(dto.selectedLocation().isPrimary()).isTrue();
    }

    @Test
    @DisplayName("getBusinessDetails: omitted locationId and no primary location uses deterministic fallback (smallest ID)")
    void getBusinessDetails_omittedLocationId_noPrimaryLocation_deterministicFallback() {
        UUID bizId = UUID.randomUUID();
        UUID branchB = UUID.fromString("00000000-0000-0000-0000-000000000002");
        UUID branchA = UUID.fromString("00000000-0000-0000-0000-000000000001");

        BusinessEntity business = createTestBusiness(bizId, "Store Without Primary", "approved");
        BusinessLocationEntity locB = createTestLocation(branchB, business, "Branch B", false);
        BusinessLocationEntity locA = createTestLocation(branchA, business, "Branch A", false);
        business.setLocations(List.of(locB, locA));

        given(businessRepository.findApprovedBusinessById(bizId)).willReturn(Optional.of(business));

        BusinessDetailsDto dto = businessService.getBusinessDetails(bizId, null);

        assertThat(dto.selectedLocation()).isNotNull();
        assertThat(dto.selectedLocation().id()).isEqualTo(branchA);
    }

    @Test
    @DisplayName("getBusinessDetails: omitted locationId and multiple primary locations uses deterministic fallback (smallest primary ID)")
    void getBusinessDetails_omittedLocationId_multiplePrimaryLocations_deterministicFallback() {
        UUID bizId = UUID.randomUUID();
        UUID branchB = UUID.fromString("00000000-0000-0000-0000-000000000002");
        UUID branchA = UUID.fromString("00000000-0000-0000-0000-000000000001");

        BusinessEntity business = createTestBusiness(bizId, "Multi Primary Store", "approved");
        BusinessLocationEntity locB = createTestLocation(branchB, business, "Primary B", true);
        BusinessLocationEntity locA = createTestLocation(branchA, business, "Primary A", true);
        business.setLocations(List.of(locB, locA));

        given(businessRepository.findApprovedBusinessById(bizId)).willReturn(Optional.of(business));

        BusinessDetailsDto dto = businessService.getBusinessDetails(bizId, null);

        assertThat(dto.selectedLocation()).isNotNull();
        assertThat(dto.selectedLocation().id()).isEqualTo(branchA);
    }

    @Test
    @DisplayName("getBusinessDetails: valid locationId selects the correct requested branch")
    void getBusinessDetails_validLocationId_selectsRequestedLocation() {
        UUID bizId = UUID.randomUUID();
        UUID branch1 = UUID.randomUUID();
        UUID branch2 = UUID.randomUUID();

        BusinessEntity business = createTestBusiness(bizId, "Chain Store", "approved");
        BusinessLocationEntity loc1 = createTestLocation(branch1, business, "Branch 1 Primary", true);
        BusinessLocationEntity loc2 = createTestLocation(branch2, business, "Branch 2 Secondary", false);
        business.setLocations(List.of(loc1, loc2));

        given(businessRepository.findApprovedBusinessById(bizId)).willReturn(Optional.of(business));

        OperatingHoursStatusDto branch2Hours = new OperatingHoursStatusDto(true, false, "Closed today", null, List.of());
        given(operatingHoursService.getOperatingHoursForLocation(branch2)).willReturn(branch2Hours);

        BusinessDetailsDto dto = businessService.getBusinessDetails(bizId, branch2);

        assertThat(dto.selectedLocation()).isNotNull();
        assertThat(dto.selectedLocation().id()).isEqualTo(branch2);
        assertThat(dto.selectedLocation().address()).isEqualTo("Branch 2 Secondary");
        assertThat(dto.operatingHours().isOpenNow()).isFalse();
        assertThat(dto.operatingHours().statusText()).isEqualTo("Closed today");
    }

    @Test
    @DisplayName("getBusinessDetails: locationId belonging to another business throws ResourceNotFoundException (404)")
    void getBusinessDetails_locationIdBelongingToAnotherBusiness_throwsResourceNotFoundException() {
        UUID bizId = UUID.randomUUID();
        UUID foreignLocId = UUID.randomUUID();
        UUID myLocId = UUID.randomUUID();

        BusinessEntity business = createTestBusiness(bizId, "Store A", "approved");
        BusinessLocationEntity myLoc = createTestLocation(myLocId, business, "My Location", true);
        business.setLocations(List.of(myLoc));

        given(businessRepository.findApprovedBusinessById(bizId)).willReturn(Optional.of(business));

        assertThatThrownBy(() -> businessService.getBusinessDetails(bizId, foreignLocId))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Location not found with id: " + foreignLocId + " for business: " + bizId);
    }

    @Test
    @DisplayName("getBusinessDetails: unconfigured operating hours defaults gracefully")
    void getBusinessDetails_unconfiguredOperatingHours_returnsUnconfiguredStatus() {
        UUID bizId = UUID.randomUUID();
        UUID locId = UUID.randomUUID();

        BusinessEntity business = createTestBusiness(bizId, "New Store", "approved");
        BusinessLocationEntity loc = createTestLocation(locId, business, "New Location", true);
        business.setLocations(List.of(loc));

        given(businessRepository.findApprovedBusinessById(bizId)).willReturn(Optional.of(business));
        given(operatingHoursService.getOperatingHoursForLocation(locId))
                .willReturn(OperatingHoursStatusDto.unconfigured());

        BusinessDetailsDto dto = businessService.getBusinessDetails(bizId, null);

        assertThat(dto.operatingHours().hasHoursConfigured()).isFalse();
        assertThat(dto.operatingHours().isOpenNow()).isNull();
        assertThat(dto.operatingHours().statusText()).isEqualTo("Hours not configured");
        assertThat(dto.operatingHours().weeklySchedule()).isEmpty();
    }

    @Test
    @DisplayName("getBusinessDetails: business without locations returns empty locations list and unconfigured hours")
    void getBusinessDetails_noLocations_returnsEmptyLocationsAndUnconfiguredHours() {
        UUID bizId = UUID.randomUUID();
        BusinessEntity business = createTestBusiness(bizId, "Online Only Store", "approved");
        business.setLocations(List.of());

        given(businessRepository.findApprovedBusinessById(bizId)).willReturn(Optional.of(business));

        BusinessDetailsDto dto = businessService.getBusinessDetails(bizId, null);

        assertThat(dto.locations()).isEmpty();
        assertThat(dto.selectedLocation()).isNull();
        assertThat(dto.operatingHours().hasHoursConfigured()).isFalse();
        assertThat(dto.operatingHours().isOpenNow()).isNull();
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // SPRINT 9 STAGE 2: BRANDING LOGO & GALLERY PHOTOS TESTS
    // ═════════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("getBusinessDetails: approved business with logo and ordered photos maps all branding fields correctly")
    void getBusinessDetails_withLogoAndOrderedPhotos_returnsMappedDtoWithOrderedPhotosAndLogo() {
        UUID bizId = UUID.randomUUID();
        BusinessEntity business = createTestBusiness(bizId, "Branded Store", "approved");
        business.setLogoUrl("https://res.cloudinary.com/localgrow/image/upload/v12345/businesses/logos/store_logo.png");
        business.setLogoPublicId("businesses/logos/store_logo");

        BusinessPhotoEntity photo1 = new BusinessPhotoEntity(
                UUID.randomUUID(),
                bizId,
                "https://res.cloudinary.com/localgrow/image/upload/v12345/businesses/photos/photo1.jpg",
                "businesses/photos/photo1",
                "Store entrance",
                0
        );
        BusinessPhotoEntity photo2 = new BusinessPhotoEntity(
                UUID.randomUUID(),
                bizId,
                "https://res.cloudinary.com/localgrow/image/upload/v12345/businesses/photos/photo2.jpg",
                "businesses/photos/photo2",
                "Product aisle",
                1
        );
        BusinessPhotoEntity photo3 = new BusinessPhotoEntity(
                UUID.randomUUID(),
                bizId,
                "https://res.cloudinary.com/localgrow/image/upload/v12345/businesses/photos/photo3.jpg",
                "businesses/photos/photo3",
                null,
                2
        );

        given(businessRepository.findApprovedBusinessById(bizId)).willReturn(Optional.of(business));
        given(businessPhotoRepository.findByBusinessIdOrderByDisplayOrderAscCreatedAtAsc(bizId))
                .willReturn(List.of(photo1, photo2, photo3));

        BusinessDetailsDto dto = businessService.getBusinessDetails(bizId, null);

        assertThat(dto).isNotNull();
        assertThat(dto.logoUrl()).isEqualTo("https://res.cloudinary.com/localgrow/image/upload/v12345/businesses/logos/store_logo.png");
        assertThat(dto.photos()).hasSize(3);

        BusinessPhotoDto p0 = dto.photos().get(0);
        assertThat(p0.id()).isEqualTo(photo1.getId());
        assertThat(p0.imageUrl()).isEqualTo("https://res.cloudinary.com/localgrow/image/upload/v12345/businesses/photos/photo1.jpg");
        assertThat(p0.caption()).isEqualTo("Store entrance");
        assertThat(p0.displayOrder()).isEqualTo(0);

        BusinessPhotoDto p1 = dto.photos().get(1);
        assertThat(p1.id()).isEqualTo(photo2.getId());
        assertThat(p1.imageUrl()).isEqualTo("https://res.cloudinary.com/localgrow/image/upload/v12345/businesses/photos/photo2.jpg");
        assertThat(p1.caption()).isEqualTo("Product aisle");
        assertThat(p1.displayOrder()).isEqualTo(1);

        BusinessPhotoDto p2 = dto.photos().get(2);
        assertThat(p2.id()).isEqualTo(photo3.getId());
        assertThat(p2.imageUrl()).isEqualTo("https://res.cloudinary.com/localgrow/image/upload/v12345/businesses/photos/photo3.jpg");
        assertThat(p2.caption()).isNull();
        assertThat(p2.displayOrder()).isEqualTo(2);
    }

    @Test
    @DisplayName("getBusinessDetails: business with null logo and empty photos list returns null logo and empty gallery")
    void getBusinessDetails_nullLogoAndEmptyPhotos_returnsNullLogoAndEmptyGallery() {
        UUID bizId = UUID.randomUUID();
        BusinessEntity business = createTestBusiness(bizId, "Plain Store", "approved");
        business.setLogoUrl(null);
        business.setLogoPublicId(null);

        given(businessRepository.findApprovedBusinessById(bizId)).willReturn(Optional.of(business));
        given(businessPhotoRepository.findByBusinessIdOrderByDisplayOrderAscCreatedAtAsc(bizId))
                .willReturn(Collections.emptyList());

        BusinessDetailsDto dto = businessService.getBusinessDetails(bizId, null);

        assertThat(dto).isNotNull();
        assertThat(dto.logoUrl()).isNull();
        assertThat(dto.photos()).isEmpty();
    }

    @Test
    @DisplayName("getBusinessDetails: unapproved business does not query photos repository and throws ResourceNotFoundException")
    void getBusinessDetails_unapprovedBusiness_neverQueriesPhotosRepository() {
        UUID bizId = UUID.randomUUID();
        BusinessEntity pendingBiz = createTestBusiness(bizId, "Pending Store", "pending");
        given(businessRepository.findApprovedBusinessById(bizId)).willReturn(Optional.of(pendingBiz));

        assertThatThrownBy(() -> businessService.getBusinessDetails(bizId, null))
                .isInstanceOf(ResourceNotFoundException.class);

        verifyNoInteractions(businessPhotoRepository);
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // SPRINT 10 STAGE 2: RATING SUMMARY INTEGRATION TESTS
    // ═════════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("getBusinessDetails: approved business attaches dynamic rating summary from reviewService")
    void getBusinessDetails_withReviewSummary_attachesDynamicRatingSummary() {
        UUID bizId = UUID.randomUUID();
        BusinessEntity business = createTestBusiness(bizId, "Spice Palace", "approved");
        given(businessRepository.findApprovedBusinessById(bizId)).willReturn(Optional.of(business));

        ReviewSummaryDto expectedSummary = new ReviewSummaryDto(4.7, 19L);
        given(reviewService.getReviewSummary(bizId)).willReturn(expectedSummary);

        BusinessDetailsDto dto = businessService.getBusinessDetails(bizId, null);

        assertThat(dto).isNotNull();
        assertThat(dto.ratingSummary()).isNotNull();
        assertThat(dto.ratingSummary().averageRating()).isEqualTo(4.7);
        assertThat(dto.ratingSummary().totalReviews()).isEqualTo(19L);
        verify(reviewService).getReviewSummary(bizId);
    }

    @Test
    @DisplayName("getBusinessDetails: null reviewService defaults rating summary to empty")
    void getBusinessDetails_nullReviewService_defaultsToEmptyRatingSummary() {
        UUID bizId = UUID.randomUUID();
        BusinessEntity business = createTestBusiness(bizId, "Spice Palace", "approved");
        given(businessRepository.findApprovedBusinessById(bizId)).willReturn(Optional.of(business));

        BusinessService serviceWithoutReviews = new BusinessService(
                businessRepository, couponService, operatingHoursService, businessPhotoRepository, null
        );

        BusinessDetailsDto dto = serviceWithoutReviews.getBusinessDetails(bizId, null);

        assertThat(dto).isNotNull();
        assertThat(dto.ratingSummary()).isNotNull();
        assertThat(dto.ratingSummary().averageRating()).isNull();
        assertThat(dto.ratingSummary().totalReviews()).isEqualTo(0L);
    }

    @Test
    @DisplayName("getBusinessDetails: unapproved business never queries reviewService and throws ResourceNotFoundException")
    void getBusinessDetails_unapprovedBusiness_neverQueriesReviewService() {
        UUID bizId = UUID.randomUUID();
        BusinessEntity rejectedBiz = createTestBusiness(bizId, "Rejected Store", "rejected");
        given(businessRepository.findApprovedBusinessById(bizId)).willReturn(Optional.of(rejectedBiz));

        assertThatThrownBy(() -> businessService.getBusinessDetails(bizId, null))
                .isInstanceOf(ResourceNotFoundException.class);

        verifyNoInteractions(reviewService);
    }
}
