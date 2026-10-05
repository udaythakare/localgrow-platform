package com.localgrow.v2.business.controller;

import com.localgrow.v2.business.dto.BusinessDetailsDto;
import com.localgrow.v2.business.dto.BusinessReviewPageResponse;
import com.localgrow.v2.business.dto.NearbyBusinessesResponse;
import com.localgrow.v2.business.dto.ReviewSummaryDto;
import com.localgrow.v2.business.service.BusinessService;
import com.localgrow.v2.business.service.ReviewService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v2/businesses")
public class BusinessController {

    private final BusinessService businessService;
    private final ReviewService reviewService;

    public BusinessController(BusinessService businessService) {
        this(businessService, null);
    }

    @Autowired
    public BusinessController(BusinessService businessService,
                              @Autowired(required = false) ReviewService reviewService) {
        this.businessService = businessService;
        this.reviewService = reviewService;
    }

    @GetMapping("/nearby")
    public ResponseEntity<NearbyBusinessesResponse> getNearbyBusinesses(
            @RequestParam(name = "latitude") Double latitude,
            @RequestParam(name = "longitude") Double longitude,
            @RequestParam(name = "radiusKm", required = false) Double radiusKm,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size
    ) {
        NearbyBusinessesResponse response = businessService.findNearbyBusinesses(
                latitude, longitude, radiusKm, page, size
        );
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<BusinessDetailsDto> getBusinessDetails(
            @PathVariable("id") UUID id,
            @RequestParam(name = "locationId", required = false) UUID locationId
    ) {
        BusinessDetailsDto response = businessService.getBusinessDetails(id, locationId);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}/reviews")
    public ResponseEntity<BusinessReviewPageResponse> getBusinessReviews(
            @PathVariable("id") UUID id,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "10") int size
    ) {
        if (reviewService == null) {
            return ResponseEntity.ok(new BusinessReviewPageResponse(List.of(), page, size, 0L, 0, ReviewSummaryDto.empty()));
        }
        BusinessReviewPageResponse response = reviewService.getBusinessReviews(id, page, size);
        return ResponseEntity.ok(response);
    }
}
