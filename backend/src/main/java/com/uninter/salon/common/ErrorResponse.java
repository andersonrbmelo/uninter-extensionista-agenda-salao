package com.uninter.salon.common;

import java.time.Instant;

public record ErrorResponse(int status, String message, Instant timestamp) {
}
