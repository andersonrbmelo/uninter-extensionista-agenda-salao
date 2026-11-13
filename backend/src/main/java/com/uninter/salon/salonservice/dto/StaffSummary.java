package com.uninter.salon.salonservice.dto;

import com.uninter.salon.user.User;

public record StaffSummary(Long id, String name) {

    public static StaffSummary from(User u) {
        return new StaffSummary(u.getId(), u.getName());
    }
}