package com.uninter.salon.salonservice;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "service_price_option")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ServicePriceOption {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "service_id")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private SalonService service;

    @Column(nullable = false, length = 100)
    private String label;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal price;

    @Column(nullable = false)
    private int durationMinutes;
}