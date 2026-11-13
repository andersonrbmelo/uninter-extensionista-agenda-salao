package com.uninter.salon.user.dto;

import com.uninter.salon.booking.dto.BookingResponse;
import com.uninter.salon.user.User;

import java.time.LocalDateTime;
import java.util.List;

public record CustomerDetailResponse(
        Long id,
        String name,
        String email,
        String phone,
        boolean active,
        String allergies,
        String notes,
        LocalDateTime createdAt,
        List<BookingResponse> bookings // newest first, all statuses
) {
    public static CustomerDetailResponse from(User u, List<BookingResponse> bookings) {
        return new CustomerDetailResponse(
                u.getId(), u.getName(), u.getEmail(), u.getPhone(), u.isActive(),
                u.getAllergies(), u.getNotes(), u.getCreatedAt(), bookings);
    }
}