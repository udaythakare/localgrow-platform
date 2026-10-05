package com.localgrow.v2.business.repository;

import com.localgrow.v2.business.entity.BusinessEntity;
import com.localgrow.v2.business.repository.projection.NearbyBusinessProjection;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface BusinessRepository extends JpaRepository<BusinessEntity, UUID> {

    @Query("""
        SELECT DISTINCT b FROM BusinessEntity b
        LEFT JOIN FETCH b.category
        LEFT JOIN FETCH b.locations
        WHERE b.id = :id AND b.status = 'approved'
    """)
    Optional<BusinessEntity> findApprovedBusinessById(@Param("id") UUID id);

    @Query(
        value = """
            WITH qualifying_locations AS (
                SELECT 
                    b.id AS business_id,
                    b.name AS business_name,
                    b.description AS business_description,
                    b.logo_url AS business_logo_url,
                    (SELECT bp.image_url FROM public.business_photos bp WHERE bp.business_id = b.id ORDER BY bp.display_order ASC, bp.created_at ASC LIMIT 1) AS business_photo_url,
                    (SELECT ROUND(AVG(br.rating)::numeric, 1)::double precision FROM public.business_reviews br WHERE br.business_id = b.id) AS average_rating,
                    (SELECT COUNT(br.id)::int FROM public.business_reviews br WHERE br.business_id = b.id) AS total_reviews,
                    bl.id AS location_id,
                    bl.address AS location_address,
                    bl.area AS location_area,
                    bl.city AS location_city,
                    bl.state AS location_state,
                    bl.postal_code AS location_postal_code,
                    bl.latitude AS location_latitude,
                    bl.longitude AS location_longitude,
                    bl.is_primary AS location_is_primary,
                    bc.id AS category_id,
                    bc.name AS category_name,
                    (ST_Distance(bl.geom::geography, ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography) / 1000.0) AS distance_km,
                    ROW_NUMBER() OVER (
                        PARTITION BY b.id 
                        ORDER BY ST_Distance(bl.geom::geography, ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography) ASC,
                                 bl.is_primary DESC,
                                 bl.id ASC
                    ) AS rn
                FROM public.businesses b
                JOIN public.business_locations bl ON bl.business_id = b.id
                LEFT JOIN public.business_categories bc ON bc.id = b.category_id
                WHERE b.status = 'approved'
                  AND bl.geom IS NOT NULL
                  AND ST_DWithin(
                      bl.geom::geography,
                      ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography,
                      :radiusMeters
                  )
            )
            SELECT 
                business_id,
                business_name,
                business_description,
                business_logo_url,
                business_photo_url,
                average_rating,
                total_reviews,
                location_id,
                location_address,
                location_area,
                location_city,
                location_state,
                location_postal_code,
                location_latitude,
                location_longitude,
                location_is_primary,
                category_id,
                category_name,
                distance_km
            FROM qualifying_locations
            WHERE rn = 1
            ORDER BY distance_km ASC, business_id ASC
            """,
        countQuery = """
            SELECT COUNT(DISTINCT b.id)
            FROM public.businesses b
            JOIN public.business_locations bl ON bl.business_id = b.id
            WHERE b.status = 'approved'
              AND bl.geom IS NOT NULL
              AND ST_DWithin(
                  bl.geom::geography,
                  ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography,
                  :radiusMeters
              )
            """,
        nativeQuery = true
    )
    Page<NearbyBusinessProjection> findNearbyApprovedBusinesses(
        @Param("longitude") double longitude,
        @Param("latitude") double latitude,
        @Param("radiusMeters") double radiusMeters,
        Pageable pageable
    );
}
