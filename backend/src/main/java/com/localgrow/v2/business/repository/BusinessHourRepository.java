package com.localgrow.v2.business.repository;

import com.localgrow.v2.business.entity.BusinessHourEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface BusinessHourRepository extends JpaRepository<BusinessHourEntity, UUID> {

    @Query("SELECT bh FROM BusinessHourEntity bh WHERE bh.locationId IN :locationIds ORDER BY bh.locationId ASC, bh.dayOfWeek ASC")
    List<BusinessHourEntity> findByLocationIdIn(@Param("locationIds") Collection<UUID> locationIds);

    List<BusinessHourEntity> findByLocationIdOrderByDayOfWeekAsc(UUID locationId);

    @Query(value = "SELECT id, timezone FROM public.business_locations WHERE id IN (:locationIds)", nativeQuery = true)
    List<Object[]> findTimezonesByLocationIds(@Param("locationIds") Collection<UUID> locationIds);
}
