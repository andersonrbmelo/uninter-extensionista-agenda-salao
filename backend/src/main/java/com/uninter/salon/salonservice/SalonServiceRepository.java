package com.uninter.salon.salonservice;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SalonServiceRepository extends JpaRepository<SalonService, Long> {

    List<SalonService> findByActiveTrueOrderByNameAsc();

    // Used when demoting a staff member (remove them from qualified lists)
    List<SalonService> findByQualifiedStaff_Id(Long staffId);
}