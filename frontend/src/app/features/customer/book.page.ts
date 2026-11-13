import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  EMPTY,
  Observable,
  Subscription,
  catchError,
  debounceTime,
  distinctUntilChanged,
  map,
  switchMap,
} from 'rxjs';

import { apiErrorMessage } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { BookingsService } from '../../core/bookings.service';
import { CatalogService } from '../../core/catalog.service';
import { CustomerSummary, CustomersService, formatPhone } from '../../core/customers.service';
import { formatDate, formatTime, todayString } from '../../core/date-utils';
import { formatDuration, formatMoney } from '../../core/format';
import { Booking, PriceOption, SalonService, StaffSummary } from '../../core/models';
import { ScheduleService } from '../../core/schedule.service';
import { Alert } from '../../shared/alert';
import { CustomerQuickCreate } from '../../shared/customer-quick-create';
import { Spinner } from '../../shared/spinner';

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_SIZE = 8;

@Component({
  selector: 'app-book-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, Alert, Spinner, CustomerQuickCreate],
  template: `
    <div class="px-4 pt-4">
      @if (booked(); as booking) {
        <section class="card space-y-4">
          <h1 class="text-2xl font-semibold text-slate-900">Agendamento confirmado!</h1>
          <app-alert type="success" message="O agendamento foi criado com sucesso." />

          <dl class="space-y-2 text-sm">
            <div class="flex justify-between gap-4">
              <dt class="text-slate-500">Cliente</dt>
              <dd class="text-right font-medium text-slate-900">{{ booking.customerName }}</dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-slate-500">Serviço</dt>
              <dd class="text-right font-medium text-slate-900">{{ booking.serviceName }}</dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-slate-500">Opção</dt>
              <dd class="text-right font-medium text-slate-900">{{ booking.optionLabel }}</dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-slate-500">Profissional</dt>
              <dd class="text-right font-medium text-slate-900">{{ booking.staffName }}</dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-slate-500">Data</dt>
              <dd class="text-right font-medium text-slate-900">{{ formatDate(booking.startTime) }}</dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-slate-500">Horário</dt>
              <dd class="text-right font-medium text-slate-900">
                {{ formatTime(booking.startTime) }} - {{ formatTime(booking.endTime) }}
              </dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-slate-500">Preço</dt>
              <dd class="text-right font-medium text-slate-900">{{ formatMoney(booking.price) }}</dd>
            </div>
          </dl>

          <div class="flex flex-col gap-2">
            <button type="button" class="btn btn-primary w-full" (click)="bookAnother()">
              Agendar outro serviço para {{ booking.customerName }}
            </button>
            <button type="button" class="btn btn-secondary w-full" (click)="startOver()">
              Novo agendamento
            </button>
            <a
              routerLink="/calendar"
              class="flex min-h-11 items-center justify-center text-sm font-medium text-rose-600"
            >
              Ver agenda
            </a>
          </div>
        </section>
      } @else {
        <h1 class="mb-4 text-2xl font-semibold text-slate-900">Agendar</h1>

        <div class="space-y-4">
          <!-- Step 1: customer -->
          <section class="card space-y-3">
            <h2 class="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <span
                class="flex h-7 w-7 items-center justify-center rounded-full bg-rose-600 text-sm text-white"
                >1</span
              >
              Cliente
            </h2>

            @if (loadingCustomer()) {
              <app-spinner label="Carregando cliente..." />
            } @else if (customer(); as chosen) {
              <div class="flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <p class="truncate font-medium text-slate-900">{{ chosen.name }}</p>
                  <p class="text-sm text-slate-600">{{ formatPhone(chosen.phone ?? '') }}</p>
                </div>
                <button
                  type="button"
                  class="btn btn-secondary disabled:cursor-not-allowed disabled:opacity-60"
                  [disabled]="submitting()"
                  (click)="changeCustomer()"
                >
                  Trocar
                </button>
              </div>
            } @else if (creatingCustomer()) {
              <app-customer-quick-create
                (created)="onCustomerCreated($event)"
                (cancelled)="creatingCustomer.set(false)"
              />
            } @else {
              <app-alert [message]="customerError()" />

              <label class="sr-only" for="customer-search">Buscar cliente</label>
              <input
                id="customer-search"
                type="search"
                class="input"
                [formControl]="searchControl"
                placeholder="Buscar por nome ou telefone"
                autocomplete="off"
                enterkeyhint="search"
              />

              @if (searching()) {
                <app-spinner label="Buscando..." />
              } @else if (searchError(); as message) {
                <app-alert [message]="message" />
              } @else if (results(); as list) {
                @if (list.length === 0) {
                  <p class="text-sm text-slate-600">Nenhum cliente encontrado.</p>
                } @else {
                  <ul class="space-y-2">
                    @for (item of list; track item.id) {
                      <li>
                        <button
                          type="button"
                          class="min-h-11 w-full rounded-lg border border-slate-200 bg-white p-3 text-left"
                          (click)="selectCustomer(item)"
                        >
                          <span class="block font-medium text-slate-900">{{ item.name }}</span>
                          <span class="block text-sm text-slate-600">
                            {{ formatPhone(item.phone ?? '') }}
                          </span>
                        </button>
                      </li>
                    }
                  </ul>
                }
              } @else {
                <p class="text-sm text-slate-500">Digite o nome ou o telefone para buscar.</p>
              }

              <button type="button" class="btn btn-secondary w-full" (click)="creatingCustomer.set(true)">
                Novo cliente
              </button>
            }
          </section>

          <!-- Step 2: service -->
          <section class="card space-y-3">
            <h2 class="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <span
                class="flex h-7 w-7 items-center justify-center rounded-full bg-rose-600 text-sm text-white"
                >2</span
              >
              Serviço
            </h2>
            @if (loadingServices()) {
              <app-spinner label="Carregando serviços..." />
            } @else if (loadError(); as message) {
              <app-alert [message]="message" />
              <button type="button" class="btn btn-secondary w-full" (click)="loadServices()">
                Tentar novamente
              </button>
            } @else if (services().length === 0) {
              <p class="text-sm text-slate-500">Nenhum serviço disponível no momento.</p>
            } @else {
              <div class="grid grid-cols-1 gap-2">
                @for (service of services(); track service.id) {
                  <button
                    type="button"
                    class="min-h-11 w-full rounded-lg border p-3 text-left transition"
                    [class]="tile(selectedService()?.id === service.id)"
                    [attr.aria-pressed]="selectedService()?.id === service.id"
                    [disabled]="submitting()"
                    (click)="selectService(service)"
                  >
                    <span class="block font-medium text-slate-900">{{ service.name }}</span>
                    @if (service.description) {
                      <span class="mt-0.5 block text-sm text-slate-500">{{ service.description }}</span>
                    }
                  </button>
                }
              </div>
            }
          </section>

          <!-- Step 3: price option -->
          @if (selectedService()) {
            <section class="card space-y-3">
              <h2 class="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <span
                  class="flex h-7 w-7 items-center justify-center rounded-full bg-rose-600 text-sm text-white"
                  >3</span
                >
                Opção
              </h2>
              <div class="grid grid-cols-1 gap-2">
                @for (option of sortedOptions(); track option.id) {
                  <button
                    type="button"
                    class="min-h-11 w-full rounded-lg border p-3 text-left transition"
                    [class]="tile(selectedOption()?.id === option.id)"
                    [attr.aria-pressed]="selectedOption()?.id === option.id"
                    [disabled]="submitting()"
                    (click)="selectOption(option)"
                  >
                    <span class="block font-medium text-slate-900">{{ option.label }}</span>
                    <span class="mt-0.5 block text-sm text-slate-500">
                      {{ formatMoney(option.price) }} · {{ formatDuration(option.durationMinutes) }}
                    </span>
                  </button>
                }
              </div>
            </section>
          }

          <!-- Step 4: professional -->
          @if (selectedService() && selectedOption()) {
            <section class="card space-y-3">
              <h2 class="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <span
                  class="flex h-7 w-7 items-center justify-center rounded-full bg-rose-600 text-sm text-white"
                  >4</span
                >
                Profissional
              </h2>
              @if (isAdmin()) {
                @if (staffOptions().length === 0) {
                  <p class="text-sm text-slate-500">Nenhum profissional disponível para este serviço.</p>
                } @else {
                  <div class="grid grid-cols-1 gap-2">
                    @for (member of staffOptions(); track member.id) {
                      <button
                        type="button"
                        class="min-h-11 w-full rounded-lg border p-3 text-left font-medium text-slate-900 transition"
                        [class]="tile(selectedStaff()?.id === member.id)"
                        [attr.aria-pressed]="selectedStaff()?.id === member.id"
                        [disabled]="submitting()"
                        (click)="selectStaff(member)"
                      >
                        {{ member.name }}
                      </button>
                    }
                  </div>
                }
              } @else {
                @if (selectedStaff(); as self) {
                  <p class="rounded-lg border border-slate-200 bg-slate-50 p-3 font-medium text-slate-900">
                    {{ self.name }}
                  </p>
                } @else {
                  <app-alert message="Você não atende este serviço." />
                }
              }
            </section>
          }

          <!-- Step 5: date -->
          @if (selectedOption() && selectedStaff()) {
            <section class="card space-y-3">
              <h2 class="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <span
                  class="flex h-7 w-7 items-center justify-center rounded-full bg-rose-600 text-sm text-white"
                  >5</span
                >
                Data
              </h2>
              <div>
                <label class="label" for="booking-date">Escolha o dia</label>
                <input
                  id="booking-date"
                  type="date"
                  class="input"
                  [min]="minDate"
                  [formControl]="dateControl"
                />
              </div>
            </section>
          }

          <!-- Step 6: time -->
          @if (selectedStaff() && date()) {
            <section class="card space-y-3">
              <h2 class="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <span
                  class="flex h-7 w-7 items-center justify-center rounded-full bg-rose-600 text-sm text-white"
                  >6</span
                >
                Horário
              </h2>
              @if (loadingTimes()) {
                <app-spinner label="Carregando horários..." />
              } @else if (timesError(); as message) {
                <app-alert [message]="message" />
              } @else if (times(); as list) {
                @if (list.length === 0) {
                  <p class="text-sm text-slate-500">Nenhum horário disponível neste dia.</p>
                } @else {
                  <div class="grid grid-cols-3 gap-2">
                    @for (time of list; track time) {
                      <button
                        type="button"
                        class="min-h-11 rounded-lg border px-2 py-2 text-base font-medium text-slate-900 transition disabled:opacity-50"
                        [class]="tile(selectedTime() === time)"
                        [attr.aria-pressed]="selectedTime() === time"
                        [disabled]="submitting()"
                        (click)="selectTime(time)"
                      >
                        {{ formatTime(time) }}
                      </button>
                    }
                  </div>
                }
              }
            </section>
          }
        </div>

        <!-- Sticky summary + confirm. Last child on purpose: it never hides the last step. -->
        <div class="sticky-action-bar -mx-4 mt-4 space-y-2 px-4 py-3">
          <app-alert [message]="error()" />
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 text-sm">
              <p class="truncate font-medium text-slate-900">
                {{ customer()?.name ?? 'Escolha o cliente' }}
              </p>
              <p class="truncate text-slate-600">{{ summaryService() }}</p>
              <p class="truncate text-slate-600">{{ summaryWhen() }}</p>
            </div>
            @if (selectedOption(); as option) {
              <p class="shrink-0 text-base font-semibold text-slate-900">
                {{ formatMoney(option.price) }}
              </p>
            }
          </div>
          <button
            type="button"
            class="btn btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
            [disabled]="!canConfirm() || submitting()"
            (click)="confirm()"
          >
            {{ submitting() ? 'Agendando...' : 'Confirmar agendamento' }}
          </button>
        </div>
      }
    </div>
  `,
})
export class BookPage implements OnInit {
  /** Query param `?customerId=` (`withComponentInputBinding`): preselects the customer. */
  readonly customerId = input<string>();

