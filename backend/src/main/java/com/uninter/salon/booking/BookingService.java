package com.uninter.salon.booking;

import com.uninter.salon.booking.dto.BookingRequest;
import com.uninter.salon.booking.dto.BookingResponse;
import com.uninter.salon.common.ApiException;
import com.uninter.salon.schedule.AvailabilityService;
import com.uninter.salon.schedule.AvailabilityService.Selection;
import com.uninter.salon.user.Role;
import com.uninter.salon.user.User;
import com.uninter.salon.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class BookingService {

    private final BookingRepository bookingRepository;
    private final UserRepository userRepository;
    private final AvailabilityService availabilityService;

    /**
     * Creates a booking on behalf of a customer. ADMIN may use any qualified professional;
     * STAFF may only book themselves.
     */
    @Transactional
    public BookingResponse create(String actorEmail, BookingRequest request) {
        User actor = currentUser(actorEmail);
        if (actor.getRole() == Role.STAFF && !actor.getId().equals(request.staffId())) {
            throw ApiException.forbidden("You can only create bookings for yourself");
        }

        User customer = userRepository.findById(request.customerId())
                .filter(u -> u.getRole() == Role.CUSTOMER)
                .orElseThrow(() -> ApiException.notFound("Customer not found"));

        // Lock the staff row so two simultaneous requests cannot book the same slot
        userRepository.findByIdForUpdate(request.staffId())
                .orElseThrow(() -> ApiException.notFound("Staff member not found"));

        Selection selection = availabilityService.resolveSelection(
                request.serviceId(), request.priceOptionId(), request.staffId());

        int duration = selection.priceOption().getDurationMinutes();
        if (!availabilityService.isSlotAvailable(selection.staff(), duration, request.startTime())) {
            throw ApiException.conflict("Selected time slot is not available");
        }

        Booking booking = new Booking();
        booking.setCustomer(customer);
        booking.setStaff(selection.staff());
        booking.setService(selection.service());
        booking.setPriceOption(selection.priceOption());
        booking.setStartTime(request.startTime());
        booking.setEndTime(request.startTime().plusMinutes(duration));
        booking.setStatus(BookingStatus.BOOKED);
        booking.setServiceName(selection.service().getName());
        booking.setOptionLabel(selection.priceOption().getLabel());
        booking.setPrice(selection.priceOption().getPrice());

        return BookingResponse.from(bookingRepository.save(booking));
    }

    /** ADMIN may cancel any booking; STAFF only the ones where they are the professional. */
    @Transactional
    public BookingResponse cancel(Long bookingId, String email) {
        User user = currentUser(email);
        Booking booking = findOrThrow(bookingId);

        boolean isAssignedStaff = booking.getStaff().getId().equals(user.getId());
        if (user.getRole() != Role.ADMIN && !isAssignedStaff) {
            throw ApiException.forbidden("You cannot cancel this booking");
        }
        assertBooked(booking);

        booking.setStatus(BookingStatus.CANCELLED);
        return BookingResponse.from(bookingRepository.save(booking));
    }

    @Transactional
    public BookingResponse complete(Long bookingId, String email) {
        User user = currentUser(email);
        Booking booking = findOrThrow(bookingId);

        boolean isAssignedStaff = booking.getStaff().getId().equals(user.getId());
        if (user.getRole() != Role.ADMIN && !isAssignedStaff) {
            throw ApiException.forbidden("You cannot complete this booking");
        }
        assertBooked(booking);

        booking.setStatus(BookingStatus.COMPLETED);
        return BookingResponse.from(bookingRepository.save(booking));
    }

    /**
     * Calendar feed. ADMIN sees all bookings; STAFF sees only their own.
     * The filter comes from the authenticated user, never from a request parameter.
     * Both dates are inclusive.
     */
    @Transactional(readOnly = true)
    public List<BookingResponse> calendar(String email, LocalDate from, LocalDate to) {
        if (to.isBefore(from)) {
            throw ApiException.badRequest("'to' must not be before 'from'");
        }
        User user = currentUser(email);
        var fromTime = from.atStartOfDay();
        var toTime = to.plusDays(1).atStartOfDay();

        List<Booking> bookings = user.getRole() == Role.ADMIN
                ? bookingRepository.findAllInRange(fromTime, toTime)
                : bookingRepository.findByStaffAndRange(user.getId(), fromTime, toTime);

        return bookings.stream().map(BookingResponse::from).toList();
    }

    private User currentUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> ApiException.unauthorized("Authentication is required"));
    }

    private Booking findOrThrow(Long id) {
        return bookingRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Booking not found"));
    }

    // COMPLETED or CANCELLED bookings cannot change status again
    private void assertBooked(Booking booking) {
        if (booking.getStatus() != BookingStatus.BOOKED) {
            throw ApiException.conflict("Booking is already " + booking.getStatus());
        }
    }
}