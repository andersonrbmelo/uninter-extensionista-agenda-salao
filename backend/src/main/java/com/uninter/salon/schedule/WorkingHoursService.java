package com.uninter.salon.schedule;

import com.uninter.salon.common.ApiException;
import com.uninter.salon.schedule.dto.WorkingHoursRequest;
import com.uninter.salon.schedule.dto.WorkingHoursResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class WorkingHoursService {

    private final WorkingHoursRepository workingHoursRepository;

    @Transactional(readOnly = true)
    public List<WorkingHoursResponse> list() {
        return workingHoursRepository.findAll().stream()
                .sorted(Comparator.comparing(WorkingHours::getDayOfWeek))
                .map(WorkingHoursResponse::from)
                .toList();
    }

    @Transactional
    public List<WorkingHoursResponse> update(List<WorkingHoursRequest> requests) {
        validate(requests);

        for (WorkingHoursRequest request : requests) {
            WorkingHours row = workingHoursRepository.findByDayOfWeek(request.dayOfWeek())
                    .orElseGet(WorkingHours::new);
            row.setDayOfWeek(request.dayOfWeek());
            row.setOpen(request.open());
            row.setOpenTime(request.openTime());
            row.setCloseTime(request.closeTime());
            workingHoursRepository.save(row);
        }
        return list();
    }

    private void validate(List<WorkingHoursRequest> requests) {
        if (requests == null || requests.size() != 7) {
            throw ApiException.badRequest("Exactly 7 items are required, one for each day of the week");
        }
        Set<DayOfWeek> seen = EnumSet.noneOf(DayOfWeek.class);
        for (WorkingHoursRequest r : requests) {
            if (r == null || r.dayOfWeek() == null || r.open() == null) {
                throw ApiException.badRequest("Each item needs dayOfWeek and open");
            }
            if (!seen.add(r.dayOfWeek())) {
                throw ApiException.badRequest("Duplicate day: " + r.dayOfWeek());
            }
            if (r.open()) {
                if (r.openTime() == null || r.closeTime() == null || !r.openTime().isBefore(r.closeTime())) {
                    throw ApiException.badRequest(
                            "Open days need openTime before closeTime (" + r.dayOfWeek() + ")");
                }
            }
        }
    }
}