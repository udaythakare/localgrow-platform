package com.localgrow.v2.coupon.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.UUID;

/**
 * Read-only JPA entity mapping to the existing V1 `coupons` table.
 * V2 never writes to this table — all write operations remain V1-owned.
 */
@Entity
@Table(name = "coupons", schema = "public")
public class CouponEntity {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "business_id", nullable = false)
    private UUID businessId;

    @Column(name = "title", nullable = false)
    private String title;

    @Column(name = "description")
    private String description;

    @Column(name = "coupon_type")
    private String couponType;

    @Column(name = "max_claims")
    private Integer maxClaims;

    @Column(name = "current_claims")
    private Integer currentClaims;

    @Column(name = "start_date")
    private LocalDateTime startDate;

    @Column(name = "end_date")
    private LocalDateTime endDate;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive;

    @Column(name = "redemption_time_type")
    private String redemptionTimeType;

    @Column(name = "redemption_start_time")
    private LocalTime redemptionStartTime;

    @Column(name = "redemption_end_time")
    private LocalTime redemptionEndTime;

    @Column(name = "image_url")
    private String imageUrl;

    public CouponEntity() {}

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getBusinessId() {
        return businessId;
    }

    public void setBusinessId(UUID businessId) {
        this.businessId = businessId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getCouponType() {
        return couponType;
    }

    public void setCouponType(String couponType) {
        this.couponType = couponType;
    }

    public Integer getMaxClaims() {
        return maxClaims;
    }

    public void setMaxClaims(Integer maxClaims) {
        this.maxClaims = maxClaims;
    }

    public Integer getCurrentClaims() {
        return currentClaims;
    }

    public void setCurrentClaims(Integer currentClaims) {
        this.currentClaims = currentClaims;
    }

    public LocalDateTime getStartDate() {
        return startDate;
    }

    public void setStartDate(LocalDateTime startDate) {
        this.startDate = startDate;
    }

    public LocalDateTime getEndDate() {
        return endDate;
    }

    public void setEndDate(LocalDateTime endDate) {
        this.endDate = endDate;
    }

    public Boolean getIsActive() {
        return isActive;
    }

    public void setIsActive(Boolean isActive) {
        this.isActive = isActive;
    }

    public String getRedemptionTimeType() {
        return redemptionTimeType;
    }

    public void setRedemptionTimeType(String redemptionTimeType) {
        this.redemptionTimeType = redemptionTimeType;
    }

    public LocalTime getRedemptionStartTime() {
        return redemptionStartTime;
    }

    public void setRedemptionStartTime(LocalTime redemptionStartTime) {
        this.redemptionStartTime = redemptionStartTime;
    }

    public void setRedemptionStartTime(String redemptionStartTime) {
        this.redemptionStartTime = redemptionStartTime != null ? LocalTime.parse(redemptionStartTime) : null;
    }

    public LocalTime getRedemptionEndTime() {
        return redemptionEndTime;
    }

    public void setRedemptionEndTime(LocalTime redemptionEndTime) {
        this.redemptionEndTime = redemptionEndTime;
    }

    public void setRedemptionEndTime(String redemptionEndTime) {
        this.redemptionEndTime = redemptionEndTime != null ? LocalTime.parse(redemptionEndTime) : null;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }
}
