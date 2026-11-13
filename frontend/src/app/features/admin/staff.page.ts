import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';

import { apiErrorMessage } from '../../core/api-error';
import { formatPhone, isValidPhone, normalizePhone } from '../../core/customers.service';
import { CreateStaffRequest, StaffResponse } from '../../core/models';
import { StaffService } from '../../core/staff.service';
import { Alert } from '../../shared/alert';
import { ConfirmDialog } from '../../shared/confirm-dialog';
import { PhoneMask } from '../../shared/phone-mask';

const PHONE_ERROR = 'Telefone inválido. Use DDD + número, ex.: (81) 99999-8888.';
const PASSWORD_LENGTH_ERROR = 'A senha deve ter entre 6 e 72 caracteres.';

const NAME_ERRORS: Record<string, string> = {
  required: 'Informe o nome.',
  maxlength: 'O nome pode ter até 100 caracteres.',
};
const EMAIL_ERRORS: Record<string, string> = {
  required: 'Informe o e-mail.',
  email: 'E-mail inválido.',
};
const PASSWORD_ERRORS: Record<string, string> = {
  required: 'Informe a senha.',
  minlength: PASSWORD_LENGTH_ERROR,
  maxlength: PASSWORD_LENGTH_ERROR,
};
const PHONE_ERRORS: Record<string, string> = {
  required: 'Informe o telefone.',
  phone: PHONE_ERROR,
};

/** Rejects values that are only whitespace. */
function notBlank(control: AbstractControl<string>): ValidationErrors | null {
  return control.value.trim() ? null : { required: true };
}

/** Empty values are left to `required`. */
function phoneValidator(control: AbstractControl<string>): ValidationErrors | null {
  const value = control.value.trim();
  if (value === '') {
    return null;
  }
  return isValidPhone(normalizePhone(value)) ? null : { phone: true };
}

