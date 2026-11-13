package com.uninter.salon.common;

import com.uninter.salon.booking.Booking;
import com.uninter.salon.booking.BookingRepository;
import com.uninter.salon.booking.BookingStatus;
import com.uninter.salon.salonservice.SalonService;
import com.uninter.salon.salonservice.SalonServiceRepository;
import com.uninter.salon.salonservice.ServicePriceOption;
import com.uninter.salon.schedule.WorkingHours;
import com.uninter.salon.schedule.WorkingHoursRepository;
import com.uninter.salon.user.Role;
import com.uninter.salon.user.User;
import com.uninter.salon.user.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Component
public class DataSeeder implements CommandLineRunner {

    private static final String STAFF_PASSWORD = "staff123";

    private final UserRepository userRepository;
    private final SalonServiceRepository salonServiceRepository;
    private final WorkingHoursRepository workingHoursRepository;
    private final BookingRepository bookingRepository;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;
    private final String adminEmail;
    private final String adminPassword;
    private final boolean demoData;

    public DataSeeder(
            UserRepository userRepository,
            SalonServiceRepository salonServiceRepository,
            WorkingHoursRepository workingHoursRepository,
            BookingRepository bookingRepository,
            PasswordEncoder passwordEncoder,
            Clock clock,
            @Value("${app.admin.email}") String adminEmail,
            @Value("${app.admin.password}") String adminPassword,
            @Value("${app.seed.demo-data:true}") boolean demoData) {
        this.userRepository = userRepository;
        this.salonServiceRepository = salonServiceRepository;
        this.workingHoursRepository = workingHoursRepository;
        this.bookingRepository = bookingRepository;
        this.passwordEncoder = passwordEncoder;
        this.clock = clock;
        this.adminEmail = adminEmail;
        this.adminPassword = adminPassword;
        this.demoData = demoData;
    }

    @Override
    @Transactional
    public void run(String... args) {
        // Must be computed before anything is inserted
        boolean fresh = userRepository.count() == 0;
        if (fresh) {
            seedUser("Admin", adminEmail, adminPassword, Role.ADMIN, null);
        }
        seedWorkingHours();
        if (demoData && fresh) {
            seedDemoData();
        }
    }

    private void seedWorkingHours() {
        if (workingHoursRepository.count() > 0) {
            return;
        }
        for (DayOfWeek day : DayOfWeek.values()) {
            boolean open = day != DayOfWeek.SUNDAY;
            WorkingHours hours = new WorkingHours();
            hours.setDayOfWeek(day);
            hours.setOpen(open);
            hours.setOpenTime(open ? LocalTime.of(9, 0) : null);
            hours.setCloseTime(open ? LocalTime.of(18, 0) : null);
            workingHoursRepository.save(hours);
        }
    }

    // ---------------------------------------------------------------- demo data

    private void seedDemoData() {
        User maria = seedUser("Maria", "maria@salon.com", STAFF_PASSWORD, Role.STAFF, "81988880001");
        User joao = seedUser("João", "joao@salon.com", STAFF_PASSWORD, Role.STAFF, "81988880002");
        User ana = seedUser("Ana", "ana@salon.com", STAFF_PASSWORD, Role.STAFF, "81988880003");

        SalonService corte = seedService("Corte", "Corte e finalização", Set.of(maria, joao, ana),
                option("Padrão", "50.00", 30));
        SalonService escova = seedService("Escova", "Escova modeladora", Set.of(ana, maria),
                option("Curto", "40.00", 30),
                option("Longo", "70.00", 60));
        SalonService coloracao = seedService("Coloração", "Coloração completa", Set.of(maria, ana),
                option("Curto", "120.00", 90),
                option("Médio", "160.00", 120),
                option("Longo", "200.00", 150));
        SalonService depilacao = seedService("Depilação", "Depilação com cera", Set.of(joao),
                option("Padrão", "40.00", 30));

        List<User> customers = seedCustomers();
        seedBookings(customers, maria, joao, ana, corte, escova, coloracao, depilacao);
    }

    /** Fictional customers (no login): phones 81999990001..81999990008. */
    private List<User> seedCustomers() {
        List<User> customers = new ArrayList<>();
        customers.add(customer("Camila Souza", "81999990001", "camila.souza@example.com",
                "Alergia a tintas com amônia", "Prefere horários pela manhã"));
        customers.add(customer("Fernanda Lima", "81999990002", null, null, null));
        customers.add(customer("Juliana Alves", "81999990003", null,
                "Sensibilidade a produtos com formol", null));
        customers.add(customer("Patrícia Gomes", "81999990004", null, null, null));
        customers.add(customer("Beatriz Rocha", "81999990005", "beatriz.rocha@example.com", null, null));
        customers.add(customer("Larissa Martins", "81999990006", null, null, null));
        customers.add(customer("Renata Barbosa", "81999990007", null, null,
                "Cabelo muito fino, usar pouco produto"));
        customers.add(customer("Aline Cardoso", "81999990008", null, null, null));
        return customers;
    }

