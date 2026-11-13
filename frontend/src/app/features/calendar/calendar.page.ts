import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { apiErrorMessage } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { BookingsService } from '../../core/bookings.service';
import { telUrl, whatsappUrl } from '../../core/customers.service';
import {
  addDays,
  formatDateTime,
  formatTime,
  parseDateString,
  startOfWeek,
  toDateString,
  todayString,
} from '../../core/date-utils';
import { formatMoney } from '../../core/format';
import { Booking } from '../../core/models';
import { reminderUrl } from '../../core/reminder';
import { Alert } from '../../shared/alert';
import { ConfirmDialog } from '../../shared/confirm-dialog';
import { StatusBadge } from '../../shared/status-badge';

type ViewMode = 'day' | 'week';
type ActionKind = 'complete' | 'cancel';

interface PendingAction {
  kind: ActionKind;
  booking: Booking;
}

interface DayGroup {
  date: string; // YYYY-MM-DD
  today: boolean;
  weekday: string; // "seg."
  dayNumber: number;
  heading: string; // "segunda-feira, 16 de nov."
  bookings: Booking[];
  bookedCount: number;
}

interface StaffOption {
  id: number;
  name: string;
}

interface Summary {
  count: number;
  total: number;
}

const weekdayFormat = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' });
const headingFormat = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: 'numeric',
  month: 'short',
});
const rangeFormat = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' });

