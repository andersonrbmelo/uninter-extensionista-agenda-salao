import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    computed,
    inject,
    input,
    signal,
  } from '@angular/core';
  import {
    AbstractControl,
    FormControl,
    FormGroup,
    NonNullableFormBuilder,
    ReactiveFormsModule,
    Validators,
  } from '@angular/forms';
  import { Router, RouterLink } from '@angular/router';
  import { Observable, forkJoin, of } from 'rxjs';
  
  import { apiErrorMessage } from '../../core/api-error';
  import { CatalogService } from '../../core/catalog.service';
  import {
    PriceOption,
    SalonService,
    ServiceRequest,
    StaffResponse,
  } from '../../core/models';
  import { StaffService } from '../../core/staff.service';
  import { Alert } from '../../shared/alert';
  
  type OptionGroup = FormGroup<{
    id: FormControl<number | null>;
    label: FormControl<string>;
    price: FormControl<number | null>;
    durationMinutes: FormControl<number | null>;
  }>;
  
  @Component({
    selector: 'app-service-form-page',
    imports: [ReactiveFormsModule, RouterLink, Alert],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
      <div class="mx-auto max-w-5xl px-4 py-6">
        <a routerLink="/admin/services" class="text-sm text-rose-600 hover:underline">
          &larr; Voltar para serviços
        </a>
        <h1 class="mt-2 text-2xl font-semibold text-slate-900">
          {{ isEdit() ? 'Editar serviço' : 'Novo serviço' }}
        </h1>
  
        @if (loading()) {
          <p class="mt-6 text-sm text-slate-500">Carregando...</p>
        } @else if (loadFailed()) {
          <div class="mt-6 space-y-3">
            <app-alert [message]="error()" />
            <button type="button" class="btn btn-secondary" (click)="load()">
              Tentar novamente
            </button>
          </div>
        } @else {
          <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="mt-6 space-y-6">
            @if (error()) {
              <app-alert [message]="error()" />
            }
  
            <section class="card space-y-4">
              <div>
                <label class="label" for="service-name">Nome</label>
                <input
                  id="service-name"
                  type="text"
                  class="input"
                  formControlName="name"
                  autocomplete="off"
                />
                @if (showError(form.controls.name)) {
                  <p class="mt-1 text-xs text-red-600">
                    Informe o nome do serviço (até 100 caracteres).
                  </p>
                }
              </div>
  
              <div>
                <label class="label" for="service-description">Descrição</label>
                <textarea
                  id="service-description"
                  rows="3"
                  class="input"
                  formControlName="description"
                ></textarea>
                @if (showError(form.controls.description)) {
                  <p class="mt-1 text-xs text-red-600">A descrição pode ter até 1000 caracteres.</p>
                }
              </div>
  
              <div>
                <label class="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    formControlName="active"
                    class="h-4 w-4 rounded border-slate-300 accent-rose-600"
                  />
                  Ativo
                </label>
                <p class="mt-1 text-xs text-slate-500">
                  Serviços inativos deixam de aparecer na lista e para os clientes.
                </p>
              </div>
            </section>
  
            <section class="card space-y-4">
              <h2 class="text-lg font-semibold text-slate-900">Opções de preço</h2>
  
              <div formArrayName="priceOptions" class="space-y-4">
                @for (group of options.controls; track group; let i = $index) {
                  <div
                    [formGroup]="group"
                    class="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_9rem_9rem_auto] sm:items-start"
                  >
                    <div>
                      <label class="label" [for]="'option-label-' + i">Rótulo</label>
                      <input
                        [id]="'option-label-' + i"
                        type="text"
                        class="input"
                        formControlName="label"
                        autocomplete="off"
                      />
                      @if (showError(group.controls.label)) {
                        <p class="mt-1 text-xs text-red-600">Informe o rótulo (até 100 caracteres).</p>
                      }
                    </div>
  
                    <div>
                      <label class="label" [for]="'option-price-' + i">Preço</label>
                      <input
                        [id]="'option-price-' + i"
                        type="number"
                        min="0"
                        step="0.01"
                        inputmode="decimal"
                        placeholder="R$"
                        class="input"
                        formControlName="price"
                      />
                      @if (showError(group.controls.price)) {
                        <p class="mt-1 text-xs text-red-600">Informe um preço maior ou igual a zero.</p>
                      }
                    </div>
  
                    <div>
                      <label class="label" [for]="'option-duration-' + i">Duração (min)</label>
                      <input
                        [id]="'option-duration-' + i"
                        type="number"
                        min="1"
                        step="1"
                        inputmode="numeric"
                        class="input"
                        formControlName="durationMinutes"
                      />
                      @if (showError(group.controls.durationMinutes)) {
                        <p class="mt-1 text-xs text-red-600">Informe minutos inteiros (mínimo 1).</p>
                      }
                    </div>
  
                    <div class="sm:pt-6">
                      <button
                        type="button"
                        class="btn btn-secondary w-full disabled:cursor-not-allowed disabled:opacity-60"
                        [disabled]="options.length === 1 || saving()"
                        (click)="removeOption(i)"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                }
              </div>
  
              <button
                type="button"
                class="btn btn-secondary disabled:cursor-not-allowed disabled:opacity-60"
                [disabled]="saving()"
                (click)="addOption()"
              >
                Adicionar opção
              </button>
            </section>
  
            <section class="card">
              <fieldset>
                <legend class="text-lg font-semibold text-slate-900">
                  Profissionais qualificados
                </legend>
  
                @if (sortedStaff().length === 0) {
                  <p class="mt-3 text-sm text-slate-500">Nenhum profissional cadastrado.</p>
                } @else {
                  <ul class="mt-3 grid gap-2 sm:grid-cols-2">
                    @for (member of sortedStaff(); track member.id) {
                      <li>
                        <label class="flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            class="h-4 w-4 rounded border-slate-300 accent-rose-600"
                            [checked]="selectedStaffIds().includes(member.id)"
                            (change)="onStaffChange(member.id, $event)"
                          />
                          {{ member.name }}
                        </label>
                      </li>
                    }
                  </ul>
                }
  
                @if (selectedStaffIds().length === 0) {
                  <p class="mt-3 text-xs text-slate-500">
                    Sem profissionais, ninguém poderá ser agendado para este serviço.
                  </p>
                }
              </fieldset>
            </section>
  
            <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <a routerLink="/admin/services" class="btn btn-secondary">Cancelar</a>
              <button
                type="submit"
                class="btn btn-primary disabled:cursor-not-allowed disabled:opacity-60"
                [disabled]="saving()"
              >
                {{ saving() ? 'Salvando...' : 'Salvar' }}
              </button>
            </div>
          </form>
        }
      </div>
    `,
  })
  export class ServiceFormPage implements OnInit {
    /** Route param `:id`; undefined on /admin/services/new. */
    readonly id = input<string>();
  
    private readonly fb = inject(NonNullableFormBuilder);
    private readonly catalog = inject(CatalogService);
    private readonly staffService = inject(StaffService);
    private readonly router = inject(Router);
  
    protected readonly isEdit = computed(() => this.id() !== undefined);
    protected readonly loading = signal(false);
    protected readonly loadFailed = signal(false);
    protected readonly saving = signal(false);
    protected readonly error = signal<string | null>(null);
  
    protected readonly staff = signal<StaffResponse[]>([]);
    protected readonly selectedStaffIds = signal<number[]>([]);
    protected readonly sortedStaff = computed(() =>
      [...this.staff()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    );
  
    protected readonly form = this.fb.group({
      name: this.fb.control('', [Validators.required, Validators.maxLength(100)]),
      description: this.fb.control('', [Validators.maxLength(1000)]),
      active: this.fb.control(true),
      priceOptions: this.fb.array<OptionGroup>([this.createOption()]),
    });
  
    protected get options() {
      return this.form.controls.priceOptions;
    }
  
    ngOnInit(): void {
      this.load();
    }
  
    protected load(): void {
      const rawId = this.id();
  
      if (rawId !== undefined && !Number.isInteger(Number(rawId))) {
        this.error.set('Serviço não encontrado.');
        this.loadFailed.set(true);
        return;
      }
  
      this.loading.set(true);
      this.loadFailed.set(false);
      this.error.set(null);
  
      const service$: Observable<SalonService | null> =
        rawId === undefined ? of(null) : this.catalog.get(Number(rawId));
  
      forkJoin({ staff: this.staffService.list(), service: service$ }).subscribe({
        next: ({ staff, service }) => {
          this.staff.set(staff);
          if (service) {
            this.fill(service);
          }
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(apiErrorMessage(err));
          this.loadFailed.set(true);
          this.loading.set(false);
        },
      });
    }
  
    protected showError(control: AbstractControl): boolean {
      return control.invalid && control.touched;
    }
  
    protected addOption(): void {
      this.options.push(this.createOption());
    }
  
    protected removeOption(index: number): void {
      if (this.options.length > 1) {
        this.options.removeAt(index);
      }
    }
  
    protected onStaffChange(staffId: number, event: Event): void {
      const checked = (event.target as HTMLInputElement).checked;
      this.selectedStaffIds.update((ids) => {
        if (checked) {
          return ids.includes(staffId) ? ids : [...ids, staffId];
        }
        return ids.filter((id) => id !== staffId);
      });
    }
  
    protected submit(): void {
      if (this.saving()) {
        return;
      }
  
      if (this.form.invalid) {
        this.form.markAllAsTouched();
        this.error.set('Verifique os campos destacados.');
        return;
      }
  
      const value = this.form.getRawValue();
      const description = value.description.trim();
  
      const request: ServiceRequest = {
        name: value.name.trim(),
        description: description === '' ? null : description,
        active: value.active,
        // Existing options keep their id, so the API updates them instead of recreating.
        priceOptions: value.priceOptions.map((option) => ({
          id: option.id,
          label: option.label.trim(),
          price: Number(option.price),
          durationMinutes: Number(option.durationMinutes),
        })),
        staffIds: this.selectedStaffIds(),
      };
  
      const rawId = this.id();
      const request$ =
        rawId === undefined
          ? this.catalog.create(request)
          : this.catalog.update(Number(rawId), request);
  
      this.saving.set(true);
      this.error.set(null);
      request$.subscribe({
        next: () => {
          this.saving.set(false);
          void this.router.navigate(['/admin/services']);
        },
        error: (err) => {
          this.error.set(apiErrorMessage(err));
          this.saving.set(false);
        },
      });
    }
  
    private fill(service: SalonService): void {
      this.form.patchValue({
        name: service.name,
        description: service.description ?? '',
        active: service.active,
      });
  
      // The API does not guarantee the order of the options: sort by price.
      const sorted = [...service.priceOptions].sort(
        (a, b) => a.price - b.price || a.durationMinutes - b.durationMinutes,
      );
      this.options.clear();
      sorted.forEach((option) => this.options.push(this.createOption(option)));
  
      this.selectedStaffIds.set(service.qualifiedStaff.map((member) => member.id));
    }
  
    private createOption(option?: PriceOption): OptionGroup {
      return this.fb.group({
        id: this.fb.control<number | null>(option?.id ?? null),
        label: this.fb.control(option?.label ?? '', [
          Validators.required,
          Validators.maxLength(100),
        ]),
        price: this.fb.control<number | null>(option?.price ?? null, [
          Validators.required,
          Validators.min(0),
        ]),
        durationMinutes: this.fb.control<number | null>(option?.durationMinutes ?? null, [
          Validators.required,
          Validators.min(1),
          Validators.pattern(/^[0-9]+$/),
        ]),
      });
    }
  }