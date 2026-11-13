package com.uninter.salon.user;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.id = :id")
    Optional<User> findByIdForUpdate(@Param("id") Long id);

    Page<User> findByRole(Role role, Pageable pageable);

    @Query("""
            select u from User u
            where u.role = :role
              and (lower(u.name) like :namePattern
                   or lower(coalesce(u.email, '')) like :namePattern
                   or u.phone like :phonePattern)
            """)
    Page<User> searchCustomers(@Param("role") Role role,
                               @Param("namePattern") String namePattern,
                               @Param("phonePattern") String phonePattern,
                               Pageable pageable);
}