@Component({
  selector: 'app-calendar-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Alert, ConfirmDialog, StatusBadge],
  template: `
    <div class="space-y-4 px-4 pb-16 pt-4">
      <div class="flex items-center justify-between gap-3">
        <h1 class="text-2xl font-semibold text-slate-900">Agenda</h1>
        <div class="w-40">
          <div class="segmented" role="group" aria-label="Visualização">
            <button
              type="button"
              class="segmented-item"
              [class.segmented-item-active]="mode() === 'day'"
              [attr.aria-pressed]="mode() === 'day'"
              (click)="setMode('day')"
            >
              Dia
            </button>
            <button
              type="button"
              class="segmented-item"
              [class.segmented-item-active]="mode() === 'week'"
              [attr.aria-pressed]="mode() === 'week'"
              (click)="setMode('week')"
            >
              Semana
            </button>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button
          type="button"
          class="btn btn-secondary w-11 px-0 text-xl"
          aria-label="Semana anterior"
          [disabled]="loading()"
          (click)="previousWeek()"
        >
          ‹
        </button>
        <p class="min-w-0 flex-1 truncate text-center text-sm font-medium text-slate-700">
          {{ rangeLabel() }}
        </p>
        <button
          type="button"
          class="btn btn-secondary w-11 px-0 text-xl"
          aria-label="Próxima semana"
          [disabled]="loading()"
          (click)="nextWeek()"
        >
          ›
        </button>
        <button
          type="button"
          class="btn btn-secondary"
          [disabled]="loading() || atToday()"
          (click)="goToToday()"
        >
          Hoje
        </button>
      </div>

      @if (mode() === 'day') {
        <div class="grid grid-cols-7 gap-1">
          @for (day of days(); track day.date) {
            <button
              type="button"
              class="flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-lg border py-1"
              [class]="dayClass(day)"
              [attr.aria-pressed]="day.date === selectedDate()"
              (click)="selectDay(day.date)"
            >
              <span class="text-xs capitalize">{{ day.weekday }}</span>
              <span class="text-base font-semibold">{{ day.dayNumber }}</span>
              <span class="flex h-4 items-center">
                @if (day.bookedCount > 0) {
                  <span
                    class="min-w-4 rounded-full px-1 text-xs leading-4"
                    [class]="badgeClass(day)"
                  >
                    {{ day.bookedCount }}
                  </span>
                }
              </span>
            </button>
          }
        </div>
      }

      <div class="space-y-1">
        <label class="flex min-h-11 items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            class="h-5 w-5 rounded border-slate-300 accent-rose-600"
            [checked]="showCancelled()"
            (change)="onToggleCancelled($event)"
          />
          Mostrar canceladas
        </label>

        @if (isAdmin()) {
          <div>
            <label class="label" for="staff-filter">Profissional</label>
            <select id="staff-filter" class="input" (change)="onStaffChange($event)">
              <option value="" [selected]="staffFilter() === null">Todos</option>
              @for (option of staffOptions(); track option.id) {
                <option [value]="option.id" [selected]="option.id === staffFilter()">
                  {{ option.name }}
                </option>
              }
            </select>
          </div>
        }
      </div>

      <app-alert type="error" [message]="actionError()" />

      @if (!loading() && !error()) {
        <div class="rounded-xl bg-rose-50 px-4 py-3" role="status">
          <p class="text-xs font-medium text-rose-700">{{ summaryTitle() }}</p>
          <p class="text-base font-semibold text-slate-900">{{ summaryText() }}</p>
        </div>
      }

      @if (loading()) {
        <p class="py-10 text-center text-sm text-slate-500" role="status">Carregando agenda...</p>
      } @else if (error(); as loadError) {
        <div class="space-y-3 py-6">
          <app-alert type="error" [message]="loadError" />
          <button type="button" class="btn btn-secondary w-full" (click)="load()">
            Tentar novamente
          </button>
        </div>
      } @else {
        <div class="space-y-5">
          @for (day of shownDays(); track day.date) {
            <section>
              <h2 class="flex items-center gap-2 text-base font-semibold capitalize text-slate-900">
                {{ day.heading }}
                @if (day.today) {
                  <span class="text-xs font-medium normal-case text-rose-600">Hoje</span>
                }
              </h2>

              @if (day.bookings.length === 0) {
                <p class="mt-2 rounded-lg bg-slate-100 px-4 py-3 text-center text-sm text-slate-600">
                  Sem agendamentos
                </p>
              } @else {
                <ul class="mt-2 space-y-2">
                  @for (booking of day.bookings; track booking.id) {
                    <li
                      class="rounded-xl border border-slate-200 bg-white shadow-sm"
                      [class.opacity-60]="booking.status === 'CANCELLED'"
                    >
                      <button
                        type="button"
                        class="flex min-h-11 w-full items-start justify-between gap-3 p-3 text-left"
                        [attr.aria-expanded]="expandedId() === booking.id"
                        (click)="toggle(booking.id)"
                      >
                        <span class="min-w-0">
                          <span class="block text-sm font-semibold text-slate-900">
                            {{ timeRange(booking) }}
                          </span>
                          <span class="block truncate text-sm text-slate-900">
                            {{ booking.customerName }}
                          </span>
                          <span class="block truncate text-sm text-slate-600">
                            {{ booking.serviceName }} · {{ booking.optionLabel }}
                          </span>
                        </span>
                        <app-status-badge [status]="booking.status" />
                      </button>

                      @if (expandedId() === booking.id) {
                        <div class="space-y-3 border-t border-slate-100 p-3">
                          <dl class="space-y-1 text-sm">
                            <div class="flex justify-between gap-3">
                              <dt class="text-slate-500">Profissional</dt>
                              <dd class="text-right font-medium text-slate-900">
                                {{ booking.staffName }}
                              </dd>
                            </div>
                            <div class="flex justify-between gap-3">
                              <dt class="text-slate-500">Preço</dt>
                              <dd class="text-right font-medium text-slate-900">
                                {{ formatMoney(booking.price) }}
                              </dd>
                            </div>
                          </dl>

                          <div class="grid grid-cols-2 gap-2">
                            @if (booking.status === 'BOOKED' && canAct(booking)) {
                              <button
                                type="button"
                                class="btn btn-primary disabled:cursor-not-allowed disabled:opacity-60"
                                [disabled]="acting()"
                                (click)="ask('complete', booking)"
                              >
                                Concluir
                              </button>
                              <button
                                type="button"
                                class="btn btn-danger disabled:cursor-not-allowed disabled:opacity-60"
                                [disabled]="acting()"
                                (click)="ask('cancel', booking)"
                              >
                                Cancelar
                              </button>
                            }
                            @if (booking.customerPhone; as phone) {
                              @if (booking.status === 'BOOKED') {
                                <a
                                  class="btn btn-secondary col-span-2"
                                  [href]="reminderLink(booking, phone)"
                                  target="_blank"
                                  rel="noopener"
                                >
                                  Enviar lembrete
                                </a>
                              }
                              <a
                                class="btn btn-secondary"
                                [href]="whatsappUrl(phone)"
                                target="_blank"
                                rel="noopener"
                              >
                                WhatsApp
                              </a>
                              <a class="btn btn-secondary" [href]="telUrl(phone)">Ligar</a>
                            }
                          </div>
                        </div>
                      }
                    </li>
                  }
                </ul>
              }
            </section>
          }
        </div>
      }
    </div>

    <!-- Floating "+" above the bottom nav, aligned with the centered content column. -->
    <div
      class="pointer-events-none fixed inset-x-0 z-10"
      style="bottom: calc(4.5rem + env(safe-area-inset-bottom))"
    >
      <div class="mx-auto flex max-w-md justify-end px-4">
        <a
          routerLink="/book"
          class="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-600 text-white shadow-lg hover:bg-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
          aria-label="Novo agendamento"
        >
          <svg
            class="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14M5 12h14" />
          </svg>
        </a>
      </div>
    </div>

    <app-confirm-dialog
      [open]="dialog() !== null"
      [title]="dialog()?.title ?? ''"
      [message]="dialog()?.message ?? ''"
      [confirmLabel]="dialog()?.confirmLabel ?? 'Confirmar'"
      [tone]="dialog()?.tone ?? 'danger'"
      [loading]="acting()"
      (confirmed)="confirm()"
      (cancelled)="dismiss()"
    />
  `,
})
export class CalendarPage {
  private readonly auth = inject(AuthService);
  private readonly bookingsService = inject(BookingsService);
  private readonly destroyRef = inject(DestroyRef);

