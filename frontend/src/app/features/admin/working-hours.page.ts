import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
} from '@angular/forms';

import { apiErrorMessage } from '../../core/api-error';
import { trimSeconds } from '../../core/date-utils';
import { dayLabel } from '../../core/format';
import { DayOfWeek, WorkingHours } from '../../core/models';
import { ScheduleService } from '../../core/schedule.service';
import { Alert } from '../../shared/alert';

type DayRow = FormGroup<{
  dayOfWeek: FormControl<DayOfWeek>;
  open: FormControl<boolean>;
  openTime: FormControl<string>;
  closeTime: FormControl<string>;
}>;

const DEFAULT_OPEN_TIME = '09:00';
const DEFAULT_CLOSE_TIME = '18:00';

@Component({
  selector: 'app-working-hours-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Alert],
  template: `
    <div class="mx-auto max-w-5xl px-4 py-6">
      <h1 class="text-2xl font-semibold text-slate-900">Horários de funcionamento</h1>
      <p class="mt-1 text-sm text-slate-600">
        Defina os dias e horários de atendimento do salão. Valem para todos os profissionais.
      </p>

      <div class="mt-4 space-y-3">
        <app-alert type="error" [message]="error()" />
        <app-alert type="success" [message]="success()" />
      </div>

      @if (loading() && rows().length === 0) {
        <p class="mt-6 text-sm text-slate-600" role="status">Carregando horários...</p>
      } @else if (rows().length === 0) {
        <div class="mt-6">
          <button
            type="button"
            class="btn btn-secondary disabled:cursor-not-allowed disabled:opacity-60"
            [disabled]="loading()"
            (click)="load()"
          >
            Tentar novamente
          </button>
        </div>
      } @else {
        <form class="mt-6 space-y-3" [formGroup]="form" (ngSubmit)="save()">
          @for (row of rows(); track row.controls.dayOfWeek.value; let i = $index) {
            <div class="card" [formGroup]="row">
              <div class="grid items-center gap-3 sm:grid-cols-[11rem_7rem_1fr_1fr]">
                <span class="font-medium text-slate-900">{{ labelOf(row) }}</span>

                <label class="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    formControlName="open"
                    class="h-4 w-4 rounded border-slate-300 accent-rose-600"
                    [attr.aria-label]="'Aberto: ' + labelOf(row)"
                  />
                  Aberto
                </label>

                <div>
                  <label class="label" [for]="'open-time-' + i">Abre às</label>
                  <input
                    type="time"
                    class="input disabled:cursor-not-allowed disabled:opacity-60"
                    [id]="'open-time-' + i"
                    formControlName="openTime"
                  />
                </div>

                <div>
                  <label class="label" [for]="'close-time-' + i">Fecha às</label>
                  <input
                    type="time"
                    class="input disabled:cursor-not-allowed disabled:opacity-60"
                    [id]="'close-time-' + i"
                    formControlName="closeTime"
                  />
                </div>
              </div>

              @if (rowErrors()[i]; as message) {
                <p class="mt-2 text-sm text-red-600" role="alert">{{ message }}</p>
              }
            </div>
          }

          <div class="pt-2">
            <button
              type="submit"
              class="btn btn-primary disabled:cursor-not-allowed disabled:opacity-60"
              [disabled]="saving() || loading()"
            >
              {{ saving() ? 'Salvando...' : 'Salvar horários' }}
            </button>
          </div>
        </form>
      }
    </div>
  `,
})
export class WorkingHoursPage implements OnInit {
  private readonly scheduleService = inject(ScheduleService);
  private readonly fb = inject(NonNullableFormBuilder);

  /** Wrapper only: each day row has its own nested group. */
  protected readonly form = this.fb.group({});
  protected readonly rows = signal<DayRow[]>([]);
  protected readonly rowErrors = signal<Record<number, string>>({});

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.scheduleService.getWorkingHours().subscribe({
      next: (items) => {
        this.setRows(items);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(apiErrorMessage(err));
        this.loading.set(false);
      },
    });
  }

  protected labelOf(row: DayRow): string {
    return dayLabel(row.controls.dayOfWeek.value);
  }

  protected save(): void {
    if (this.saving() || this.loading()) {
      return;
    }
    this.success.set(null);

    const errors = this.validate();
    this.rowErrors.set(errors);
    if (Object.keys(errors).length > 0) {
      this.error.set('Corrija os horários destacados antes de salvar.');
      return;
    }
    this.error.set(null);

    const payload: WorkingHours[] = this.rows().map((row) => {
      const value = row.getRawValue();
      return value.open
        ? {
            dayOfWeek: value.dayOfWeek,
            open: true,
            openTime: value.openTime,
            closeTime: value.closeTime,
          }
        : { dayOfWeek: value.dayOfWeek, open: false, openTime: null, closeTime: null };
    });

    this.saving.set(true);
    this.scheduleService.saveWorkingHours(payload).subscribe({
      next: (items) => {
        this.setRows(items);
        this.saving.set(false);
        this.success.set('Horários salvos com sucesso.');
      },
      error: (err) => {
        this.error.set(apiErrorMessage(err));
        this.saving.set(false);
      },
    });
  }

  private validate(): Record<number, string> {
    const errors: Record<number, string> = {};
    this.rows().forEach((row, index) => {
      const { open, openTime, closeTime } = row.getRawValue();
      if (!open) {
        return;
      }
      if (!openTime || !closeTime) {
        errors[index] = 'Informe o horário de abertura e de fechamento.';
      } else if (openTime >= closeTime) {
        errors[index] = 'A abertura deve ser antes do fechamento.';
      }
    });
    return errors;
  }

  private setRows(items: WorkingHours[]): void {
    this.rowErrors.set({});
    this.rows.set(items.map((item) => this.createRow(item)));
  }

  private createRow(item: WorkingHours): DayRow {
    const row: DayRow = this.fb.group({
      dayOfWeek: this.fb.control<DayOfWeek>(item.dayOfWeek),
      open: this.fb.control(item.open),
      openTime: this.fb.control(item.openTime ? trimSeconds(item.openTime) : ''),
      closeTime: this.fb.control(item.closeTime ? trimSeconds(item.closeTime) : ''),
    });

    this.syncTimes(row);
    row.controls.open.valueChanges.subscribe((isOpen) => {
      const { openTime, closeTime } = row.controls;
      if (isOpen) {
        if (!openTime.value) {
          openTime.setValue(DEFAULT_OPEN_TIME, { emitEvent: false });
        }
        if (!closeTime.value) {
          closeTime.setValue(DEFAULT_CLOSE_TIME, { emitEvent: false });
        }
      }
      this.syncTimes(row);
    });

    return row;
  }

  /** Closed days disable the time inputs. */
  private syncTimes(row: DayRow): void {
    const { open, openTime, closeTime } = row.controls;
    if (open.value) {
      openTime.enable({ emitEvent: false });
      closeTime.enable({ emitEvent: false });
    } else {
      openTime.disable({ emitEvent: false });
      closeTime.disable({ emitEvent: false });
    }
  }
}