package com.uninter.salon.salonservice;

import com.uninter.salon.booking.BookingRepository;
import com.uninter.salon.common.ApiException;
import com.uninter.salon.salonservice.dto.PriceOptionRequest;
import com.uninter.salon.salonservice.dto.ServiceRequest;
import com.uninter.salon.salonservice.dto.ServiceResponse;
import com.uninter.salon.user.Role;
import com.uninter.salon.user.User;
import com.uninter.salon.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CatalogService {

    private final SalonServiceRepository serviceRepository;
    private final UserRepository userRepository;
    private final BookingRepository bookingRepository;

    @Transactional(readOnly = true)
    public List<ServiceResponse> listActive() {
        return serviceRepository.findByActiveTrueOrderByNameAsc().stream()
                .map(ServiceResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public ServiceResponse get(Long id) {
        return ServiceResponse.from(findOrThrow(id));
    }

    @Transactional
    public ServiceResponse create(ServiceRequest request) {
        SalonService service = new SalonService();
        apply(service, request);
        return ServiceResponse.from(serviceRepository.save(service));
    }

    @Transactional
    public ServiceResponse update(Long id, ServiceRequest request) {
        SalonService service = findOrThrow(id);
        apply(service, request);
        return ServiceResponse.from(serviceRepository.save(service));
    }

    // Soft delete: keeps booking history intact
    @Transactional
    public void deactivate(Long id) {
        SalonService service = findOrThrow(id);
        service.setActive(false);
        serviceRepository.save(service);
    }

    private SalonService findOrThrow(Long id) {
        return serviceRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Service not found"));
    }

    private void apply(SalonService service, ServiceRequest request) {
        service.setName(request.name().trim());
        service.setDescription(request.description());
        service.setActive(request.active());

        Set<User> staff = loadStaff(request.staffIds());
        service.getQualifiedStaff().clear();
        service.getQualifiedStaff().addAll(staff);

        applyPriceOptions(service, request.priceOptions());
    }

    private Set<User> loadStaff(List<Long> staffIds) {
        Set<Long> uniqueIds = new HashSet<>(staffIds);
        List<User> users = userRepository.findAllById(uniqueIds);
        if (users.size() != uniqueIds.size()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "One or more staffIds do not exist");
        }
        for (User user : users) {
            if (user.getRole() != Role.STAFF) {
                throw new ApiException(HttpStatus.BAD_REQUEST,
                        "User " + user.getId() + " is not a staff member");
            }
        }
        return new HashSet<>(users);
    }

    /**
     * Merges price options by id so existing rows are updated in place
     * (bookings will reference them in phase 5). Options missing from the request
     * are removed by orphanRemoval; options without id are created.
     */
    private void applyPriceOptions(SalonService service, List<PriceOptionRequest> requests) {
        Map<Long, ServicePriceOption> existing = service.getPriceOptions().stream()
                .filter(o -> o.getId() != null)
                .collect(Collectors.toMap(ServicePriceOption::getId, Function.identity()));

        Set<Long> keepIds = requests.stream()
                .map(PriceOptionRequest::id)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        for (Long id : keepIds) {
            if (!existing.containsKey(id)) {
                throw new ApiException(HttpStatus.BAD_REQUEST,
                        "Price option " + id + " does not belong to this service");
            }
        }

        for (ServicePriceOption option : service.getPriceOptions()) {
            if (option.getId() != null
                    && !keepIds.contains(option.getId())
                    && bookingRepository.existsByPriceOptionId(option.getId())) {
                throw ApiException.conflict(
                        "Price option '" + option.getLabel() + "' has bookings and cannot be removed");
            }
        }

        service.getPriceOptions().removeIf(o -> o.getId() != null && !keepIds.contains(o.getId()));

        for (PriceOptionRequest r : requests) {
            ServicePriceOption option;
            if (r.id() == null) {
                option = new ServicePriceOption();
                option.setService(service);
                service.getPriceOptions().add(option);
            } else {
                option = existing.get(r.id());
            }
            option.setLabel(r.label().trim());
            option.setPrice(r.price());
            option.setDurationMinutes(r.durationMinutes());
        }
    }
}