package com.uninter.salon.auth.dto;

import com.uninter.salon.user.Role;
import com.uninter.salon.user.User;

public record UserSummary(Long id, String name, String email, Role role) {

    public static UserSummary from(User user) {
        return new UserSummary(user.getId(), user.getName(), user.getEmail(), user.getRole());
    }
}