@Component({
  selector: 'app-staff-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Alert, ConfirmDialog, PhoneMask],
  template: `
    <div class="space-y-4 px-4 py-4">
      <h1 class="text-2xl font-semibold text-slate-900">Profissionais</h1>

      <app-alert type="error" [message]="error()" />
      <app-alert type="success" [message]="success()" />

      <section class="card">
        <h2 class="text-lg font-semibold text-slate-900">Novo profissional</h2>

        <form class="mt-3 space-y-3" [formGroup]="form" (ngSubmit)="create()" novalidate>
          <div>
            <label class="label" for="staff-name">Nome</label>
            <input
              id="staff-name"
              type="text"
              class="input"
              formControlName="name"
              autocomplete="off"
              autocapitalize="words"
              enterkeyhint="next"
            />
            @if (errorOf(form.controls.name, nameErrors); as message) {
              <p class="mt-1 text-sm text-red-600">{{ message }}</p>
            }
          </div>

          <div>
            <label class="label" for="staff-email">E-mail</label>
            <input
              id="staff-email"
              type="email"
              class="input"
              formControlName="email"
              autocomplete="off"
              autocapitalize="none"
              enterkeyhint="next"
            />
            @if (errorOf(form.controls.email, emailErrors); as message) {
              <p class="mt-1 text-sm text-red-600">{{ message }}</p>
            }
          </div>

          <div>
            <label class="label" for="staff-password">Senha</label>
            <input
              id="staff-password"
              type="password"
              class="input"
              formControlName="password"
              autocomplete="new-password"
              enterkeyhint="next"
            />
            @if (errorOf(form.controls.password, passwordErrors); as message) {
              <p class="mt-1 text-sm text-red-600">{{ message }}</p>
            }
          </div>

          <div>
            <label class="label" for="staff-phone">Telefone</label>
            <input
              id="staff-phone"
              type="tel"
              class="input"
              formControlName="phone"
              appPhoneMask
              placeholder="(81) 99999-8888"
              autocomplete="off"
              enterkeyhint="done"
            />
            @if (errorOf(form.controls.phone, phoneErrors); as message) {
              <p class="mt-1 text-sm text-red-600">{{ message }}</p>
            }
          </div>

          <button
            type="submit"
            class="btn btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
            [disabled]="creating()"
          >
            {{ creating() ? 'Criando...' : 'Criar profissional' }}
          </button>
        </form>
      </section>

      <section class="space-y-3">
        <h2 class="text-lg font-semibold text-slate-900">Equipe</h2>

        @if (loading()) {
          <p class="text-sm text-slate-600" role="status">Carregando profissionais...</p>
        } @else if (loadError(); as message) {
          <app-alert type="error" [message]="message" />
          <button type="button" class="btn btn-secondary w-full" (click)="load()">
            Tentar novamente
          </button>
        } @else if (sortedStaff().length === 0) {
          <p class="text-sm text-slate-600">Nenhum profissional cadastrado.</p>
        } @else {
          <ul class="space-y-3">
            @for (member of sortedStaff(); track member.id) {
              <li class="card space-y-3">
                <div class="min-w-0">
                  <p class="font-medium text-slate-900">{{ member.name }}</p>
                  <p class="truncate text-sm text-slate-600">{{ member.email }}</p>
                  <p class="text-sm text-slate-600">{{ formatPhone(member.phone ?? '') }}</p>
                </div>

                @if (resetTargetId() === member.id) {
                  <div class="space-y-2">
                    <label class="label" [for]="'reset-password-' + member.id">Nova senha</label>
                    <input
                      [id]="'reset-password-' + member.id"
                      type="password"
                      class="input"
                      [formControl]="resetControl"
                      autocomplete="new-password"
                    />
                    @if (errorOf(resetControl, passwordErrors); as message) {
                      <p class="text-sm text-red-600">{{ message }}</p>
                    }
                    <div class="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        class="btn btn-secondary disabled:cursor-not-allowed disabled:opacity-60"
                        [disabled]="resetting()"
                        (click)="closeReset()"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        class="btn btn-primary disabled:cursor-not-allowed disabled:opacity-60"
                        [disabled]="resetting()"
                        (click)="saveReset(member)"
                      >
                        {{ resetting() ? 'Salvando...' : 'Salvar senha' }}
                      </button>
                    </div>
                  </div>
                } @else {
                  <div class="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      class="btn btn-secondary disabled:cursor-not-allowed disabled:opacity-60"
                      [disabled]="deactivating()"
                      (click)="openReset(member)"
                    >
                      Redefinir senha
                    </button>
                    <button
                      type="button"
                      class="btn btn-danger disabled:cursor-not-allowed disabled:opacity-60"
                      [disabled]="deactivating()"
                      (click)="askDeactivate(member)"
                    >
                      Desativar
                    </button>
                  </div>
                }
              </li>
            }
          </ul>
        }
      </section>
    </div>

    <app-confirm-dialog
      [open]="deactivateTarget() !== null"
      title="Desativar profissional"
      [message]="deactivateMessage()"
      confirmLabel="Desativar"
      cancelLabel="Voltar"
      tone="danger"
      [loading]="deactivating()"
      (confirmed)="confirmDeactivate()"
      (cancelled)="cancelDeactivate()"
    />
  `,
})
export class StaffPage implements OnInit {
  private readonly staffService = inject(StaffService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly formatPhone = formatPhone;
  protected readonly nameErrors = NAME_ERRORS;
  protected readonly emailErrors = EMAIL_ERRORS;
  protected readonly passwordErrors = PASSWORD_ERRORS;
  protected readonly phoneErrors = PHONE_ERRORS;

  protected readonly form = this.fb.group({
    name: ['', [Validators.required, notBlank, Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(72)]],
    phone: ['', [Validators.required, phoneValidator]],
  });

  protected readonly resetControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(6), Validators.maxLength(72)],
  });

  protected readonly staff = signal<StaffResponse[]>([]);
  protected readonly loading = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly creating = signal(false);
  protected readonly resetting = signal(false);
  protected readonly deactivating = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);

  protected readonly resetTargetId = signal<number | null>(null);
  protected readonly deactivateTarget = signal<StaffResponse | null>(null);

  protected readonly sortedStaff = computed(() =>
    [...this.staff()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
  );

  protected readonly deactivateMessage = computed(() => {
    const target = this.deactivateTarget();
    return target
      ? `${target.name} não poderá mais entrar nem ser agendado(a). Deseja continuar?`
      : '';
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.staffService.list().subscribe({
      next: (items) => {
        this.staff.set(items);
        this.loading.set(false);
      },
      error: (err) => {
        this.loadError.set(apiErrorMessage(err));
        this.loading.set(false);
      },
    });
  }

  /** First matching message of a touched, invalid control. */
  protected errorOf(control: AbstractControl, messages: Record<string, string>): string | null {
    if (!control.touched || !control.errors) {
      return null;
    }
    const key = Object.keys(control.errors).find((candidate) => candidate in messages);
    return key ? messages[key] : null;
  }

  protected create(): void {
    if (this.creating()) {
      return;
    }
    this.success.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const request: CreateStaffRequest = {
      name: value.name.trim(),
      email: value.email.trim(),
      password: value.password,
      phone: normalizePhone(value.phone),
    };

    this.error.set(null);
    this.creating.set(true);
    this.staffService.create(request).subscribe({
      next: (created) => {
        this.staff.update((list) => [...list, created]);
        this.loadError.set(null);
        this.form.reset();
        this.success.set(`${created.name} foi cadastrado(a).`);
        this.creating.set(false);
      },
      error: (err) => {
        this.error.set(apiErrorMessage(err));
        this.creating.set(false);
      },
    });
  }

  protected openReset(member: StaffResponse): void {
    this.error.set(null);
    this.success.set(null);
    this.resetControl.reset('');
    this.resetTargetId.set(member.id);
  }

  protected closeReset(): void {
    if (!this.resetting()) {
      this.resetTargetId.set(null);
    }
  }

  protected saveReset(member: StaffResponse): void {
    if (this.resetting()) {
      return;
    }
    if (this.resetControl.invalid) {
      this.resetControl.markAsTouched();
      return;
    }

    this.error.set(null);
    this.success.set(null);
    this.resetting.set(true);
    this.staffService.resetPassword(member.id, { password: this.resetControl.value }).subscribe({
      next: () => {
        this.resetting.set(false);
        this.resetTargetId.set(null);
        this.resetControl.reset('');
        this.success.set(`Senha de ${member.name} redefinida.`);
      },
      error: (err) => {
        this.error.set(apiErrorMessage(err));
        this.resetting.set(false);
      },
    });
  }

  protected askDeactivate(member: StaffResponse): void {
    this.error.set(null);
    this.success.set(null);
    this.deactivateTarget.set(member);
  }

  protected cancelDeactivate(): void {
    if (!this.deactivating()) {
      this.deactivateTarget.set(null);
    }
  }

  protected confirmDeactivate(): void {
    const target = this.deactivateTarget();
    if (!target || this.deactivating()) {
      return;
    }

    this.error.set(null);
    this.success.set(null);
    this.deactivating.set(true);
    this.staffService.deactivate(target.id).subscribe({
      next: () => {
        this.staff.update((list) => list.filter((item) => item.id !== target.id));
        if (this.resetTargetId() === target.id) {
          this.resetTargetId.set(null);
        }
        this.success.set(`${target.name} foi desativado(a).`);
        this.deactivating.set(false);
        this.deactivateTarget.set(null);
      },
      error: (err) => {
        this.error.set(apiErrorMessage(err));
        this.deactivating.set(false);
        this.deactivateTarget.set(null);
      },
    });
  }
}