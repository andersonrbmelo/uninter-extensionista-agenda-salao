package com.uninter.salon.auth.dto;

public record AuthResponse(String token, UserSummary user) {
}
