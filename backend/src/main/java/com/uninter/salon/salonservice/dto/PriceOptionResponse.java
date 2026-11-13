package com.uninter.salon.salonservice.dto;

import com.uninter.salon.salonservice.ServicePriceOption;

import java.math.BigDecimal;

public record PriceOptionResponse(Long id, String label, BigDecimal price, int durationMinutes) {

    public static PriceOptionResponse from(ServicePriceOption o) {
        return new PriceOptionResponse(o.getId(), o.getLabel(), o.getPrice(), o.getDurationMinutes());
    }
}