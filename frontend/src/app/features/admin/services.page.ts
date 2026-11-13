import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { apiErrorMessage } from '../../core/api-error';
import { CatalogService } from '../../core/catalog.service';
import { formatMoney } from '../../core/format';
import { SalonService } from '../../core/models';
import { Alert } from '../../shared/alert';
import { ConfirmDialog } from '../../shared/confirm-dialog';

@Component({
  selector: 'app-services-page',
  imports: [RouterLink, Alert, ConfirmDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="px-4 py-6">
      <div class="flex items-center justify-between gap-3">
        <h1 class="text-2xl font-semibold text-slate-900">Serviços</h1>
        <a routerLink="/admin/services/new" class="btn btn-primary shrink-0">Novo serviço</a>
      </div>

      @if (actionError()) {
        <div class="mt-4">
          <app-alert [message]="actionError()" />
        </div>
      }

      @if (loading()) {
        <p class="mt-6 text-sm text-slate-500" role="status">Carregando serviços...</p>
      } @else if (error(); as message) {
        <div class="mt-6 space-y-3">
          <app-alert [message]="message" />
          <button type="button" class="btn btn-secondary" (click)="load()">
            Tentar novamente
          </button>
        </div>
      } @else if (services().length === 0) {
        <div class="card mt-6 text-center">
          <p class="text-slate-600">Nenhum serviço cadastrado.</p>
          <a routerLink="/admin/services/new" class="btn btn-primary mt-4">Novo serviço</a>
        </div>
      } @else {
        <ul class="mt-6 space-y-3">
          @for (service of services(); track service.id) {
            <li class="card space-y-4">
              <div class="min-w-0">
                <h2 class="break-words font-semibold text-slate-900">{{ service.name }}</h2>
                @if (service.description) {
                  <p class="mt-0.5 break-words text-sm text-slate-500">
                    {{ service.description }}
                  </p>
                }
                <p class="mt-2 text-sm text-slate-700">
                  {{ optionsLabel(service) }} · {{ priceRange(service) }}
                </p>
                <p class="mt-1 break-words text-sm text-slate-600">
                  <span class="font-medium">Profissionais:</span>
                  {{ staffLabel(service) }}
                </p>
              </div>

              <div class="grid grid-cols-2 gap-2">
                <a [routerLink]="['/admin/services', service.id]" class="btn btn-secondary">
                  Editar
                </a>
                <button type="button" class="btn btn-danger" (click)="askDelete(service)">
                  Excluir
                </button>
              </div>
            </li>
          }
        </ul>
      }
    </div>

    <app-confirm-dialog
      [open]="pendingDelete() !== null"
      title="Excluir serviço"
      [message]="deleteMessage()"
      confirmLabel="Excluir"
      cancelLabel="Voltar"
      tone="danger"
      [loading]="deleting()"
      (confirmed)="confirmDelete()"
      (cancelled)="cancelDelete()"
    />
  `,
})
export class ServicesPage implements OnInit {
  private readonly catalog = inject(CatalogService);

  protected readonly services = signal<SalonService[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly pendingDelete = signal<SalonService | null>(null);
  protected readonly deleting = signal(false);

  protected readonly deleteMessage = computed(() => {
    const service = this.pendingDelete();
    return service
      ? `O serviço "${service.name}" deixará de aparecer na lista e na tela de agendamento. Os agendamentos já feitos serão mantidos.`
      : '';
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.catalog.list().subscribe({
      next: (services) => {
        this.services.set(services);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(apiErrorMessage(err));
        this.loading.set(false);
      },
    });
  }

  protected optionsLabel(service: SalonService): string {
    const count = service.priceOptions.length;
    return count === 1 ? '1 opção' : `${count} opções`;
  }

  protected priceRange(service: SalonService): string {
    const prices = service.priceOptions.map((option) => option.price);
    if (prices.length === 0) {
      return '-';
    }
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return min === max ? formatMoney(min) : `${formatMoney(min)} a ${formatMoney(max)}`;
  }

  protected staffLabel(service: SalonService): string {
    return service.qualifiedStaff.length === 0
      ? 'Nenhum'
      : service.qualifiedStaff.map((member) => member.name).join(', ');
  }

  protected askDelete(service: SalonService): void {
    this.actionError.set(null);
    this.pendingDelete.set(service);
  }

  protected cancelDelete(): void {
    if (!this.deleting()) {
      this.pendingDelete.set(null);
    }
  }

  protected confirmDelete(): void {
    const service = this.pendingDelete();
    if (!service || this.deleting()) {
      return;
    }

    this.deleting.set(true);
    this.actionError.set(null);
    this.catalog.remove(service.id).subscribe({
      next: () => {
        this.services.update((list) => list.filter((item) => item.id !== service.id));
        this.pendingDelete.set(null);
        this.deleting.set(false);
      },
      error: (err) => {
        this.actionError.set(apiErrorMessage(err));
        this.pendingDelete.set(null);
        this.deleting.set(false);
      },
    });
  }
}