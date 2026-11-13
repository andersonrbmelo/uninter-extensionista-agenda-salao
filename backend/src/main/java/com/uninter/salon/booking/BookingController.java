package com.uninter.salon.booking;

import com.uninter.salon.booking.dto.BookingRequest;
import com.uninter.salon.booking.dto.BookingResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/bookings")
@CrossOrigin(origins = "${app.cors.allowed-origins}")
@RequiredArgsConstructor
public class BookingController {

    private final BookingService bookingService;

    @PostMapping
    @PreAuthorize("hasAnyRole('STAFF','ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public BookingResponse create(Authentication authentication, @Valid @RequestBody BookingRequest request) {
        return bookingService.create(authentication.getName(), request);
    }

    @PatchMapping("/{id}/cancel")
    @PreAuthorize("hasAnyRole('STAFF','ADMIN')")
    public BookingResponse cancel(@PathVariable Long id, Authentication authentication) {
        return bookingService.cancel(id, authentication.getName());
    }

    @PatchMapping("/{id}/complete")
    @PreAuthorize("hasAnyRole('STAFF','ADMIN')")
    public BookingResponse complete(@PathVariable Long id, Authentication authentication) {
        return bookingService.complete(id, authentication.getName());
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public List<BookingResponse> calendar(
            Authentication authentication,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return bookingService.calendar(authentication.getName(), from, to);
    }
}