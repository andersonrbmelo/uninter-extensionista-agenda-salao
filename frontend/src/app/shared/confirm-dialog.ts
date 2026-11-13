import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

export type ConfirmTone = 'danger' | 'primary';

@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'onEscape()',
  },
  template: `
    @if (open()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
        (click)="onBackdrop()"
      >
        <div
          class="card w-full max-w-md bg-white"
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="title()"
          (click)="$event.stopPropagation()"
        >
          <h2 class="text-lg font-semibold text-slate-900">{{ title() }}</h2>
          <p class="mt-2 text-sm text-slate-600">{{ message() }}</p>

          <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              class="btn btn-secondary disabled:cursor-not-allowed disabled:opacity-60"
              [disabled]="loading()"
              (click)="cancelled.emit()"
            >
              {{ cancelLabel() }}
            </button>
            <button
              type="button"
              [class]="confirmClass()"
              [disabled]="loading()"
              (click)="confirmed.emit()"
            >
              {{ loading() ? 'Aguarde...' : confirmLabel() }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ConfirmDialog {
  readonly open = input(false);
  readonly title = input('Confirmar');
  readonly message = input('');
  readonly confirmLabel = input('Confirmar');
  readonly cancelLabel = input('Voltar');
  readonly tone = input<ConfirmTone>('danger');
  readonly loading = input(false);

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  protected readonly confirmClass = computed(
    () =>
      (this.tone() === 'danger' ? 'btn btn-danger' : 'btn btn-primary') +
      ' disabled:cursor-not-allowed disabled:opacity-60',
  );

  protected onBackdrop(): void {
    if (!this.loading()) {
      this.cancelled.emit();
    }
  }

  protected onEscape(): void {
    if (this.open() && !this.loading()) {
      this.cancelled.emit();
    }
  }
}