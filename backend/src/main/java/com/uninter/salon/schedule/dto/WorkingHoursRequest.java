package com.uninter.salon.schedule.dto;

import java.time.DayOfWeek;
import java.time.LocalTime;

// Validated in WorkingHoursService (the endpoint receives a plain JSON array of 7 items)
public record WorkingHoursRequest(
        DayOfWeek dayOfWeek,
        Boolean open,
        LocalTime openTime,
        LocalTime closeTime
) {}