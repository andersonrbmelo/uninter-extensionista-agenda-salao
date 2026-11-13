import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { BookingStatus } from '../core/models';

const STATUS_LABELS: Record<BookingStatus, string> = {
  BOOKED: 'Agendado',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
};

const STATUS_STYLES: Record<BookingStatus, string> = {
  BOOKED: 'bg-sky-100 text-sky-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-slate-200 text-slate-600',
};

@Component({
  selector: 'app-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge" [class]="styles()">{{ label() }}</span>`,
})
export class StatusBadge {
  readonly status = input.required<BookingStatus>();

  protected readonly label = computed(() => STATUS_LABELS[this.status()]);
  protected readonly styles = computed(() => STATUS_STYLES[this.status()]);
}