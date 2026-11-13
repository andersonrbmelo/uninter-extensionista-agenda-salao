package com.uninter.salon.booking.dto;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDateTime;

public record BookingRequest(
        @NotNull(message = "customerId is required") Long customerId,
        @NotNull(message = "serviceId is required") Long serviceId,
        @NotNull(message = "priceOptionId is required") Long priceOptionId,
        @NotNull(message = "staffId is required") Long staffId,
        @NotNull(message = "startTime is required") LocalDateTime startTime
) {}