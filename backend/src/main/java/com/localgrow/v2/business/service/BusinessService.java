package com.localgrow.v2.business.service;

import com.localgrow.v2.business.dto.BusinessDetailsDto;
import com.localgrow.v2.business.dto.BusinessLocationDto;
import com.localgrow.v2.business.dto.BusinessPhotoDto;
import com.localgrow.v2.business.dto.CategoryDto;
import com.localgrow.v2.business.dto.NearbyBusinessDto;
import com.localgrow.v2.business.dto.NearbyBusinessesResponse;
import com.localgrow.v2.business.dto.OperatingHoursStatusDto;
import com.localgrow.v2.business.dto.ReviewSummaryDto;
import com.localgrow.v2.business.entity.BusinessEntity;
import com.localgrow.v2.business.entity.BusinessLocationEntity;
import com.localgrow.v2.business.repository.BusinessPhotoRepository;
import com.localgrow.v2.business.repository.BusinessRepository;
import com.localgrow.v2.business.repository.projection.NearbyBusinessProjection;
import com.localgrow.v2.common.exception.ResourceNotFoundException;
import com.localgrow.v2.coupon.dto.ActiveOfferDto;
import com.localgrow.v2.coupon.service.CouponService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class BusinessService {

    private static final double DEFAULT_RADIUS_KM = 2.0;
    private static final Set<Double> SUPPORTED_RADII_KM = Set.of(
            0.5, 1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0
    );

    private final BusinessRepository businessRepository;
    private final CouponService couponService;
    private final OperatingHoursService operatingHoursService;
    private final BusinessPhotoRepository businessPhotoRepository;
    private final ReviewService reviewService;

    public BusinessService(BusinessRepository businessRepository,
                           CouponService couponService,
                           OperatingHoursService operatingHoursService) {
        this(businessRepository, couponService, operatingHoursService, null, null);
    }

    public BusinessService(BusinessRepository businessRepository,
                           CouponService couponService,
                           OperatingHoursService operatingHoursService,
                           BusinessPhotoRepository businessPhotoRepository) {
        this(businessRepository, couponService, operatingHoursService, businessPhotoRepository, null);
    }

    @Autowired
    public BusinessService(BusinessRepository businessRepository,
                           CouponService couponService,
                           OperatingHoursService operatingHoursService,
                           @Autowired(required = false) BusinessPhotoRepository businessPhotoRepository,
                           @Autowired(required = false) ReviewService reviewService) {
        this.businessRepository = businessRepository;
        this.couponService = couponService;
        this.operatingHoursService = operatingHoursService;
        this.businessPhotoRepository = businessPhotoRepository;
        this.reviewService = reviewService;
    }

    public NearbyBusinessesResponse findNearbyBusinesses(
            Double latitude,
            Double longitude,
            Double radiusKm,
            int page,
            int size
    ) {
        // 1. Validate coordinates
        if (latitude == null) {
            throw new IllegalArgumentException("latitude is required");
        }
        if (latitude.isNaN() || latitude.isInfinite()) {
            throw new IllegalArgumentException("latitude must be a valid number");
        }
        if (latitude < -90.0 || latitude > 90.0) {
            throw new IllegalArgumentException("latitude must be between -90 and 90");
        }

        if (longitude == null) {
            throw new IllegalArgumentException("longitude is required");
        }
        if (longitude.isNaN() || longitude.isInfinite()) {
            throw new IllegalArgumentException("longitude must be a valid number");
        }
        if (longitude < -180.0 || longitude > 180.0) {
            throw new IllegalArgumentException("longitude must be between -180 and 180");
        }

        // 2. Validate/Normalize radiusKm
        double effectiveRadiusKm = radiusKm != null ? radiusKm : DEFAULT_RADIUS_KM;
        if (Double.isNaN(effectiveRadiusKm) || Double.isInfinite(effectiveRadiusKm)) {
            throw new IllegalArgumentException("radiusKm must be a valid number");
        }

        boolean isSupported = SUPPORTED_RADII_KM.stream()
                .anyMatch(supported -> Math.abs(supported - effectiveRadiusKm) < 1e-6);

        if (!isSupported) {
            throw new IllegalArgumentException(
                    "Invalid radiusKm. Supported values are 0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9 and 10."
            );
        }

        // 3. Validate pagination
        if (page < 0) {
            throw new IllegalArgumentException("Page index must not be less than zero");
        }
        if (size <= 0 || size > 50) {
            throw new IllegalArgumentException("Page size must be between 1 and 50");
        }

        // 4. Convert km to meters for PostGIS calculation
        double radiusMeters = effectiveRadiusKm * 1000.0;

        // 5. Execute the PostGIS nearby query (unchanged)
        PageRequest pageRequest = PageRequest.of(page, size);
        Page<NearbyBusinessProjection> projectionPage = businessRepository.findNearbyApprovedBusinesses(
                longitude,
                latitude,
                radiusMeters,
                pageRequest
        );

        // 6. Map projections to DTOs (without offers yet)
        List<NearbyBusinessDto> content = projectionPage.getContent().stream()
                .map(this::mapProjectionToDto)
                .toList();

        // 7. Batch-fetch active offers for this page of businesses (ONE query, no N+1)
        //    Security: business IDs come from the nearby query which already enforces
        //    status = 'approved', so rejected/pending offers are never exposed.
        List<UUID> businessIds = content.stream()
                .map(NearbyBusinessDto::businessId)
                .toList();

        Map<UUID, List<ActiveOfferDto>> offersMap =
                couponService.findActiveOffersGroupedByBusiness(businessIds);

        // 8. Batch-fetch operating hours for this page of locations (ONE query, no N+1)
        List<UUID> locationIds = content.stream()
                .map(NearbyBusinessDto::locationId)
                .filter(Objects::nonNull)
                .toList();

        Map<UUID, OperatingHoursStatusDto> hoursMap =
                operatingHoursService.getOperatingHoursForLocations(locationIds);

        // 9. Attach offers and operating hours to each DTO; default to empty/unconfigured when none found
        List<NearbyBusinessDto> enriched = content.stream()
                .map(dto -> new NearbyBusinessDto(
                        dto.businessId(),
                        dto.name(),
                        dto.description(),
                        dto.locationId(),
                        dto.address(),
                        dto.area(),
                        dto.city(),
                        dto.state(),
                        dto.postalCode(),
                        dto.latitude(),
                        dto.longitude(),
                        dto.distanceKm(),
                        dto.category(),
                        offersMap.getOrDefault(dto.businessId(), List.of()),
                        hoursMap.getOrDefault(dto.locationId(), OperatingHoursStatusDto.unconfigured()),
                        dto.logoUrl(),
                        dto.photoUrl(),
                        dto.ratingSummary()
                ))
                .toList();

        return new NearbyBusinessesResponse(
                enriched,
                projectionPage.getNumber(),
                projectionPage.getSize(),
                projectionPage.getTotalElements(),
                projectionPage.getTotalPages()
        );
    }

    private NearbyBusinessDto mapProjectionToDto(NearbyBusinessProjection proj) {
        Double distanceKm = null;
        if (proj.getDistanceKm() != null) {
            distanceKm = BigDecimal.valueOf(proj.getDistanceKm())
                    .setScale(2, RoundingMode.HALF_UP)
                    .doubleValue();
        }

        CategoryDto category = null;
        if (proj.getCategoryId() != null && proj.getCategoryName() != null) {
            category = new CategoryDto(proj.getCategoryId(), proj.getCategoryName());
        }

        Double lat = proj.getLocationLatitude() != null ? proj.getLocationLatitude().doubleValue() : null;
        Double lng = proj.getLocationLongitude() != null ? proj.getLocationLongitude().doubleValue() : null;

        ReviewSummaryDto ratingSummary = ReviewSummaryDto.empty();
        if (proj.getAverageRating() != null || proj.getTotalReviews() != null) {
            ratingSummary = new ReviewSummaryDto(
                    proj.getAverageRating() != null ? proj.getAverageRating() : 0.0,
                    proj.getTotalReviews() != null ? proj.getTotalReviews().longValue() : 0L
            );
        }

        // activeOffers and operatingHours populated in a second pass after batch-fetch
        return new NearbyBusinessDto(
                proj.getBusinessId(),
                proj.getBusinessName(),
                proj.getBusinessDescription(),
                proj.getLocationId(),
                proj.getLocationAddress(),
                proj.getLocationArea(),
                proj.getLocationCity(),
                proj.getLocationState(),
                proj.getLocationPostalCode(),
                lat,
                lng,
                distanceKm,
                category,
                List.of(),
                OperatingHoursStatusDto.unconfigured(),
                proj.getBusinessLogoUrl(),
                proj.getBusinessPhotoUrl(),
                ratingSummary
        );
    }

    /**
     * Fetches public business details including locations, operating hours for the selected location,
     * and active coupon offers.
     *
     * @param businessId ID of the requested business (must be in 'approved' status)
     * @param locationId optional location ID; if omitted, primary location is selected (with deterministic fallback)
     * @return public BusinessDetailsDto
     * @throws ResourceNotFoundException if business is not found/approved, or if locationId is invalid for this business
     */
    public BusinessDetailsDto getBusinessDetails(UUID businessId, UUID locationId) {
        if (businessId == null) {
            throw new IllegalArgumentException("businessId is required");
        }

        BusinessEntity business = businessRepository.findApprovedBusinessById(businessId)
                .orElseThrow(() -> new ResourceNotFoundException("Business not found with id: " + businessId));

        if (!"approved".equalsIgnoreCase(business.getStatus())) {
            throw new ResourceNotFoundException("Business not found with id: " + businessId);
        }

        CategoryDto category = null;
        if (business.getCategory() != null) {
            category = new CategoryDto(business.getCategory().getId(), business.getCategory().getName());
        }

        List<BusinessLocationEntity> rawLocations = business.getLocations() != null
                ? business.getLocations()
                : List.of();

        Map<UUID, BusinessLocationEntity> locationMap = new LinkedHashMap<>();
        for (BusinessLocationEntity loc : rawLocations) {
            if (loc != null && loc.getId() != null) {
                locationMap.putIfAbsent(loc.getId(), loc);
            }
        }

        Comparator<BusinessLocationEntity> locationComparator = Comparator
                .comparing((BusinessLocationEntity loc) -> Boolean.TRUE.equals(loc.getIsPrimary()), Comparator.reverseOrder())
                .thenComparing(BusinessLocationEntity::getId);

        List<BusinessLocationEntity> sortedLocations = locationMap.values().stream()
                .sorted(locationComparator)
                .toList();

        List<BusinessLocationDto> locationDtos = sortedLocations.stream()
                .map(BusinessLocationDto::fromEntity)
                .toList();

        BusinessLocationEntity selectedEntity;
        if (locationId != null) {
            selectedEntity = locationMap.get(locationId);
            if (selectedEntity == null) {
                throw new ResourceNotFoundException("Location not found with id: " + locationId + " for business: " + businessId);
            }
        } else {
            selectedEntity = sortedLocations.isEmpty() ? null : sortedLocations.get(0);
        }

        BusinessLocationDto selectedLocationDto = BusinessLocationDto.fromEntity(selectedEntity);

        OperatingHoursStatusDto operatingHours = selectedEntity != null
                ? operatingHoursService.getOperatingHoursForLocation(selectedEntity.getId())
                : OperatingHoursStatusDto.unconfigured();

        List<ActiveOfferDto> activeOffers = couponService.findActiveOffersByBusiness(business.getId());

        List<BusinessPhotoDto> photos = List.of();
        if (businessPhotoRepository != null) {
            photos = businessPhotoRepository.findByBusinessIdOrderByDisplayOrderAscCreatedAtAsc(business.getId())
                    .stream()
                    .map(BusinessPhotoDto::fromEntity)
                    .toList();
        }

        ReviewSummaryDto ratingSummary = reviewService != null
                ? reviewService.getReviewSummary(business.getId())
                : ReviewSummaryDto.empty();

        return new BusinessDetailsDto(
                business.getId(),
                business.getName(),
                business.getDescription(),
                category,
                business.getLogoUrl(),
                business.getPhone(),
                business.getEmail(),
                business.getWebsite(),
                locationDtos,
                selectedLocationDto,
                operatingHours,
                activeOffers,
                photos,
                ratingSummary
        );
    }
}

