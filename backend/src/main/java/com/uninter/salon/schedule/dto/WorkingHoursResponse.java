package com.uninter.salon.schedule.dto;

import com.uninter.salon.schedule.WorkingHours;

import java.time.DayOfWeek;
import java.time.LocalTime;

public record WorkingHoursResponse(
        DayOfWeek dayOfWeek,
        boolean open,
        LocalTime openTime,
        LocalTime closeTime
) {
    public static WorkingHoursResponse from(WorkingHours w) {
        return new WorkingHoursResponse(w.getDayOfWeek(), w.isOpen(), w.getOpenTime(), w.getCloseTime());
    }
}