  private requestId = 0;

  protected readonly formatMoney = formatMoney;
  protected readonly whatsappUrl = whatsappUrl;
  protected readonly reminderLink = reminderUrl;
  protected readonly telUrl = telUrl;

  protected readonly isAdmin = computed(() => this.auth.role() === 'ADMIN');
  private readonly userId = computed(() => this.auth.user()?.id ?? null);

  protected readonly mode = signal<ViewMode>('day');
  protected readonly weekStart = signal<Date>(startOfWeek(new Date()));
  protected readonly selectedDate = signal<string>(todayString());

  protected readonly bookings = signal<Booking[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);

  protected readonly showCancelled = signal(false);
  protected readonly staffFilter = signal<number | null>(null);

  /** One card expanded at a time. */
  protected readonly expandedId = signal<number | null>(null);

  protected readonly pending = signal<PendingAction | null>(null);
  protected readonly acting = signal(false);

  protected readonly isCurrentWeek = computed(
    () => this.weekStart().getTime() === startOfWeek(new Date()).getTime(),
  );

  protected readonly atToday = computed(
    () =>
      this.isCurrentWeek() && (this.mode() === 'week' || this.selectedDate() === todayString()),
  );

  protected readonly rangeLabel = computed(() => {
    const start = this.weekStart();
    return `${rangeFormat.format(start)} – ${rangeFormat.format(addDays(start, 6))}`;
  });

  /** Professionals found in the loaded bookings (admin filter). */
  protected readonly staffOptions = computed<StaffOption[]>(() => {
    const byId = new Map<number, string>();
    for (const booking of this.bookings()) {
      byId.set(booking.staffId, booking.staffName);
    }
    return Array.from(byId, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-BR'),
    );
  });

  private readonly visibleBookings = computed(() => {
    const showCancelled = this.showCancelled();
    const staffId = this.isAdmin() ? this.staffFilter() : null;
    return this.bookings().filter(
      (booking) =>
        (showCancelled || booking.status !== 'CANCELLED') &&
        (staffId === null || booking.staffId === staffId),
    );
  });

  /** The 7 days of the week (Monday to Sunday), each with its bookings sorted by time. */
  protected readonly days = computed<DayGroup[]>(() => {
    const byDay = new Map<string, Booking[]>();
    for (const booking of this.visibleBookings()) {
      // startTime is a salon-local string: its first 10 chars are the local date.
      const key = booking.startTime.slice(0, 10);
      const list = byDay.get(key);
      if (list) {
        list.push(booking);
      } else {
        byDay.set(key, [booking]);
      }
    }

    const start = this.weekStart();
    const today = todayString();
    return Array.from({ length: 7 }, (_, index) => {
      const day = addDays(start, index);
      const date = toDateString(day);
      const bookings = [...(byDay.get(date) ?? [])].sort((a, b) =>
        a.startTime.localeCompare(b.startTime),
      );
      return {
        date,
        today: date === today,
        weekday: weekdayFormat.format(day),
        dayNumber: day.getDate(),
        heading: headingFormat.format(day),
        bookings,
        bookedCount: bookings.filter((booking) => booking.status === 'BOOKED').length,
      };
    });
  });

  /** Dia: only the selected day. Semana: all seven. */
  protected readonly shownDays = computed(() =>
    this.mode() === 'week'
      ? this.days()
      : this.days().filter((day) => day.date === this.selectedDate()),
  );

  /**
   * Count and total of what is on screen (day or week), following the professional filter.
   * Cancelled bookings never count, even when "Mostrar canceladas" is on.
   */
  private readonly summary = computed<Summary>(() => {
    let count = 0;
    let total = 0;
    for (const day of this.shownDays()) {
      for (const booking of day.bookings) {
        if (booking.status === 'CANCELLED') {
          continue;
        }
        count += 1;
        total += Number(booking.price);
      }
    }
    return { count, total };
  });

  protected readonly summaryTitle = computed(() =>
    this.mode() === 'day' ? 'Resumo do dia' : 'Resumo da semana',
  );

