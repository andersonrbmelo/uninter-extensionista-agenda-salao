package com.uninter.salon.user;

import com.uninter.salon.booking.BookingRepository;
import com.uninter.salon.booking.BookingStatus;
import com.uninter.salon.common.ApiException;
import com.uninter.salon.common.PhoneUtil;
import com.uninter.salon.salonservice.SalonService;
import com.uninter.salon.salonservice.SalonServiceRepository;
import com.uninter.salon.user.dto.CreateStaffRequest;
import com.uninter.salon.user.dto.ResetPasswordRequest;
import com.uninter.salon.user.dto.StaffResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class StaffService {

    private static final String STAFF_NOT_FOUND = "Staff member not found";

    private final UserRepository userRepository;
    private final SalonServiceRepository salonServiceRepository;
    private final BookingRepository bookingRepository;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;

    /** Active professionals only, sorted by name. */
    @Transactional(readOnly = true)
    public List<StaffResponse> list() {
        return userRepository.findAll().stream()
                .filter(this::isActiveStaff)
                .sorted(Comparator.comparing(User::getName, String.CASE_INSENSITIVE_ORDER))
                .map(StaffResponse::from)
                .toList();
    }

    @Transactional
    public StaffResponse create(CreateStaffRequest request) {
        String phone = PhoneUtil.requireValid(request.phone());
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        if (userRepository.existsByEmail(email)) {
            throw ApiException.conflict("Email is already registered");
        }

        User user = new User();
        user.setName(request.name().trim());
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(request.password()));
        user.setPhone(phone);
        user.setRole(Role.STAFF);
        user.setActive(true);
        return StaffResponse.from(userRepository.save(user));
    }

    /** Tokens already issued stay valid until they expire (accepted in the plan). */
    @Transactional
    public void resetPassword(Long id, ResetPasswordRequest request) {
        User user = userRepository.findById(id)
                .filter(this::isActiveStaff)
                .orElseThrow(() -> ApiException.notFound(STAFF_NOT_FOUND));
        user.setPassword(passwordEncoder.encode(request.password()));
        userRepository.save(user);
    }

    @Transactional
    public void deactivate(Long id) {
        // Same row lock BookingService.create takes, so a booking cannot slip in meanwhile
        User user = userRepository.findByIdForUpdate(id)
                .filter(this::isActiveStaff)
                .orElseThrow(() -> ApiException.notFound(STAFF_NOT_FOUND));

        if (bookingRepository.existsByStaffIdAndStatusAndEndTimeAfter(
                id, BookingStatus.BOOKED, LocalDateTime.now(clock))) {
            throw ApiException.conflict("Staff member has future bookings");
        }

        List<SalonService> services = salonServiceRepository.findByQualifiedStaff_Id(id);
        for (SalonService service : services) {
            service.getQualifiedStaff().removeIf(u -> u.getId().equals(id));
        }
        salonServiceRepository.saveAll(services);

        // Inactive users cannot log in and existing tokens stop working (AppUserDetailsService)
        user.setActive(false);
        userRepository.save(user);
    }

    private boolean isActiveStaff(User user) {
        return user.getRole() == Role.STAFF && user.isActive();
    }
}