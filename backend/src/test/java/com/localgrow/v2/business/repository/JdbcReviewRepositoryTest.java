package com.localgrow.v2.business.repository;

import com.localgrow.v2.business.dto.BusinessReviewDto;
import com.localgrow.v2.business.dto.ReviewSummaryDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.BadSqlGrammarException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.jdbc.core.RowMapper;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class JdbcReviewRepositoryTest {

    @Mock
    private JdbcTemplate jdbcTemplate;

    private JdbcReviewRepository repository;

    @BeforeEach
    void setUp() {
        repository = new JdbcReviewRepository(jdbcTemplate);
    }

    @Test
    @DisplayName("getReviewSummary: returns dynamic average and count from result set")
    void getReviewSummary_withResults_returnsSummary() throws SQLException {
        UUID businessId = UUID.randomUUID();

        ResultSet rs = mock(ResultSet.class);
        given(rs.next()).willReturn(true);
        given(rs.getLong("total_reviews")).willReturn(5L);
        given(rs.getBigDecimal("avg_rating")).willReturn(new BigDecimal("4.4"));

        given(jdbcTemplate.query(anyString(), any(ResultSetExtractor.class), eq(businessId)))
                .willAnswer(invocation -> {
                    ResultSetExtractor<ReviewSummaryDto> extractor = invocation.getArgument(1);
                    return extractor.extractData(rs);
                });

        ReviewSummaryDto summary = repository.getReviewSummary(businessId);

        assertThat(summary).isNotNull();
        assertThat(summary.averageRating()).isEqualTo(4.4);
        assertThat(summary.totalReviews()).isEqualTo(5L);
    }

    @Test
    @DisplayName("getReviewSummary: returns empty summary when total_reviews is 0")
    void getReviewSummary_zeroReviews_returnsEmptySummary() throws SQLException {
        UUID businessId = UUID.randomUUID();

        ResultSet rs = mock(ResultSet.class);
        given(rs.next()).willReturn(true);
        given(rs.getLong("total_reviews")).willReturn(0L);

        given(jdbcTemplate.query(anyString(), any(ResultSetExtractor.class), eq(businessId)))
                .willAnswer(invocation -> {
                    ResultSetExtractor<ReviewSummaryDto> extractor = invocation.getArgument(1);
                    return extractor.extractData(rs);
                });

        ReviewSummaryDto summary = repository.getReviewSummary(businessId);

        assertThat(summary).isNotNull();
        assertThat(summary.averageRating()).isNull();
        assertThat(summary.totalReviews()).isEqualTo(0L);
    }

    @Test
    @DisplayName("getReviewSummary: gracefully returns empty summary when business_reviews table does not exist (42P01)")
    void getReviewSummary_missingTable_returnsEmptySummaryGracefully() {
        UUID businessId = UUID.randomUUID();
        SQLException sqlEx = new SQLException("relation \"public.business_reviews\" does not exist", "42P01");
        BadSqlGrammarException badSqlEx = new BadSqlGrammarException("task", "SQL", sqlEx);

        given(jdbcTemplate.query(anyString(), any(ResultSetExtractor.class), eq(businessId)))
                .willThrow(badSqlEx);

        ReviewSummaryDto summary = repository.getReviewSummary(businessId);

        assertThat(summary).isNotNull();
        assertThat(summary.averageRating()).isNull();
        assertThat(summary.totalReviews()).isEqualTo(0L);
    }

    @Test
    @DisplayName("findReviewsByBusinessId: maps reviewer full_name, username fallback, and Customer default")
    void findReviewsByBusinessId_mapsReviewerNameCorrectly() throws SQLException {
        UUID businessId = UUID.randomUUID();
        UUID rId = UUID.randomUUID();
        UUID uId = UUID.randomUUID();
        Timestamp now = Timestamp.valueOf(LocalDateTime.now());

        ResultSet rs = mock(ResultSet.class);
        given(rs.getObject("id")).willReturn(rId);
        given(rs.getObject("business_id")).willReturn(businessId);
        given(rs.getObject("user_id")).willReturn(uId);
        given(rs.getInt("rating")).willReturn(5);
        given(rs.getString("comment")).willReturn("Super fresh!");
        given(rs.getTimestamp("created_at")).willReturn(now);
        given(rs.getString("full_name")).willReturn("Suresh Raina");
        given(rs.getString("username")).willReturn("suresh");

        ArgumentCaptor<RowMapper<BusinessReviewDto>> mapperCaptor = ArgumentCaptor.forClass(RowMapper.class);
        given(jdbcTemplate.query(anyString(), mapperCaptor.capture(), eq(businessId), eq(10), eq(0)))
                .willAnswer(invocation -> List.of(mapperCaptor.getValue().mapRow(rs, 1)));

        List<BusinessReviewDto> reviews = repository.findReviewsByBusinessId(businessId, 10, 0);

        assertThat(reviews).hasSize(1);
        assertThat(reviews.get(0).reviewerName()).isEqualTo("Suresh Raina");
        assertThat(reviews.get(0).rating()).isEqualTo(5);
        assertThat(reviews.get(0).comment()).isEqualTo("Super fresh!");
    }

    @Test
    @DisplayName("findReviewsByBusinessId: falls back to username when full_name is null")
    void findReviewsByBusinessId_fallsBackToUsernameWhenFullNameNull() throws SQLException {
        UUID businessId = UUID.randomUUID();
        UUID rId = UUID.randomUUID();
        UUID uId = UUID.randomUUID();

        ResultSet rs = mock(ResultSet.class);
        given(rs.getObject("id")).willReturn(rId);
        given(rs.getObject("business_id")).willReturn(businessId);
        given(rs.getObject("user_id")).willReturn(uId);
        given(rs.getInt("rating")).willReturn(4);
        given(rs.getString("comment")).willReturn(null);
        given(rs.getTimestamp("created_at")).willReturn(null);
        given(rs.getString("full_name")).willReturn(null);
        given(rs.getString("username")).willReturn("spicelover99");

        ArgumentCaptor<RowMapper<BusinessReviewDto>> mapperCaptor = ArgumentCaptor.forClass(RowMapper.class);
        given(jdbcTemplate.query(anyString(), mapperCaptor.capture(), eq(businessId), eq(5), eq(0)))
                .willAnswer(invocation -> List.of(mapperCaptor.getValue().mapRow(rs, 1)));

        List<BusinessReviewDto> reviews = repository.findReviewsByBusinessId(businessId, 5, 0);

        assertThat(reviews).hasSize(1);
        assertThat(reviews.get(0).reviewerName()).isEqualTo("spicelover99");
    }

    @Test
    @DisplayName("findReviewsByBusinessId: falls back to 'Customer' when both name and username are blank")
    void findReviewsByBusinessId_fallsBackToCustomerDefault() throws SQLException {
        UUID businessId = UUID.randomUUID();
        UUID rId = UUID.randomUUID();
        UUID uId = UUID.randomUUID();

        ResultSet rs = mock(ResultSet.class);
        given(rs.getObject("id")).willReturn(rId);
        given(rs.getObject("business_id")).willReturn(businessId);
        given(rs.getObject("user_id")).willReturn(uId);
        given(rs.getInt("rating")).willReturn(3);
        given(rs.getString("comment")).willReturn(null);
        given(rs.getTimestamp("created_at")).willReturn(null);
        given(rs.getString("full_name")).willReturn("   ");
        given(rs.getString("username")).willReturn("");

        ArgumentCaptor<RowMapper<BusinessReviewDto>> mapperCaptor = ArgumentCaptor.forClass(RowMapper.class);
        given(jdbcTemplate.query(anyString(), mapperCaptor.capture(), eq(businessId), eq(5), eq(0)))
                .willAnswer(invocation -> List.of(mapperCaptor.getValue().mapRow(rs, 1)));

        List<BusinessReviewDto> reviews = repository.findReviewsByBusinessId(businessId, 5, 0);

        assertThat(reviews).hasSize(1);
        assertThat(reviews.get(0).reviewerName()).isEqualTo("Customer");
    }

    @Test
    @DisplayName("findReviewsByBusinessId: returns empty list when table does not exist (42P01)")
    void findReviewsByBusinessId_missingTable_returnsEmptyListGracefully() {
        UUID businessId = UUID.randomUUID();
        SQLException sqlEx = new SQLException("relation \"public.business_reviews\" does not exist", "42P01");
        BadSqlGrammarException badSqlEx = new BadSqlGrammarException("task", "SQL", sqlEx);

        given(jdbcTemplate.query(anyString(), any(RowMapper.class), eq(businessId), eq(10), eq(0)))
                .willThrow(badSqlEx);

        List<BusinessReviewDto> reviews = repository.findReviewsByBusinessId(businessId, 10, 0);

        assertThat(reviews).isEmpty();
    }

    @Test
    @DisplayName("countReviewsByBusinessId: returns count from database")
    void countReviewsByBusinessId_returnsCount() {
        UUID businessId = UUID.randomUUID();
        given(jdbcTemplate.queryForObject(anyString(), eq(Long.class), eq(businessId))).willReturn(7L);

        long count = repository.countReviewsByBusinessId(businessId);

        assertThat(count).isEqualTo(7L);
    }

    @Test
    @DisplayName("countReviewsByBusinessId: returns 0 when table does not exist (42P01)")
    void countReviewsByBusinessId_missingTable_returnsZeroGracefully() {
        UUID businessId = UUID.randomUUID();
        SQLException sqlEx = new SQLException("relation \"public.business_reviews\" does not exist", "42P01");
        BadSqlGrammarException badSqlEx = new BadSqlGrammarException("task", "SQL", sqlEx);

        given(jdbcTemplate.queryForObject(anyString(), eq(Long.class), eq(businessId)))
                .willThrow(badSqlEx);

        long count = repository.countReviewsByBusinessId(businessId);

        assertThat(count).isEqualTo(0L);
    }
}
