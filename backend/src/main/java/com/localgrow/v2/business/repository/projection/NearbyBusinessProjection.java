package com.localgrow.v2.business.repository.projection;

import java.math.BigDecimal;
import java.util.UUID;

public interface NearbyBusinessProjection {
    UUID getBusinessId();
    String getBusinessName();
    String getBusinessDescription();
    UUID getLocationId();
    String getLocationAddress();
    String getLocationArea();
    String getLocationCity();
    String getLocationState();
    String getLocationPostalCode();
    BigDecimal getLocationLatitude();
    BigDecimal getLocationLongitude();
    Boolean getLocationIsPrimary();
    UUID getCategoryId();
    String getCategoryName();
    Double getDistanceKm();
    String getBusinessLogoUrl();
    String getBusinessPhotoUrl();
    Double getAverageRating();
    Integer getTotalReviews();
}