  protected readonly summaryText = computed(() => {
    const { count, total } = this.summary();
    if (count === 0) {
      return 'Nenhum agendamento';
    }
    const noun = count === 1 ? 'agendamento' : 'agendamentos';
    return `${count} ${noun} · ${formatMoney(total)}`;
  });

  protected readonly dialog = computed(() => {
    const action = this.pending();
    if (!action) {
      return null;
    }
    const { booking } = action;
    const details = `${booking.customerName} — ${booking.serviceName}, ${formatDateTime(booking.startTime)}`;
    if (action.kind === 'complete') {
      return {
        title: 'Concluir agendamento',
        message: `Deseja marcar este agendamento como concluído? ${details}`,
        confirmLabel: 'Concluir',
        tone: 'primary' as const,
      };
    }
    return {
      title: 'Cancelar agendamento',
      message: `Deseja cancelar este agendamento? ${details}`,
      confirmLabel: 'Cancelar agendamento',
      tone: 'danger' as const,
    };
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    const requestId = ++this.requestId;
    const start = this.weekStart();
    const from = toDateString(start);
    const to = toDateString(addDays(start, 6));

    this.loading.set(true);
    this.error.set(null);
    this.actionError.set(null);
    this.expandedId.set(null);
    this.bookings.set([]);

    this.bookingsService
      .calendar(from, to)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          if (requestId !== this.requestId) {
            return;
          }
          this.bookings.set(list);
          this.loading.set(false);
        },
        error: (err) => {
          if (requestId !== this.requestId) {
            return;
          }
          this.error.set(apiErrorMessage(err));
          this.loading.set(false);
        },
      });
  }

  protected setMode(mode: ViewMode): void {
    this.mode.set(mode);
    this.expandedId.set(null);
  }

  protected previousWeek(): void {
    this.shiftWeek(-7);
  }

  protected nextWeek(): void {
    this.shiftWeek(7);
  }

  protected goToToday(): void {
    const start = startOfWeek(new Date());
    const sameWeek = start.getTime() === this.weekStart().getTime();
    this.selectedDate.set(todayString());
    this.expandedId.set(null);
    if (sameWeek) {
      return;
    }
    this.weekStart.set(start);
    this.staffFilter.set(null);
    this.load();
  }

  protected selectDay(date: string): void {
    this.selectedDate.set(date);
    this.expandedId.set(null);
  }

  protected toggle(id: number): void {
    this.expandedId.update((current) => (current === id ? null : id));
  }

  protected onToggleCancelled(event: Event): void {
    this.showCancelled.set((event.target as HTMLInputElement).checked);
  }

  protected onStaffChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.staffFilter.set(value === '' ? null : Number(value));
  }

  /** ADMIN: any booking. STAFF: only where they are the professional. */
  protected canAct(booking: Booking): boolean {
    return this.isAdmin() || booking.staffId === this.userId();
  }

  protected ask(kind: ActionKind, booking: Booking): void {
    this.actionError.set(null);
    this.pending.set({ kind, booking });
  }

  protected dismiss(): void {
    if (!this.acting()) {
      this.pending.set(null);
    }
  }

  protected confirm(): void {
    const action = this.pending();
    if (!action || this.acting()) {
      return;
    }

    this.acting.set(true);
    const request$ =
      action.kind === 'complete'
        ? this.bookingsService.complete(action.booking.id)
        : this.bookingsService.cancel(action.booking.id);

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (updated) => {
        this.bookings.update((list) =>
          list.map((booking) => (booking.id === updated.id ? updated : booking)),
        );
        this.acting.set(false);
        this.pending.set(null);
      },
      error: (err) => {
        this.actionError.set(apiErrorMessage(err));
        this.acting.set(false);
        this.pending.set(null);
      },
    });
  }

  protected timeRange(booking: Booking): string {
    return `${formatTime(booking.startTime)} – ${formatTime(booking.endTime)}`;
  }

  protected dayClass(day: DayGroup): string {
    if (day.date === this.selectedDate()) {
      return 'border-rose-600 bg-rose-600 text-white';
    }
    return day.today
      ? 'border-rose-300 bg-rose-50 text-rose-700'
      : 'border-slate-200 bg-white text-slate-700';
  }

  protected badgeClass(day: DayGroup): string {
    return day.date === this.selectedDate() ? 'bg-white text-rose-700' : 'bg-rose-100 text-rose-700';
  }

  /** Moves the week and the selected day by the same number of days. */
  private shiftWeek(days: number): void {
    this.weekStart.set(addDays(this.weekStart(), days));
    this.selectedDate.set(toDateString(addDays(parseDateString(this.selectedDate()), days)));
    this.staffFilter.set(null);
    this.load();
  }
}