import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Observable, catchError, debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';

import { apiErrorMessage } from '../core/api-error';
import {
  CustomerRequest,
  CustomerSummary,
  CustomersService,
  formatPhone,
  isValidPhone,
  normalizePhone,
} from '../core/customers.service';
import { Alert } from './alert';
import { PhoneMask } from './phone-mask';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_ERROR = 'Telefone inválido. Use DDD + número, ex.: (81) 99999-8888.';

function notBlank(control: AbstractControl<string>): ValidationErrors | null {
  return control.value.trim() === '' ? { required: true } : null;
}

/** Empty is handled by `notBlank`; here only a filled value is checked. */
function validPhone(control: AbstractControl<string>): ValidationErrors | null {
  const value = control.value.trim();
  if (value === '') {
    return null;
  }
  return isValidPhone(normalizePhone(value)) ? null : { phone: true };
}

function optionalEmail(control: AbstractControl<string>): ValidationErrors | null {
  const value = control.value.trim();
  return value === '' || EMAIL_PATTERN.test(value) ? null : { email: true };
}

@Component({
  selector: 'app-customer-quick-create',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Alert, PhoneMask],
  template: `
    <section class="card">
      <h2 class="text-lg font-semibold text-slate-900">Novo cliente</h2>

      <form class="mt-4 space-y-4" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <app-alert type="error" [message]="error()" />

        <div>
          <label class="label" for="qc-name">Nome</label>
          <input
            id="qc-name"
            type="text"
            class="input"
            formControlName="name"
            autocomplete="off"
            autocapitalize="words"
            enterkeyhint="next"
          />
          @if (showError(form.controls.name)) {
            <p class="mt-1 text-sm text-red-600">
              {{
                form.controls.name.hasError('required')
                  ? 'Informe o nome.'
                  : 'O nome pode ter até 100 caracteres.'
              }}
            </p>
          }
        </div>

        <div>
          <label class="label" for="qc-phone">Telefone</label>
          <input
            id="qc-phone"
            type="tel"
            inputmode="tel"
            class="input"
            formControlName="phone"
            appPhoneMask
            autocomplete="off"
            placeholder="(81) 99999-8888"
            enterkeyhint="done"
          />
          @if (phoneValid()) {
            <p class="mt-1 text-sm text-slate-600">Será salvo como {{ formattedPhone() }}</p>
          } @else if (showError(form.controls.phone)) {
            <p class="mt-1 text-sm text-red-600">{{ phoneError() }}</p>
          }
          @if (duplicate(); as existing) {
            <p
              role="status"
              class="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
            >
              Já existe um cliente com este telefone: {{ existing.name }}. Você ainda pode salvar.
            </p>
          }
        </div>

        <div>
          <button
            type="button"
            class="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-slate-700 underline underline-offset-4"
            [attr.aria-expanded]="showDetails()"
            (click)="toggleDetails()"
          >
            {{ showDetails() ? 'Menos detalhes' : 'Mais detalhes' }}
            <svg
              class="h-4 w-4 transition-transform"
              [class.rotate-180]="showDetails()"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        @if (showDetails()) {
          <div class="space-y-4">
            <div>
              <label class="label" for="qc-email">E-mail</label>
              <input
                id="qc-email"
                type="email"
                inputmode="email"
                class="input"
                formControlName="email"
                autocomplete="off"
                autocapitalize="none"
                enterkeyhint="next"
              />
              @if (showError(form.controls.email)) {
                <p class="mt-1 text-sm text-red-600">E-mail inválido.</p>
              }
            </div>

            <div>
              <label class="label" for="qc-allergies">Alergias</label>
              <textarea
                id="qc-allergies"
                rows="2"
                class="input"
                formControlName="allergies"
              ></textarea>
              @if (showError(form.controls.allergies)) {
                <p class="mt-1 text-sm text-red-600">Alergias: máximo de 2000 caracteres.</p>
              }
            </div>

            <div>
              <label class="label" for="qc-notes">Observações</label>
              <textarea id="qc-notes" rows="2" class="input" formControlName="notes"></textarea>
              @if (showError(form.controls.notes)) {
                <p class="mt-1 text-sm text-red-600">Observações: máximo de 2000 caracteres.</p>
              }
            </div>
          </div>
        }

        <div class="flex flex-col gap-2">
          <button
            type="submit"
            class="btn btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
            [disabled]="saving()"
          >
            {{ saving() ? 'Salvando...' : 'Salvar cliente' }}
          </button>
          <button
            type="button"
            class="btn btn-secondary w-full disabled:cursor-not-allowed disabled:opacity-60"
            [disabled]="saving()"
            (click)="cancelled.emit()"
          >
            Cancelar
          </button>
        </div>
      </form>
    </section>
  `,
})
export class CustomerQuickCreate {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly customersService = inject(CustomersService);

