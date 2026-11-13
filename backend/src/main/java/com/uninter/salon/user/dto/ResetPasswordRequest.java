package com.uninter.salon.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ResetPasswordRequest(
        @NotBlank(message = "Password is required")
        @Size(min = 6, max = 72, message = "Password must have between 6 and 72 characters")
        String password
) {}