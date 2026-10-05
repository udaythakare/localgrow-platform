package com.localgrow.v2.business.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.UUID;

/**
 * JPA entity mapping to the {@code public.business_hours} table.
 *
 * <p>Represents one schedule record per business location per ISO weekday
 * (Monday = 1 through Sunday = 7).</p>
 */
@Entity
@Table(name = "business_hours", schema = "public")
public class BusinessHourEntity {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "location_id", nullable = false)
    private UUID locationId;

    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.SMALLINT)
    @Column(name = "day_of_week", nullable = false)
    private int dayOfWeek;

    @Column(name = "open_time", nullable = false)
    private LocalTime openTime;

    @Column(name = "close_time", nullable = false)
    private LocalTime closeTime;

    @Column(name = "is_closed", nullable = false)
    private Boolean isClosed = false;

    @Column(name = "is_24_hours", nullable = false)
    private Boolean is24Hours = false;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;

    public BusinessHourEntity() {}

    public BusinessHourEntity(UUID id, UUID locationId, int dayOfWeek,
                              LocalTime openTime, LocalTime closeTime,
                              Boolean isClosed, Boolean is24Hours) {
        this.id = id;
        this.locationId = locationId;
        this.dayOfWeek = dayOfWeek;
        this.openTime = openTime;
        this.closeTime = closeTime;
        this.isClosed = isClosed != null ? isClosed : false;
        this.is24Hours = is24Hours != null ? is24Hours : false;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getLocationId() {
        return locationId;
    }

    public void setLocationId(UUID locationId) {
        this.locationId = locationId;
    }

    public int getDayOfWeek() {
        return dayOfWeek;
    }

    public void setDayOfWeek(int dayOfWeek) {
        this.dayOfWeek = dayOfWeek;
    }

    public LocalTime getOpenTime() {
        return openTime;
    }

    public void setOpenTime(LocalTime openTime) {
        this.openTime = openTime;
    }

    public LocalTime getCloseTime() {
        return closeTime;
    }

    public void setCloseTime(LocalTime closeTime) {
        this.closeTime = closeTime;
    }

    public Boolean isClosed() {
        return isClosed != null && isClosed;
    }

    public void setClosed(Boolean closed) {
        this.isClosed = closed;
    }

    public Boolean is24Hours() {
        return is24Hours != null && is24Hours;
    }

    public void set24Hours(Boolean is24Hours) {
        this.is24Hours = is24Hours;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
