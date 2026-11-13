package com.uninter.salon.user;

import com.uninter.salon.booking.BookingRepository;
import com.uninter.salon.booking.dto.BookingResponse;
import com.uninter.salon.common.ApiException;
import com.uninter.salon.common.PageResponse;
import com.uninter.salon.common.PhoneUtil;
import com.uninter.salon.user.dto.CustomerDetailResponse;
import com.uninter.salon.user.dto.CustomerRequest;
import com.uninter.salon.user.dto.CustomerSummary;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class CustomerService {

    private final UserRepository userRepository;
    private final BookingRepository bookingRepository;

    @Transactional(readOnly = true)
    public PageResponse<CustomerSummary> list(String search, int page, int size) {
        Pageable pageable = PageResponse.pageable(page, size, Sort.by("name"));
        Page<User> customers;
        if (search == null || search.isBlank()) {
            customers = userRepository.findByRole(Role.CUSTOMER, pageable);
        } else {
            String term = search.trim();
            String namePattern = "%" + term.toLowerCase(Locale.ROOT) + "%";
            String digits = PhoneUtil.searchDigits(term);
            // "#" never matches a phone (digits only), so a term without digits cannot match by phone
            String phonePattern = digits.isEmpty() ? "#" : "%" + digits + "%";
            customers = userRepository.searchCustomers(Role.CUSTOMER, namePattern, phonePattern, pageable);
        }
        return PageResponse.from(customers.map(CustomerSummary::from));
    }

    @Transactional(readOnly = true)
    public CustomerDetailResponse get(Long id) {
        User customer = userRepository.findById(id)
                .filter(u -> u.getRole() == Role.CUSTOMER)
                .orElseThrow(() -> ApiException.notFound("Customer not found"));

        List<BookingResponse> history = bookingRepository.findByCustomer(id).stream()
                .map(BookingResponse::from)
                .toList();

        return CustomerDetailResponse.from(customer, history);
    }

    @Transactional
    public CustomerSummary create(CustomerRequest request) {
        String phone = PhoneUtil.requireValid(request.phone());

        String email = blankToNull(request.email());
        if (email != null) {
            email = email.toLowerCase(Locale.ROOT);
            if (userRepository.existsByEmail(email)) {
                throw ApiException.conflict("Email is already registered");
            }
        }

        User customer = new User();
        customer.setName(request.name().trim());
        customer.setPhone(phone);
        customer.setEmail(email);
        customer.setAllergies(blankToNull(request.allergies()));
        customer.setNotes(blankToNull(request.notes()));
        customer.setRole(Role.CUSTOMER);
        customer.setActive(true);

        return CustomerSummary.from(userRepository.save(customer));
    }

    private String blankToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}