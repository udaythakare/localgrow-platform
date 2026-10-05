package com.localgrow.v2.business.controller;

import com.localgrow.v2.business.dto.BusinessDetailsDto;
import com.localgrow.v2.business.dto.BusinessLocationDto;
import com.localgrow.v2.business.dto.BusinessPhotoDto;
import com.localgrow.v2.business.dto.BusinessReviewDto;
import com.localgrow.v2.business.dto.BusinessReviewPageResponse;
import com.localgrow.v2.business.dto.CategoryDto;
import com.localgrow.v2.business.dto.NearbyBusinessDto;
import com.localgrow.v2.business.dto.NearbyBusinessesResponse;
import com.localgrow.v2.business.dto.OperatingHoursStatusDto;
import com.localgrow.v2.business.dto.ReviewSummaryDto;
import com.localgrow.v2.business.service.BusinessService;
import com.localgrow.v2.business.service.ReviewService;
import com.localgrow.v2.common.exception.ResourceNotFoundException;
import com.localgrow.v2.coupon.dto.ActiveOfferDto;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(BusinessController.class)
class BusinessControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private BusinessService businessService;

    @MockitoBean
    private ReviewService reviewService;

    @Test
    @DisplayName("1. Valid request returns 200 OK with paginated DTO response")
    void validRequest_returnsOkWithPaginatedResponse() throws Exception {
        UUID businessId = UUID.randomUUID();
        UUID locationId = UUID.randomUUID();
        UUID categoryId = UUID.randomUUID();

        NearbyBusinessDto dto = new NearbyBusinessDto(
                businessId,
                "Apex Spices",
                "Authentic wholesale spices",
                locationId,
                "123 Market St",
                "Bandra",
                "Mumbai",
                "Maharashtra",
                "400050",
                19.0760,
                72.8777,
                1.25,
                new CategoryDto(categoryId, "Retail"),
                List.of()
        );

        NearbyBusinessesResponse mockResponse = new NearbyBusinessesResponse(
                List.of(dto),
                0,
                20,
                1L,
                1
        );

        given(businessService.findNearbyBusinesses(19.0760, 72.8777, 2.0, 0, 20))
                .willReturn(mockResponse);

        mockMvc.perform(get("/api/v2/businesses/nearby")
                        .param("latitude", "19.0760")
                        .param("longitude", "72.8777")
                        .param("radiusKm", "2.0")
                        .param("page", "0")
                        .param("size", "20")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].businessId", is(businessId.toString())))
                .andExpect(jsonPath("$.content[0].name", is("Apex Spices")))
                .andExpect(jsonPath("$.content[0].description", is("Authentic wholesale spices")))
                .andExpect(jsonPath("$.content[0].locationId", is(locationId.toString())))
                .andExpect(jsonPath("$.content[0].address", is("123 Market St")))
                .andExpect(jsonPath("$.content[0].area", is("Bandra")))
                .andExpect(jsonPath("$.content[0].city", is("Mumbai")))
                .andExpect(jsonPath("$.content[0].state", is("Maharashtra")))
                .andExpect(jsonPath("$.content[0].postalCode", is("400050")))
                .andExpect(jsonPath("$.content[0].latitude", is(19.0760)))
                .andExpect(jsonPath("$.content[0].longitude", is(72.8777)))
                .andExpect(jsonPath("$.content[0].distanceKm", is(1.25)))
                .andExpect(jsonPath("$.content[0].category.id", is(categoryId.toString())))
                .andExpect(jsonPath("$.content[0].category.name", is("Retail")))
                .andExpect(jsonPath("$.content[0].activeOffers").isArray())
                .andExpect(jsonPath("$.page", is(0)))
                .andExpect(jsonPath("$.size", is(20)))
                .andExpect(jsonPath("$.totalElements", is(1)))
                .andExpect(jsonPath("$.totalPages", is(1)));
    }

    @Test
    @DisplayName("2. Default radius = 2 km when radiusKm is not provided")
    void defaultRadius_whenNotSpecified_delegatesWithNullRadiusToService() throws Exception {
        NearbyBusinessesResponse emptyResponse = new NearbyBusinessesResponse(List.of(), 0, 20, 0L, 0);
        given(businessService.findNearbyBusinesses(eq(19.0760), eq(72.8777), eq(null), eq(0), eq(20)))
                .willReturn(emptyResponse);

        mockMvc.perform(get("/api/v2/businesses/nearby")
                        .param("latitude", "19.0760")
                        .param("longitude", "72.8777"))
                .andExpect(status().isOk());

        verify(businessService).findNearbyBusinesses(19.0760, 72.8777, null, 0, 20);
    }

    @ParameterizedTest(name = "radiusKm = {0} is supported")
    @ValueSource(doubles = {0.5, 1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0})
    @DisplayName("3. All supported radius values (0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 km) succeed")
    void supportedRadiusValues_succeed(double radius) throws Exception {
        NearbyBusinessesResponse emptyResponse = new NearbyBusinessesResponse(List.of(), 0, 20, 0L, 0);
        given(businessService.findNearbyBusinesses(eq(19.0760), eq(72.8777), eq(radius), anyInt(), anyInt()))
                .willReturn(emptyResponse);

        mockMvc.perform(get("/api/v2/businesses/nearby")
                        .param("latitude", "19.0760")
                        .param("longitude", "72.8777")
                        .param("radiusKm", String.valueOf(radius)))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("4. Invalid radius returns 400 Bad Request")
    void invalidRadius_returnsBadRequest() throws Exception {
        given(businessService.findNearbyBusinesses(any(), any(), eq(15.0), anyInt(), anyInt()))
                .willThrow(new IllegalArgumentException("Invalid radiusKm. Supported values are 0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9 and 10."));

        mockMvc.perform(get("/api/v2/businesses/nearby")
                        .param("latitude", "19.0760")
                        .param("longitude", "72.8777")
                        .param("radiusKm", "15.0"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status", is(400)))
                .andExpect(jsonPath("$.error", is("Bad Request")))
                .andExpect(jsonPath("$.message", is("Invalid radiusKm. Supported values are 0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9 and 10.")));
    }

    @Test
    @DisplayName("5. Latitude below -90 returns 400 Bad Request")
    void latitudeBelowMinus90_returnsBadRequest() throws Exception {
        given(businessService.findNearbyBusinesses(eq(-90.1), any(), any(), anyInt(), anyInt()))
                .willThrow(new IllegalArgumentException("latitude must be between -90 and 90"));

        mockMvc.perform(get("/api/v2/businesses/nearby")
                        .param("latitude", "-90.1")
                        .param("longitude", "72.8777"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status", is(400)))
                .andExpect(jsonPath("$.message", is("latitude must be between -90 and 90")));
    }

    @Test
    @DisplayName("6. Latitude above 90 returns 400 Bad Request")
    void latitudeAbove90_returnsBadRequest() throws Exception {
        given(businessService.findNearbyBusinesses(eq(90.1), any(), any(), anyInt(), anyInt()))
                .willThrow(new IllegalArgumentException("latitude must be between -90 and 90"));

        mockMvc.perform(get("/api/v2/businesses/nearby")
                        .param("latitude", "90.1")
                        .param("longitude", "72.8777"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status", is(400)))
                .andExpect(jsonPath("$.message", is("latitude must be between -90 and 90")));
    }

    @Test
    @DisplayName("7. Longitude below -180 returns 400 Bad Request")
    void longitudeBelowMinus180_returnsBadRequest() throws Exception {
        given(businessService.findNearbyBusinesses(any(), eq(-180.1), any(), anyInt(), anyInt()))
                .willThrow(new IllegalArgumentException("longitude must be between -180 and 180"));

        mockMvc.perform(get("/api/v2/businesses/nearby")
                        .param("latitude", "19.0760")
                        .param("longitude", "-180.1"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status", is(400)))
                .andExpect(jsonPath("$.message", is("longitude must be between -180 and 180")));
    }

    @Test
    @DisplayName("8. Longitude above 180 returns 400 Bad Request")
    void longitudeAbove180_returnsBadRequest() throws Exception {
        given(businessService.findNearbyBusinesses(any(), eq(180.1), any(), anyInt(), anyInt()))
                .willThrow(new IllegalArgumentException("longitude must be between -180 and 180"));

        mockMvc.perform(get("/api/v2/businesses/nearby")
                        .param("latitude", "19.0760")
                        .param("longitude", "180.1"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status", is(400)))
                .andExpect(jsonPath("$.message", is("longitude must be between -180 and 180")));
    }

    @Test
    @DisplayName("9. Invalid numeric input returns 400 Bad Request")
    void invalidNumericInput_returnsBadRequest() throws Exception {
        mockMvc.perform(get("/api/v2/businesses/nearby")
                        .param("latitude", "not-a-number")
                        .param("longitude", "72.8777"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status", is(400)))
                .andExpect(jsonPath("$.error", is("Bad Request")));
    }

    @Test
    @DisplayName("10. Negative page returns 400 Bad Request")
    void negativePage_returnsBadRequest() throws Exception {
        given(businessService.findNearbyBusinesses(any(), any(), any(), eq(-1), anyInt()))
                .willThrow(new IllegalArgumentException("Page index must not be less than zero"));

        mockMvc.perform(get("/api/v2/businesses/nearby")
                        .param("latitude", "19.0760")
                        .param("longitude", "72.8777")
                        .param("page", "-1"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status", is(400)))
                .andExpect(jsonPath("$.message", is("Page index must not be less than zero")));
    }

    @Test
    @DisplayName("11. Size greater than 50 returns 400 Bad Request")
    void sizeGreaterThan50_returnsBadRequest() throws Exception {
        given(businessService.findNearbyBusinesses(any(), any(), any(), anyInt(), eq(100)))
                .willThrow(new IllegalArgumentException("Page size must be between 1 and 50"));

        mockMvc.perform(get("/api/v2/businesses/nearby")
                        .param("latitude", "19.0760")
                        .param("longitude", "72.8777")
                        .param("size", "100"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status", is(400)))
                .andExpect(jsonPath("$.message", is("Page size must be between 1 and 50")));
    }

    @Test
    @DisplayName("12. Missing required latitude returns 400 Bad Request")
    void missingLatitude_returnsBadRequest() throws Exception {
        mockMvc.perform(get("/api/v2/businesses/nearby")
                        .param("longitude", "72.8777"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status", is(400)))
                .andExpect(jsonPath("$.message", is("Required parameter 'latitude' is not present")));
    }

    @Test
    @DisplayName("13. Missing required longitude returns 400 Bad Request")
    void missingLongitude_returnsBadRequest() throws Exception {
        mockMvc.perform(get("/api/v2/businesses/nearby")
                        .param("latitude", "19.0760"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status", is(400)))
                .andExpect(jsonPath("$.message", is("Required parameter 'longitude' is not present")));
    }

    @Test
    @DisplayName("14. Nearby response serializes operating-hours status object")
    void nearbyResponse_serializesOperatingHoursStatus() throws Exception {
        UUID businessId = UUID.randomUUID();
        UUID locationId = UUID.randomUUID();

        com.localgrow.v2.business.dto.OperatingHoursStatusDto hoursStatus =
                new com.localgrow.v2.business.dto.OperatingHoursStatusDto(
                        true,
                        true,
                        "Open now • Closes at 21:00",
                        new com.localgrow.v2.business.dto.OperatingHoursDto(1, java.time.LocalTime.of(9, 0), java.time.LocalTime.of(21, 0), false, false),
                        java.util.List.of()
                );

        NearbyBusinessDto dto = new NearbyBusinessDto(
                businessId,
                "Bakery Delight",
                "Fresh artisanal bread",
                locationId,
                "45 Hill Rd",
                "Bandra",
                "Mumbai",
                "Maharashtra",
                "400050",
                19.0760,
                72.8777,
                0.45,
                null,
                java.util.List.of(),
                hoursStatus
        );

        NearbyBusinessesResponse mockResponse = new NearbyBusinessesResponse(
                java.util.List.of(dto),
                0,
                20,
                1L,
                1
        );

        given(businessService.findNearbyBusinesses(19.0760, 72.8777, 2.0, 0, 20))
                .willReturn(mockResponse);

        mockMvc.perform(get("/api/v2/businesses/nearby")
                        .param("latitude", "19.0760")
                        .param("longitude", "72.8777")
                        .param("radiusKm", "2.0")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].operatingHours.hasHoursConfigured", is(true)))
                .andExpect(jsonPath("$.content[0].operatingHours.isOpenNow", is(true)))
                .andExpect(jsonPath("$.content[0].operatingHours.statusText", is("Open now • Closes at 21:00")))
                .andExpect(jsonPath("$.content[0].operatingHours.todaySchedule.openTime", is("09:00:00")))
                .andExpect(jsonPath("$.content[0].operatingHours.todaySchedule.closeTime", is("21:00:00")));
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // SPRINT 8 STAGE 1: GET /api/v2/businesses/{id} TESTS
    // ═════════════════════════════════════════════════════════════════════════════

    private BusinessDetailsDto createSampleBusinessDetails(UUID businessId, UUID locationId) {
        BusinessLocationDto locDto = new BusinessLocationDto(
                locationId,
                "123 Market St",
                "Bandra",
                "Mumbai",
                "Maharashtra",
                "400050",
                "India",
                19.0760,
                72.8777,
                true
        );

        OperatingHoursStatusDto hours = new OperatingHoursStatusDto(
                true,
                true,
                "Open now • Closes at 21:00",
                null,
                List.of()
        );

        ActiveOfferDto offer = new ActiveOfferDto(
                UUID.randomUUID(),
                "20% Off",
                "Get 20% off all spices",
                "percentage",
                100,
                15,
                null,
                "all_day",
                null,
                null
        );

        return new BusinessDetailsDto(
                businessId,
                "Apex Spices",
                "Finest wholesale spices",
                new CategoryDto(UUID.randomUUID(), "Grocery"),
                "+91 9876543210",
                "hello@apexspices.com",
                "https://apexspices.com",
                List.of(locDto),
                locDto,
                hours,
                List.of(offer)
        );
    }

    @Test
    @DisplayName("getBusinessDetails: 200 OK with full public DTO for approved business")
    void getBusinessDetails_validApprovedBusiness_returns200OkWithPublicDto() throws Exception {
        UUID bizId = UUID.randomUUID();
        UUID locId = UUID.randomUUID();
        BusinessDetailsDto dto = createSampleBusinessDetails(bizId, locId);

        given(businessService.getBusinessDetails(bizId, null)).willReturn(dto);

        mockMvc.perform(get("/api/v2/businesses/" + bizId)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is(bizId.toString())))
                .andExpect(jsonPath("$.name", is("Apex Spices")))
                .andExpect(jsonPath("$.description", is("Finest wholesale spices")))
                .andExpect(jsonPath("$.category.name", is("Grocery")))
                .andExpect(jsonPath("$.phone", is("+91 9876543210")))
                .andExpect(jsonPath("$.email", is("hello@apexspices.com")))
                .andExpect(jsonPath("$.website", is("https://apexspices.com")))
                .andExpect(jsonPath("$.locations", hasSize(1)))
                .andExpect(jsonPath("$.locations[0].id", is(locId.toString())))
                .andExpect(jsonPath("$.locations[0].city", is("Mumbai")))
                .andExpect(jsonPath("$.selectedLocation.id", is(locId.toString())))
                .andExpect(jsonPath("$.operatingHours.isOpenNow", is(true)))
                .andExpect(jsonPath("$.operatingHours.statusText", is("Open now • Closes at 21:00")))
                .andExpect(jsonPath("$.activeOffers", hasSize(1)))
                .andExpect(jsonPath("$.activeOffers[0].title", is("20% Off")));
    }

    @Test
    @DisplayName("getBusinessDetails: 404 Not Found when business does not exist")
    void getBusinessDetails_missingBusiness_returns404NotFound() throws Exception {
        UUID bizId = UUID.randomUUID();
        given(businessService.getBusinessDetails(bizId, null))
                .willThrow(new ResourceNotFoundException("Business not found with id: " + bizId));

        mockMvc.perform(get("/api/v2/businesses/" + bizId)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status", is(404)))
                .andExpect(jsonPath("$.error", is("Not Found")))
                .andExpect(jsonPath("$.message", is("Business not found with id: " + bizId)));
    }

    @Test
    @DisplayName("getBusinessDetails: 404 Not Found when business is pending or rejected")
    void getBusinessDetails_pendingOrRejectedBusiness_returns404NotFound() throws Exception {
        UUID pendingBizId = UUID.randomUUID();
        given(businessService.getBusinessDetails(pendingBizId, null))
                .willThrow(new ResourceNotFoundException("Business not found with id: " + pendingBizId));

        mockMvc.perform(get("/api/v2/businesses/" + pendingBizId)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status", is(404)))
                .andExpect(jsonPath("$.error", is("Not Found")));
    }

    @Test
    @DisplayName("getBusinessDetails: 200 OK when valid locationId is passed")
    void getBusinessDetails_withLocationId_returns200Ok() throws Exception {
        UUID bizId = UUID.randomUUID();
        UUID branchId = UUID.randomUUID();
        BusinessDetailsDto dto = createSampleBusinessDetails(bizId, branchId);

        given(businessService.getBusinessDetails(bizId, branchId)).willReturn(dto);

        mockMvc.perform(get("/api/v2/businesses/" + bizId)
                        .param("locationId", branchId.toString())
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.selectedLocation.id", is(branchId.toString())));
    }

    @Test
    @DisplayName("getBusinessDetails: 404 Not Found when locationId does not belong to the business")
    void getBusinessDetails_invalidLocationIdForBusiness_returns404NotFound() throws Exception {
        UUID bizId = UUID.randomUUID();
        UUID foreignLocId = UUID.randomUUID();
        given(businessService.getBusinessDetails(bizId, foreignLocId))
                .willThrow(new ResourceNotFoundException("Location not found with id: " + foreignLocId + " for business: " + bizId));

        mockMvc.perform(get("/api/v2/businesses/" + bizId)
                        .param("locationId", foreignLocId.toString())
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status", is(404)))
                .andExpect(jsonPath("$.error", is("Not Found")))
                .andExpect(jsonPath("$.message", is("Location not found with id: " + foreignLocId + " for business: " + bizId)));
    }

    @Test
    @DisplayName("getBusinessDetails: 400 Bad Request when path variable id is malformed UUID")
    void getBusinessDetails_invalidUuid_returns400BadRequest() throws Exception {
        mockMvc.perform(get("/api/v2/businesses/not-a-valid-uuid")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status", is(400)))
                .andExpect(jsonPath("$.error", is("Bad Request")));
    }

    @Test
    @DisplayName("getBusinessDetails: public response does not expose userId or rejectionReason")
    void getBusinessDetails_publicResponseDoesNotExposeUserIdOrRejectionReason() throws Exception {
        UUID bizId = UUID.randomUUID();
        UUID locId = UUID.randomUUID();
        BusinessDetailsDto dto = createSampleBusinessDetails(bizId, locId);

        given(businessService.getBusinessDetails(bizId, null)).willReturn(dto);

        mockMvc.perform(get("/api/v2/businesses/" + bizId)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").doesNotExist())
                .andExpect(jsonPath("$.user_id").doesNotExist())
                .andExpect(jsonPath("$.rejectionReason").doesNotExist())
                .andExpect(jsonPath("$.rejection_reason").doesNotExist());
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // SPRINT 9 STAGE 2: BRANDING LOGO & GALLERY PHOTOS ENDPOINT TESTS
    // ═════════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("getBusinessDetails: 200 OK returns logoUrl and ordered photos, excluding Cloudinary public IDs")
    void getBusinessDetails_withLogoAndPhotos_returns200OkWithBrandingAndExcludesPublicIds() throws Exception {
        UUID bizId = UUID.randomUUID();
        UUID locId = UUID.randomUUID();
        UUID photoId1 = UUID.randomUUID();
        UUID photoId2 = UUID.randomUUID();

        BusinessLocationDto locDto = new BusinessLocationDto(
                locId, "123 Market St", "Bandra", "Mumbai", "Maharashtra", "400050",
                "India", 19.0760, 72.8777, true
        );
        OperatingHoursStatusDto hours = new OperatingHoursStatusDto(true, true, "Open now", null, List.of());

        List<BusinessPhotoDto> photos = List.of(
                new BusinessPhotoDto(photoId1, "https://res.cloudinary.com/demo/image/upload/v1/photo1.jpg", "Storefront", 0),
                new BusinessPhotoDto(photoId2, "https://res.cloudinary.com/demo/image/upload/v1/photo2.jpg", null, 1)
        );

        BusinessDetailsDto dto = new BusinessDetailsDto(
                bizId,
                "Apex Spices",
                "Finest wholesale spices",
                new CategoryDto(UUID.randomUUID(), "Grocery"),
                "https://res.cloudinary.com/demo/image/upload/v1/logo.png",
                "+91 9876543210",
                "hello@apexspices.com",
                "https://apexspices.com",
                List.of(locDto),
                locDto,
                hours,
                List.of(),
                photos
        );

        given(businessService.getBusinessDetails(bizId, null)).willReturn(dto);

        mockMvc.perform(get("/api/v2/businesses/" + bizId)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is(bizId.toString())))
                .andExpect(jsonPath("$.logoUrl", is("https://res.cloudinary.com/demo/image/upload/v1/logo.png")))
                .andExpect(jsonPath("$.photos", hasSize(2)))
                .andExpect(jsonPath("$.photos[0].id", is(photoId1.toString())))
                .andExpect(jsonPath("$.photos[0].imageUrl", is("https://res.cloudinary.com/demo/image/upload/v1/photo1.jpg")))
                .andExpect(jsonPath("$.photos[0].caption", is("Storefront")))
                .andExpect(jsonPath("$.photos[0].displayOrder", is(0)))
                .andExpect(jsonPath("$.photos[1].id", is(photoId2.toString())))
                .andExpect(jsonPath("$.photos[1].imageUrl", is("https://res.cloudinary.com/demo/image/upload/v1/photo2.jpg")))
                .andExpect(jsonPath("$.photos[1].caption", nullValue()))
                .andExpect(jsonPath("$.photos[1].displayOrder", is(1)))
                // Verify Cloudinary public IDs and private fields are NEVER exposed
                .andExpect(jsonPath("$.logoPublicId").doesNotExist())
                .andExpect(jsonPath("$.logo_public_id").doesNotExist())
                .andExpect(jsonPath("$.photos[0].publicId").doesNotExist())
                .andExpect(jsonPath("$.photos[0].public_id").doesNotExist())
                .andExpect(jsonPath("$.photos[1].publicId").doesNotExist())
                .andExpect(jsonPath("$.photos[1].public_id").doesNotExist());
    }

    @Test
    @DisplayName("getBusinessDetails: 200 OK returns null logoUrl and empty photos array when unconfigured")
    void getBusinessDetails_withoutBranding_returnsNullLogoAndEmptyPhotosArray() throws Exception {
        UUID bizId = UUID.randomUUID();
        UUID locId = UUID.randomUUID();

        // createSampleBusinessDetails uses the 11-arg constructor where logoUrl is null and photos is empty
        BusinessDetailsDto dto = createSampleBusinessDetails(bizId, locId);

        given(businessService.getBusinessDetails(bizId, null)).willReturn(dto);

        mockMvc.perform(get("/api/v2/businesses/" + bizId)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.logoUrl", nullValue()))
                .andExpect(jsonPath("$.photos", hasSize(0)));
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // SPRINT 10 STAGE 2: CUSTOMER REVIEWS & RATINGS ENDPOINT TESTS
    // ═════════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("getBusinessDetails: 200 OK includes dynamic ratingSummary in business details response")
    void getBusinessDetails_withRatingSummary_returns200OkWithRatingSummary() throws Exception {
        UUID bizId = UUID.randomUUID();
        UUID locId = UUID.randomUUID();
        BusinessLocationDto locDto = new BusinessLocationDto(
                locId, "123 Market St", "Bandra", "Mumbai", "Maharashtra", "400050",
                "India", 19.0760, 72.8777, true
        );
        OperatingHoursStatusDto hours = new OperatingHoursStatusDto(true, true, "Open now", null, List.of());

        BusinessDetailsDto dto = new BusinessDetailsDto(
                bizId,
                "Apex Spices",
                "Finest wholesale spices",
                new CategoryDto(UUID.randomUUID(), "Grocery"),
                "https://res.cloudinary.com/demo/image/upload/v1/logo.png",
                "+91 9876543210",
                "hello@apexspices.com",
                "https://apexspices.com",
                List.of(locDto),
                locDto,
                hours,
                List.of(),
                List.of(),
                new ReviewSummaryDto(4.6, 25L)
        );

        given(businessService.getBusinessDetails(bizId, null)).willReturn(dto);

        mockMvc.perform(get("/api/v2/businesses/" + bizId)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ratingSummary").exists())
                .andExpect(jsonPath("$.ratingSummary.averageRating", is(4.6)))
                .andExpect(jsonPath("$.ratingSummary.totalReviews", is(25)));
    }

    @Test
    @DisplayName("getBusinessReviews: 200 OK returns paginated reviews with deterministic ordering and summary")
    void getBusinessReviews_validRequest_returns200OkWithPaginatedReviews() throws Exception {
        UUID bizId = UUID.randomUUID();
        UUID rId = UUID.randomUUID();
        UUID uId = UUID.randomUUID();
        LocalDateTime reviewTime = LocalDateTime.of(2026, 9, 29, 10, 30, 0);

        BusinessReviewDto reviewDto = new BusinessReviewDto(
                rId,
                bizId,
                uId,
                "Aarav Sharma",
                5,
                "Outstanding spices, top-notch aroma and quick delivery!",
                reviewTime
        );

        ReviewSummaryDto summary = new ReviewSummaryDto(4.8, 15L);
        BusinessReviewPageResponse pageResponse = new BusinessReviewPageResponse(
                List.of(reviewDto),
                0,
                10,
                15L,
                2,
                summary
        );

        given(reviewService.getBusinessReviews(bizId, 0, 10)).willReturn(pageResponse);

        mockMvc.perform(get("/api/v2/businesses/" + bizId + "/reviews")
                        .param("page", "0")
                        .param("size", "10")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].id", is(rId.toString())))
                .andExpect(jsonPath("$.content[0].businessId", is(bizId.toString())))
                .andExpect(jsonPath("$.content[0].userId", is(uId.toString())))
                .andExpect(jsonPath("$.content[0].reviewerName", is("Aarav Sharma")))
                .andExpect(jsonPath("$.content[0].rating", is(5)))
                .andExpect(jsonPath("$.content[0].comment", is("Outstanding spices, top-notch aroma and quick delivery!")))
                .andExpect(jsonPath("$.content[0].createdAt", is("2026-09-29T10:30:00")))
                .andExpect(jsonPath("$.page", is(0)))
                .andExpect(jsonPath("$.size", is(10)))
                .andExpect(jsonPath("$.totalElements", is(15)))
                .andExpect(jsonPath("$.totalPages", is(2)))
                .andExpect(jsonPath("$.summary.averageRating", is(4.8)))
                .andExpect(jsonPath("$.summary.totalReviews", is(15)));

        verify(reviewService).getBusinessReviews(bizId, 0, 10);
    }

    @Test
    @DisplayName("getBusinessReviews: 200 OK returns empty reviews array and null rating when no reviews exist")
    void getBusinessReviews_emptyReviews_returns200OkWithEmptyContentAndZeroCount() throws Exception {
        UUID bizId = UUID.randomUUID();
        BusinessReviewPageResponse emptyResponse = new BusinessReviewPageResponse(
                List.of(),
                0,
                10,
                0L,
                0,
                ReviewSummaryDto.empty()
        );

        given(reviewService.getBusinessReviews(bizId, 0, 10)).willReturn(emptyResponse);

        mockMvc.perform(get("/api/v2/businesses/" + bizId + "/reviews")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(0)))
                .andExpect(jsonPath("$.totalElements", is(0)))
                .andExpect(jsonPath("$.totalPages", is(0)))
                .andExpect(jsonPath("$.summary.averageRating", nullValue()))
                .andExpect(jsonPath("$.summary.totalReviews", is(0)));
    }

    @Test
    @DisplayName("getBusinessReviews: 404 Not Found when business is not found or not approved")
    void getBusinessReviews_missingOrUnapprovedBusiness_returns404NotFound() throws Exception {
        UUID bizId = UUID.randomUUID();
        given(reviewService.getBusinessReviews(bizId, 0, 10))
                .willThrow(new ResourceNotFoundException("Business not found with id: " + bizId));

        mockMvc.perform(get("/api/v2/businesses/" + bizId + "/reviews")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status", is(404)))
                .andExpect(jsonPath("$.error", is("Not Found")))
                .andExpect(jsonPath("$.message", is("Business not found with id: " + bizId)));
    }

    @Test
    @DisplayName("getBusinessReviews: 400 Bad Request when path variable id is malformed UUID")
    void getBusinessReviews_invalidUuid_returns400BadRequest() throws Exception {
        mockMvc.perform(get("/api/v2/businesses/not-a-valid-uuid/reviews")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status", is(400)))
                .andExpect(jsonPath("$.error", is("Bad Request")));
    }

    @Test
    @DisplayName("getBusinessReviews: 400 Bad Request when page is negative")
    void getBusinessReviews_negativePage_returns400BadRequest() throws Exception {
        UUID bizId = UUID.randomUUID();
        given(reviewService.getBusinessReviews(bizId, -1, 10))
                .willThrow(new IllegalArgumentException("Page index must not be less than zero"));

        mockMvc.perform(get("/api/v2/businesses/" + bizId + "/reviews")
                        .param("page", "-1")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status", is(400)))
                .andExpect(jsonPath("$.message", is("Page index must not be less than zero")));
    }

    @Test
    @DisplayName("getBusinessReviews: 400 Bad Request when size is invalid (<= 0 or > 50)")
    void getBusinessReviews_invalidSize_returns400BadRequest() throws Exception {
        UUID bizId = UUID.randomUUID();
        given(reviewService.getBusinessReviews(bizId, 0, 100))
                .willThrow(new IllegalArgumentException("Page size must be between 1 and 50"));

        mockMvc.perform(get("/api/v2/businesses/" + bizId + "/reviews")
                        .param("size", "100")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status", is(400)))
                .andExpect(jsonPath("$.message", is("Page size must be between 1 and 50")));
    }

    @Test
    @DisplayName("getBusinessReviews: defaults to page 0 and size 10 when pagination params are omitted")
    void getBusinessReviews_omittedPagination_usesDefaults() throws Exception {
        UUID bizId = UUID.randomUUID();
        BusinessReviewPageResponse defaultResponse = new BusinessReviewPageResponse(
                List.of(),
                0,
                10,
                0L,
                0,
                ReviewSummaryDto.empty()
        );

        given(reviewService.getBusinessReviews(bizId, 0, 10)).willReturn(defaultResponse);

        mockMvc.perform(get("/api/v2/businesses/" + bizId + "/reviews")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());

        verify(reviewService).getBusinessReviews(bizId, 0, 10);
    }
}

