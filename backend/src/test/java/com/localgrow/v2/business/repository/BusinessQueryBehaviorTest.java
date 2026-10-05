package com.localgrow.v2.business.repository;

import com.localgrow.v2.business.repository.projection.NearbyBusinessProjection;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.jpa.repository.Query;

import java.lang.reflect.Method;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Validates the SQL contract, constraints, visibility rules, and query semantics
 * of the native PostGIS spatial query defined on BusinessRepository.
 */
class BusinessQueryBehaviorTest {

    @Test
    @DisplayName("Verify BusinessRepository native query adheres to PostGIS and visibility specifications")
    void verifyNativeQueryContract() throws NoSuchMethodException {
        Method method = BusinessRepository.class.getMethod(
                "findNearbyApprovedBusinesses",
                double.class,
                double.class,
                double.class,
                org.springframework.data.domain.Pageable.class
        );

        Query queryAnnotation = method.getAnnotation(Query.class);
        assertThat(queryAnnotation).isNotNull();
        assertThat(queryAnnotation.nativeQuery()).isTrue();

        String sql = queryAnnotation.value();
        String countSql = queryAnnotation.countQuery();

        // 1. Status visibility rule: strictly approved businesses only
        assertThat(sql).contains("b.status = 'approved'");
        assertThat(countSql).contains("b.status = 'approved'");

        // 2. Exclusion of null geom
        assertThat(sql).contains("bl.geom IS NOT NULL");
        assertThat(countSql).contains("bl.geom IS NOT NULL");

        // 3. PostGIS spatial radius filter using ST_DWithin and geography casting
        assertThat(sql).contains("ST_DWithin(");
        assertThat(sql).contains("bl.geom::geography");
        assertThat(sql).contains("ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography");
        assertThat(sql).contains(":radiusMeters");

        // 4. PostGIS distance calculation using ST_Distance and geography casting, converted to km
        assertThat(sql).contains("ST_Distance(");
        assertThat(sql).contains("/ 1000.0");
        assertThat(sql).contains("AS distance_km");

        // 5. Multiple locations handling: deduplicate per business selecting nearest qualifying location
        assertThat(sql).contains("ROW_NUMBER() OVER");
        assertThat(sql).contains("PARTITION BY b.id");
        assertThat(sql).contains("WHERE rn = 1");

        // 6. Distance ordering: nearest first, with deterministic secondary ordering by business id
        assertThat(sql).contains("ORDER BY distance_km ASC, business_id ASC");

        // 7. Count query counts distinct approved businesses within radius
        assertThat(countSql).contains("COUNT(DISTINCT b.id)");
    }

    @Test
    @DisplayName("Projection interface maps all expected columns deterministically")
    void verifyProjectionInterfaceMethods() {
        Method[] methods = NearbyBusinessProjection.class.getMethods();

        assertThat(methods).extracting(Method::getName).contains(
                "getBusinessId",
                "getBusinessName",
                "getBusinessDescription",
                "getLocationId",
                "getLocationAddress",
                "getLocationArea",
                "getLocationCity",
                "getLocationState",
                "getLocationPostalCode",
                "getLocationLatitude",
                "getLocationLongitude",
                "getDistanceKm",
                "getCategoryId",
                "getCategoryName"
        );
    }
}
