package com.uninter.salon.user.dto;

import com.uninter.salon.user.User;

public record CustomerSummary(Long id, String name, String email, String phone, boolean active) {

    public static CustomerSummary from(User u) {
        return new CustomerSummary(u.getId(), u.getName(), u.getEmail(), u.getPhone(), u.isActive());
    }
}