package com.localgrow.v2.business.repository;

import com.localgrow.v2.business.dto.BusinessReviewDto;
import com.localgrow.v2.business.dto.ReviewSummaryDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.BadSqlGrammarException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Spring JDBC implementation of {@link ReviewRepository}.
 *
 * <p>Uses {@link JdbcTemplate} directly against PostgreSQL rather than an unmigrated JPA {@code @Entity}.
 * This guarantees that the Spring Boot backend can start cleanly against the existing database
 * with {@code spring.jpa.hibernate.ddl-auto: validate} enabled, without failing on the pending
 * {@code public.business_reviews} table.</p>
 */
@Repository
public class JdbcReviewRepository implements ReviewRepository {

    private static final Logger log = LoggerFactory.getLogger(JdbcReviewRepository.class);

    private final JdbcTemplate jdbcTemplate;

    public JdbcReviewRepository() {
        this(null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public JdbcReviewRepository(@org.springframework.beans.factory.annotation.Autowired(required = false) JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private static final RowMapper<BusinessReviewDto> REVIEW_ROW_MAPPER = (rs, rowNum) -> {
        UUID id = (UUID) rs.getObject("id");
        UUID businessId = (UUID) rs.getObject("business_id");
        UUID userId = (UUID) rs.getObject("user_id");
        int rating = rs.getInt("rating");
        String comment = rs.getString("comment");
        Timestamp createdAtTs = rs.getTimestamp("created_at");
        LocalDateTime createdAt = createdAtTs != null ? createdAtTs.toLocalDateTime() : null;

        String fullName = rs.getString("full_name");
        String username = rs.getString("username");
        String reviewerName = "Customer";
        if (fullName != null && !fullName.isBlank()) {
            reviewerName = fullName.trim();
        } else if (username != null && !username.isBlank()) {
            reviewerName = username.trim();
        }

        return new BusinessReviewDto(
                id,
                businessId,
                userId,
                reviewerName,
                rating,
                comment,
                createdAt
        );
    };

    @Override
    public ReviewSummaryDto getReviewSummary(UUID businessId) {
        if (jdbcTemplate == null) {
            return ReviewSummaryDto.empty();
        }
        String sql = """
                SELECT 
                    ROUND(AVG(rating)::numeric, 1) AS avg_rating,
                    COUNT(*) AS total_reviews
                FROM public.business_reviews
                WHERE business_id = ?
                """;
        try {
            return jdbcTemplate.query(sql, rs -> {
                if (rs.next()) {
                    long total = rs.getLong("total_reviews");
                    if (total == 0) {
                        return ReviewSummaryDto.empty();
                    }
                    BigDecimal avgBd = rs.getBigDecimal("avg_rating");
                    Double avg = avgBd != null ? avgBd.doubleValue() : null;
                    return new ReviewSummaryDto(avg, total);
                }
                return ReviewSummaryDto.empty();
            }, businessId);
        } catch (BadSqlGrammarException e) {
            if (isMissingTableException(e)) {
                log.warn("Table public.business_reviews does not exist yet (migration pending). Returning empty rating summary.");
                return ReviewSummaryDto.empty();
            }
            throw e;
        }
    }

    @Override
    public List<BusinessReviewDto> findReviewsByBusinessId(UUID businessId, int limit, int offset) {
        if (jdbcTemplate == null) {
            return List.of();
        }
        String sql = """
                SELECT 
                    r.id,
                    r.business_id,
                    r.user_id,
                    r.rating,
                    r.comment,
                    r.created_at,
                    u.full_name,
                    u.username
                FROM public.business_reviews r
                LEFT JOIN public.users u ON r.user_id = u.id
                WHERE r.business_id = ?
                ORDER BY r.created_at DESC, r.id ASC
                LIMIT ? OFFSET ?
                """;
        try {
            return jdbcTemplate.query(sql, REVIEW_ROW_MAPPER, businessId, limit, offset);
        } catch (BadSqlGrammarException e) {
            if (isMissingTableException(e)) {
                log.warn("Table public.business_reviews does not exist yet (migration pending). Returning empty review list.");
                return List.of();
            }
            throw e;
        }
    }

    @Override
    public long countReviewsByBusinessId(UUID businessId) {
        if (jdbcTemplate == null) {
            return 0L;
        }
        String sql = "SELECT COUNT(*) FROM public.business_reviews WHERE business_id = ?";
        try {
            Long count = jdbcTemplate.queryForObject(sql, Long.class, businessId);
            return count != null ? count : 0L;
        } catch (BadSqlGrammarException e) {
            if (isMissingTableException(e)) {
                log.warn("Table public.business_reviews does not exist yet (migration pending). Returning 0 review count.");
                return 0L;
            }
            throw e;
        }
    }

    private boolean isMissingTableException(BadSqlGrammarException e) {
        return (e.getSQLException() != null && "42P01".equals(e.getSQLException().getSQLState()))
                || (e.getMessage() != null && e.getMessage().contains("does not exist"));
    }
}
