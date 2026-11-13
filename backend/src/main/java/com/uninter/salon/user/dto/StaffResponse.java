package com.uninter.salon.user.dto;

import com.uninter.salon.user.User;

public record StaffResponse(Long id, String name, String email, String phone) {

    public static StaffResponse from(User u) {
        return new StaffResponse(u.getId(), u.getName(), u.getEmail(), u.getPhone());
    }
}