  readonly created = output<CustomerSummary>();
  readonly cancelled = output<void>();

  protected readonly form = this.fb.group({
    name: ['', [notBlank, Validators.maxLength(100)]],
    phone: ['', [notBlank, validPhone]],
    email: ['', [optionalEmail]],
    allergies: ['', [Validators.maxLength(2000)]],
    notes: ['', [Validators.maxLength(2000)]],
  });

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly showDetails = signal(false);
  /** Existing customer with exactly the same phone (non-blocking warning). */
  protected readonly duplicate = signal<CustomerSummary | null>(null);

  private readonly phoneValue = toSignal(this.form.controls.phone.valueChanges, {
    initialValue: '',
  });
  private readonly normalizedPhone = computed(() => normalizePhone(this.phoneValue()));
  protected readonly phoneValid = computed(() => isValidPhone(this.normalizedPhone()));
  protected readonly formattedPhone = computed(() => formatPhone(this.normalizedPhone()));

  constructor() {
    this.form.controls.phone.valueChanges
      .pipe(
        debounceTime(300),
        map((value) => normalizePhone(value)),
        map((digits) => (isValidPhone(digits) ? digits : null)),
        distinctUntilChanged(),
        switchMap((digits) => this.findDuplicate(digits)),
        takeUntilDestroyed(),
      )
      .subscribe((existing) => this.duplicate.set(existing));
  }

  protected showError(control: AbstractControl): boolean {
    return control.invalid && control.touched;
  }

  protected phoneError(): string {
    return this.form.controls.phone.hasError('required') ? 'Informe o telefone.' : PHONE_ERROR;
  }

  protected toggleDetails(): void {
    this.showDetails.update((open) => !open);
  }

  protected submit(): void {
    if (this.saving()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      const { email, allergies, notes } = this.form.controls;
      // Do not leave an error hidden inside the collapsed section.
      if (email.invalid || allergies.invalid || notes.invalid) {
        this.showDetails.set(true);
      }
      return;
    }

    const value = this.form.getRawValue();
    const request: CustomerRequest = {
      name: value.name.trim(),
      phone: normalizePhone(value.phone),
    };
    const email = value.email.trim();
    const allergies = value.allergies.trim();
    const notes = value.notes.trim();
    if (email) {
      request.email = email;
    }
    if (allergies) {
      request.allergies = allergies;
    }
    if (notes) {
      request.notes = notes;
    }

    this.saving.set(true);
    this.error.set(null);
    this.customersService.create(request).subscribe({
      next: (customer) => {
        this.saving.set(false);
        this.created.emit(customer);
      },
      error: (err: unknown) => {
        this.error.set(apiErrorMessage(err));
        this.saving.set(false);
      },
    });
  }

  private findDuplicate(digits: string | null): Observable<CustomerSummary | null> {
    if (digits === null) {
      return of(null);
    }
    return this.customersService.list({ search: digits, size: 5 }).pipe(
      map((page) => page.content.find((customer) => customer.phone === digits) ?? null),
      catchError(() => of(null)),
    );
  }
}