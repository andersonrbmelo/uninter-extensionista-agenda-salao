import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { PageResponse } from '../core/models';

@Component({
  selector: 'app-pagination',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (response().totalPages > 1) {
      <nav class="flex items-center justify-between gap-3 py-2" aria-label="Paginação">
        <button
          type="button"
          class="btn btn-secondary disabled:cursor-not-allowed disabled:opacity-60"
          [disabled]="disabled() || isFirst()"
          (click)="go(response().page - 1)"
        >
          Anterior
        </button>
        <span class="text-sm text-slate-600">
          Página {{ response().page + 1 }} de {{ response().totalPages }}
        </span>
        <button
          type="button"
          class="btn btn-secondary disabled:cursor-not-allowed disabled:opacity-60"
          [disabled]="disabled() || isLast()"
          (click)="go(response().page + 1)"
        >
          Próxima
        </button>
      </nav>
    }
  `,
})
export class Pagination {
  /** Any page response: only page and totalPages are used. */
  readonly response = input.required<PageResponse<unknown>>();
  readonly disabled = input(false);
  /** Emits the zero-based index of the requested page. */
  readonly pageChange = output<number>();

  protected readonly isFirst = computed(() => this.response().page <= 0);
  protected readonly isLast = computed(
    () => this.response().page >= this.response().totalPages - 1,
  );

  protected go(page: number): void {
    this.pageChange.emit(page);
  }
}