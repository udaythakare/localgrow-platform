package com.localgrow.v2.business.repository;

import com.localgrow.v2.business.entity.BusinessPhotoEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface BusinessPhotoRepository extends JpaRepository<BusinessPhotoEntity, UUID> {

    List<BusinessPhotoEntity> findByBusinessIdOrderByDisplayOrderAscCreatedAtAsc(UUID businessId);
}
