package com.uninter.salon.salonservice.dto;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;

public record PriceOptionRequest(
        Long id, // null = new option; filled = update existing option of this service
        @NotBlank(message = "Price option label is required") @Size(max = 100) String label,
        @NotNull(message = "Price is required") @DecimalMin(value = "0.00", message = "Price cannot be negative") BigDecimal price,
        @NotNull(message = "Duration is required") @Min(value = 1, message = "Duration must be at least 1 minute") Integer durationMinutes
) {}