  private readonly auth = inject(AuthService);
  private readonly catalog = inject(CatalogService);
  private readonly schedule = inject(ScheduleService);
  private readonly bookings = inject(BookingsService);
  private readonly customersService = inject(CustomersService);
  private readonly destroyRef = inject(DestroyRef);

  private timesSubscription: Subscription | null = null;

  protected readonly formatMoney = formatMoney;
  protected readonly formatDuration = formatDuration;
  protected readonly formatDate = formatDate;
  protected readonly formatTime = formatTime;
  protected readonly formatPhone = formatPhone;
  protected readonly minDate = todayString();

  protected readonly isAdmin = computed(() => this.auth.role() === 'ADMIN');

  // Step 1: customer.
  protected readonly customer = signal<CustomerSummary | null>(null);
  protected readonly creatingCustomer = signal(false);
  protected readonly loadingCustomer = signal(false);
  protected readonly customerError = signal<string | null>(null);
  protected readonly searchControl = new FormControl('', { nonNullable: true });
  protected readonly results = signal<CustomerSummary[] | null>(null);
  protected readonly searching = signal(false);
  protected readonly searchError = signal<string | null>(null);

  // Step 2 data.
  protected readonly services = signal<SalonService[]>([]);
  protected readonly loadingServices = signal(false);
  protected readonly loadError = signal<string | null>(null);

