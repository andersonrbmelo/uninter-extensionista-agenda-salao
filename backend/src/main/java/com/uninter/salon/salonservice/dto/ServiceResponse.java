package com.uninter.salon.salonservice.dto;

import com.uninter.salon.salonservice.SalonService;

import java.util.Comparator;
import java.util.List;

public record ServiceResponse(
        Long id,
        String name,
        String description,
        boolean active,
        List<PriceOptionResponse> priceOptions,
        List<StaffSummary> qualifiedStaff
) {
    public static ServiceResponse from(SalonService s) {
        return new ServiceResponse(
                s.getId(),
                s.getName(),
                s.getDescription(),
                s.isActive(),
                s.getPriceOptions().stream().map(PriceOptionResponse::from).toList(),
                s.getQualifiedStaff().stream()
                        .sorted(Comparator.comparing(u -> u.getName()))
                        .map(StaffSummary::from)
                        .toList());
    }
}