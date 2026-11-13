package com.uninter.salon.auth;

import com.uninter.salon.auth.dto.AuthResponse;
import com.uninter.salon.auth.dto.LoginRequest;
import com.uninter.salon.auth.dto.RegisterRequest;
import com.uninter.salon.auth.dto.UserSummary;
import com.uninter.salon.common.ApiException;
import com.uninter.salon.user.Role;
import com.uninter.salon.user.User;
import com.uninter.salon.user.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final boolean registrationEnabled;

    public AuthService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            AuthenticationManager authenticationManager,
            @Value("${app.registration-enabled:false}") boolean registrationEnabled) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.authenticationManager = authenticationManager;
        this.registrationEnabled = registrationEnabled;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (!registrationEnabled) {
            throw ApiException.forbidden("Registration is disabled");
        }
        String email = normalizeEmail(request.email());
        if (userRepository.existsByEmail(email)) {
            throw ApiException.conflict("Email is already registered");
        }
        User user = new User();
        user.setName(request.name().trim());
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(request.password()));
        user.setRole(Role.CUSTOMER);
        user.setActive(true);
        User saved = userRepository.save(user);
        return new AuthResponse(jwtService.generateToken(saved), UserSummary.from(saved));
    }

    public AuthResponse login(LoginRequest request) {
        String email = normalizeEmail(request.email());
        // Only active ADMIN/STAFF users that have a password can log in
        User user = userRepository.findByEmail(email)
                .filter(this::canLogin)
                .orElseThrow(() -> ApiException.unauthorized("Invalid email or password"));
        try {
            authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(email, request.password()));
        } catch (AuthenticationException ex) {
            throw ApiException.unauthorized("Invalid email or password");
        }
        return new AuthResponse(jwtService.generateToken(user), UserSummary.from(user));
    }

    @Transactional(readOnly = true)
    public UserSummary currentUser(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> ApiException.unauthorized("Authentication is required"));
        if (!user.isActive()) {
            throw ApiException.unauthorized("Authentication is required");
        }
        return UserSummary.from(user);
    }

    private boolean canLogin(User user) {
        return user.isActive()
                && user.getRole() != Role.CUSTOMER
                && user.getPassword() != null
                && !user.getPassword().isBlank();
    }

    private String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}