package com.uninter.salon.booking.dto;

import com.uninter.salon.booking.Booking;
import com.uninter.salon.booking.BookingStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record BookingResponse(
        Long id,
        Long customerId,
        String customerName,
        String customerPhone,
        Long staffId,
        String staffName,
        String serviceName,
        String optionLabel,
        BigDecimal price,
        LocalDateTime startTime,
        LocalDateTime endTime,
        BookingStatus status,
        LocalDateTime createdAt
) {
    public static BookingResponse from(Booking b) {
        return new BookingResponse(
                b.getId(),
                b.getCustomer().getId(),
                b.getCustomer().getName(),
                b.getCustomer().getPhone(),
                b.getStaff().getId(),
                b.getStaff().getName(),
                b.getServiceName(),
                b.getOptionLabel(),
                b.getPrice(),
                b.getStartTime(),
                b.getEndTime(),
                b.getStatus(),
                b.getCreatedAt());
    }
}