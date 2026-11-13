package com.uninter.salon.salonservice.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.util.List;

public record ServiceRequest(
        @NotBlank(message = "Name is required") @Size(max = 100) String name,
        @Size(max = 1000) String description,
        @NotNull(message = "Active flag is required") Boolean active,
        @NotEmpty(message = "At least one price option is required") List<@Valid PriceOptionRequest> priceOptions,
        @NotNull(message = "staffIds is required (use an empty list for none)") List<Long> staffIds
) {}