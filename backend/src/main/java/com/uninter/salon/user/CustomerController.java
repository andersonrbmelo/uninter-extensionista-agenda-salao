package com.uninter.salon.user;

import com.uninter.salon.common.PageResponse;
import com.uninter.salon.user.dto.CustomerDetailResponse;
import com.uninter.salon.user.dto.CustomerRequest;
import com.uninter.salon.user.dto.CustomerSummary;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/customers")
@CrossOrigin(origins = "${app.cors.allowed-origins}")
@PreAuthorize("hasAnyRole('ADMIN','STAFF')")
@RequiredArgsConstructor
public class CustomerController {

    private final CustomerService customerService;

    @GetMapping
    public PageResponse<CustomerSummary> list(
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return customerService.list(search, page, size);
    }

    @GetMapping("/{id}")
    public CustomerDetailResponse get(@PathVariable Long id) {
        return customerService.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CustomerSummary create(@Valid @RequestBody CustomerRequest request) {
        return customerService.create(request);
    }
}