import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { apiErrorMessage } from '../../core/api-error';
import {
  CustomerDetail,
  CustomersService,
  formatPhone,
  telUrl,
  whatsappUrl,
} from '../../core/customers.service';
import { formatDate, formatTime } from '../../core/date-utils';
import { formatMoney } from '../../core/format';
import { Alert } from '../../shared/alert';
import { StatusBadge } from '../../shared/status-badge';

@Component({
  selector: 'app-customer-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Alert, StatusBadge],
  template: `
    <div class="px-4 py-4">
      <a
        routerLink="/customers"
        class="inline-flex min-h-11 items-center text-sm font-medium text-rose-600"
      >
        ← Clientes
      </a>

      <div class="mt-2">
        <app-alert type="error" [message]="error()" />
      </div>

      @if (customer(); as c) {
        <h1 class="mt-2 break-words text-2xl font-semibold text-slate-900">{{ c.name }}</h1>

        <a
          class="btn btn-primary mt-3 w-full"
          routerLink="/book"
          [queryParams]="{ customerId: c.id }"
        >
          Agendar
        </a>

        <section class="card mt-4">
          <dl class="space-y-4">
            <div>
              <dt class="text-sm text-slate-500">Telefone</dt>
              <dd class="text-slate-900">{{ formatPhone(c.phone) }}</dd>
              @if (c.phone; as phone) {
                <div class="mt-3 grid grid-cols-2 gap-2">
                  <a class="btn btn-secondary" [href]="telUrl(phone)">Ligar</a>
                  <a
                    class="btn btn-secondary"
                    [href]="whatsappUrl(phone)"
                    target="_blank"
                    rel="noopener"
                  >
                    WhatsApp
                  </a>
                </div>
              }
            </div>
            @if (c.email) {
              <div>
                <dt class="text-sm text-slate-500">E-mail</dt>
                <dd class="break-words text-slate-900">{{ c.email }}</dd>
              </div>
            }
            <div>
              <dt class="text-sm text-slate-500">Alergias</dt>
              <dd class="whitespace-pre-line break-words text-slate-900">
                {{ c.allergies || '—' }}
              </dd>
            </div>
            <div>
              <dt class="text-sm text-slate-500">Observações</dt>
              <dd class="whitespace-pre-line break-words text-slate-900">{{ c.notes || '—' }}</dd>
            </div>
            <div>
              <dt class="text-sm text-slate-500">Cliente desde</dt>
              <dd class="text-slate-900">{{ formatDate(c.createdAt) }}</dd>
            </div>
          </dl>
        </section>

        <section class="mt-6">
          <h2 class="text-lg font-semibold text-slate-900">Histórico de agendamentos</h2>

          @if (history().length === 0) {
            <p class="mt-3 text-sm text-slate-600">Este cliente ainda não possui agendamentos.</p>
          } @else {
            <ul class="mt-3 space-y-3">
              @for (booking of history(); track booking.id) {
                <li class="card">
                  <div class="flex items-start justify-between gap-3">
                    <p class="min-w-0 break-words font-medium text-slate-900">
                      {{ booking.serviceName }} · {{ booking.optionLabel }}
                    </p>
                    <app-status-badge [status]="booking.status" />
                  </div>
                  <p class="mt-1 text-sm text-slate-600">
                    {{ formatDate(booking.startTime) }} · {{ formatTime(booking.startTime) }} –
                    {{ formatTime(booking.endTime) }}
                  </p>
                  <p class="text-sm text-slate-600">Profissional: {{ booking.staffName }}</p>
                  <p class="mt-1 font-medium text-slate-900">{{ formatMoney(booking.price) }}</p>
                </li>
              }
            </ul>
          }
        </section>
      } @else if (loading()) {
        <p class="mt-6 text-sm text-slate-600" role="status">Carregando cliente...</p>
      } @else {
        <div class="mt-6">
          <button type="button" class="btn btn-secondary" (click)="load()">
            Tentar novamente
          </button>
        </div>
      }
    </div>
  `,
})
export class CustomerDetailPage implements OnInit {
  private readonly customersService = inject(CustomersService);

  /** Route param (`withComponentInputBinding`). */
  readonly id = input.required<string>();

  protected readonly customer = signal<CustomerDetail | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  /** Newest first (the API already sends it this way; sorted again to be safe). */
  protected readonly history = computed(() =>
    [...(this.customer()?.bookings ?? [])].sort((a, b) => b.startTime.localeCompare(a.startTime)),
  );

  protected readonly formatPhone = formatPhone;
  protected readonly telUrl = telUrl;
  protected readonly whatsappUrl = whatsappUrl;
  protected readonly formatDate = formatDate;
  protected readonly formatTime = formatTime;
  protected readonly formatMoney = formatMoney;

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    const id = Number(this.id());
    if (!Number.isInteger(id) || id <= 0) {
      this.error.set('Cliente não encontrado.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.customersService.get(id).subscribe({
      next: (customer) => {
        this.customer.set(customer);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(apiErrorMessage(err));
        this.loading.set(false);
      },
    });
  }
}