package com.localgrow.v2.business.dto;

import java.util.List;

public record NearbyBusinessesResponse(
        List<NearbyBusinessDto> content,
        int page,
        int size,
        long totalElements,
        int totalPages
) {}
