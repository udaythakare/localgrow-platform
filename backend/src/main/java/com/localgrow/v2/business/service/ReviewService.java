package com.localgrow.v2.business.service;

import com.localgrow.v2.business.dto.BusinessReviewDto;
import com.localgrow.v2.business.dto.BusinessReviewPageResponse;
import com.localgrow.v2.business.dto.ReviewSummaryDto;
import com.localgrow.v2.business.entity.BusinessEntity;
import com.localgrow.v2.business.repository.BusinessRepository;
import com.localgrow.v2.business.repository.ReviewRepository;
import com.localgrow.v2.common.exception.ResourceNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Service for customer reviews and ratings of approved businesses.
 */
@Service
@Transactional(readOnly = true)
public class ReviewService {

    private final ReviewRepository reviewRepository;
    private final BusinessRepository businessRepository;

    public ReviewService(ReviewRepository reviewRepository, BusinessRepository businessRepository) {
        this.reviewRepository = reviewRepository;
        this.businessRepository = businessRepository;
    }

    /**
     * Retrieves the dynamic rating summary for a business.
     *
     * @param businessId ID of the business
     * @return dynamic rating summary containing average rating and count
     */
    public ReviewSummaryDto getReviewSummary(UUID businessId) {
        if (businessId == null) {
            throw new IllegalArgumentException("businessId is required");
        }
        return reviewRepository.getReviewSummary(businessId);
    }

    /**
     * Retrieves paginated customer reviews with deterministic ordering (newest first)
     * for an approved business.
     *
     * @param businessId ID of the requested business (must be in 'approved' status)
     * @param page zero-based page index
     * @param size page size (1 to 50)
     * @return paginated reviews response with metadata and rating summary
     * @throws ResourceNotFoundException if the business does not exist or is not approved
     * @throws IllegalArgumentException if pagination arguments are invalid
     */
    public BusinessReviewPageResponse getBusinessReviews(UUID businessId, int page, int size) {
        if (businessId == null) {
            throw new IllegalArgumentException("businessId is required");
        }
        if (page < 0) {
            throw new IllegalArgumentException("Page index must not be less than zero");
        }
        if (size <= 0 || size > 50) {
            throw new IllegalArgumentException("Page size must be between 1 and 50");
        }

        // Enforce approved-business visibility rule
        BusinessEntity business = businessRepository.findApprovedBusinessById(businessId)
                .orElseThrow(() -> new ResourceNotFoundException("Business not found with id: " + businessId));

        if (!"approved".equalsIgnoreCase(business.getStatus())) {
            throw new ResourceNotFoundException("Business not found with id: " + businessId);
        }

        int offset = page * size;
        List<BusinessReviewDto> content = reviewRepository.findReviewsByBusinessId(businessId, size, offset);
        long totalElements = reviewRepository.countReviewsByBusinessId(businessId);
        int totalPages = size == 0 ? 0 : (int) Math.ceil((double) totalElements / size);
        ReviewSummaryDto summary = reviewRepository.getReviewSummary(businessId);

        return new BusinessReviewPageResponse(
                content,
                page,
                size,
                totalElements,
                totalPages,
                summary
        );
    }
}
