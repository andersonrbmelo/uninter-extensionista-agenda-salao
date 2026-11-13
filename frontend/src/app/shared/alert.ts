import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type AlertType = 'error' | 'success';

@Component({
  selector: 'app-alert',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (message(); as text) {
      <div
        class="rounded-lg border px-4 py-3 text-sm"
        [class]="styles()"
        [attr.role]="type() === 'error' ? 'alert' : 'status'"
      >
        {{ text }}
      </div>
    }
  `,
})
export class Alert {
  readonly type = input<AlertType>('error');
  readonly message = input<string | null>(null);

  protected readonly styles = computed(() =>
    this.type() === 'error'
      ? 'border-red-200 bg-red-50 text-red-700'
      : 'border-green-200 bg-green-50 text-green-700',
  );
}