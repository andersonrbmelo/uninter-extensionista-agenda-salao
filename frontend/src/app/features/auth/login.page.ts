import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { apiErrorMessage } from '../../core/api-error';
import { AuthService, homeForRole } from '../../core/auth.service';
import { Alert } from '../../shared/alert';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, Alert],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mx-auto flex min-h-dvh w-full max-w-md items-center px-4 py-8">
      <div class="card w-full">
        <h1 class="text-2xl font-bold text-slate-900">Entrar</h1>
        <p class="mt-1 text-sm text-slate-500">Acesso da equipe do salão.</p>

        @if (error()) {
          <div class="mt-4">
            <app-alert type="error" [message]="error()" />
          </div>
        }

        <form class="mt-6 space-y-4" [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div>
            <label class="label" for="email">E-mail</label>
            <input
              id="email"
              class="input"
              type="email"
              formControlName="email"
              autocomplete="username"
              autocapitalize="none"
              autocorrect="off"
              spellcheck="false"
              inputmode="email"
              enterkeyhint="next"
              placeholder="voce@exemplo.com"
            />
            @if (form.controls.email.touched && form.controls.email.errors; as errors) {
              <p class="mt-1 text-sm text-red-600">
                {{ errors['required'] ? 'Informe o e-mail.' : 'E-mail inválido.' }}
              </p>
            }
          </div>

          <div>
            <label class="label" for="password">Senha</label>
            <input
              id="password"
              class="input"
              type="password"
              formControlName="password"
              autocomplete="current-password"
              enterkeyhint="go"
              placeholder="Sua senha"
            />
            @if (form.controls.password.touched && form.controls.password.errors) {
              <p class="mt-1 text-sm text-red-600">Informe a senha.</p>
            }
          </div>

          <button
            type="submit"
            class="btn btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
            [disabled]="loading()"
          >
            {{ loading() ? 'Entrando...' : 'Entrar' }}
          </button>
        </form>
      </div>
    </main>
  `,
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  protected submit(): void {
    if (this.loading()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.auth.login(this.form.getRawValue()).subscribe({
      next: (response) => {
        this.loading.set(false);
        void this.router.navigateByUrl(homeForRole(response.user.role));
      },
      error: (err: unknown) => {
        this.error.set(apiErrorMessage(err));
        this.loading.set(false);
      },
    });
  }
}