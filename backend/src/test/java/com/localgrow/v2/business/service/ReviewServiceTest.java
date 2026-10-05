package com.localgrow.v2.business.service;

import com.localgrow.v2.business.dto.BusinessReviewDto;
import com.localgrow.v2.business.dto.BusinessReviewPageResponse;
import com.localgrow.v2.business.dto.ReviewSummaryDto;
import com.localgrow.v2.business.entity.BusinessEntity;
import com.localgrow.v2.business.repository.BusinessRepository;
import com.localgrow.v2.business.repository.ReviewRepository;
import com.localgrow.v2.common.exception.ResourceNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class ReviewServiceTest {

    @Mock
    private ReviewRepository reviewRepository;

    @Mock
    private BusinessRepository businessRepository;

    private ReviewService reviewService;

    @BeforeEach
    void setUp() {
        reviewService = new ReviewService(reviewRepository, businessRepository);
    }

    private BusinessEntity createApprovedBusiness(UUID id) {
        BusinessEntity entity = new BusinessEntity();
        entity.setId(id);
        entity.setName("Test Spice Mart");
        entity.setStatus("approved");
        return entity;
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // 1. DYNAMIC AGGREGATE CALCULATION & SUMMARY
    // ═════════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("Dynamic Aggregate Rating & Summary")
    class RatingSummaryTests {

        @Test
        @DisplayName("Returns dynamic average rating and count when reviews exist")
        void getReviewSummary_withReviews_returnsDynamicAverageAndCount() {
            UUID businessId = UUID.randomUUID();
            ReviewSummaryDto summary = new ReviewSummaryDto(4.5, 12L);

            given(reviewRepository.getReviewSummary(businessId)).willReturn(summary);

            ReviewSummaryDto result = reviewService.getReviewSummary(businessId);

            assertThat(result).isNotNull();
            assertThat(result.averageRating()).isEqualTo(4.5);
            assertThat(result.totalReviews()).isEqualTo(12L);
            verify(reviewRepository).getReviewSummary(businessId);
        }

        @Test
        @DisplayName("Returns null average rating and 0 count when no reviews exist")
        void getReviewSummary_emptyReviews_returnsNullAverageAndZeroCount() {
            UUID businessId = UUID.randomUUID();
            given(reviewRepository.getReviewSummary(businessId)).willReturn(ReviewSummaryDto.empty());

            ReviewSummaryDto result = reviewService.getReviewSummary(businessId);

            assertThat(result).isNotNull();
            assertThat(result.averageRating()).isNull();
            assertThat(result.totalReviews()).isEqualTo(0L);
        }

        @Test
        @DisplayName("Throws IllegalArgumentException when businessId is null for summary")
        void getReviewSummary_nullBusinessId_throwsIllegalArgument() {
            assertThatThrownBy(() -> reviewService.getReviewSummary(null))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("businessId is required");
        }
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // 2. PAGINATED REVIEWS RETRIEVAL & DETERMINISTIC ORDERING
    // ═════════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("Paginated Reviews Retrieval")
    class PaginatedReviewsTests {

        @Test
        @DisplayName("Returns paginated reviews with deterministic ordering and metadata for approved business")
        void getBusinessReviews_validRequest_returnsPaginatedResponse() {
            UUID businessId = UUID.randomUUID();
            BusinessEntity approvedBusiness = createApprovedBusiness(businessId);
            given(businessRepository.findApprovedBusinessById(businessId)).willReturn(Optional.of(approvedBusiness));

            UUID review1Id = UUID.randomUUID();
            UUID review2Id = UUID.randomUUID();
            LocalDateTime now = LocalDateTime.now();

            BusinessReviewDto r1 = new BusinessReviewDto(
                    review1Id, businessId, UUID.randomUUID(), "Rahul Sharma", 5, "Great service!", now
            );
            BusinessReviewDto r2 = new BusinessReviewDto(
                    review2Id, businessId, UUID.randomUUID(), "Priya Patel", 4, "Good spices.", now.minusDays(1)
            );

            given(reviewRepository.findReviewsByBusinessId(businessId, 10, 0))
                    .willReturn(List.of(r1, r2));
            given(reviewRepository.countReviewsByBusinessId(businessId)).willReturn(2L);
            given(reviewRepository.getReviewSummary(businessId)).willReturn(new ReviewSummaryDto(4.5, 2L));

            BusinessReviewPageResponse response = reviewService.getBusinessReviews(businessId, 0, 10);

            assertThat(response).isNotNull();
            assertThat(response.content()).hasSize(2);
            assertThat(response.content().get(0).id()).isEqualTo(review1Id);
            assertThat(response.content().get(0).rating()).isEqualTo(5);
            assertThat(response.content().get(0).reviewerName()).isEqualTo("Rahul Sharma");
            assertThat(response.content().get(1).id()).isEqualTo(review2Id);
            assertThat(response.page()).isEqualTo(0);
            assertThat(response.size()).isEqualTo(10);
            assertThat(response.totalElements()).isEqualTo(2L);
            assertThat(response.totalPages()).isEqualTo(1);
            assertThat(response.summary()).isNotNull();
            assertThat(response.summary().averageRating()).isEqualTo(4.5);
            assertThat(response.summary().totalReviews()).isEqualTo(2L);

            verify(reviewRepository).findReviewsByBusinessId(businessId, 10, 0);
        }

        @Test
        @DisplayName("Returns empty reviews list, 0 totalPages, and empty summary when business has no reviews")
        void getBusinessReviews_emptyReviews_returnsEmptyPageResponse() {
            UUID businessId = UUID.randomUUID();
            BusinessEntity approvedBusiness = createApprovedBusiness(businessId);
            given(businessRepository.findApprovedBusinessById(businessId)).willReturn(Optional.of(approvedBusiness));

            given(reviewRepository.findReviewsByBusinessId(businessId, 10, 0)).willReturn(List.of());
            given(reviewRepository.countReviewsByBusinessId(businessId)).willReturn(0L);
            given(reviewRepository.getReviewSummary(businessId)).willReturn(ReviewSummaryDto.empty());

            BusinessReviewPageResponse response = reviewService.getBusinessReviews(businessId, 0, 10);

            assertThat(response).isNotNull();
            assertThat(response.content()).isEmpty();
            assertThat(response.page()).isEqualTo(0);
            assertThat(response.size()).isEqualTo(10);
            assertThat(response.totalElements()).isEqualTo(0L);
            assertThat(response.totalPages()).isEqualTo(0);
            assertThat(response.summary().averageRating()).isNull();
            assertThat(response.summary().totalReviews()).isEqualTo(0L);
        }

        @Test
        @DisplayName("Calculates correct offset and totalPages for multi-page pagination")
        void getBusinessReviews_secondPage_calculatesCorrectOffsetAndTotalPages() {
            UUID businessId = UUID.randomUUID();
            BusinessEntity approvedBusiness = createApprovedBusiness(businessId);
            given(businessRepository.findApprovedBusinessById(businessId)).willReturn(Optional.of(approvedBusiness));

            given(reviewRepository.findReviewsByBusinessId(businessId, 5, 5)).willReturn(List.of());
            given(reviewRepository.countReviewsByBusinessId(businessId)).willReturn(12L);
            given(reviewRepository.getReviewSummary(businessId)).willReturn(new ReviewSummaryDto(4.2, 12L));

            BusinessReviewPageResponse response = reviewService.getBusinessReviews(businessId, 1, 5);

            assertThat(response.page()).isEqualTo(1);
            assertThat(response.size()).isEqualTo(5);
            assertThat(response.totalElements()).isEqualTo(12L);
            assertThat(response.totalPages()).isEqualTo(3); // ceil(12 / 5) = 3
            verify(reviewRepository).findReviewsByBusinessId(businessId, 5, 5);
        }
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // 3. INVALID BUSINESS IDS & APPROVED BUSINESS RESTRICTIONS
    // ═════════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("Invalid Business ID & Approval Status Checks")
    class BusinessValidationTests {

        @Test
        @DisplayName("Throws ResourceNotFoundException when business does not exist")
        void getBusinessReviews_businessNotFound_throwsResourceNotFound() {
            UUID businessId = UUID.randomUUID();
            given(businessRepository.findApprovedBusinessById(businessId)).willReturn(Optional.empty());

            assertThatThrownBy(() -> reviewService.getBusinessReviews(businessId, 0, 10))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("Business not found with id: " + businessId);

            verify(reviewRepository, never()).findReviewsByBusinessId(any(), anyInt(), anyInt());
        }

        @ParameterizedTest
        @ValueSource(strings = {"pending", "rejected", "draft", "suspended"})
        @DisplayName("Throws ResourceNotFoundException when business status is not approved")
        void getBusinessReviews_unapprovedStatus_throwsResourceNotFound(String nonApprovedStatus) {
            UUID businessId = UUID.randomUUID();
            BusinessEntity nonApprovedBusiness = new BusinessEntity();
            nonApprovedBusiness.setId(businessId);
            nonApprovedBusiness.setStatus(nonApprovedStatus);

            given(businessRepository.findApprovedBusinessById(businessId)).willReturn(Optional.of(nonApprovedBusiness));

            assertThatThrownBy(() -> reviewService.getBusinessReviews(businessId, 0, 10))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("Business not found with id: " + businessId);

            verify(reviewRepository, never()).findReviewsByBusinessId(any(), anyInt(), anyInt());
        }

        @Test
        @DisplayName("Throws IllegalArgumentException when businessId is null")
        void getBusinessReviews_nullBusinessId_throwsIllegalArgument() {
            assertThatThrownBy(() -> reviewService.getBusinessReviews(null, 0, 10))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("businessId is required");
        }

        @Test
        @DisplayName("Throws IllegalArgumentException when page is negative")
        void getBusinessReviews_negativePage_throwsIllegalArgument() {
            UUID businessId = UUID.randomUUID();
            assertThatThrownBy(() -> reviewService.getBusinessReviews(businessId, -1, 10))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Page index must not be less than zero");
        }

        @ParameterizedTest
        @ValueSource(ints = {0, -1, 51, 100})
        @DisplayName("Throws IllegalArgumentException when size is out of bounds (<= 0 or > 50)")
        void getBusinessReviews_invalidSize_throwsIllegalArgument(int invalidSize) {
            UUID businessId = UUID.randomUUID();
            assertThatThrownBy(() -> reviewService.getBusinessReviews(businessId, 0, invalidSize))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Page size must be between 1 and 50");
        }
    }
}