  // Selection.
  protected readonly selectedService = signal<SalonService | null>(null);
  protected readonly selectedOption = signal<PriceOption | null>(null);
  /** Professional picked by an ADMIN. STAFF never uses it: they always book themselves. */
  private readonly staffChoice = signal<StaffSummary | null>(null);
  protected readonly date = signal('');
  protected readonly selectedTime = signal<string | null>(null);
  protected readonly dateControl = new FormControl('', { nonNullable: true });

  // Available times (null = not loaded yet).
  protected readonly times = signal<string[] | null>(null);
  protected readonly loadingTimes = signal(false);
  protected readonly timesError = signal<string | null>(null);

  // Booking.
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly booked = signal<Booking | null>(null);

  protected readonly sortedOptions = computed(() => {
    const service = this.selectedService();
    if (!service) {
      return [];
    }
    return [...service.priceOptions].sort(
      (a, b) => a.price - b.price || a.durationMinutes - b.durationMinutes,
    );
  });

  protected readonly staffOptions = computed(() => this.selectedService()?.qualifiedStaff ?? []);

  /** The logged professional, when qualified for the selected service. */
  private readonly selfStaff = computed(() => {
    const userId = this.auth.user()?.id;
    return this.staffOptions().find((member) => member.id === userId) ?? null;
  });

