package com.uninter.salon.schedule;

import com.uninter.salon.schedule.dto.WorkingHoursRequest;
import com.uninter.salon.schedule.dto.WorkingHoursResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/working-hours")
@CrossOrigin(origins = "${app.cors.allowed-origins}")
@RequiredArgsConstructor
public class WorkingHoursController {

    private final WorkingHoursService workingHoursService;

    @GetMapping
    public List<WorkingHoursResponse> list() {
        return workingHoursService.list();
    }

    @PutMapping
    @PreAuthorize("hasRole('ADMIN')")
    public List<WorkingHoursResponse> update(@RequestBody List<WorkingHoursRequest> requests) {
        return workingHoursService.update(requests);
    }
}