    /**
     * About 14 bookings over the previous and the current week, never on Sunday.
     * For each professional the times of day never overlap, so no two bookings of the same
     * professional collide whatever day they land on. Status is derived from the clock:
     * already finished -> COMPLETED, otherwise BOOKED (two are explicitly CANCELLED).
     */
    private void seedBookings(
            List<User> c, User maria, User joao, User ana,
            SalonService corte, SalonService escova, SalonService coloracao, SalonService depilacao) {
        LocalDate today = LocalDate.now(clock);
        LocalDate monday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate prev = monday.minusWeeks(1);
        LocalDate todayOrNext = nextOpenDay(today);
        LocalDate tomorrowOrNext = nextOpenDay(today.plusDays(1));

        // Maria
        book(c.get(0), maria, coloracao, "Curto", prev.plusDays(1), 9, 0, false);
        book(c.get(1), maria, corte, "Padrão", prev.plusDays(3), 10, 30, false);
        book(c.get(2), maria, escova, "Longo", prev.plusDays(4), 11, 0, false);
        book(c.get(3), maria, coloracao, "Médio", monday.plusDays(1), 13, 0, false);
        book(c.get(4), maria, corte, "Padrão", tomorrowOrNext, 15, 30, false);

        // João
        book(c.get(5), joao, corte, "Padrão", prev, 9, 0, false);
        book(c.get(6), joao, depilacao, "Padrão", prev.plusDays(5), 10, 0, true);
        book(c.get(7), joao, corte, "Padrão", monday.plusDays(2), 11, 30, false);
        book(c.get(1), joao, depilacao, "Padrão", todayOrNext, 14, 0, false);
        book(c.get(0), joao, corte, "Padrão", monday.plusDays(4), 16, 0, true);

        // Ana
        book(c.get(2), ana, escova, "Curto", prev.plusDays(2), 9, 30, false);
        book(c.get(3), ana, corte, "Padrão", monday, 10, 0, false);
        book(c.get(5), ana, coloracao, "Curto", tomorrowOrNext, 14, 0, false);
        book(c.get(4), ana, escova, "Longo", monday.plusDays(5), 16, 0, false);
    }

    private LocalDate nextOpenDay(LocalDate date) {
        return date.getDayOfWeek() == DayOfWeek.SUNDAY ? date.plusDays(1) : date;
    }

    private void book(User customer, User staff, SalonService service, String optionLabel,
                      LocalDate date, int hour, int minute, boolean cancelled) {
        ServicePriceOption option = service.getPriceOptions().stream()
                .filter(o -> o.getLabel().equals(optionLabel))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Unknown demo option: " + optionLabel));

        LocalDateTime start = date.atTime(hour, minute);
        LocalDateTime end = start.plusMinutes(option.getDurationMinutes());

        BookingStatus status;
        if (cancelled) {
            status = BookingStatus.CANCELLED;
        } else if (end.isBefore(LocalDateTime.now(clock))) {
            status = BookingStatus.COMPLETED;
        } else {
            status = BookingStatus.BOOKED;
        }

        Booking booking = new Booking();
        booking.setCustomer(customer);
        booking.setStaff(staff);
        booking.setService(service);
        booking.setPriceOption(option);
        booking.setStartTime(start);
        booking.setEndTime(end);
        booking.setStatus(status);
        booking.setServiceName(service.getName());
        booking.setOptionLabel(option.getLabel());
        booking.setPrice(option.getPrice());
        bookingRepository.save(booking);
    }

    // ------------------------------------------------------------------ helpers

    private User seedUser(String name, String email, String rawPassword, Role role, String phone) {
        String normalizedEmail = email.trim().toLowerCase(Locale.ROOT);
        return userRepository.findByEmail(normalizedEmail).orElseGet(() -> {
            User user = new User();
            user.setName(name);
            user.setEmail(normalizedEmail);
            user.setPassword(passwordEncoder.encode(rawPassword));
            user.setPhone(phone);
            user.setRole(role);
            user.setActive(true);
            return userRepository.save(user);
        });
    }

    /** Customers are plain records: no password, so they can never log in. */
    private User customer(String name, String phone, String email, String allergies, String notes) {
        User user = new User();
        user.setName(name);
        user.setPhone(phone);
        user.setEmail(email == null ? null : email.trim().toLowerCase(Locale.ROOT));
        user.setAllergies(allergies);
        user.setNotes(notes);
        user.setRole(Role.CUSTOMER);
        user.setActive(true);
        return userRepository.save(user);
    }

    private ServicePriceOption option(String label, String price, int minutes) {
        ServicePriceOption option = new ServicePriceOption();
        option.setLabel(label);
        option.setPrice(new BigDecimal(price));
        option.setDurationMinutes(minutes);
        return option;
    }

    private SalonService seedService(String name, String description, Set<User> staff, ServicePriceOption... options) {
        SalonService service = new SalonService();
        service.setName(name);
        service.setDescription(description);
        service.setActive(true);
        service.getQualifiedStaff().addAll(staff);
        for (ServicePriceOption option : options) {
            option.setService(service);
            service.getPriceOptions().add(option);
        }
        return salonServiceRepository.save(service);
    }
}