package com.uninter.salon.booking;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.List;

public interface BookingRepository extends JpaRepository<Booking, Long> {

    // Overlap: existing.start < newEnd AND existing.end > newStart (only BOOKED blocks)
    @Query("""
            select count(b) > 0 from Booking b
            where b.staff.id = :staffId
              and b.status = :status
              and b.startTime < :end
              and b.endTime > :start
            """)
    boolean existsOverlap(@Param("staffId") Long staffId,
                          @Param("status") BookingStatus status,
                          @Param("start") LocalDateTime start,
                          @Param("end") LocalDateTime end);

    // Used to refuse demoting a staff member who still has pending bookings
    boolean existsByStaffIdAndStatusAndEndTimeAfter(Long staffId, BookingStatus status, LocalDateTime time);

    boolean existsByPriceOptionId(Long priceOptionId);
    
    @Query(value = """
        select b from Booking b
        join fetch b.customer join fetch b.staff
        where b.customer.id = :customerId
        """,
        countQuery = "select count(b) from Booking b where b.customer.id = :customerId")
    Page<Booking> findPageByCustomer(@Param("customerId") Long customerId, Pageable pageable);

    @Query("""
            select b from Booking b
            join fetch b.customer join fetch b.staff
            where b.customer.id = :customerId
            order by b.startTime desc
            """)
    List<Booking> findByCustomer(@Param("customerId") Long customerId);

    @Query("""
            select b from Booking b
            join fetch b.customer join fetch b.staff
            where b.staff.id = :staffId
              and b.startTime >= :from and b.startTime < :to
            order by b.startTime
            """)
    List<Booking> findByStaffAndRange(@Param("staffId") Long staffId,
                                      @Param("from") LocalDateTime from,
                                      @Param("to") LocalDateTime to);

    @Query("""
            select b from Booking b
            join fetch b.customer join fetch b.staff
            where b.startTime >= :from and b.startTime < :to
            order by b.startTime
            """)
    List<Booking> findAllInRange(@Param("from") LocalDateTime from,
                                 @Param("to") LocalDateTime to);        
}