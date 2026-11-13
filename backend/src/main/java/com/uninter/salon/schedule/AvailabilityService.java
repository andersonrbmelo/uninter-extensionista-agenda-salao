package com.uninter.salon.schedule;

import com.uninter.salon.booking.BookingRepository;
import com.uninter.salon.booking.BookingStatus;
import com.uninter.salon.common.ApiException;
import com.uninter.salon.salonservice.SalonService;
import com.uninter.salon.salonservice.SalonServiceRepository;
import com.uninter.salon.salonservice.ServicePriceOption;
import com.uninter.salon.user.Role;
import com.uninter.salon.user.User;
import com.uninter.salon.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AvailabilityService {

    // Slots start every 30 minutes (change here)
    public static final int SLOT_STEP_MINUTES = 30;

    private final BookingRepository bookingRepository;
    private final WorkingHoursRepository workingHoursRepository;
    private final SalonServiceRepository salonServiceRepository;
    private final UserRepository userRepository;
    private final Clock clock;

    /** Result of validating the service / price option / staff combination (business rule 1). */
    public record Selection(SalonService service, ServicePriceOption priceOption, User staff) {}

    @Transactional(readOnly = true)
    public List<LocalDateTime> getAvailableSlots(Long serviceId, Long priceOptionId, Long staffId, LocalDate date) {
        Selection selection = resolveSelection(serviceId, priceOptionId, staffId);
        return generateSlots(selection.staff(), selection.priceOption().getDurationMinutes(), date);
    }

    /** Rule 1: the option belongs to the service, the staff is qualified, the service is active. */
    @Transactional(readOnly = true)
    public Selection resolveSelection(Long serviceId, Long priceOptionId, Long staffId) {
        SalonService service = salonServiceRepository.findById(serviceId)
                .orElseThrow(() -> ApiException.notFound("Service not found"));
        if (!service.isActive()) {
            throw ApiException.badRequest("Service is not active");
        }

        ServicePriceOption option = service.getPriceOptions().stream()
                .filter(o -> o.getId().equals(priceOptionId))
                .findFirst()
                .orElseThrow(() -> ApiException.badRequest("Price option does not belong to this service"));

        User staff = userRepository.findById(staffId)
                .orElseThrow(() -> ApiException.notFound("Staff member not found"));
        if (staff.getRole() != Role.STAFF) {
            throw ApiException.badRequest("User is not a staff member");
        }
        boolean qualified = service.getQualifiedStaff().stream()
                .anyMatch(u -> u.getId().equals(staffId));
        if (!qualified) {
            throw ApiException.badRequest("Staff member is not qualified for this service");
        }
        return new Selection(service, option, staff);
    }

    /** Rule 2: all valid start times for the staff member on the given day. */
    @Transactional(readOnly = true)
    public List<LocalDateTime> generateSlots(User staff, int durationMinutes, LocalDate date) {
        List<LocalDateTime> slots = new ArrayList<>();

        WorkingHours hours = workingHoursRepository.findByDayOfWeek(date.getDayOfWeek()).orElse(null);
        if (hours == null || !hours.isOpen() || hours.getOpenTime() == null || hours.getCloseTime() == null) {
            return slots;
        }

        LocalDateTime now = LocalDateTime.now(clock);
        LocalDateTime closeAt = date.atTime(hours.getCloseTime());

        for (LocalDateTime start = date.atTime(hours.getOpenTime());
             !start.plusMinutes(durationMinutes).isAfter(closeAt);
             start = start.plusMinutes(SLOT_STEP_MINUTES)) {

            LocalDateTime end = start.plusMinutes(durationMinutes);
            if (!start.isAfter(now)) {
                continue; // in the past
            }
            if (hasConflict(staff, start, end)) {
                continue;
            }
            slots.add(start);
        }
        return slots;
    }

    @Transactional(readOnly = true)
    public boolean isSlotAvailable(User staff, int durationMinutes, LocalDateTime start) {
        return generateSlots(staff, durationMinutes, start.toLocalDate()).contains(start);
    }

    private boolean hasConflict(User staff, LocalDateTime start, LocalDateTime end) {
        return bookingRepository.existsOverlap(staff.getId(), BookingStatus.BOOKED, start, end);
    }
}