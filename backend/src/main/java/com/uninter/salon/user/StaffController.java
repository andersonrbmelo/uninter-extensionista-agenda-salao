package com.uninter.salon.user;

import com.uninter.salon.user.dto.CreateStaffRequest;
import com.uninter.salon.user.dto.ResetPasswordRequest;
import com.uninter.salon.user.dto.StaffResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/staff")
@CrossOrigin(origins = "${app.cors.allowed-origins}")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class StaffController {

    private final StaffService staffService;

    @GetMapping
    public List<StaffResponse> list() {
        return staffService.list();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public StaffResponse create(@Valid @RequestBody CreateStaffRequest request) {
        return staffService.create(request);
    }

    @PatchMapping("/{id}/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resetPassword(@PathVariable Long id, @Valid @RequestBody ResetPasswordRequest request) {
        staffService.resetPassword(id, request);
    }

    @PatchMapping("/{id}/deactivate")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deactivate(@PathVariable Long id) {
        staffService.deactivate(id);
    }
}