  protected readonly selectedStaff = computed(() =>
    this.isAdmin() ? this.staffChoice() : this.selfStaff(),
  );

  protected readonly canConfirm = computed(
    () =>
      this.customer() !== null &&
      this.selectedService() !== null &&
      this.selectedOption() !== null &&
      this.selectedStaff() !== null &&
      this.date() !== '' &&
      this.selectedTime() !== null,
  );

  protected readonly summaryService = computed(() => {
    const service = this.selectedService();
    const option = this.selectedOption();
    if (!service) {
      return 'Escolha o serviço';
    }
    return option ? `${service.name} · ${option.label}` : service.name;
  });

  protected readonly summaryWhen = computed(() => {
    const date = this.date();
    const time = this.selectedTime();
    return date && time ? `${formatDate(date)} às ${formatTime(time)}` : 'Escolha a data e o horário';
  });

  constructor() {
    this.dateControl.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => this.onDateChange(value));

    this.searchControl.valueChanges
      .pipe(
        debounceTime(SEARCH_DEBOUNCE_MS),
        map((value) => value.trim()),
        distinctUntilChanged(),
        switchMap((term) => this.search(term)),
        takeUntilDestroyed(),
      )
      .subscribe((list) => {
        this.results.set(list);
        this.searching.set(false);
      });

