package com.uninter.salon.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CustomerRequest(
        @NotBlank(message = "Name is required")
        @Size(max = 100, message = "Name must have at most 100 characters")
        String name,

        @NotBlank(message = "Phone is required")
        String phone,

        @Email(message = "Invalid email")
        String email,

        @Size(max = 2000, message = "Allergies must have at most 2000 characters")
        String allergies,

        @Size(max = 2000, message = "Notes must have at most 2000 characters")
        String notes
) {}