    this.destroyRef.onDestroy(() => this.timesSubscription?.unsubscribe());
    this.loadServices();
  }

  ngOnInit(): void {
    const rawId = this.customerId();
    if (rawId !== undefined) {
      this.loadPresetCustomer(rawId);
    }
  }

  protected tile(selected: boolean): string {
    return selected
      ? 'border-rose-600 bg-rose-50 ring-1 ring-rose-600'
      : 'border-slate-200 bg-white';
  }

  // ----- Step 1: customer -----

  /** Customer coming from the customers list (`/book?customerId=12`). */
  private loadPresetCustomer(rawId: string): void {
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) {
      this.customerError.set('Cliente não encontrado.');
      return;
    }

    this.loadingCustomer.set(true);
    this.customerError.set(null);
    this.customersService
      .get(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detail) => {
          this.loadingCustomer.set(false);
          // Keep only the summary: the booking history is not needed here.
          this.customer.set({
            id: detail.id,
            name: detail.name,
            email: detail.email,
            phone: detail.phone,
            createdAt: detail.createdAt,
          });
        },
        error: (err: unknown) => {
          this.loadingCustomer.set(false);
          this.customerError.set(apiErrorMessage(err));
        },
      });
  }

  protected selectCustomer(item: CustomerSummary): void {
    this.customer.set(item);
    this.creatingCustomer.set(false);
    this.customerError.set(null);
    this.clearSearch();
    this.error.set(null);
  }

  protected onCustomerCreated(item: CustomerSummary): void {
    this.selectCustomer(item);
  }

  /** Later steps are kept: the customer does not change availability. */
  protected changeCustomer(): void {
    this.customer.set(null);
    this.customerError.set(null);
    this.error.set(null);
    this.clearSearch();
  }

  private clearSearch(): void {
    this.searchControl.setValue('');
    this.results.set(null);
    this.searchError.set(null);
    this.searching.set(false);
  }

  private search(term: string): Observable<CustomerSummary[]> {
    if (term === '') {
      this.results.set(null);
      this.searchError.set(null);
      this.searching.set(false);
      return EMPTY;
    }

    this.searching.set(true);
    this.searchError.set(null);
    return this.customersService.list({ search: term, size: SEARCH_SIZE }).pipe(
      map((page) => page.content),
      catchError((err: unknown) => {
        this.searchError.set(apiErrorMessage(err));
        this.results.set(null);
        this.searching.set(false);
        return EMPTY;
      }),
    );
  }

  // ----- Step 2: service -----

  protected loadServices(): void {
    this.loadingServices.set(true);
    this.loadError.set(null);
    this.catalog.list().subscribe({
      next: (services) => {
        this.services.set(services);
        this.loadingServices.set(false);
      },
      error: (err: unknown) => {
        this.loadError.set(apiErrorMessage(err));
        this.loadingServices.set(false);
      },
    });
  }

  protected selectService(service: SalonService): void {
    this.selectedService.set(service);
    this.selectedOption.set(null);
    this.staffChoice.set(null);
    this.error.set(null);
    this.resetDate();
  }

  protected selectOption(option: PriceOption): void {
    this.selectedOption.set(option);
    this.staffChoice.set(null);
    this.error.set(null);
    this.resetDate();
  }

  protected selectStaff(member: StaffSummary): void {
    this.staffChoice.set(member);
    this.selectedTime.set(null);
    this.error.set(null);
    this.loadTimes();
  }

  protected selectTime(time: string): void {
    this.selectedTime.set(time);
    this.error.set(null);
  }

  // ----- Confirm -----

  protected confirm(): void {
    const customer = this.customer();
    const service = this.selectedService();
    const option = this.selectedOption();
    const staff = this.selectedStaff();
    const startTime = this.selectedTime();
    if (!customer || !service || !option || !staff || !startTime || this.submitting()) {
      return;
    }

    this.submitting.set(true);
    this.error.set(null);
    this.bookings
      .create({
        customerId: customer.id,
        serviceId: service.id,
        priceOptionId: option.id,
        staffId: staff.id,
        startTime, // exactly the string returned by /api/availability
      })
      .subscribe({
        next: (booking) => {
          this.submitting.set(false);
          this.booked.set(booking);
        },
        error: (err: unknown) => {
          this.submitting.set(false);
          this.error.set(apiErrorMessage(err));
          if (err instanceof HttpErrorResponse && err.status === 409) {
            // The slot was taken meanwhile: drop it and refresh the list.
            this.selectedTime.set(null);
            this.loadTimes();
          }
        },
      });
  }

  /** Keeps the customer, clears everything else. */
  protected bookAnother(): void {
    this.clearSelection();
  }

  /** Clears everything, customer included. */
  protected startOver(): void {
    this.customer.set(null);
    this.customerError.set(null);
    this.clearSearch();
    this.creatingCustomer.set(false);
    this.clearSelection();
  }

  private clearSelection(): void {
    this.booked.set(null);
    this.selectedService.set(null);
    this.selectedOption.set(null);
    this.staffChoice.set(null);
    this.error.set(null);
    this.resetDate();
    this.loadServices();
  }

  // ----- Date and times -----

  private onDateChange(value: string): void {
    this.date.set(value);
    this.selectedTime.set(null);
    this.error.set(null);
    this.loadTimes();
  }

  /** Clears the date, the chosen time and the loaded times (without triggering a request). */
  private resetDate(): void {
    this.timesSubscription?.unsubscribe();
    this.dateControl.setValue('', { emitEvent: false });
    this.date.set('');
    this.selectedTime.set(null);
    this.times.set(null);
    this.timesError.set(null);
    this.loadingTimes.set(false);
  }

  private loadTimes(): void {
    this.timesSubscription?.unsubscribe();

    const service = this.selectedService();
    const option = this.selectedOption();
    const staff = this.selectedStaff();
    const date = this.date();

    this.times.set(null);
    this.timesError.set(null);

    if (!service || !option || !staff || !date) {
      this.loadingTimes.set(false);
      return;
    }

    this.loadingTimes.set(true);
    this.timesSubscription = this.schedule
      .getAvailability({
        serviceId: service.id,
        priceOptionId: option.id,
        staffId: staff.id,
        date,
      })
      .subscribe({
        next: (times) => {
          this.times.set(times);
          this.loadingTimes.set(false);
        },
        error: (err: unknown) => {
          this.timesError.set(apiErrorMessage(err));
          this.loadingTimes.set(false);
        },
      });
  }
}